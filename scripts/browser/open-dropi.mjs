#!/usr/bin/env node
// Abre una instancia NUEVA de Chrome (perfil temporal + debug) sin tocar el Chrome del usuario.
// Navega a Dropi CRM y reporta si esta autenticado o redirige a login.
import { chromium } from 'playwright';
import { spawn } from 'node:child_process';
import { mkdirSync } from 'node:fs';

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

mkdirSync('reports/browser', { recursive: true });

await page.goto('https://crm.dropi.co', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

const url = page.url();
const title = await page.title();
console.log('FINAL URL:', url);
console.log('TITLE:', title);
await page.screenshot({ path: 'reports/browser/dropi-home.png' });

const body = await page.evaluate(() => document.body ? document.body.innerText.slice(0, 800) : '');
console.log('=== BODY (800) ===');
console.log(body);

await browser.close();
process.exit(0);
