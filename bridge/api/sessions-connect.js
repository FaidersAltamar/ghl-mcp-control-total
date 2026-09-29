import { connectSession } from '../lib/wasender.js';
import { requireAdmin } from '../lib/admin.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  try {
    const { id, linkMethod } = req.body || {};
    if (!id) return res.status(400).json({ error: 'Falta id' });
    const result = await connectSession(id, linkMethod || 'qr');
    return res.status(200).json({ success: true, data: result.data || result });
  } catch (e) {
    console.error('connect error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
