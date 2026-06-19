/**
 * GHL Webhook Receiver
 *
 * Servidor listo para recibir webhooks de GoHighLevel.
 * Verifica firmas X-GHL-Signature (Ed25519) y X-WH-Signature (legacy RSA).
 *
 * Uso:
 *   GHL_WEBHOOK_PORT=3000 node webhook-server.js
 */

const express = require('express');
const crypto = require('crypto');
const app = express();

const PORT = process.env.GHL_WEBHOOK_PORT || 3000;

// Clave pública Ed25519 actual (X-GHL-Signature)
const GHL_PUBLIC_KEY = process.env.GHL_WEBHOOK_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----
MCowBQYDK2VwAyEAi2HR1srL4o18O8BRa7gVJY7G7bupbN3H9AwJrHCDiOg=
-----END PUBLIC KEY-----`;

// Clave pública RSA legacy (X-WH-Signature)
const LEGACY_PUBLIC_KEY = process.env.GHL_WEBHOOK_LEGACY_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----
MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAokvo/r9tVgcfZ5DysOSC
Frm602qYV0MaAiNnX9O8KxMbiyRKWeL9JpCpVpt4XHIcBOK4u3cLSqJGOLaPuXw6d
O0t6Q/ZVdAV5Phz+ZtzPL16iCGeK9po6D6JHBpbi989mmzMryUnQJezlYJ3DVfBcs
edpinheNnyYeFXolrJvcsjDtfAeRx5ByHQmTnSdFUzuAnC9/GepgLT9SM4nCpvux
mZMxrJt5Rw+VUaQ9B8JSvbMPpez4peKaJPZHBbU3OdeCVx5klVXXZQGNHOs8gF3k
voV5rTnXV0IknLBXlcKKAQLZcY/Q9rG6Ifi9c+5vqlvHPCUJFT5XUGG5RKgOKUJ06
2fRtN+rLYZUV+BjafxQauvC8wSWeYja63VSUruvmNj8xkx2zE/Juc+yjLjTXpIoc
maiFeAO6fUtNjDeFVkhf5LNb59vECyrHD2SQIrhgXpO4Q3dVNA5rw576PwTzNh/AM
fHKIjE4xQA1SZuYJmNnmVZLIZBlQAF9Ntd03rfadZ+yDiOXCCs9FkHibELhCHULgC
snuDJHcrGNd5/Ddm5hxGQ0ASitgHeMZ0kcIOwKDOzOU53lDza6/Y09T7sYJPQe7z0
cvj7aE4B+Ax1ZoZGPzpJlZtGXCsu9aTEGEnKzmsFqwcSsnw3JB31IGKAykT1hhTia
CeIY/OwwwNUY2yvcCAwEAAQ==
-----END PUBLIC KEY-----`;

function verifyGhlSignature(payload, signature, publicKeyPem) {
  if (!signature || signature === 'N/A') return { ok: false, reason: 'no signature' };
  try {
    const payloadBuffer = Buffer.from(payload, 'utf8');
    const signatureBuffer = Buffer.from(signature, 'base64');
    const ok = crypto.verify(null, payloadBuffer, publicKeyPem, signatureBuffer);
    return { ok, reason: ok ? null : 'verify failed' };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

function verifyLegacySignature(payload, signature, publicKeyPem) {
  if (!signature || signature === 'N/A') return { ok: false, reason: 'no signature' };
  try {
    const verifier = crypto.createVerify('SHA256');
    verifier.update(payload);
    const ok = verifier.verify(publicKeyPem, signature, 'base64');
    return { ok, reason: ok ? null : 'verify failed' };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

app.use(express.json());

app.post('/webhooks/ghl', (req, res) => {
  const payload = JSON.stringify(req.body);
  const ghlSig = req.headers['x-ghl-signature'];
  const legacySig = req.headers['x-wh-signature'];

  let verification = { ok: false, reason: 'no signature' };
  if (ghlSig) {
    verification = verifyGhlSignature(payload, ghlSig, GHL_PUBLIC_KEY);
  } else if (legacySig) {
    verification = verifyLegacySignature(payload, legacySig, LEGACY_PUBLIC_KEY);
  }

  // LOG: guarda en disco para debug
  const fs = require('fs');
  const log = {
    timestamp: new Date().toISOString(),
    headers: req.headers,
    body: req.body,
    verification
  };
  fs.appendFileSync(__dirname + '/webhooks.log', JSON.stringify(log) + '\n');

  if (!verification.ok) {
    console.error('Firma inválida:', verification.reason);
    // GHL reintentará si no es 2xx; devolvemos 401 para que lo sepan
    return res.status(401).json({ success: false, error: 'Invalid signature' });
  }

  // Procesa el webhook
  console.log('Webhook OK:', req.body.type, req.body.webhookId || '');

  // TODO: conectar con tu lógica de negocio aquí

  res.status(200).json({ success: true });
});

app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`GHL Webhook receiver escuchando en http://localhost:${PORT}/webhooks/ghl`);
});
