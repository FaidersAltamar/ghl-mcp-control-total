#!/usr/bin/env node
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const browser = await chromium.connectOverCDP('http://localhost:9223');
const ctx = browser.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('crm.dropi.co')) || ctx.pages()[0];
await page.bringToFront();
mkdirSync('reports/browser', { recursive: true });

// cerrar modal (Cancelar o X)
for (const label of ['Cancelar', '×']) {
  try {
    const btn = page.getByText(label, { exact: false }).first();
    if (await btn.count()) {
      await btn.click({ timeout: 4000 });
      console.log('clickeado:', label);
      await page.waitForTimeout(3000);
      break;
    }
  } catch (e) {}
}

// cerrar cualquier otro modal con X
await page.keyboard.press('Escape');
await page.waitForTimeout(3000);

console.log('URL:', page.url());
await page.screenshot({ path: 'reports/browser/email-services-2.png', fullPage: true });

const body = await page.evaluate(() => document.body.innerText);
console.log('=== BODY (5000) ===');
console.log(body.slice(0, 5000));

await browser.close();
process.exit(0);
