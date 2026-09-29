// Envío saliente: GHL (workflow webhook) -> WhatsApp.
// POST /api/send  { "to": "+57...", "text": "..." }
// Opcional: { "from": "+1..." } para elegir la sesión/número que envía (por id o teléfono).
// El registro en GHL del mensaje saliente lo hace el webhook (evento "message.sent").
import { sendText, getSessionApiKey } from '../lib/wasender.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const secrets = (process.env.WASENDER_WEBHOOK_SECRET || '').split(',').map((s) => s.trim()).filter(Boolean);
  if (secrets.length) {
    const sig = req.headers['x-webhook-signature'];
    if (!sig || !secrets.includes(sig)) {
      return res.status(401).json({ error: 'Invalid signature' });
    }
  }

  const { to, text, from } = req.body || {};
  if (!to || !text) {
    return res.status(400).json({ error: 'Faltan campos "to" y "text"' });
  }

  try {
    let apiKey;
    let fromInfo = null;
    if (from) {
      fromInfo = await getSessionApiKey(from);
      apiKey = fromInfo.api_key;
    }
    const sent = await sendText(to, text, apiKey);
    return res.status(200).json({ success: true, sent, from: fromInfo });
  } catch (e) {
    console.error('send error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
