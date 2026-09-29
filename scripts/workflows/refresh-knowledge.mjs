// Mantiene actualizada la base de conocimiento del bot consumiendo el sitio faidersaltamar.com.
// Uso: node scripts/workflows/refresh-knowledge.mjs
//
// 1. Descarga el HTML del sitio.
// 2. Extrae el texto limpio (título, encabezados, párrafos, enlaces).
// 3. Arma una base de conocimiento estructurada (conserva tono/reglas + enlaces de agendamiento).
// 4. La sube a Supabase (tabla public.bot_knowledge) si hay SUPABASE_SERVICE_KEY en .env.
//    Si no, la guarda en reports/faiders-site-knowledge.txt para revisión.

import { readFileSync, writeFileSync } from 'node:fs';
import { loadEnv } from '../../lib/env.mjs';

const SITE = 'https://faidersaltamar.com';
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://mpojxlotpsmblaibxaem.supabase.co';
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || '';
const KNOWLEDGE_KEY = process.env.KNOWLEDGE_KEY || 'faiders';

function decodeHtml(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&aacute;/gi, 'á').replace(/&eacute;/gi, 'é').replace(/&iacute;/gi, 'í')
    .replace(/&oacute;/gi, 'ó').replace(/&uacute;/gi, 'ú').replace(/&ntilde;/gi, 'ñ');
}

function extractText(html) {
  let h = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, ' ')
    .replace(/<svg[\s\S]*?<\/svg>/gi, ' ');
  // Marcar saltos de bloque
  h = h.replace(/<\/(h[1-6]|p|li|div|section|article|tr|ul|ol|br)>/gi, '\n');
  h = h.replace(/<br\s*\/?>/gi, '\n');
  // Links con texto: conservar [texto](url)
  h = h.replace(/<a[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (m, url, txt) => {
    const t = decodeHtml(txt.replace(/<[^>]+>/g, '').trim());
    return t ? `${t} (${url})` : url;
  });
  h = h.replace(/<[^>]+>/g, ' ');
  h = decodeHtml(h);
  return h.split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean);
}

function buildKnowledge(lines, title) {
  const body = lines.join('\n');
  const TONO = `## TONO Y REGLAS
- Responde en español, breve, amable y directo.
- No inventes precios, promesas ni resultados garantizados. Para cotizar, ofrece agendar una llamada estratégica o que un asesor le escriba.
- Nombra productos/servicios con su URL real cuando corresponda.
- Si no sabes algo, dilo y ofrece agendar una llamada.`;

  return `## Quién eres
Eres "Faiders", el asistente virtual de Faiders Altamar (Control Ads). Sitio: ${SITE}

## Contacto y agendamiento
- Sitio principal: ${SITE}
- Comunidad RUSH (gratis): https://www.skool.com/rush
- Este chat de WhatsApp es el canal directo. Para cotizar o comprar, ofrece "agendar una llamada estratégica" (Meta Ads o TikTok Ads).
- Llamada Meta Ads: https://link.dropi.co/widget/booking/bJT5h32OkoOdSfV2zd4O
- Llamada TikTok Ads: https://link.dropi.co/widget/booking/o6c2SOIoEkjEfKtBPUNN

## CONTENIDO ACTUAL DEL SITIO (${title || 'faidersaltamar.com'})
${body}

${TONO}`.trim();
}

async function main() {
  await loadEnv();
  console.log('Descargando', SITE, '...');
  const resp = await fetch(SITE, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
  const html = await resp.text();
  const title = (html.match(/<title[^>]*>([^<]*)<\/title>/i) || [])[1] || '';
  const lines = extractText(html);
  console.log('Líneas de texto extraídas:', lines.length);

  const knowledge = buildKnowledge(lines, title);
  console.log('Conocimiento generado:', knowledge.length, 'chars');

  if (SERVICE_KEY) {
    const r = await fetch(`${SUPABASE_URL}/rest/v1/bot_knowledge?key=eq.${KNOWLEDGE_KEY}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY,
        Authorization: `Bearer ${SERVICE_KEY}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ content: knowledge, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) throw new Error(`Supabase update ${r.status}: ${await r.text()}`);
    console.log('✔ Conocimiento actualizado en Supabase.');
  } else {
    const out = 'reports/faiders-site-knowledge.txt';
    writeFileSync(out, knowledge, 'utf8');
    console.log(`No hay SUPABASE_SERVICE_KEY. Guardado en ${out} para revisión.`);
  }
}

main().catch((e) => { console.error('ERROR:', e.message); process.exit(1); });
