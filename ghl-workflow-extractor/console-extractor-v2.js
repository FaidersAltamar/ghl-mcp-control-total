/**
 * Extractor final de workflows de GHL usando Firebase refresh token.
 *
 * 1. Abre GHL en Chrome.
 * 2. Ve a Automation → Workflows.
 * 3. Abre DevTools (F12) → Console.
 * 4. Pega TODO este script y presiona Enter.
 * 5. Espera a que diga "¡Listo!".
 */
(async () => {
  const BACKEND = 'https://backend.leadconnectorhq.com';
  const LOCAL_SERVER = 'http://localhost:8765/capture';
  const FIREBASE_API_KEY = 'AIzaSyB_w3vXmsI7WeQtrIOkjR6xTRVN5uOieiE';

  // --- 1. Extraer refresh token de IndexedDB ---
  async function getRefreshToken() {
    const db = await new Promise((resolve, reject) => {
      const req = indexedDB.open('firebaseLocalStorageDb', 1);
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });

    const tx = db.transaction('firebaseLocalStorage', 'readonly');
    const store = tx.objectStore('firebaseLocalStorage');
    const all = await new Promise((resolve, reject) => {
      const req = store.getAll();
      req.onerror = () => reject(req.error);
      req.onsuccess = () => resolve(req.result);
    });

    for (const item of all) {
      const val = item.value;
      if (val && val.stsTokenManager && val.stsTokenManager.refreshToken) {
        return val.stsTokenManager.refreshToken;
      }
    }
    throw new Error('No se encontró refreshToken en IndexedDB');
  }

  // --- 2. Intercambiar refresh token por ID token ---
  async function refreshToIdToken(refreshToken) {
    const url = `https://securetoken.googleapis.com/v1/token?key=${FIREBASE_API_KEY}`;
    const resp = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
    });
    if (!resp.ok) throw new Error(`Firebase refresh failed: ${resp.status}`);
    const data = await resp.json();
    return data.id_token;
  }

  // --- 3. Helpers de API ---
  async function authedFetch(token, url, init = {}) {
    const headers = Object.assign({
      'token-id': token,
      'channel': 'APP',
      'accept': 'application/json, text/plain, */*'
    }, init.headers || {});
    const resp = await fetch(url, Object.assign({ method: 'GET', credentials: 'omit' }, init, { headers }));
    if (!resp.ok) throw new Error(`HTTP_${resp.status}`);
    return resp.json();
  }

  async function fetchAllWorkflows(token, locationId) {
    const out = [];
    let offset = 0;
    const limit = 100;
    for (let i = 0; i < 50; i++) {
      const url = `${BACKEND}/workflow/${locationId}/list?type=workflow&limit=${limit}&offset=${offset}&sortBy=name&sortOrder=asc&includeCustomObjects=true&includeObjectiveBuilder=true`;
      const data = await authedFetch(token, url);
      const rows = (data && data.rows) || [];
      out.push(...rows);
      if (rows.length < limit) break;
      offset += rows.length;
    }
    return out;
  }

  async function fetchDetail(token, locationId, workflowId) {
    const url = `${BACKEND}/workflow/${locationId}/${workflowId}?includeScheduledPauseInfo=true&sessionId=${crypto.randomUUID()}`;
    return authedFetch(token, url);
  }

  async function fetchTriggers(token, locationId, workflowId) {
    const url = `${BACKEND}/workflow/${locationId}/trigger?workflowId=${workflowId}`;
    return authedFetch(token, url);
  }

  // --- 4. Ejecutar ---
  try {
    const locationId = (location.pathname.match(/\/location\/([^/]+)/) || [])[1];
    if (!locationId) throw new Error('No se pudo detectar locationId');

    console.log('Extrayendo refresh token...');
    const refreshToken = await getRefreshToken();
    console.log('Refresh token encontrado.');

    console.log('Obteniendo ID token fresco...');
    const idToken = await refreshToIdToken(refreshToken);
    console.log('ID token obtenido.');

    console.log('Cargando workflows...');
    const list = await fetchAllWorkflows(idToken, locationId);
    console.log(`Total workflows: ${list.length}`);

    const workflows = [];
    for (let i = 0; i < list.length; i++) {
      const row = list[i];
      console.log(`[${i + 1}/${list.length}] ${row.name || '(sin nombre)'}`);
      try {
        const detail = await fetchDetail(idToken, locationId, row.id);
        const triggers = await fetchTriggers(idToken, locationId, row.id);
        workflows.push({ source: { workflowId: row.id, locationId }, workflow: detail, triggers });
      } catch (e) {
        console.warn('Error leyendo workflow:', row.id, e.message);
      }
    }

    const payload = {
      capturedAt: new Date().toISOString(),
      locationId,
      host: location.host,
      workflows
    };

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
  } catch (err) {
    console.error('ERROR:', err);
    alert('Error: ' + err.message);
  }
})();
