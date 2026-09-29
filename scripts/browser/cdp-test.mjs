#!/usr/bin/env node
// Valida que Playwright puede conectar a Chrome via CDP y sacar screenshot.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const port = 9222;
const chrome = 'C:/Program Files/Google/Chrome/Application/chrome.exe';
const { spawn } = await import('node:child_process');
mkdirSync('reports/browser', { recursive: true });

const proc = spawn(chrome, [
  '--remote-debugging-port=' + port,
  '--user-data-dir=' + process.env.TEMP + '/chrome-cdp-test',
  '--no-first-run',
  '--no-default-browser-check',
  'about:blank',
], { detached: false, stdio: 'ignore' });

// esperar a que el endpoint este disponible
let ok = false;
for (let i = 0; i < 30; i++) {
  await new Promise(r => setTimeout(r, 1000));
  try {
    const r = await fetch('http://localhost:' + port + '/json/version');
    if (r.ok) { ok = true; break; }
  } catch {}
}
if (!ok) { console.error('Chrome no abrio CDP'); process.exit(1); }

const browser = await chromium.connectOverCDP('http://localhost:' + port);
const ctx = browser.contexts()[0];
const page = ctx.pages()[0] || await ctx.newPage();
await page.goto('https://example.com');
await page.screenshot({ path: 'reports/browser/test.png' });
const title = await page.title();
console.log('OK - titulo:', title);
console.log('screenshot: reports/browser/test.png');
await browser.close();
proc.kill();
process.exit(0);
