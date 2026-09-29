#!/usr/bin/env node
/**
 * Crea + publica workflows GHL que notifican al equipo por WhatsApp cuando se
 * agenda una cita (TikTok y Meta), usando el número americano como remitente.
 *
 * Cada workflow: trigger "appointment" -> webhook (aviso inmediato) ->
 *   wait 24h antes -> webhook (recordatorio) -> wait 1h antes -> webhook (recordatorio).
 *
 * Uso: node scripts/workflows/create-team-notify-workflows.mjs
 */
import { randomUUID } from 'crypto';
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });

const LOC = getLocationId();
const USER_ID = process.env.GHL_USER_ID || 'd4QvP27fL7tIKcutJNfd';

const WEBHOOK_URL = process.env.NOTIFY_WEBHOOK_URL || 'https://bridge-iota-opal.vercel.app/api/appointment-notify';
const SECRET = process.env.APPOINTMENT_NOTIFY_SECRET;
if (!SECRET) throw new Error('APPOINTMENT_NOTIFY_SECRET no configurado en .env');

const CALENDARS = [
  { id: 'o6c2SOIoEkjEfKtBPUNN', label: 'TikTok', name: 'Cita TikTok → WhatsApp equipo' },
  { id: 'bJT5h32OkoOdSfV2zd4O', label: 'Meta', name: 'Cita Meta → WhatsApp equipo' },
];

function webhookStep(kind, calendarId, order, parentKey, next) {
  const step = {
    id: randomUUID(),
    order,
    name: kind === 'booked' ? 'Avisar equipo (nueva cita)' : 'Recordatorio al equipo',
    type: 'webhook',
    attributes: {
      url: WEBHOOK_URL,
      method: 'POST',
      bodyType: 'json',
      body: JSON.stringify({
        secret: SECRET,
        kind,
        calendar_id: calendarId,
        name: '{{contact.first_name}} {{contact.last_name}}',
        phone: '{{contact.phone}}',
        when: '{{appointment.start_time}}',
        location: '{{appointment.location}}',
      }),
    },
  };
  if (parentKey !== undefined) step.parentKey = parentKey;
  if (next !== undefined) step.next = next;
  return step;
}

function waitStep(hoursBefore, order, parentKey, next) {
  const step = {
    id: randomUUID(),
    order,
    name: `Esperar hasta ${hoursBefore}h antes`,
    type: 'wait',
    attributes: {
      type: 'appointment',
      appointmentStartAfter: {
        when: 'before',
        type: 'hours',
        value: hoursBefore,
      },
      appointmentCondition: 'next',
      isHybridAction: true,
      hybridActionType: 'wait',
    },
  };
  if (parentKey !== undefined) step.parentKey = parentKey;
  if (next !== undefined) step.next = next;
  return step;
}

async function createWorkflow({ id, label, name }) {
  const sBooked = webhookStep('booked', id, 0);
  const sWait24 = waitStep(24, 1);
  const sRemind24 = webhookStep('reminder', id, 2);
  const sWait1 = waitStep(1, 3);
  const sRemind1 = webhookStep('reminder', id, 4);

  // Encadenar (lineal): next = siguiente, parentKey = anterior.
  sBooked.parentKey = null;
  sBooked.next = sWait24.id;
  sWait24.parentKey = sBooked.id;
  sWait24.next = sRemind24.id;
  sRemind24.parentKey = sWait24.id;
  sRemind24.next = sWait1.id;
  sWait1.parentKey = sRemind24.id;
  sWait1.next = sRemind1.id;
  sRemind1.parentKey = sWait1.id;
  // último paso sin "next" (termina el flujo)

  const templates = [sBooked, sWait24, sRemind24, sWait1, sRemind1];

  console.log(`\n=== ${label}: creando workflow... ===`);
  const created = await ghlWorkflowFetch(`/workflow/${LOC}`, {
    method: 'POST',
    body: JSON.stringify({ name, workflowData: { templates } }),
  });
  const wfId = created.id || created._id || created.workflowId;
  console.log('Workflow id:', wfId);

  const current = await ghlWorkflowFetch(`/workflow/${LOC}/${wfId}?includeScheduledPauseInfo=true&sessionId=test`);
  await ghlWorkflowFetch(`/workflow/${LOC}/${wfId}`, {
    method: 'PUT',
    body: JSON.stringify({
      version: current.version,
      name,
      status: 'draft',
      allowMultiple: true,
      removeContactFromLastStep: true,
      workflowData: { templates },
    }),
  });

  console.log('Trigger appointment...');
  const trig = await ghlWorkflowFetch(`/workflow/${LOC}/trigger`, {
    method: 'POST',
    body: JSON.stringify({
      workflowId: wfId,
      type: 'appointment',
      name: `Cita agendada - ${label}`,
      active: true,
      conditions: [
        {
          operator: '==',
          field: 'calendar.id',
          value: id,
          title: 'In calendar',
          type: 'select',
        },
        {
          operator: '==',
          field: 'appointment.status',
          value: 'confirmed',
          title: 'Appointment status is',
          type: 'select',
        },
      ],
      actions: [{ workflow_id: wfId, type: 'add_to_workflow' }],
    }),
  });
  const trigId = trig.id || trig._id;
  console.log('Trigger id:', trigId);

  await ghlWorkflowFetch(`/workflow/${LOC}/trigger/${trigId}`, {
    method: 'PUT',
    body: JSON.stringify({ targetActionId: sBooked.id, active: true }),
  });

  console.log('Publicando...');
  await ghlWorkflowFetch(`/workflow/${LOC}/change-status/${wfId}`, {
    method: 'PUT',
    body: JSON.stringify({ status: 'published', updatedBy: USER_ID }),
  });

  return { wfId, trigId, firstStep: sBooked.id, label };
}

const results = [];
for (const cal of CALENDARS) {
  try {
    results.push(await createWorkflow(cal));
  } catch (e) {
    console.error(`ERROR ${cal.label}:`, e.message);
    results.push({ error: e.message, label: cal.label });
  }
}

console.log('\n=== RESULTADO ===');
console.log(JSON.stringify(results, null, 2));
