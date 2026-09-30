// Envío desde la bandeja de chats del sitio.
// POST /api/inbox-send  (header x-inbox-secret)
// { "from": "17863728411", "to": "+57...", "text": "...", "mediaUrl": "https://...", "mediaType": "image|video|audio|document", "fileName": "..." }
import { sendMessage, getSessionApiKey } from '../lib/wasender.js';

const MEDIA_FIELD = { image: 'imageUrl', video: 'videoUrl', audio: 'audioUrl', voice: 'audioUrl', document: 'documentUrl', sticker: 'stickerUrl' };

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const secret = process.env.INBOX_SECRET;
  if (!secret || req.headers['x-inbox-secret'] !== secret) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { from, to, text, mediaUrl, mediaType, fileName } = req.body || {};
  if (!from || !to || (!text && !mediaUrl)) {
    return res.status(400).json({ error: 'Faltan "from", "to" y "text" o "mediaUrl"' });
  }
  if (mediaUrl && !MEDIA_FIELD[mediaType]) {
    return res.status(400).json({ error: 'mediaType inválido' });
  }

  try {
    const session = await getSessionApiKey(from);
    if (session.status !== 'connected') {
      return res.status(409).json({ error: `El número ${session.phone_number} está desconectado` });
    }
    const fields = { text };
    if (mediaUrl) {
      fields[MEDIA_FIELD[mediaType]] = mediaUrl;
      if (fileName) fields.fileName = fileName;
    }
    const sent = await sendMessage(to, fields, session.api_key);
    return res.status(200).json({ success: true, data: sent?.data || sent });
  } catch (e) {
    console.error('inbox-send error:', e.message);
    return res.status(502).json({ success: false, error: e.message.slice(0, 300) });
  }
}
