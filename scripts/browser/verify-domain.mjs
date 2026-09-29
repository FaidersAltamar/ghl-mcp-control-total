#!/usr/bin/env node
// Conecta a Chrome local (CDP) y maneja la pantalla de Dominios Dedicados de Dropi/GHL.
// Uso: node scripts/browser/verify-domain.mjs <accion>
//   accion = "status"  -> screenshot + volcar texto/botones de la pagina
//   accion = "verify"  -> buscar y pulsar el boton de verificar el dominio
import { chromium } from 'playwright';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..', '..');
const REPORTS = join(ROOT, 'reports', 'browser');
mkdirSync(REPORTS, { recursive: true });

const action = process.argv[2] || 'status';
const DOMAIN = 'mail.controlads.com.co';
const DEDICATED_URL =
  'https://crm.dropi.co/v2/location/kNcygEmVTrhIueZQMDXM/settings/smtp_service/dedicated-domains';

const CDP_URL = 'http://localhost:9223';

async function connect() {
  let browser;
  try {
    browser = await chromium.connectOverCDP(CDP_URL);
  } catch (e) {
    console.error('No se pudo conectar a Chrome en ' + CDP_URL);
    console.error(e.message);
    process.exit(1);
  }
  return browser;
}

function findDropiPage(browser) {
  for (const ctx of browser.contexts()) {
    for (const page of ctx.pages()) {
      if (page.url().includes('crm.dropi.co')) return page;
    }
  }
  return null;
}

const browser = await connect();
let page = findDropiPage(browser);

if (!page) {
  // abrir en una pestaña nueva del contexto existente
  const ctx = browser.contexts()[0];
  page = await ctx.newPage();
  await page.goto(DEDICATED_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
} else {
  await page.bringToFront();
  if (!page.url().includes('dedicated-domains')) {
    await page.goto(DEDICATED_URL, { waitUntil: 'domcontentloaded', timeout: 60000 });
  } else {
    await page.reload({ waitUntil: 'domcontentloaded', timeout: 60000 });
  }
}

await page.waitForTimeout(6000);

if (action === 'status') {
  await page.screenshot({ path: join(REPORTS, 'dedicated-domains.png'), fullPage: false });
  const bodyText = await page.evaluate(() => document.body.innerText);
  console.log('=== TEXTO DE LA PAGINA (primeros 4000 chars) ===');
  console.log(bodyText.slice(0, 4000));

  // buscar el dominio y botones
  const hasDomain = bodyText.includes(DOMAIN) || bodyText.includes('controlads');
  console.log('\n=== DOMINIO PRESENTE ===', hasDomain);

  // listar botones/enlaces relevantes
  const buttons = await page.evaluate(() => {
    return Array.from(document.querySelectorAll('button, a, [role="button"]'))
      .map((el) => (el.innerText || el.textContent || '').trim())
      .filter((t) => t.length > 0 && t.length < 60)
      .filter((t) => /verif|warm|domain|re-?verify|reverif|calent|status|estado/i.test(t));
  });
  console.log('=== BOTONES/ENLACES RELEVANTES ===');
  console.log(JSON.stringify([...new Set(buttons)], null, 2));
  console.log('\nScreenshot guardado en reports/browser/dedicated-domains.png');
}

if (action === 'verify') {
  // Intentar localizar el botón de verificar del dominio
  const candidates = page.getByText(/verif|re-?verify|reverif|verificar/i);
  const count = await candidates.count();
  console.log('Candidatos a boton verify:', count);
  for (let i = 0; i < count; i++) {
    const t = await candidates.nth(i).innerText().catch(() => '');
    console.log(`  [${i}] ${JSON.stringify(t)}`);
  }
}

await browser.close();
