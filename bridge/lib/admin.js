// Protección simple para endpoints administrativos del puente.
// Usa WASENDER_WEBHOOK_SECRET como clave de administración (ya es un secreto compartido).
export function requireAdmin(req, res) {
  // La clave de administración es el primer secreto (el principal). Los demás
  // secretos (separados por coma) son para verificar webhooks de múltiples sesiones.
  const key = (process.env.WASENDER_WEBHOOK_SECRET || '').split(',')[0].trim();
  if (!key) return true; // sin clave configurada => abierto
  const provided = req.headers['x-admin-key'];
  if (provided === key) return true;
  res.status(401).json({ error: 'Unauthorized' });
  return false;
}
