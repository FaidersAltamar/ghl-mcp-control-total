// Endpoint de la base de conocimiento del bot.
// GET  /api/knowledge -> devuelve el conocimiento actual (Supabase o estático).
// POST /api/knowledge -> actualiza el conocimiento (requiere SUPABASE_SERVICE_KEY y secreto admin).

import { KNOWLEDGE, getKnowledge } from '../lib/knowledge.js';
import { requireAdmin } from '../lib/admin.js';

const SUPABASE_URL = () => process.env.SUPABASE_URL;
const SERVICE_KEY = () => process.env.SUPABASE_SERVICE_KEY;
const KNOWLEDGE_KEY = process.env.KNOWLEDGE_KEY || 'faiders';

export default async function handler(req, res) {
  if (req.method === 'GET') {
    const content = await getKnowledge();
    return res.status(200).json({ key: KNOWLEDGE_KEY, length: content.length, content });
  }

  if (req.method === 'POST') {
    if (!requireAdmin(req, res)) return;
    const body = req.body && (typeof req.body === 'string' ? JSON.parse(req.body || '{}') : req.body);
    const content = (body && body.content || '').trim();
    if (!content) return res.status(400).json({ ok: false, error: 'content requerido' });
    if (!SERVICE_KEY()) {
      return res.status(503).json({ ok: false, error: 'SUPABASE_SERVICE_KEY no configurado en Vercel' });
    }
    const r = await fetch(`${SUPABASE_URL()}/rest/v1/bot_knowledge?key=eq.${KNOWLEDGE_KEY}`, {
      method: 'PATCH',
      headers: {
        apikey: SERVICE_KEY(),
        Authorization: `Bearer ${SERVICE_KEY()}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify({ content, updated_at: new Date().toISOString() }),
    });
    if (!r.ok) return res.status(502).json({ ok: false, error: `Supabase ${r.status}` });
    return res.status(200).json({ ok: true, length: content.length });
  }

  return res.status(405).json({ error: 'Method not allowed' });
}
