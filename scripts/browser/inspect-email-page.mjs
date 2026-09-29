#!/usr/bin/env node
// Inspecciona la pagina de Email Services a fondo (iframes, shadow DOM, HTML completo).
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9223');
const ctx = browser.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('crm.dropi.co')) || ctx.pages()[0];
await page.bringToFront();

console.log('URL:', page.url());

// iframes
const frames = page.frames();
console.log('=== IFRAMES (' + frames.length + ') ===');
for (const f of frames) {
  console.log('  frame:', f.url());
}

// buscar en el HTML completo
const htmlLen = await page.evaluate(() => document.documentElement.outerHTML.length);
console.log('HTML total length:', htmlLen);

const find = async (needle) => {
  return page.evaluate((n) => {
    const html = document.documentElement.outerHTML;
    const i = html.indexOf(n);
    return i >= 0 ? html.slice(Math.max(0, i - 300), i + 500) : null;
  }, needle);
};

for (const needle of ['controlads', 'Dedicated', 'Dominio', 'domain', 'smtp', 'verified', 'Verif', 'warmup']) {
  const ctx = await find(needle);
  if (ctx) {
    console.log('\n=== ENCONTRADO: ' + needle + ' ===');
    console.log(ctx.replace(/</g, '\n<').slice(0, 900));
    break;
  }
}

// accesibilidad de playwright
try {
  const snap = await page.accessibility.snapshot();
  console.log('\n=== ACCESSIBILITY (primeros nodos) ===');
  console.log(JSON.stringify(snap, null, 1).slice(0, 2000));
} catch (e) {
  console.log('accessibility error:', e.message);
}

await browser.close();
process.exit(0);
