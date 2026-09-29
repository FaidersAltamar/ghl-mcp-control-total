const SSE = process.env.WEB_MCP_SSE;
if (!SSE) throw new Error('WEB_MCP_SSE no configurado');
const r = await fetch(SSE, { headers: { accept: 'text/event-stream' } });
const reader = r.body.getReader();
const dec = new TextDecoder();
let buf = '';
function* parse(s) {
  buf += s;
  let i;
  while ((i = buf.indexOf('\n\n')) >= 0) {
    const raw = buf.slice(0, i);
    buf = buf.slice(i + 2);
    const ev = {};
    for (const l of raw.split('\n')) {
      if (l.startsWith('event:')) ev.event = l.slice(6).trim();
      else if (l.startsWith('data:')) ev.data = l.slice(5).trim();
    }
    if (ev.data !== undefined) yield ev;
  }
}
let endpoint = null;
while (!endpoint) {
  const { value } = await reader.read();
  for (const e of parse(dec.decode(value, { stream: true }))) {
    if (e.event === 'endpoint') endpoint = e.data;
  }
}
const url = new URL(SSE).origin + endpoint;
let id = 100;
const post = (method, params) => fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ jsonrpc: '2.0', id: id++, method, params }),
});
await post('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'x', version: '1' } });
await post('notifications/initialized', {});
const callId = id;
await post('tools/call', { name: 'page_snapshot', arguments: {} });
console.log('sent page_snapshot id', callId);
const t = setTimeout(() => { console.log('[[done 25s]]'); process.exit(0); }, 25000);
while (true) {
  const { value } = await reader.read();
  for (const e of parse(dec.decode(value, { stream: true }))) {
    console.log('EVT event=', e.event, 'len=', (e.data || '').length);
    console.log('   prefix=', (e.data || '').slice(0, 160));
  }
}
