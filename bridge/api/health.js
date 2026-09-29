// Health check + verificación de variables de entorno.
export default async function handler(req, res) {
  const required = {
    GHL_LOCATION_ID: !!process.env.GHL_LOCATION_ID,
    GHL_PIT_TOKEN: !!process.env.GHL_PIT_TOKEN,
    GHL_FIREBASE_REFRESH_TOKEN: !!process.env.GHL_FIREBASE_REFRESH_TOKEN,
    WASENDER_API_KEY: !!process.env.WASENDER_API_KEY,
    WASENDER_PAT: !!process.env.WASENDER_PAT,
  };
  const optional = {
    WASENDER_WEBHOOK_SECRET: !!process.env.WASENDER_WEBHOOK_SECRET,
  };
  const ok = Object.values(required).every(Boolean);
  return res.status(ok ? 200 : 500).json({ ok, required, optional });
}
