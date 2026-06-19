// Isolated-world content script. Responsibilities:
//   1. Inject page-hook.js into MAIN world
//   2. Listen for capture events from the hook
//   3. Maintain in-memory cache + token
//   4. Inject "Export ▾" toolbar button when workflows list is on screen
//   5. On click: build envelopes (using cache + active fallback) and ship to BG
(function () {
  if (window.__ghlExporterContentLoaded) return;
  window.__ghlExporterContentLoaded = true;

  const BACKEND = 'https://backend.leadconnectorhq.com';
  const HOST = 'client-app-automation-workflows.leadconnectorhq.com';
  const EXPORTER = { name: 'ghl-workflow-exporter', version: '0.1.0' };

  // ---------- 1. Inject page hook ----------
  function injectHook() {
    try {
      const s = document.createElement('script');
      s.src = chrome.runtime.getURL('page-hook.js');
      s.onload = function () { this.remove(); };
      (document.head || document.documentElement).appendChild(s);
    } catch (e) {
      console.warn('[GHL Exporter] hook injection failed', e);
    }
  }
  injectHook();

  // ---------- 2. Cache ----------
  // state.workflowsByLocation: locationId -> {
  //   folders: Map<folderId, {id, name, parentId}>,
  //   workflows: Map<workflowId, { meta?, detail?, triggers? }>
  // }
  const state = {
    workflowsByLocation: new Map(),
    latestToken: null,
    currentLocationId: null
  };

  function loc(id) {
    if (!state.workflowsByLocation.has(id)) {
      state.workflowsByLocation.set(id, { folders: new Map(), workflows: new Map() });
    }
    return state.workflowsByLocation.get(id);
  }
  function wf(locationId, workflowId) {
    const L = loc(locationId);
    if (!L.workflows.has(workflowId)) L.workflows.set(workflowId, {});
    return L.workflows.get(workflowId);
  }

  function detectLocationFromUrl() {
    const m = location.pathname.match(/\/location\/([^/]+)/);
    return m ? m[1] : null;
  }

  function handleCapture(ev) {
    const d = ev.detail || {};
    if (d.token) state.latestToken = d.token;

    if (d.kind === 'token-bootstrap') return;

    const locId = (d.match && d.match[1]) || detectLocationFromUrl();
    if (!locId) return;
    state.currentLocationId = state.currentLocationId || locId;

    if (d.kind === 'list' && d.body && Array.isArray(d.body.rows)) {
      for (const row of d.body.rows) {
        if (row.type === 'directory') {
          loc(locId).folders.set(row.id, { id: row.id, name: row.name, parentId: row.parentId });
        } else if (row.type === 'workflow') {
          const w = wf(locId, row.id);
          w.meta = row;
        }
      }
    } else if (d.kind === 'detail' && d.body && d.body._id) {
      const w = wf(locId, d.body._id);
      w.detail = d.body;
      if (!w.meta) {
        w.meta = {
          id: d.body._id, name: d.body.name, parentId: d.body.parentId,
          status: d.body.status, type: 'workflow', locationId: locId
        };
      }
    } else if (d.kind === 'trigger' && Array.isArray(d.body)) {
      const wfId = d.match && d.match[2];
      if (wfId) wf(locId, wfId).triggers = d.body;
    }
  }
  window.addEventListener('ghl-export:capture', handleCapture);

  // Fallback: read token from localStorage on load
  function bootstrapToken() {
    try {
      const t = localStorage.getItem('refreshedToken');
      if (!t) return;
      state.latestToken = t.startsWith('"') ? JSON.parse(t) : t;
    } catch (_) {}
  }
  bootstrapToken();
  // Re-bootstrap periodically in case token rotates
  setInterval(bootstrapToken, 60_000);

  // ---------- 3. Active API client ----------
  async function authedFetch(url, attempt = 0, init = null) {
    if (!state.latestToken) throw new Error('NO_TOKEN');
    const headers = Object.assign({
      'token-id': state.latestToken,
      'channel': 'APP',
      'accept': 'application/json, text/plain, */*'
    }, (init && init.headers) || {});
    const opts = Object.assign({ method: 'GET', credentials: 'omit' }, init || {}, { headers });
    const resp = await fetch(url, opts);
    if (resp.status === 401) throw new Error('UNAUTHORIZED');
    if (resp.status === 429 && attempt < 3) {
      const wait = (2 ** attempt) * 1000 + Math.random() * 250;
      await new Promise(r => setTimeout(r, wait));
      return authedFetch(url, attempt + 1, init);
    }
    if (!resp.ok) throw new Error(`HTTP_${resp.status}`);
    return resp.json();
  }

  async function fetchAllWorkflows(locationId) {
    // /list?type=workflow returns workflows only (no folders), paginated.
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

  async function fetchAllFolders(locationId) {
    // /list?parentId=root for folders only.
    const url = `${BACKEND}/workflow/${locationId}/list?parentId=root&limit=200&offset=0&sortBy=name&sortOrder=asc&includeCustomObjects=true&includeObjectiveBuilder=true`;
    const data = await authedFetch(url);
    return ((data && data.rows) || []).filter(r => r.type === 'directory');
  }

  async function fetchWorkflowDetail(locationId, workflowId) {
    const url = `${BACKEND}/workflow/${locationId}/${workflowId}?includeScheduledPauseInfo=true&sessionId=${crypto.randomUUID()}`;
    return authedFetch(url);
  }
  async function fetchTriggers(locationId, workflowId) {
    const url = `${BACKEND}/workflow/${locationId}/trigger?workflowId=${workflowId}`;
    return authedFetch(url);
  }

  // ---------- 3b. Write API (import) ----------
  function decodeJwtUserInfo() {
    try {
      const t = state.latestToken;
      if (!t) return {};
      const payload = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
      return {
        userId: payload.user_id || payload.sub || null,
        companyId: payload.company_id || null
      };
    } catch (_) { return {}; }
  }

  async function createFolder(locationId, name, parentId) {
    const { userId, companyId } = decodeJwtUserInfo();
    const body = {
      type: 'directory',
      name,
      updatedBy: userId,
      parentId: parentId || null,
      company_id: companyId,
      company_age: 0
    };
    return authedFetch(`${BACKEND}/workflow/${locationId}/directory`, 0, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async function listFolders(locationId) {
    const url = `${BACKEND}/workflow/${locationId}/list?parentId=root&limit=200&offset=0&sortBy=name&sortOrder=asc&includeCustomObjects=true&includeObjectiveBuilder=true`;
    const data = await authedFetch(url);
    return ((data && data.rows) || []).filter(r => r.type === 'directory');
  }

  // Given a list of source folder descriptors (id, name, parentId), ensure they
  // all exist in the target location. Returns Map<sourceFolderId, targetFolderId>.
  // Reuses folders that already exist (matched by name at the same depth).
  async function ensureFolders(locationId, sourceFolders, onProgress) {
    const map = new Map(); // sourceId -> targetId
    if (!sourceFolders || !sourceFolders.length) return map;

    // Snapshot existing folders in the target so we can match by name.
    const existing = await listFolders(locationId);
    const existingByName = new Map();
    for (const f of existing) existingByName.set((f.name || '').toLowerCase(), f.id);

    // Topo-sort by parent-first.
    const byId = new Map();
    for (const f of sourceFolders) if (f && f.id) byId.set(f.id, f);
    const ordered = [];
    const visited = new Set();
    function visit(id) {
      if (visited.has(id) || !byId.has(id)) return;
      visited.add(id);
      const f = byId.get(id);
      if (f.parentId && byId.has(f.parentId)) visit(f.parentId);
      ordered.push(f);
    }
    for (const f of sourceFolders) visit(f.id);

    let done = 0;
    for (const src of ordered) {
      onProgress && onProgress(`Folder ${++done}/${ordered.length}: ${src.name}`);
      const name = src.name || `(unnamed folder)`;
      const key = name.toLowerCase();
      if (existingByName.has(key)) {
        map.set(src.id, existingByName.get(key));
        continue;
      }
      // Resolve parent: if source has a mapped parent, use mapped target; else root.
      const parent = (src.parentId && map.get(src.parentId)) || null;
      try {
        const r = await createFolder(locationId, name, parent);
        if (r && r.id) {
          map.set(src.id, r.id);
          existingByName.set(key, r.id);
          loc(locationId).folders.set(r.id, { id: r.id, name, parentId: parent });
        }
      } catch (e) {
        console.warn('[GHL Exporter] folder create failed', name, e);
      }
    }
    return map;
  }

  async function createEmptyWorkflow(locationId, name, parentId) {
    const { userId, companyId } = decodeJwtUserInfo();
    const body = {
      name: name || `Imported Workflow ${Date.now()}`,
      status: 'draft',
      parentId: parentId || null,
      updatedBy: userId,
      modifiedSteps: [],
      deletedSteps: [],
      createdSteps: [],
      senderAddress: {},
      stopOnResponse: false,
      allowMultiple: true,
      allowMultipleOpportunity: true,
      autoMarkAsRead: false,
      eventStartDate: '',
      timezone: '',
      workflowData: { templates: [] },
      triggersChanged: false,
      company_id: companyId,
      company_age: 0
    };
    return authedFetch(`${BACKEND}/workflow/${locationId}`, 0, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async function createTrigger(locationId, newWorkflowId, srcTrigger) {
    const { companyId } = decodeJwtUserInfo();
    const body = {
      status: 'draft',
      workflowId: newWorkflowId,
      schedule_config: srcTrigger.schedule_config || {},
      conditions: srcTrigger.conditions || [],
      type: srcTrigger.type,
      masterType: srcTrigger.masterType || 'highlevel',
      name: srcTrigger.name,
      actions: [{ workflow_id: newWorkflowId, type: 'add_to_workflow' }],
      active: srcTrigger.active !== false,
      triggersChanged: true,
      location_id: locationId,
      company_id: companyId,
      company_age: 0
    };
    return authedFetch(`${BACKEND}/workflow/${locationId}/trigger`, 0, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async function saveWorkflowSteps(locationId, freshEnvelope, templates, newTriggers) {
    // freshEnvelope is the GET response for the just-created empty workflow.
    const stepIds = templates.map(t => t.id);
    const body = Object.assign({}, freshEnvelope, {
      workflowData: { templates },
      modifiedSteps: [],
      deletedSteps: [],
      createdSteps: stepIds,
      senderAddress: {},
      eventStartDate: freshEnvelope.eventStartDate || '',
      triggersChanged: newTriggers.length > 0,
      oldTriggers: [],
      newTriggers,
      isAutoSave: true,
      autoSaveSession: {
        workflowId: freshEnvelope._id,
        id: crypto.randomUUID(),
        userId: decodeJwtUserInfo().userId,
        version: freshEnvelope.version || 1
      }
    });
    return authedFetch(`${BACKEND}/workflow/${locationId}/${freshEnvelope._id}/auto-save`, 0, {
      method: 'PUT',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(body)
    });
  }

  async function importWorkflowEnvelope(locationId, envelope, onProgress, folderMap) {
    const wfSrc = envelope.workflow || {};
    const triggersSrc = envelope.triggers || [];
    const targetName = (wfSrc.name || 'Imported Workflow') + (envelope.__nameSuffix || '');

    // Resolve target parentId via the folder map built in performImport.
    let targetParentId = null;
    const srcFolder = envelope.source && envelope.source.folder;
    if (srcFolder && srcFolder.id && folderMap && folderMap.has(srcFolder.id)) {
      targetParentId = folderMap.get(srcFolder.id);
    }

    onProgress && onProgress('Creating shell…');
    const created = await createEmptyWorkflow(locationId, targetName, targetParentId);
    const newId = created && created.id;
    if (!newId) throw new Error('CREATE_FAILED');

    onProgress && onProgress('Fetching shell envelope…');
    const fresh = await fetchWorkflowDetail(locationId, newId);

    onProgress && onProgress(`Creating ${triggersSrc.length} trigger(s)…`);
    const newTriggers = [];
    for (const t of triggersSrc) {
      try {
        const r = await createTrigger(locationId, newId, t);
        newTriggers.push({
          status: 'draft',
          workflowId: newId,
          schedule_config: t.schedule_config || {},
          conditions: t.conditions || [],
          type: t.type,
          masterType: t.masterType || 'highlevel',
          name: t.name,
          actions: [{ workflow_id: newId, type: 'add_to_workflow' }],
          active: t.active !== false,
          id: r && r.id,
          location_id: locationId
        });
      } catch (e) {
        console.warn('[GHL Exporter] trigger create failed', e);
      }
    }

    const templates = (wfSrc.workflowData && Array.isArray(wfSrc.workflowData.templates))
      ? JSON.parse(JSON.stringify(wfSrc.workflowData.templates))
      : [];

    if (templates.length === 0 && newTriggers.length === 0) {
      return { newId, warning: 'Empty workflow (no steps, no triggers).' };
    }

    onProgress && onProgress(`Saving ${templates.length} step(s)…`);
    await saveWorkflowSteps(locationId, fresh, templates, newTriggers);

    return { newId, name: targetName, stepCount: templates.length, triggerCount: newTriggers.length };
  }

  // ---------- 4. Build envelopes ----------
  function folderInfo(locationId, parentId) {
    if (!parentId) return null;
    const f = loc(locationId).folders.get(parentId);
    if (!f) return { id: parentId, name: null, parentId: null };
    return { id: f.id, name: f.name, parentId: f.parentId || null };
  }

  function envelopeSingle(locationId, w) {
    const parentId = (w.detail && w.detail.parentId) || (w.meta && w.meta.parentId) || null;
    return {
      '$schema': 'ghl-workflow-export/v1',
      exportedAt: new Date().toISOString(),
      exporter: EXPORTER,
      source: {
        locationId,
        workflowId: w.detail._id,
        host: HOST,
        folder: folderInfo(locationId, parentId)
      },
      workflow: w.detail,
      triggers: w.triggers || []
    };
  }
  function envelopeCombined(locationId, items) {
    // Collect all folders that hold these workflows, plus their ancestors (best-effort).
    const folderIds = new Set();
    for (const w of items) {
      const pid = (w.detail && w.detail.parentId) || (w.meta && w.meta.parentId);
      if (pid) folderIds.add(pid);
    }
    // Walk ancestors so the import side can rebuild nesting
    const L = loc(locationId);
    const queue = [...folderIds];
    while (queue.length) {
      const id = queue.shift();
      const f = L.folders.get(id);
      if (f && f.parentId && !folderIds.has(f.parentId)) {
        folderIds.add(f.parentId);
        queue.push(f.parentId);
      }
    }
    const folders = [...folderIds].map(id => folderInfo(locationId, id)).filter(Boolean);

    return {
      '$schema': 'ghl-workflow-export/v1',
      exportedAt: new Date().toISOString(),
      exporter: EXPORTER,
      folders,
      workflows: items.map(w => ({
        source: {
          locationId,
          workflowId: w.detail._id,
          host: HOST,
          folder: folderInfo(locationId, (w.detail && w.detail.parentId) || (w.meta && w.meta.parentId) || null)
        },
        workflow: w.detail,
        triggers: w.triggers || []
      }))
    };
  }

  function slugify(s) {
    return String(s || 'untitled')
      .normalize('NFKD').replace(/[̀-ͯ]/g, '')
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .replace(/-+/g, '-')
      .toLowerCase()
      .substring(0, 80) || 'untitled';
  }

  // ---------- 5. Export orchestration ----------
  async function resolveWorkflows(locationId, workflowIds, onProgress) {
    const L = loc(locationId);
    const total = workflowIds.length;
    let done = 0;
    onProgress && onProgress({ done, total, message: 'Preparing…' });

    const results = [];
    const errors = [];
    for (const id of workflowIds) {
      const w = wf(locationId, id);
      try {
        if (!w.detail) w.detail = await fetchWorkflowDetail(locationId, id);
        if (!w.triggers) w.triggers = await fetchTriggers(locationId, id);
        results.push(w);
      } catch (e) {
        errors.push({ workflowId: id, error: String(e && e.message || e) });
      }
      done++;
      onProgress && onProgress({ done, total, message: `Fetching ${done}/${total}` });
    }
    return { results, errors };
  }

  async function performExport({ scope, format }) {
    const locationId = state.currentLocationId || detectLocationFromUrl();
    if (!locationId) return showToast('Could not detect locationId', 'error');
    if (!state.latestToken) return showToast('No auth token captured — open at least one workflow first, then retry.', 'error');

    let workflowIds;
    if (scope === 'selected') {
      const raw = readSelectedIds();
      if (!raw.length) return showToast('Nothing selected. Tick a workflow or folder first.', 'error');
      const expandToast = showToast('Resolving selection…', 'info', true);
      try {
        workflowIds = await resolveSelectedToWorkflowIds(locationId, raw, (msg) => expandToast.update(msg, 0, 1));
      } catch (e) {
        expandToast.close();
        return showToast(`Could not resolve selection: ${e.message}`, 'error');
      }
      expandToast.close();
      if (!workflowIds.length) return showToast('Selected folder(s) contained no workflows.', 'error');
    } else {
      // ALL: ensure we have folder + workflow lists fresh
      try {
        const folders = await fetchAllFolders(locationId);
        for (const f of folders) loc(locationId).folders.set(f.id, { id: f.id, name: f.name, parentId: f.parentId });
        const all = await fetchAllWorkflows(locationId);
        for (const row of all) {
          const w = wf(locationId, row.id);
          w.meta = row;
        }
        workflowIds = all.map(r => r.id);
      } catch (e) {
        return showToast(`Failed to enumerate workflows: ${e.message}`, 'error');
      }
    }
    if (!workflowIds.length) return showToast('Nothing to export.', 'error');

    const toast = showToast('Starting export…', 'info', true);
    const { results, errors } = await resolveWorkflows(locationId, workflowIds, ({ done, total, message }) => {
      toast.update(`${message}…`, done, total);
    });

    if (!results.length) {
      toast.close();
      return showToast('Export failed: no workflows could be fetched.', 'error');
    }

    // Build payload + folder map (for ZIP layout)
    const L = loc(locationId);
    const folderMap = {};
    for (const [id, f] of L.folders.entries()) folderMap[id] = f.name;

    const payload = {
      kind: 'export',
      format,
      scope,
      locationId,
      folderMap,
      results: results.map(w => ({
        envelope: envelopeSingle(locationId, w),
        meta: w.meta || { id: w.detail._id, name: w.detail.name, parentId: w.detail.parentId }
      })),
      errors,
      combinedEnvelope: format === 'json' ? envelopeCombined(locationId, results) : null
    };
    chrome.runtime.sendMessage(payload, (resp) => {
      toast.close();
      if (chrome.runtime.lastError) {
        showToast(`Download error: ${chrome.runtime.lastError.message}`, 'error');
        return;
      }
      if (resp && resp.ok) {
        const msg = errors.length
          ? `Exported ${results.length}/${results.length + errors.length} (${errors.length} failed).`
          : `Exported ${results.length} workflow${results.length === 1 ? '' : 's'}.`;
        showToast(msg, 'success');
      } else {
        showToast(`Export failed: ${resp && resp.error || 'unknown'}`, 'error');
      }
    });
  }

  // ---------- 5b. Import orchestration ----------
  async function performImport() {
    const locationId = state.currentLocationId || detectLocationFromUrl();
    if (!locationId) return showToast('Could not detect locationId', 'error');
    if (!state.latestToken) return showToast('No auth token captured — open at least one workflow first, then retry.', 'error');

    // File picker
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,.zip,application/json,application/zip';
    input.multiple = false;
    input.style.display = 'none';
    document.body.appendChild(input);
    const files = await new Promise((resolve) => {
      input.onchange = () => resolve(Array.from(input.files || []));
      input.click();
    });
    input.remove();
    if (!files.length) return;
    const file = files[0];

    const allEnvelopes = await parseImportFile(file);
    if (!allEnvelopes.length) {
      return showToast('No workflows found in file.', 'error');
    }

    // Single-workflow file → simple confirm. Multiple → selection modal.
    let envelopes;
    if (allEnvelopes.length === 1) {
      const wfName = (allEnvelopes[0].workflow && allEnvelopes[0].workflow.name) || '(unnamed)';
      if (!confirm(`Import workflow "${wfName}" into this location?`)) return;
      envelopes = allEnvelopes;
    } else {
      envelopes = await showImportSelectionModal(allEnvelopes, file.name);
      if (!envelopes || !envelopes.length) return;
    }

    const toast = showToast('Starting import…', 'info', true);

    // Pre-pass: collect distinct source folders from envelopes (+ any top-level
    // folders[] hint from a combined JSON envelope).
    const folderById = new Map();
    function addFolder(f) {
      if (!f || !f.id || !f.name) return;
      if (!folderById.has(f.id)) folderById.set(f.id, { id: f.id, name: f.name, parentId: f.parentId || null });
    }
    for (const env of envelopes) {
      const f = env.source && env.source.folder;
      addFolder(f);
      // Also pull from the combined envelope's __folders__ pass-through if present
      if (env.__folders) for (const ff of env.__folders) addFolder(ff);
    }

    let folderMap = new Map();
    if (folderById.size > 0) {
      toast.update(`Preparing ${folderById.size} folder(s)…`, 0, 1);
      try {
        folderMap = await ensureFolders(locationId, [...folderById.values()], (msg) => toast.update(msg, 0, 1));
      } catch (e) {
        console.error('[GHL Exporter] folder pre-creation failed', e);
        showToast(`Folder creation failed: ${e.message}. Continuing without folders.`, 'error');
      }
    }

    const results = [];
    const errors = [];
    for (let i = 0; i < envelopes.length; i++) {
      const env = envelopes[i];
      const wfName = (env.workflow && env.workflow.name) || `Workflow ${i + 1}`;
      toast.update(`Importing ${i + 1}/${envelopes.length}: ${wfName}`, i, envelopes.length);
      try {
        const r = await importWorkflowEnvelope(locationId, env, (msg) => {
          toast.update(`(${i + 1}/${envelopes.length}) ${wfName} — ${msg}`, i, envelopes.length);
        }, folderMap);
        results.push(r);
      } catch (e) {
        console.error('[GHL Exporter] import failed', wfName, e);
        errors.push({ name: wfName, error: String(e && e.message || e) });
      }
    }
    toast.close();

    if (errors.length === 0) {
      showToast(`Imported ${results.length} workflow${results.length === 1 ? '' : 's'}. Reloading…`, 'success');
      setTimeout(() => {
        // Reload the top-level (white-label) page so the workflow list re-fetches
        // from scratch. window.location.reload() inside the iframe also works
        // because GHL re-renders the list on iframe load.
        try { window.top.location.reload(); }
        catch (_) { window.location.reload(); }
      }, 1500);
    } else if (results.length > 0) {
      showToast(`Imported ${results.length}/${results.length + errors.length}. ${errors.length} failed (see console). Reloading…`, 'error');
      setTimeout(() => {
        try { window.top.location.reload(); }
        catch (_) { window.location.reload(); }
      }, 3000);
    } else {
      showToast(`Import failed: ${errors[0] && errors[0].error || 'unknown'}`, 'error');
    }
  }

  async function parseImportFile(file) {
    if (file.name.toLowerCase().endsWith('.json') || file.type === 'application/json') {
      const text = await file.text();
      const parsed = JSON.parse(text);
      return normalizeEnvelopes(parsed);
    }
    if (file.name.toLowerCase().endsWith('.zip') || file.type === 'application/zip') {
      // Delegate to the service worker which has JSZip loaded
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let bin = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
      const b64 = btoa(bin);
      const resp = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ kind: 'parse-zip', dataB64: b64 }, resolve);
      });
      if (!resp || !resp.ok) throw new Error((resp && resp.error) || 'ZIP parse failed');
      const out = [];
      const indexFolders = (resp.index && Array.isArray(resp.index.folders)) ? resp.index.folders : [];
      for (const f of resp.files) {
        try {
          const parsed = JSON.parse(f.content);
          const envs = normalizeEnvelopes(parsed);
          // For per-file envelopes that lack folder info, fall back to _index.json
          for (const e of envs) {
            if (!e.__folders) e.__folders = indexFolders;
            if (!(e.source && e.source.folder) && indexFolders.length) {
              // Try to find folder by id matched against the workflow's parentId
              const pid = e.workflow && e.workflow.parentId;
              if (pid) {
                const m = indexFolders.find(ff => ff.id === pid);
                if (m) {
                  e.source = Object.assign({}, e.source || {}, { folder: { id: m.id, name: m.name, parentId: m.parentId || null } });
                }
              }
            }
          }
          out.push(...envs);
        } catch (_) {}
      }
      return out;
    }
    throw new Error(`Unsupported file type: ${file.name}`);
  }

  function showImportSelectionModal(envelopes, fileName) {
    return new Promise((resolve) => {
      const overlay = document.createElement('div');
      overlay.className = 'ghl-import-overlay';

      const modal = document.createElement('div');
      modal.className = 'ghl-import-modal';

      // Header
      const header = document.createElement('div');
      header.className = 'ghl-import-header';
      header.innerHTML = `
        <div>
          <div class="ghl-import-title">Import workflows</div>
          <div class="ghl-import-subtitle">${escapeHtml(fileName)} — ${envelopes.length} workflow${envelopes.length === 1 ? '' : 's'} detected</div>
        </div>
        <button type="button" class="ghl-import-close" aria-label="Close">×</button>
      `;
      modal.appendChild(header);

      // Toolbar (select all / search)
      const toolbar = document.createElement('div');
      toolbar.className = 'ghl-import-toolbar';
      toolbar.innerHTML = `
        <input type="text" class="ghl-import-search" placeholder="Filter by name…" />
        <button type="button" class="ghl-import-link" data-act="all">Select all</button>
        <button type="button" class="ghl-import-link" data-act="none">Deselect all</button>
      `;
      modal.appendChild(toolbar);

      // List
      const list = document.createElement('div');
      list.className = 'ghl-import-list';
      const rows = envelopes.map((env, idx) => {
        const wf = env.workflow || {};
        const name = wf.name || `(unnamed #${idx + 1})`;
        const stepCount = (wf.workflowData && Array.isArray(wf.workflowData.templates))
          ? wf.workflowData.templates.length : 0;
        const trigCount = Array.isArray(env.triggers) ? env.triggers.length : 0;
        const folderName = (env.source && env.source.folder && env.source.folder.name) || null;

        const row = document.createElement('label');
        row.className = 'ghl-import-row';
        row.innerHTML = `
          <input type="checkbox" class="ghl-import-checkbox" checked data-idx="${idx}" />
          <div class="ghl-import-row-body">
            <div class="ghl-import-row-name"></div>
            <div class="ghl-import-row-meta">${stepCount} step${stepCount === 1 ? '' : 's'} • ${trigCount} trigger${trigCount === 1 ? '' : 's'}${folderName ? ' • <span class="ghl-import-folder">📁 ' + escapeHtml(folderName) + '</span>' : ''}</div>
          </div>
        `;
        row.querySelector('.ghl-import-row-name').textContent = name;
        list.appendChild(row);
        return { row, name: name.toLowerCase(), idx };
      });
      modal.appendChild(list);

      // Footer
      const footer = document.createElement('div');
      footer.className = 'ghl-import-footer';
      footer.innerHTML = `
        <div class="ghl-import-count"></div>
        <div class="ghl-import-actions">
          <button type="button" class="ghl-import-btn ghl-import-btn--ghost" data-act="cancel">Cancel</button>
          <button type="button" class="ghl-import-btn ghl-import-btn--primary" data-act="import">Import 0</button>
        </div>
      `;
      modal.appendChild(footer);

      overlay.appendChild(modal);
      document.body.appendChild(overlay);

      // State + behaviors
      const checkboxes = list.querySelectorAll('.ghl-import-checkbox');
      const importBtn = footer.querySelector('[data-act="import"]');
      const countEl = footer.querySelector('.ghl-import-count');

      function refreshCount() {
        const n = list.querySelectorAll('.ghl-import-checkbox:checked').length;
        importBtn.textContent = `Import ${n}`;
        importBtn.disabled = n === 0;
        countEl.textContent = `${n} of ${envelopes.length} selected`;
      }
      list.addEventListener('change', refreshCount);
      refreshCount();

      // Toolbar actions
      toolbar.addEventListener('click', (e) => {
        const act = e.target.getAttribute('data-act');
        if (act === 'all' || act === 'none') {
          checkboxes.forEach(cb => {
            // Only toggle currently-visible rows
            if (cb.closest('.ghl-import-row').style.display !== 'none') {
              cb.checked = act === 'all';
            }
          });
          refreshCount();
        }
      });

      // Search filter
      toolbar.querySelector('.ghl-import-search').addEventListener('input', (e) => {
        const q = e.target.value.trim().toLowerCase();
        for (const r of rows) {
          r.row.style.display = (!q || r.name.includes(q)) ? '' : 'none';
        }
      });

      // Close / cancel / import
      function close(result) {
        document.removeEventListener('keydown', onKey);
        overlay.remove();
        resolve(result);
      }
      function onKey(e) {
        if (e.key === 'Escape') close(null);
      }
      document.addEventListener('keydown', onKey);

      header.querySelector('.ghl-import-close').addEventListener('click', () => close(null));
      footer.querySelector('[data-act="cancel"]').addEventListener('click', () => close(null));
      importBtn.addEventListener('click', () => {
        const picked = [];
        for (const cb of checkboxes) {
          if (cb.checked) picked.push(envelopes[Number(cb.getAttribute('data-idx'))]);
        }
        close(picked);
      });
      overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });
    });
  }

  function normalizeEnvelopes(parsed) {
    if (parsed && Array.isArray(parsed.workflows)) {
      // Combined JSON — propagate the top-level folders[] to each envelope so
      // performImport can pre-create the full folder set, including ones whose
      // workflow wasn't selected (the user may have unchecked them).
      const topFolders = Array.isArray(parsed.folders) ? parsed.folders : [];
      return parsed.workflows.map((w) => ({
        $schema: parsed.$schema,
        workflow: w.workflow,
        triggers: w.triggers || [],
        source: w.source,
        __folders: topFolders,
        __nameSuffix: ''
      })).filter(e => e.workflow);
    }
    if (parsed && parsed.workflow) return [parsed];
    return [];
  }

  // ---------- 6. UI: Button + Dropdown ----------
  function findCreateWorkflowButton() {
    const btns = Array.from(document.querySelectorAll('button'));
    return btns.find(b => /create\s+workflow/i.test((b.textContent || '').trim()));
  }

  function readSelectedIds() {
    // GHL uses NaiveUI custom checkboxes (no native <input>).
    // Each body row: <tr class="n-data-table-tr">
    //   <td class="...n-data-table-td--selection">
    //     <div class="n-checkbox" role="checkbox" aria-checked="true|false">
    //   <td data-col-key="name">
    //     <a id="<uuid>"> ... </a>  ← the UUID lives here (workflow OR folder)
    // We deliberately skip the header (TH) checkbox by scoping to TD cells.
    const ids = new Set();
    const rows = document.querySelectorAll('tr.n-data-table-tr');
    for (const row of rows) {
      const cb = row.querySelector('td.n-data-table-td--selection .n-checkbox');
      if (!cb) continue;
      const isChecked = cb.classList.contains('n-checkbox--checked') ||
                        cb.getAttribute('aria-checked') === 'true';
      if (!isChecked) continue;
      const a = row.querySelector('td[data-col-key="name"] a[id]');
      if (!a) continue;
      const id = a.getAttribute('id');
      if (/^[a-f0-9-]{36}$/.test(id)) ids.add(id);
    }
    return Array.from(ids);
  }

  // Expand a list of selected UUIDs (workflows + folders) into a flat list of
  // workflow IDs. Folders are walked recursively via /list?parentId=…
  async function resolveSelectedToWorkflowIds(locationId, selectedIds, onProgress) {
    const L = loc(locationId);
    const workflowIds = new Set();
    const queue = [];

    for (const id of selectedIds) {
      if (L.workflows.has(id)) workflowIds.add(id);
      else queue.push(id); // folder or unknown
    }

    const visited = new Set();
    let walked = 0;
    while (queue.length) {
      const fid = queue.shift();
      if (visited.has(fid)) continue;
      visited.add(fid);
      onProgress && onProgress(`Expanding folders… (${++walked})`);
      try {
        // Pull both workflows and sub-directories under this folder
        for (let offset = 0; offset < 1000; offset += 200) {
          const url = `${BACKEND}/workflow/${locationId}/list?parentId=${fid}&limit=200&offset=${offset}&sortBy=name&sortOrder=asc&includeCustomObjects=true&includeObjectiveBuilder=true`;
          const data = await authedFetch(url);
          const rows = (data && data.rows) || [];
          for (const row of rows) {
            if (row.type === 'workflow') {
              workflowIds.add(row.id);
              const w = wf(locationId, row.id);
              w.meta = row;
            } else if (row.type === 'directory') {
              L.folders.set(row.id, { id: row.id, name: row.name, parentId: row.parentId });
              queue.push(row.id);
            }
          }
          if (rows.length < 200) break;
        }
      } catch (e) {
        // If we couldn't expand and we didn't recognize it as a folder, treat as workflow.
        if (!L.folders.has(fid)) workflowIds.add(fid);
      }
    }

    return Array.from(workflowIds);
  }

  let buttonInjected = false;
  let dropdown = null;

  function buildButton() {
    const wrap = document.createElement('div');
    wrap.className = 'ghl-export-wrap';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'ghl-export-btn';
    btn.innerHTML = '<span class="ghl-export-icon">⇅</span> Export / Import <span class="ghl-export-caret">▾</span>';
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggleDropdown(btn);
    });

    wrap.appendChild(btn);
    return wrap;
  }

  function toggleDropdown(anchor) {
    if (dropdown && dropdown.isConnected) {
      dropdown.remove();
      dropdown = null;
      return;
    }
    dropdown = document.createElement('div');
    dropdown.className = 'ghl-export-menu';
    const selCount = readSelectedIds().length;
    const items = [
      { label: `Export selected${selCount ? ` (${selCount})` : ''} as ZIP`, action: 'export', scope: 'selected', format: 'zip', disabled: selCount === 0 },
      { label: `Export selected${selCount ? ` (${selCount})` : ''} as single JSON`, action: 'export', scope: 'selected', format: 'json', disabled: selCount === 0 },
      { label: 'Export ALL workflows as ZIP', action: 'export', scope: 'all', format: 'zip' },
      { label: 'Export ALL workflows as single JSON', action: 'export', scope: 'all', format: 'json' },
      { separator: true },
      { label: 'Import workflow(s) from JSON or ZIP…', action: 'import' }
    ];
    for (const it of items) {
      if (it.separator) {
        const sep = document.createElement('div');
        sep.className = 'ghl-export-sep';
        dropdown.appendChild(sep);
        continue;
      }
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'ghl-export-item' + (it.disabled ? ' ghl-export-item--disabled' : '');
      el.textContent = it.label;
      if (!it.disabled) {
        el.addEventListener('click', () => {
          dropdown && dropdown.remove();
          dropdown = null;
          if (it.action === 'export') performExport({ scope: it.scope, format: it.format });
          else if (it.action === 'import') performImport();
        });
      }
      dropdown.appendChild(el);
    }
    document.body.appendChild(dropdown);
    const r = anchor.getBoundingClientRect();
    dropdown.style.top = (r.bottom + window.scrollY + 4) + 'px';
    dropdown.style.left = Math.max(8, r.right + window.scrollX - dropdown.offsetWidth) + 'px';

    setTimeout(() => {
      const outside = (e) => {
        if (dropdown && !dropdown.contains(e.target) && !anchor.contains(e.target)) {
          dropdown.remove();
          dropdown = null;
          document.removeEventListener('mousedown', outside);
          document.removeEventListener('keydown', esc);
        }
      };
      const esc = (e) => {
        if (e.key === 'Escape' && dropdown) {
          dropdown.remove();
          dropdown = null;
          document.removeEventListener('mousedown', outside);
          document.removeEventListener('keydown', esc);
        }
      };
      document.addEventListener('mousedown', outside);
      document.addEventListener('keydown', esc);
    }, 0);
  }

  function tryInjectButton() {
    if (buttonInjected && document.querySelector('.ghl-export-btn')) return;
    const anchor = findCreateWorkflowButton();
    if (!anchor) return;
    const parent = anchor.parentElement;
    if (!parent) return;
    const wrap = buildButton();
    parent.insertBefore(wrap, anchor);
    buttonInjected = true;
  }

  // ---------- 7. Toast ----------
  let toastEl = null;
  function ensureToast() {
    if (toastEl && toastEl.isConnected) return toastEl;
    toastEl = document.createElement('div');
    toastEl.className = 'ghl-export-toast';
    document.body.appendChild(toastEl);
    return toastEl;
  }
  function showToast(message, level = 'info', sticky = false) {
    const t = ensureToast();
    t.className = `ghl-export-toast ghl-export-toast--${level}`;
    t.innerHTML = `<div class="ghl-export-toast__msg">${escapeHtml(message)}</div>
      <div class="ghl-export-toast__bar"><div class="ghl-export-toast__fill" style="width:0%"></div></div>`;
    const api = {
      update(msg, done, total) {
        t.querySelector('.ghl-export-toast__msg').textContent = msg;
        const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
        t.querySelector('.ghl-export-toast__fill').style.width = pct + '%';
      },
      close() { if (t.isConnected) t.remove(); toastEl = null; }
    };
    if (!sticky) setTimeout(api.close, 4000);
    return api;
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  // ---------- 8. Re-injection on SPA navigation ----------
  const obs = new MutationObserver(() => {
    if (!buttonInjected || !document.querySelector('.ghl-export-btn')) {
      buttonInjected = false;
      tryInjectButton();
    }
  });
  function startObserver() {
    obs.observe(document.body, { childList: true, subtree: true });
    tryInjectButton();
  }
  if (document.body) startObserver();
  else document.addEventListener('DOMContentLoaded', startObserver);
})();
