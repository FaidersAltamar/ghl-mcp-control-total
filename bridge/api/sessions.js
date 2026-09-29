import { listSessions, createSession } from '../lib/wasender.js';
import { requireAdmin } from '../lib/admin.js';

export default async function handler(req, res) {
  if (!requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') {
      const result = await listSessions();
      const sessions = (result.data || []).map((s) => ({
        id: s.id,
        name: s.name,
        phone_number: s.phone_number,
        status: s.status,
        webhook_url: s.webhook_url,
        webhook_enabled: s.webhook_enabled,
        last_active_at: s.last_active_at,
      }));
      return res.status(200).json({ success: true, sessions });
    }
    if (req.method === 'POST') {
      const { name, phone_number } = req.body || {};
      if (!name || !phone_number) {
        return res.status(400).json({ error: 'Faltan name y phone_number' });
      }
      const result = await createSession({ name, phone_number });
      return res.status(200).json({ success: true, session: result.data || result });
    }
    return res.status(405).json({ error: 'Method not allowed' });
  } catch (e) {
    console.error('sessions error:', e.message);
    return res.status(500).json({ success: false, error: e.message });
  }
}
