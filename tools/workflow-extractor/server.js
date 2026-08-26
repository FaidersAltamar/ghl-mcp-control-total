#!/usr/bin/env node
/**
 * Servidor local para recibir workflows extraídos desde la extensión de Chrome.
 *
 * Uso:
 *   node server.js
 *
 * La extensión envía un POST a http://localhost:8765/capture con el payload.
 * Este servidor lo guarda en workflows-live.json y lo imprime resumido.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.GHL_WORKFLOW_PORT || 8765;
const OUT_FILE = path.join(__dirname, 'workflows-live.json');

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function sanitizeForFile(payload) {
  // Guardamos todo tal cual; el token también queda en el archivo local
  // (gitignored). No lo imprimimos en consola.
  return JSON.stringify(payload, null, 2);
}

function summarize(payload) {
  const workflows = payload?.workflows || [];
  const total = workflows.length;
  const published = workflows.filter(w => w?.workflow?.status === 'published').length;
  const draft = workflows.filter(w => w?.workflow?.status !== 'published').length;
  log(`📦 Workflows recibidos: ${total} (publicados: ${published}, borradores: ${draft})`);
  for (const w of workflows.slice(0, 5)) {
    const name = w?.workflow?.name || '(sin nombre)';
    const status = w?.workflow?.status || '?';
    const steps = w?.workflow?.workflowData?.templates?.length || 0;
    const triggers = w?.triggers?.length || 0;
    log(`   - [${status}] ${name} (${steps} pasos, ${triggers} triggers)`);
  }
  if (workflows.length > 5) log(`   ... y ${workflows.length - 5} más`);
}

const server = http.createServer((req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  if (req.method === 'GET' && req.url === '/status') {
    const exists = fs.existsSync(OUT_FILE);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      listening: true,
      dataFile: OUT_FILE,
      hasData: exists,
      capturedAt: exists ? fs.statSync(OUT_FILE).mtime.toISOString() : null
    }, null, 2));
    return;
  }

  if (req.method === 'POST' && req.url === '/capture') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const payload = JSON.parse(body);
        fs.writeFileSync(OUT_FILE, sanitizeForFile(payload));
        log('✅ Datos capturados y guardados en', OUT_FILE);
        summarize(payload);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, savedTo: OUT_FILE, workflowCount: (payload?.workflows || []).length }));
      } catch (err) {
        log('❌ Error procesando payload:', err.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: err.message }));
      }
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ ok: false, error: 'Not found' }));
});

server.listen(PORT, () => {
  log(`🚀 Servidor listo en http://localhost:${PORT}`);
  log('   Endpoint de captura: POST /capture');
  log('   Estado:              GET  /status');
  log('   Archivo de salida:   ', OUT_FILE);
});
