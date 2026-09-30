#!/usr/bin/env node
/**
 * Crea (si no existen) los campos personalizados de SorryMark en GHL e imprime sus ids.
 * Uso: node scripts/sorrymark/create-ghl-fields.mjs
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });
const LID = getLocationId();
const h = { Authorization: `Bearer ${getPitToken()}`, Version: '2021-07-28', 'Content-Type': 'application/json' };

export const FIELDS = [
  ['total_recargado', 'SorryMark Total Recargado (USD)', 'NUMERICAL'],
  ['total_comprado', 'SorryMark Total Comprado (USD)', 'NUMERICAL'],
  ['pedidos', 'SorryMark Pedidos', 'NUMERICAL'],
  ['ultimo_pedido', 'SorryMark Último Pedido', 'DATE'],
  ['productos', 'SorryMark Productos', 'LARGE_TEXT'],
  ['saldo', 'SorryMark Saldo (USD)', 'NUMERICAL'],
  ['registro', 'SorryMark Registro', 'DATE'],
  ['metodo_pago', 'SorryMark Método de Pago', 'TEXT'],
  ['reembolsos', 'SorryMark Reembolsos', 'NUMERICAL'],
  ['disputas', 'SorryMark Disputas', 'NUMERICAL'],
  ['estado', 'SorryMark Estado', 'TEXT'],
  ['user_id', 'SorryMark User ID', 'TEXT'],
];

const existing = (await (await fetch(`https://services.leadconnectorhq.com/locations/${LID}/customFields`, { headers: h })).json()).customFields || [];
const ids = {};
for (const [key, name, dataType] of FIELDS) {
  let f = existing.find((x) => x.name === name);
  if (!f) {
    const r = await fetch(`https://services.leadconnectorhq.com/locations/${LID}/customFields`, {
      method: 'POST', headers: h, body: JSON.stringify({ name, dataType, model: 'contact' }),
    });
    const j = await r.json();
    if (!r.ok) { console.error('✗', name, r.status, JSON.stringify(j).slice(0, 200)); continue; }
    f = j.customField || j;
    console.log('creado', name);
  }
  ids[key] = f.id;
}
console.log(JSON.stringify(ids));
