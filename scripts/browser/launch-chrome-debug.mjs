#!/usr/bin/env node
// Lanza Chrome con depuracion remota usando el perfil real del usuario (conserva sesion de Dropi).
import { spawn } from 'node:child_process';

const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const port = 9222;
const profile = 'C:/Users/faiders/AppData/Local/Google/Chrome/User Data';

const proc = spawn(chrome, [
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + profile,
  '--restore-last-session',
  '--no-first-run',
  '--no-default-browser-check',
], { detached: true, stdio: 'ignore' });
proc.unref();

let ok = false;
for (let i = 0; i < 40; i++) {
  await new Promise(r => setTimeout(r, 1000));
  try {
    const r = await fetch('http://localhost:' + port + '/json/version');
    if (r.ok) { ok = true; break; }
  } catch {}
}
if (ok) {
  console.log('Chrome listo en puerto ' + port + ' (sesion conservada)');
} else {
  console.error('Chrome no abrio CDP en 40s. ¿Cerraste Chrome antes?');
  process.exit(1);
}
process.exit(0);
