#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9223');
const ctx = browser.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('crm.dropi.co')) || ctx.pages()[0];
await page.bringToFront();

// contexto de "dedicated" en el HTML
const ctxStr = await page.evaluate(() => {
  const html = document.documentElement.outerHTML;
  const i = html.indexOf('dedicated');
  return i >= 0 ? html.slice(Math.max(0, i - 400), i + 400) : 'NO FOUND';
});
console.log('=== CONTEXTO "dedicated" ===');
console.log(ctxStr);

// buscar elementos con texto relacionado a email/smtp/dominio en el area principal
const hits = await page.evaluate(() => {
  const out = [];
  const walk = (el) => {
    if (el.nodeType === 1) {
      const txt = (el.innerText || el.textContent || '').trim();
      if (txt && txt.length < 200 && /smtp|dominio|domain|sender|remitente|email|correo|verify|verific/i.test(txt)) {
        out.push({ tag: el.tagName, cls: (el.className || '').toString().slice(0, 60), txt: txt.slice(0, 150) });
      }
      for (const c of el.children) walk(c);
    }
  };
  walk(document.body);
  return out.slice(0, 60);
});
console.log('\n=== ELEMENTOS email/dominio ===');
console.log(JSON.stringify(hits, null, 1));

// todos los TABS/links dentro del area de settings
const tabs = await page.evaluate(() => {
  return Array.from(document.querySelectorAll('a[href*="settings"]')).map(a => ({
    href: a.getAttribute('href'),
    txt: (a.innerText || '').trim().slice(0, 50),
  })).filter(x => x.href && x.href.includes('smtp') || (x.txt && /email|smtp|domin/i.test(x.txt)));
});
console.log('\n=== TABS settings relacionados ===');
console.log(JSON.stringify(tabs, null, 1));

await browser.close();
process.exit(0);
