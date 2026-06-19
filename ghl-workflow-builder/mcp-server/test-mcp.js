import { spawn } from 'child_process';

const server = spawn('node', ['server.js'], {
  cwd: process.cwd(),
  stdio: ['pipe', 'pipe', 'pipe']
});

let buffer = '';
let responses = [];

function send(msg) {
  const json = JSON.stringify(msg);
  const header = `Content-Length: ${Buffer.byteLength(json)}\r\n\r\n`;
  server.stdin.write(header + json);
}

server.stdout.on('data', (data) => {
  buffer += data.toString();
  while (true) {
    const match = buffer.match(/^Content-Length: (\d+)\r\n\r\n/);
    if (!match) break;
    const len = parseInt(match[1], 10);
    const start = match[0].length;
    if (buffer.length < start + len) break;
    const json = buffer.slice(start, start + len);
    buffer = buffer.slice(start + len);
    try {
      const resp = JSON.parse(json);
      responses.push(resp);
      console.log('Respuesta:', JSON.stringify(resp, null, 2).slice(0, 500));
    } catch (e) {
      console.error('JSON parse error:', e.message);
    }
    if (responses.length >= 2) {
      server.kill();
      process.exit(0);
    }
  }
});

server.stderr.on('data', (data) => {
  console.error('Server stderr:', data.toString());
});

server.on('exit', (code) => {
  console.log('Server exited with code', code);
});

// Enviar initialize
send({
  jsonrpc: '2.0',
  id: 1,
  method: 'initialize',
  params: {
    protocolVersion: '2024-11-05',
    capabilities: {},
    clientInfo: { name: 'test-client', version: '0.1.0' }
  }
});

// Enviar tools/list
setTimeout(() => {
  send({
    jsonrpc: '2.0',
    id: 2,
    method: 'tools/list',
    params: {}
  });
}, 1000);

// Timeout de seguridad
setTimeout(() => {
  console.error('Timeout esperando respuestas');
  server.kill();
  process.exit(1);
}, 10000);
