import { getSessionQr } from '../lib/wasender.js';
import { requireAdmin } from '../lib/admin.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const id = req.query.id;
    if (!id) return res.status(400).json({ error: 'Falta id' });
    const result = await getSessionQr(id);
    return res.status(200).json({ success: true, data: result.data || result });
  } catch (e) {
    console.error('qrcode error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
