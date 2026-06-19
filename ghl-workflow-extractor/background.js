// Service worker. Receives composed export payloads from the content script,
// builds the file(s) (single JSON or ZIP), and triggers chrome.downloads.

importScripts('lib/jszip.min.js');

function slugify(s) {
  return String(s || 'untitled')
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-+/g, '-')
    .toLowerCase()
    .substring(0, 80) || 'untitled';
}

function timestamp() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${pad(d.getHours())}${pad(d.getMinutes())}`;
}

// Derive a human-friendly filename from the export payload.
// Priority:
//   1. Single workflow (count=1) → "{workflow-name}.workflow.{ext}"
//   2. All workflows share one folder → "ghl-{folder-name}-{count}-{date}.{ext}"
//   3. All at root → "ghl-root-workflows-{count}-{date}.{ext}"
//   4. scope=all → "ghl-all-workflows-{count}-{date}.{ext}"
//   5. Mixed selection → "ghl-selected-workflows-{count}-{date}.{ext}"
function buildOutputName(msg, ext) {
  const ts = timestamp();
  const count = msg.results ? msg.results.length : 0;

  if (count === 1) {
    const wf = msg.results[0].envelope.workflow || {};
    const base = slugify(wf.name || 'workflow');
    return ext === 'zip'
      ? `ghl-${base}-${ts}.zip`
      : `${base}.workflow.json`;
  }

  const parents = new Set((msg.results || []).map(r => (r.meta && r.meta.parentId) || null));
  if (parents.size === 1) {
    const parentId = [...parents][0];
    if (parentId && msg.folderMap && msg.folderMap[parentId]) {
      return `ghl-${slugify(msg.folderMap[parentId])}-${count}-${ts}.${ext}`;
    }
    if (parentId === null) {
      return `ghl-root-workflows-${count}-${ts}.${ext}`;
    }
  }

  if (msg.scope === 'all') {
    return `ghl-all-workflows-${count}-${ts}.${ext}`;
  }
  return `ghl-selected-workflows-${count}-${ts}.${ext}`;
}

function jsonBlob(obj) {
  return new Blob([JSON.stringify(obj, null, 2)], { type: 'application/json' });
}

async function blobToDataUrl(blob) {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  // Base64 encode in chunks (avoid call-stack issues on large bufs)
  let binary = '';
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, bytes.subarray(i, i + chunk));
  }
  const b64 = btoa(binary);
  return `data:${blob.type || 'application/octet-stream'};base64,${b64}`;
}

async function download(blob, filename) {
  // Service workers in MV3 cannot use URL.createObjectURL for chrome.downloads
  // (Blob URLs aren't reachable from the downloads system). Use a data: URL.
  const url = await blobToDataUrl(blob);
  await chrome.downloads.download({ url, filename, saveAs: false });
}

function buildZip(payload) {
  const zip = new JSZip();
  const { folderMap, results, locationId } = payload;
  const usedNames = new Map(); // folder -> Set<filename>
  const index = [];

  function uniqueFileName(folder, base) {
    if (!usedNames.has(folder)) usedNames.set(folder, new Set());
    const set = usedNames.get(folder);
    let candidate = `${base}.workflow.json`;
    let n = 2;
    while (set.has(candidate)) {
      candidate = `${base}-${n}.workflow.json`;
      n++;
    }
    set.add(candidate);
    return candidate;
  }

  for (const item of results) {
    const meta = item.meta || {};
    const wf = item.envelope.workflow || {};
    const name = meta.name || wf.name || 'untitled';
    const parentId = meta.parentId || wf.parentId;
    const folderName = parentId ? slugify(folderMap[parentId] || `folder-${parentId.slice(0, 8)}`) : '_root';
    const file = uniqueFileName(folderName, slugify(name));
    const path = `${folderName}/${file}`;
    zip.file(path, JSON.stringify(item.envelope, null, 2));
    index.push({
      id: wf._id || meta.id,
      name,
      folder: parentId ? (folderMap[parentId] || null) : null,
      folderId: parentId || null,
      file: path
    });
  }
  const folders = Object.keys(folderMap || {}).map(id => ({
    id,
    name: folderMap[id],
    parentId: null // current API doesn't expose nesting in folderMap; keep flat
  }));
  zip.file('_index.json', JSON.stringify({
    locationId,
    exportedAt: new Date().toISOString(),
    count: results.length,
    folders,
    workflows: index,
    errors: payload.errors || []
  }, null, 2));
  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE' });
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

async function parseZipPayload(b64) {
  const zip = await JSZip.loadAsync(b64ToBytes(b64));
  const files = [];
  let index = null;
  for (const path of Object.keys(zip.files)) {
    const entry = zip.files[path];
    if (entry.dir) continue;
    if (!/\.json$/i.test(path)) continue;
    const content = await entry.async('string');
    if (path === '_index.json' || path.endsWith('/_index.json')) {
      try { index = JSON.parse(content); } catch (_) {}
      continue;
    }
    files.push({ path, content });
  }
  return { files, index };
}

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  if (!msg) return;

  if (msg.kind === 'parse-zip') {
    (async () => {
      try {
        const { files, index } = await parseZipPayload(msg.dataB64);
        sendResponse({ ok: true, files, index });
      } catch (e) {
        sendResponse({ ok: false, error: String(e && e.message || e) });
      }
    })();
    return true;
  }

  if (msg.kind !== 'export') return;
  (async () => {
    try {
      if (msg.format === 'json') {
        const fname = buildOutputName(msg, 'json');
        const payload = msg.results.length === 1
          ? msg.results[0].envelope
          : msg.combinedEnvelope;
        await download(jsonBlob(payload), fname);
      } else if (msg.format === 'zip') {
        const fname = buildOutputName(msg, 'zip');
        const blob = await buildZip(msg);
        await download(blob, fname);
      } else {
        throw new Error(`Unknown format: ${msg.format}`);
      }
      sendResponse({ ok: true });
    } catch (e) {
      console.error('[GHL Exporter] export failed', e);
      sendResponse({ ok: false, error: String(e && e.message || e) });
    }
  })();
  return true; // async
});
