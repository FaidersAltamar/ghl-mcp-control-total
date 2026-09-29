#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9223');
const ctx = browser.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('crm.dropi.co')) || ctx.pages()[0];
await page.bringToFront();

const needles = ['controlads', 'mail.controlads', 'Dedicated', 'dedicated', 'Dominio dedicado', 'verified', 'Verificado', 'warmup', 'calentamiento', 'smtp', 'mailgun', 'sin verificar', 'Verificación'];

const results = await page.evaluate((needles) => {
  const html = document.documentElement.outerHTML;
  const out = {};
  for (const n of needles) {
    const i = html.indexOf(n);
    out[n] = i >= 0 ? i : -1;
  }
  return out;
}, needles);

console.log('=== POSICIONES (indice en HTML) ===');
for (const [k, v] of Object.entries(results)) {
  console.log(`${v >= 0 ? 'SI ' : 'no '} ${k}  @ ${v}`);
}

// buscar "controlads" y mostrar contexto
const ctxHtml = await page.evaluate(() => {
  const html = document.documentElement.outerHTML;
  const i = html.indexOf('controlads');
  if (i < 0) return null;
  return html.slice(Math.max(0, i - 500), i + 800);
});
if (ctxHtml) {
  console.log('\n=== CONTEXTO "controlads" ===');
  console.log(ctxHtml.slice(0, 1600));
}

// listar TODOS los botones con texto visible
const buttons = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('button, [role="button"], a.btn'))
    .map(b => (b.innerText || b.textContent || '').trim())
    .filter(t => t.length > 0 && t.length < 40);
});
console.log('\n=== BOTONES VISIBLES (' + buttons.length + ') ===');
console.log(JSON.stringify([...new Set(buttons)], null, 1));

await browser.close();
process.exit(0);
