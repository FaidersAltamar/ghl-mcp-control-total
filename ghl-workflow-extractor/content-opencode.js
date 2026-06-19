// Content script minimalista para enviar workflows de GHL a OpenCode/Claude Code.
(function () {
  if (window.__ghlOpenCodeContentLoaded) return;
  window.__ghlOpenCodeContentLoaded = true;

  const BACKEND = 'https://backend.leadconnectorhq.com';
  const LOCAL_SERVER = 'http://localhost:8765/capture';

  const state = {
    workflows: new Map(),
    folders: new Map(),
    token: null,
    locationId: null
  };

  // ---------- 1. Inyectar hook para capturar fetch/XHR ----------
  function injectHook() {
    const s = document.createElement('script');
    s.src = chrome.runtime.getURL('page-hook.js');
    s.onload = () => s.remove();
    (document.head || document.documentElement).appendChild(s);
  }
  injectHook();

  function detectLocationFromUrl() {
    const m = location.pathname.match(/\/location\/([^/]+)/);
    return m ? m[1] : null;
  }

  function getCookie(name) {
    const m = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return m ? decodeURIComponent(m[2]) : null;
  }

  function findSessionToken() {
    const candidates = [
      { type: 'localStorage', key: 'refreshedToken' },
      { type: 'cookie', key: 'access-token-v2' },
      { type: 'cookie', key: 'm_a' },
      { type: 'cookie', key: 'custom-firebase-token' },
      { type: 'cookie', key: 'access-token-v1' }
    ];
    for (const c of candidates) {
      let val = null;
      if (c.type === 'localStorage') val = localStorage.getItem(c.key);
      if (c.type === 'cookie') val = getCookie(c.key);
      if (val && val.startsWith('"')) val = JSON.parse(val);
      if (val && val.includes('.') && val.length > 50) return val;
    }
    return null;
  }

  function bootstrapToken() {
    const t = findSessionToken();
    if (t) state.token = t;
  }
  bootstrapToken();
  setInterval(bootstrapToken, 60_000);

  window.addEventListener('ghl-export:capture', (ev) => {
    const d = ev.detail || {};
    if (d.token) state.token = d.token;

    const locId = (d.match && d.match[1]) || detectLocationFromUrl();
    if (!locId) return;
    state.locationId = state.locationId || locId;

    if (d.kind === 'list' && d.body && Array.isArray(d.body.rows)) {
      for (const row of d.body.rows) {
        if (row.type === 'directory') {
          state.folders.set(row.id, { id: row.id, name: row.name, parentId: row.parentId });
        } else if (row.type === 'workflow') {
          const w = state.workflows.get(row.id) || {};
          w.meta = row;
          state.workflows.set(row.id, w);
        }
      }
    } else if (d.kind === 'detail' && d.body && d.body._id) {
      const w = state.workflows.get(d.body._id) || {};
      w.detail = d.body;
      state.workflows.set(d.body._id, w);
    } else if (d.kind === 'trigger' && Array.isArray(d.body)) {
      const wfId = d.match && d.match[2];
      if (wfId) {
        const w = state.workflows.get(wfId) || {};
        w.triggers = d.body;
        state.workflows.set(wfId, w);
      }
    }
  });

  // ---------- 2. Cliente HTTP autenticado ----------
  async function authedFetch(url, init = {}) {
    if (!state.token) throw new Error('NO_TOKEN');
    const headers = Object.assign({
      'token-id': state.token,
      'channel': 'APP',
      'accept': 'application/json, text/plain, */*'
    }, init.headers || {});
    const resp = await fetch(url, Object.assign({ method: 'GET', credentials: 'omit' }, init, { headers }));
    if (!resp.ok) throw new Error(`HTTP_${resp.status}`);
    return resp.json();
  }

  async function fetchAllWorkflows(locationId) {
    const out = [];
    let offset = 0;
    const limit = 100;
    for (let safety = 0; safety < 50; safety++) {
      const url = `${BACKEND}/workflow/${locationId}/list?type=workflow&limit=${limit}&offset=${offset}&sortBy=name&sortOrder=asc&includeCustomObjects=true&includeObjectiveBuilder=true`;
      const data = await authedFetch(url);
      const rows = (data && data.rows) || [];
      out.push(...rows);
      if (rows.length < limit) break;
      offset += rows.length;
    }
    return out;
  }

  async function fetchWorkflowDetail(locationId, workflowId) {
    const url = `${BACKEND}/workflow/${locationId}/${workflowId}?includeScheduledPauseInfo=true&sessionId=${crypto.randomUUID()}`;
    return authedFetch(url);
  }

  async function fetchTriggers(locationId, workflowId) {
    const url = `${BACKEND}/workflow/${locationId}/trigger?workflowId=${workflowId}`;
    return authedFetch(url);
  }

  // ---------- 3. UI: botón "Enviar a OpenCode" ----------
  function showToast(message, type = 'info', sticky = false) {
    let el = document.getElementById('ghl-opencode-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'ghl-opencode-toast';
      el.style.cssText = 'position:fixed;top:16px;right:16px;z-index:99999;padding:12px 18px;border-radius:8px;font-family:sans-serif;font-size:14px;font-weight:600;box-shadow:0 4px 12px rgba(0,0,0,0.15);transition:opacity 0.3s;';
      document.body.appendChild(el);
    }
    el.style.background = type === 'error' ? '#fee2e2' : (type === 'success' ? '#dcfce7' : '#e0e7ff');
    el.style.color = type === 'error' ? '#991b1b' : (type === 'success' ? '#166534' : '#3730a3');
    el.textContent = message;
    el.style.opacity = '1';
    if (!sticky) {
      setTimeout(() => { el.style.opacity = '0'; }, 4000);
    }
  }

  async function onSendClick() {
    const locationId = state.locationId || detectLocationFromUrl();
    if (!locationId) return showToast('No se detectó locationId. Recarga la página.', 'error');
    if (!state.token) return showToast('No hay token. Abre al menos un workflow primero.', 'error');

    showToast('Leyendo workflows...', 'info', true);
    try {
      const list = await fetchAllWorkflows(locationId);
      for (const row of list) {
        const w = state.workflows.get(row.id) || {};
        w.meta = row;
        state.workflows.set(row.id, w);
      }

      const workflowIds = Array.from(state.workflows.keys());
      let done = 0;
      for (const id of workflowIds) {
        const w = state.workflows.get(id);
        if (!w.detail) w.detail = await fetchWorkflowDetail(locationId, id);
        if (!w.triggers) w.triggers = await fetchTriggers(locationId, id);
        done++;
        if (done % 5 === 0) showToast(`Cargando ${done}/${workflowIds.length} workflows...`, 'info', true);
      }

      const payload = {
        capturedAt: new Date().toISOString(),
        locationId,
        host: location.host,
        workflows: workflowIds.map(id => {
          const w = state.workflows.get(id);
          return {
            source: { workflowId: id, locationId },
            workflow: w.detail || {},
            triggers: w.triggers || []
          };
        })
      };

      showToast('Enviando a OpenCode...', 'info', true);
      const resp = await fetch(LOCAL_SERVER, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const result = await resp.json();
      if (result.ok) {
        showToast(`¡Enviado! ${result.workflowCount} workflows en workflows-live.json`, 'success');
      } else {
        showToast('Error del servidor local: ' + result.error, 'error');
      }
    } catch (err) {
      console.error('[GHL OpenCode]', err);
      showToast('Error: ' + err.message, 'error');
    }
  }

  function addButton() {
    if (document.getElementById('ghl-opencode-btn')) return;
    // El botón "Create Workflow" suele estar cerca del header de la tabla.
    const createBtn = Array.from(document.querySelectorAll('button')).find(b =>
      /create workflow|crear workflow|create new workflow/i.test(b.textContent || '')
    );
    if (!createBtn) return;

    const btn = document.createElement('button');
    btn.id = 'ghl-opencode-btn';
    btn.textContent = 'Enviar a OpenCode';
    btn.style.cssText = 'margin-left:12px;padding:8px 16px;border-radius:6px;background:#3730a3;color:#fff;border:none;font-weight:600;cursor:pointer;';
    btn.addEventListener('click', onSendClick);
    createBtn.parentNode.insertBefore(btn, createBtn.nextSibling);
  }

  // Intentar añadir el botón cada segundo hasta que aparezca el DOM
  const interval = setInterval(addButton, 1000);
  setTimeout(() => clearInterval(interval), 30000);
})();
