// Minimal CDP (Chrome DevTools Protocol) helper over native WebSocket (Node 22+).
//
// Usage:
//   const { connectTab } = await import('./cdp-lib.mjs');
//   const cdp = await connectTab({ host: '127.0.0.1', port: 9222, matchUrl: 'crm' });
//   const r = await cdp.evaluate(`document.title`);
//   await cdp.close();
//
// `matchUrl` selects the first open page whose URL contains the string. If not found
// it creates a new tab on `createUrl`.

export async function listTabs({ host = '127.0.0.1', port = 9222 } = {}) {
  const res = await fetch(`http://${host}:${port}/json`);
  return await res.json();
}

export async function connectTab({ host = '127.0.0.1', port = 9222, matchUrl, createUrl } = {}) {
  const tabs = await listTabs({ host, port });
  let target = tabs.find(t => t.type === 'page' && (!matchUrl || (t.url || '').includes(matchUrl)));
  if (!target && createUrl) {
    const res = await fetch(`http://${host}:${port}/json/new?${encodeURIComponent(createUrl)}`, { method: 'PUT' });
    target = await res.json();
  }
  if (!target) throw new Error(`No page tab found matching "${matchUrl}". Launch Chrome with launch-chrome.ps1 first.`);

  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });

  let nextId = 0;
  const pending = new Map();
  ws.onmessage = (ev) => {
    const msg = JSON.parse(ev.data);
    if (msg.id && pending.has(msg.id)) {
      const p = pending.get(msg.id);
      pending.delete(msg.id);
      msg.error ? p.reject(new Error(msg.error.message)) : p.resolve(msg.result);
    }
  };

  const send = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++nextId;
    pending.set(id, { resolve, reject });
    ws.send(JSON.stringify({ id, method, params }));
  });

  return {
    send,
    async evaluate(expression, { awaitPromise = false, returnByValue = true } = {}) {
      const res = await send('Runtime.evaluate', { expression, awaitPromise, returnByValue });
      if (res.exceptionDetails) {
        throw new Error('Page exception: ' + (res.exceptionDetails.text || '') + ' ' + (res.exceptionDetails.exception?.description || ''));
      }
      return res.result ? res.result.value : res;
    },
    async getAllDbs() {
      return this.evaluate(`(async () => {
        const out = { dbs: [] };
        try {
          const dbs = await indexedDB.databases();
          for (const d of dbs) {
            const entry = { name: d.name, version: d.version, stores: [], data: [] };
            try {
              const db = await new Promise((res, rej) => {
                const r = indexedDB.open(d.name);
                r.onsuccess = () => res(r.result);
                r.onerror = () => rej(r.error);
                r.onupgradeneeded = () => res(r.result);
              });
              entry.stores = Array.from(db.objectStoreNames);
              for (const s of db.objectStoreNames) {
                try {
                  const tx = db.transaction(s, 'readonly');
                  const st = tx.objectStore(s);
                  const all = st.getAll();
                  await new Promise((res2) => { all.onsuccess = res2; });
                  entry.data.push({ store: s, count: (all.result || []).length, rows: all.result || [] });
                } catch (e) { entry.data.push({ store: s, error: String(e) }); }
              }
              db.close();
            } catch (e) { entry.error = String(e); }
            out.dbs.push(entry);
          }
        } catch (e) { out.topError = String(e); }
        return JSON.stringify(out);
      })()`, { awaitPromise: true });
    },
    async getLocalStorage() {
      return this.evaluate(`(() => {
        const out = { origin: location.origin, href: location.href, keys: [] };
        try {
          for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            let v;
            try { v = JSON.parse(localStorage.getItem(k)); } catch (_) { v = localStorage.getItem(k); }
            out.keys.push({ key: k, value: v });
          }
        } catch (e) { out.error = String(e); }
        return JSON.stringify(out);
      })()`);
    },
    close() { try { ws.close(); } catch (_) {} }
  };
}
