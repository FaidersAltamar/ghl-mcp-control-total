// Cliente IA (compatible con OpenAI) para el chatbot de WhatsApp.
import { KNOWLEDGE } from './knowledge.js';

const AI_KEY = () => process.env.AI_API_KEY;
const AI_BASE = () => process.env.AI_BASE_URL || 'https://r7k2xq9m.scal7.com/v1';
const AI_MODEL = () => process.env.AI_MODEL || 'faiders';

const PERSONA_DEFAULT = (nombre) =>
  `Eres "Faiders", el asistente virtual de Faiders Altamar (Control Ads).${nombre ? ` Estás hablando con ${nombre}.` : ''} Responde en español, de forma breve, amable y útil.`;

// System prompt completo: personalidad (configurable) + memoria larga + fuente de conocimiento.
export function buildSystemPrompt(nombre, resumen = '', knowledge = KNOWLEDGE) {
  const persona = process.env.AI_SYSTEM_PROMPT || PERSONA_DEFAULT(nombre);
  const memoria = resumen
    ? `\n\n## MEMORIA DE ESTA CONVERSACIÓN (lo hablado antes con este contacto)\n${resumen}`
    : '';
  return `${persona}\n\n${knowledge}${memoria}`;
}

// Envía una conversación completa (con historial) al modelo.
export async function aiChatMessages(messages) {
  const resp = await fetch(`${AI_BASE()}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: 'Bearer ' + AI_KEY(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ model: AI_MODEL(), messages }),
  });
  const text = await resp.text();
  if (!resp.ok) throw new Error(`AI ${resp.status}: ${text.slice(0, 200)}`);
  const json = JSON.parse(text);
  return (
    (json.choices && json.choices[0] && json.choices[0].message && json.choices[0].message.content) || ''
  );
}

// Recibe el texto del usuario y devuelve la respuesta (sin memoria). Uso simple/legacy.
export async function aiChat(userText) {
  return aiChatMessages([
    { role: 'system', content: buildSystemPrompt('') },
    { role: 'user', content: userText },
  ]);
}

// Resume turnos viejos en un resumen compacto para conservar memoria a largo plazo.
export async function summarizeConversation({ previousSummary = '', turns = [] } = {}) {
  const lines = turns.map((t) => `${t.role}: ${t.content}`).join('\n');
  if (!lines) return previousSummary;
  const prompt = [
    'Resume en español y de forma breve (máx 250 palabras) esta conversación para conservar el contexto.',
    'Conserva: nombre del cliente, intereses, servicios/productos mencionados, precios o acuerdos, decisiones y próximos pasos.',
    '',
    'Resumen previo:',
    previousSummary || '(ninguno)',
    '',
    'Nueva parte de la conversación:',
    lines,
    '',
    'Nuevo resumen consolidado:',
  ].join('\n');
  const resp = await aiChatMessages([{ role: 'user', content: prompt }]);
  return (resp || previousSummary).trim();
}
