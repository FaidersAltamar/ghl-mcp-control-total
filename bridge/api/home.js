export default async function handler(req, res) {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.status(200).send(HTML);
}

const HTML = [
'<!doctype html>',
'<html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
'<title>Control WhatsApp</title>',
'<script src="https://cdn.jsdelivr.net/npm/qrcodejs@1.0.0/qrcode.min.js"></script>',
'<style>body{font-family:system-ui,sans-serif;max-width:760px;margin:24px auto;padding:0 16px;color:#111}.card{border:1px solid #ddd;border-radius:10px;padding:16px;margin:12px 0}.row{display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap}input,button{padding:8px 10px;border-radius:8px;border:1px solid #ccc;font-size:14px}button{background:#111;color:#fff;border:none;cursor:pointer}.ok{color:#0a7c2e;font-weight:600}.warn{color:#b45309;font-weight:600}.muted{color:#666;font-size:13px}#qr img,#qr canvas{margin:8px 0}</style>',
'</head><body>',
'<h1>WhatsApp — Control total</h1>',
'<div id="login" class="card"><p>Clave de administración (el webhook secret):</p><input id="key" type="password" style="width:100%"><button id="loginBtn" style="margin-top:8px">Entrar</button></div>',
'<div id="app" style="display:none">',
'<div class="card"><div class="row"><h2 style="margin:0">Sesiones</h2><button id="refresh">Refrescar</button></div><div id="sessions"></div></div>',
'<div class="card"><h2 style="margin:0 0 8px">Conectar nuevo número</h2><div class="row"><input id="nname" placeholder="Nombre (ej: Ventas)"><input id="nphone" placeholder="Teléfono (+57...)"><button id="create">Crear y conectar</button></div><div id="qrbox"></div></div>',
'<div class="card muted" id="log"></div>',
'</div>',
'<script>',
`const KEY = () => localStorage.getItem('wa_key') || '';
function log(m){ document.getElementById('log').textContent = m; }
async function api(path, opts){
  opts = opts || {};
  const headers = Object.assign({ 'x-admin-key': KEY() }, opts.body ? {'Content-Type':'application/json'} : {});
  const r = await fetch(path, { method: opts.method || 'GET', headers: headers, body: opts.body });
  let j = {};
  try { j = await r.json(); } catch(e){}
  if(!r.ok){ throw new Error(j.error || ('HTTP ' + r.status)); }
  return j;
}
function showApp(){
  document.getElementById('login').style.display = 'none';
  document.getElementById('app').style.display = 'block';
  load();
}
async function load(){
  try {
    const d = await api('/api/sessions');
    const el = document.getElementById('sessions');
    const list = d.sessions || [];
    if(!list.length){ el.innerHTML = '<p class="muted">No hay sesiones.</p>'; return; }
    el.innerHTML = list.map(function(s){
      const st = (s.status || '').toLowerCase();
      const ok = st === 'connected' || st === 'open';
      const btn = ok
        ? '<button onclick="disc(' + s.id + ')">Desconectar</button>'
        : '<button onclick="qr(' + s.id + ')">Ver QR</button>';
      return '<div class="row card"><div><b>' + (s.name || '') + '</b><div class="muted">' + (s.phone_number || '') + '</div><span class="' + (ok ? 'ok' : 'warn') + '">' + (s.status || '') + '</span></div><div>' + btn + '</div></div>';
    }).join('');
  } catch(e){ log('Error: ' + e.message); }
}
async function disc(id){
  if(!confirm('Desconectar sesión ' + id + '?')) return;
  try { await api('/api/sessions-disconnect', { method:'POST', body: JSON.stringify({ id: id }) }); log('Desconectado'); load(); }
  catch(e){ log('Error: ' + e.message); }
}
async function qr(id){
  try {
    const d = await api('/api/sessions-connect', { method:'POST', body: JSON.stringify({ id: id }) });
    const s = (d.data && (d.data.qrCode || d.data.qrcode)) || '';
    renderQr(s);
  } catch(e){ log('Error: ' + e.message); }
}
function renderQr(str){
  const box = document.getElementById('qrbox');
  box.innerHTML = '';
  if(!str){ box.innerHTML = '<p class="muted">Sin QR.</p>'; return; }
  try {
    new QRCode(box, { text: str, width: 220, height: 220, correctLevel: QRCode.CorrectLevel.M });
  } catch(e){
    box.textContent = 'QR (texto): ' + str;
  }
}
async function create(){
  const name = document.getElementById('nname').value.trim();
  const phone = document.getElementById('nphone').value.trim();
  if(!name || !phone){ log('Pon nombre y teléfono'); return; }
  try {
    const c = await api('/api/sessions', { method:'POST', body: JSON.stringify({ name: name, phone_number: phone }) });
    const s = c.session || {};
    const id = s.id || (s.data && s.data.id);
    if(!id){ log('No se obtuvo id: ' + JSON.stringify(c)); return; }
    log('Sesión ' + id + ' creada. Conectando...');
    const k = await api('/api/sessions-connect', { method:'POST', body: JSON.stringify({ id: id }) });
    const q = (k.data && (k.data.qrCode || k.data.qrcode)) || '';
    if(q){ renderQr(q); } else { log('Estado: ' + JSON.stringify(k.data || k)); }
    load();
  } catch(e){ log('Error: ' + e.message); }
}
document.getElementById('loginBtn').onclick = function(){
  const k = document.getElementById('key').value.trim();
  if(!k) return;
  localStorage.setItem('wa_key', k);
  showApp();
};
document.getElementById('refresh').onclick = load;
document.getElementById('create').onclick = create;
if(KEY()){ showApp(); }
`,
'</script>',
'</body></html>',
].join('\n');
