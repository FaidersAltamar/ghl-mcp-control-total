#!/usr/bin/env node
// Abre una instancia NUEVA de Chrome (visible, perfil propio) con Dropi para que el usuario inicie sesion.
// No toca el Chrome actual del usuario. Deja Chrome abierto.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9223;
const profile = process.env.TEMP + '/chrome-ghl-session';

const proc = spawn(chrome, [
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile,
  '--no-first-run',
  '--no-default-browser-check',
  'https://crm.dropi.co',
], { detached: true, stdio: 'ignore' });
proc.unref();

let ok = false;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 1000));
  try { const r = await fetch('http://localhost:' + port + '/json/version'); if (r.ok) { ok = true; break; } } catch {}
}
if (!ok) { console.error('Chrome no abrio'); process.exit(1); }
console.log('Chrome abierto en puerto ' + port + '. Ve a la ventana de Dropi e inicia sesion.');
process.exit(0);
