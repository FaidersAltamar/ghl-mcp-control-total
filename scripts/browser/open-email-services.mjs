#!/usr/bin/env node
// Conecta a Chrome (9223), hace clic en "Email Services" del sidebar, y vuelca la pagina.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const browser = await chromium.connectOverCDP('http://localhost:9223');
const ctx = browser.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('crm.dropi.co')) || ctx.pages()[0] || await ctx.newPage();
await page.bringToFront();

mkdirSync('reports/browser', { recursive: true });

// asegurarse de estar en configuracion
if (!page.url().includes('/settings')) {
  await page.goto('https://crm.dropi.co/v2/location/kNcygEmVTrhIueZQMDXM/settings', { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(4000);
}

// clic en "Email Services"
const emailLink = page.getByText('Email Services', { exact: false }).first();
try {
  await emailLink.click({ timeout: 8000 });
  console.log('CLICK en Email Services OK');
} catch (e) {
  console.log('No se pudo clickear Email Services:', e.message.split('\n')[0]);
}

await page.waitForTimeout(6000);
console.log('URL ahora:', page.url());
await page.screenshot({ path: 'reports/browser/email-services.png', fullPage: true });
const body = await page.evaluate(() => document.body.innerText);
console.log('=== TEXTO (6000) ===');
console.log(body.slice(0, 6000));

await browser.close();
process.exit(0);
