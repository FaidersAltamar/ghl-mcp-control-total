#!/usr/bin/env node
/**
 * Abre una sala de videollamada en Chrome headless, entra como invitado y
 * guarda una captura para verificar que no pide moderador/inicio de sesión.
 * Uso: npx -y -p playwright-core node scripts/browser/test-meeting-room.mjs <url>
 */
import { createRequire } from 'node:module';

const require = createRequire(`${process.env.npm_config_prefix || process.cwd()}/`);
let chromium;
try {
  ({ chromium } = await import('playwright-core'));
} catch {
  ({ chromium } = require('playwright-core'));
}

const url = process.argv[2];
const browser = await chromium.launch({
  executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  args: ['--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream'],
});
const page = await (await browser.newContext({ permissions: ['camera', 'microphone'] })).newPage();
await page.goto(url, { waitUntil: 'domcontentloaded' });
await page.waitForTimeout(6000);
const name = page.locator('input[placeholder], input[type="text"]').first();
if (await name.count()) await name.fill('Cliente Prueba').catch(() => {});
const join = page.getByRole('button', { name: /join|unirse|entrar|beitreten/i }).first();
if (await join.count()) await join.click().catch(() => {});
await page.waitForTimeout(8000);
const text = (await page.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 600);
await page.screenshot({ path: 'reports/meeting-room.png' });
console.log(text);
await browser.close();
