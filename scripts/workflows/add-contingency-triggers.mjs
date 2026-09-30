#!/usr/bin/env node
/**
 * Añade a los workflows de aviso al equipo un disparador para los calendarios de
 * contingencias (Contingencias Facebook → Meta, Contingencias TikTok → TikTok).
 * Idempotente: no duplica si ya existe.
 * Uso: node scripts/workflows/add-contingency-triggers.mjs
 */
import { loadEnv, getLocationId } from '../../lib/env.mjs';
import { ghlWorkflowFetch } from '../../lib/ghl-auth.mjs';

loadEnv({ required: true });
const LOC = getLocationId();

const PLAN = [
  { wf: '8f124c53-25a4-44aa-bfa4-18d0507a132e', cal: 'JGiNpYTCf6w3BwpAdChw', name: 'Cita agendada - Contingencias Facebook' },
  { wf: '74ae799e-650f-4109-8a9b-0835ab1b9a9d', cal: '2vVaqq8c1uZ2xSpXW6Cr', name: 'Cita agendada - Contingencias TikTok' },
];

for (const p of PLAN) {
  const existing = await ghlWorkflowFetch(`/workflow/${LOC}/trigger?workflowId=${p.wf}`);
  if (existing.some((t) => !t.deleted && t.conditions?.some((c) => c.field === 'calendar.id' && c.value === p.cal))) {
    console.log(`YA EXISTE ${p.name}`);
    continue;
  }
  const targetActionId = existing[0]?.targetActionId;
  const trig = await ghlWorkflowFetch(`/workflow/${LOC}/trigger`, {
    method: 'POST',
    body: JSON.stringify({
      workflowId: p.wf,
      type: 'appointment',
      name: p.name,
      active: true,
      conditions: [
        { operator: '==', field: 'calendar.id', value: p.cal, title: 'In calendar', type: 'select' },
        { operator: '==', field: 'appointment.status', value: 'confirmed', title: 'Appointment status is', type: 'select' },
      ],
      actions: [{ workflow_id: p.wf, type: 'add_to_workflow' }],
    }),
  });
  const id = trig.id || trig._id;
  await ghlWorkflowFetch(`/workflow/${LOC}/trigger/${id}`, {
    method: 'PUT',
    body: JSON.stringify({ targetActionId, active: true }),
  });
  console.log(`OK ${p.name} (${id})`);
}
