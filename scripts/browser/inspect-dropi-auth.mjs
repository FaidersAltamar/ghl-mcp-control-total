#!/usr/bin/env node
// Inspecciona la config de Firebase/auth de la pagina de login de Dropi.
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
  'about:blank',
], { detached: true, stdio: 'ignore' });
proc.unref();

let ok = false;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 1000));
  try { const r = await fetch('http://localhost:' + port + '/json/version'); if (r.ok) { ok = true; break; } } catch {}
}
if (!ok) { console.error('Chrome no abrio'); process.exit(1); }

const browser = await chromium.connectOverCDP('http://localhost:' + port);
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] || await ctx.newPage();

await page.goto('https://crm.dropi.co', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

const info = await page.evaluate(async () => {
  const out = {};
  out.localStorage = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      out.localStorage[k] = (localStorage.getItem(k) || '').slice(0, 200);
    }
  } catch (e) { out.localStorageErr = e.message; }
  out.hasFirebase = typeof window.firebase !== 'undefined';
  out.keys = Object.keys(window).filter(k => /firebase|auth|token|ghl|leadconnector/i.test(k)).slice(0, 50);
  // buscar config de firebase en el HTML/scripts
  out.htmlApiKey = (document.documentElement.innerHTML.match(/AIzaSy[A-Za-z0-9_-]{20,}/) || [])[0] || null;
  out.htmlAuthDomain = (document.documentElement.innerHTML.match(/[a-z0-9-]+\.firebaseapp\.com/) || [])[0] || null;
  out.htmlProjectId = (document.documentElement.innerHTML.match(/projectId["':\s]+["']([a-z0-9-]+)/i) || [])[1] || null;
  return out;
});

console.log(JSON.stringify(info, null, 2));
await browser.close();
process.exit(0);
