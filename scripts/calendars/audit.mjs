#!/usr/bin/env node
/**
 * Audit calendars — usage, team, notifications, widget URLs.
 * Uso: node scripts/calendars/audit.mjs
 */
import { loadEnv, getPitToken, getLocationId } from '../../lib/env.mjs';

loadEnv({ required: true });

const BASE = process.env.GHL_API_BASE || 'https://services.leadconnectorhq.com';
const VERSION = process.env.GHL_API_VERSION || '2021-07-28';
const LID = getLocationId();
const PIT = getPitToken();

const PRIORITY = {
  bJT5h32OkoOdSfV2zd4O: 'Meta (Facebook/Instagram)',
  o6c2SOIoEkjEfKtBPUNN: 'TikTok',
};

async function pitGet(path) {
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      Authorization: `Bearer ${PIT}`,
      Version: VERSION,
      'Content-Type': 'application/json',
    },
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`${path} → ${res.status}: ${JSON.stringify(body)}`);
  return body;
}

const now = Date.now();
const start90 = now - 90 * 24 * 60 * 60 * 1000;
const endFuture = now + 365 * 24 * 60 * 60 * 1000;

const { calendars = [] } = await pitGet(`/calendars/?locationId=${LID}`);

let groups = [];
try {
  const g = await pitGet(`/calendars/groups?locationId=${LID}`);
  groups = g.groups || g.calendarGroups || [];
} catch {
  groups = [];
}
const groupById = Object.fromEntries(groups.map((x) => [x.id, x]));

let users = [];
try {
  const u = await pitGet(`/users/?locationId=${LID}`);
  users = u.users || [];
} catch {
  users = [];
}
const userById = Object.fromEntries(users.map((u) => [u.id, u]));

function userName(id) {
  const u = userById[id];
  if (!u) return id || '—';
  return `${u.name || u.firstName || ''} ${u.lastName || ''}`.trim() || u.email || id;
}

async function appointments(calendarId) {
  try {
    const q = new URLSearchParams({
      locationId: LID,
      calendarId,
      startTime: String(start90),
      endTime: String(endFuture),
    });
    const res = await pitGet(`/calendars/events?${q}`);
    const events = res.events || res.appointments || [];
    return events.filter((e) => e.appointmentStatus !== 'cancelled');
  } catch {
    return [];
  }
}

async function notifications(calendarId) {
  try {
    const res = await pitGet(`/calendars/${calendarId}/notifications?locationId=${LID}`);
    return res.notifications || res || [];
  } catch {
    return [];
  }
}

const results = [];

for (const cal of calendars) {
  const [events, notifs] = await Promise.all([appointments(cal.id), notifications(cal.id)]);
  const past = events.filter((e) => new Date(e.startTime) < new Date());
  const future = events.filter((e) => new Date(e.startTime) >= new Date());
  const last = past.length
    ? past.sort((a, b) => new Date(b.startTime) - new Date(a.startTime))[0].startTime
    : null;

  const members = cal.teamMembers || cal.calendarMembers || [];
  const team = members.map((m) => userName(typeof m === 'string' ? m : m.userId || m.id));

  const emails = Array.isArray(notifs) ? notifs.filter((n) => n.channel !== 'sms') : [];
  const immediate = emails.some((n) => !n.beforeTime?.length && !n.delayedEmail);
  const delayed = emails.some((n) => n.delayedEmail || (n.beforeTime && n.beforeTime.length > 0));

  const group = cal.groupId ? groupById[cal.groupId] : null;

  results.push({
    priority: PRIORITY[cal.id] || null,
    id: cal.id,
    name: cal.name,
    slug: cal.slug || cal.widgetSlug || null,
    active: cal.isActive !== false,
    widgetUrl: `https://link.dropi.co/widget/booking/${cal.id}`,
    group: group ? `${group.name}` : null,
    groupSlug: group?.slug || null,
    team: team.length ? team : [],
    appointments90d: events.length,
    past: past.length,
    future: future.length,
    lastAppointment: last,
    emailCount: emails.length,
    emailImmediate: immediate,
    emailDelayed: delayed,
    slotDuration: cal.slotDuration,
    eventType: cal.eventType,
    description: (cal.description || '').slice(0, 100),
  });
}

results.sort((a, b) => {
  if (a.priority && !b.priority) return -1;
  if (!a.priority && b.priority) return 1;
  return b.appointments90d - a.appointments90d;
});

console.log(JSON.stringify({ locationId: LID, total: results.length, calendars: results }, null, 2));
