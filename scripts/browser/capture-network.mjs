#!/usr/bin/env node
import { chromium } from 'playwright';

const browser = await chromium.connectOverCDP('http://localhost:9223');
const ctx = browser.contexts()[0];
let page = ctx.pages().find(p => p.url().includes('crm.dropi.co')) || ctx.pages()[0];
await page.bringToFront();

const calls = [];
page.on('request', (r) => {
  if (/backend|email|smtp|domain|leadconnector|dropi/i.test(r.url())) {
    calls.push({ type: 'REQ', method: r.method(), url: r.url().slice(0, 160) });
  }
});
page.on('response', (r) => {
  if (/backend|email|smtp|domain|leadconnector|dropi/i.test(r.url())) {
    calls.push({ type: 'RES', status: r.status(), url: r.url().slice(0, 160) });
  }
});

await page.goto('https://crm.dropi.co/v2/location/kNcygEmVTrhIueZQMDXM/settings/smtp_service/dedicated-domains', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForTimeout(8000);

console.log('=== LLAMADAS DE RED (email/backend/domain) ===');
for (const c of calls) {
  console.log(`${c.type} ${c.status !== undefined ? c.status : ''} ${c.method || ''} ${c.url}`);
}

await browser.close();
process.exit(0);
