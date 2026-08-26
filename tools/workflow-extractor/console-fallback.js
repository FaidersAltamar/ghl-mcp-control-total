/**
 * Fallback manual: pega este script en la consola de DevTools del iframe de workflows.
 *
 * 1. Abre GHL en Chrome.
 * 2. Ve a Automation → Workflows.
 * 3. Haz clic derecho dentro del área de workflows → Inspect.
 * 4. Si la consola que se abre es del dominio wrapper (crm.dropi.co), busca el
 *    iframe con src que contenga "leadconnectorhq.com" y abre su consola
 *    (puedes usar el menú desplegable arriba a la izquierda de DevTools).
 * 5. Asegúrate de que node server.js esté corriendo.
 * 6. Pega este script completo y presiona Enter.
 */
(async () => {
  const BACKEND = 'https://backend.leadconnectorhq.com';
  const LOCAL_SERVER = 'http://localhost:8765/capture';

  // 1. Buscar token en localStorage, sessionStorage y cookies
  function getCookie(name) {
    const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
    return match ? decodeURIComponent(match[2]) : null;
  }

  let token = null;
  let tokenSource = '';

  const candidates = [
    { type: 'localStorage', key: 'refreshedToken' },
    { type: 'cookie', key: 'access-token-v2' },
    { type: 'cookie', key: 'm_a' },
    { type: 'cookie', key: 'custom-firebase-token' },
    { type: 'cookie', key: 'access-token-v1' },
    { type: 'cookie', key: 'refresh-token-v2' }
  ];

  for (const c of candidates) {
    let val = null;
    if (c.type === 'localStorage') val = localStorage.getItem(c.key);
    if (c.type === 'sessionStorage') val = sessionStorage.getItem(c.key);
    if (c.type === 'cookie') val = getCookie(c.key);

    if (val && val.startsWith('"')) val = JSON.parse(val);
    if (val && val.includes('.') && val.length > 50) {
      token = val;
      tokenSource = `${c.type}.${c.key}`;
      break;
    }
  }

  if (!token) {
    console.error('No se encontró token de sesión en localStorage, sessionStorage ni cookies.');
    return;
  }

  console.log('Token encontrado en:', tokenSource);

  // 2. Location ID
  const m = location.pathname.match(/\/location\/([^/]+)/);
  const locationId = m ? m[1] : null;
  if (!locationId) {
    console.error('No se pudo detectar locationId en la URL');
    return;
  }

  console.log('Location:', locationId);

  // 3. Helpers
  async function authedFetch(url, init = {}) {
    const headers = Object.assign({
      'token-id': token,
      'channel': 'APP',
      'accept': 'application/json, text/plain, */*'
    }, init.headers || {});
    const resp = await fetch(url, Object.assign({ method: 'GET', credentials: 'omit' }, init, { headers }));
    if (!resp.ok) throw new Error(`HTTP_${resp.status}`);
    return resp.json();
  }

  async function fetchAllWorkflows() {
    const out = [];
    let offset = 0;
    const limit = 100;
    for (let i = 0; i < 50; i++) {
      const url = `${BACKEND}/workflow/${locationId}/list?type=workflow&limit=${limit}&offset=${offset}&sortBy=name&sortOrder=asc&includeCustomObjects=true&includeObjectiveBuilder=true`;
      const data = await authedFetch(url);
      const rows = (data && data.rows) || [];
      out.push(...rows);
      if (rows.length < limit) break;
      offset += rows.length;
    }
    return out;
  }

  async function fetchDetail(id) {
    const url = `${BACKEND}/workflow/${locationId}/${id}?includeScheduledPauseInfo=true&sessionId=${crypto.randomUUID()}`;
    return authedFetch(url);
  }

  async function fetchTriggers(id) {
    const url = `${BACKEND}/workflow/${locationId}/trigger?workflowId=${id}`;
    return authedFetch(url);
  }

  // 4. Leer todo
  console.log('Cargando lista de workflows...');
  const list = await fetchAllWorkflows();
  console.log(`Total workflows encontrados: ${list.length}`);

  const workflows = [];
  for (let i = 0; i < list.length; i++) {
    const row = list[i];
    console.log(`[${i + 1}/${list.length}] ${row.name || '(sin nombre)'}`);
    try {
      const detail = await fetchDetail(row.id);
      const triggers = await fetchTriggers(row.id);
      workflows.push({ source: { workflowId: row.id, locationId }, workflow: detail, triggers });
    } catch (e) {
      console.warn('Error leyendo', row.id, e.message);
    }
  }

  // 5. Enviar
  const payload = { capturedAt: new Date().toISOString(), locationId, host: location.host, workflows };
  console.log('Enviando a OpenCode...');
  const resp = await fetch(LOCAL_SERVER, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const result = await resp.json();
  console.log('Resultado:', result);
  if (result.ok) {
    alert(`¡Listo! ${result.workflowCount} workflows enviados a OpenCode.`);
  }
})();
