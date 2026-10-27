// Utilidades compartidas por las funciones de la API.

export function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

export function error(message, status = 400) {
  return json({ error: message }, status);
}

export async function readBody(request) {
  try {
    return await request.json();
  } catch {
    return {};
  }
}

// Fecha de hoy en Madrid, formato YYYY-MM-DD.
export function today(date = new Date()) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

// Días entre dos fechas YYYY-MM-DD (b - a).
export function dayDiff(a, b) {
  const ms = Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z');
  return Math.round(ms / 86400000);
}

export function addDays(day, n) {
  const d = new Date(Date.parse(day + 'T00:00:00Z') + n * 86400000);
  return d.toISOString().slice(0, 10);
}

// Semana ISO (ej. "2026-W44") de una fecha YYYY-MM-DD.
export function isoWeek(day) {
  const d = new Date(Date.parse(day + 'T00:00:00Z'));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

// Lee un archivo estático del propio sitio (contenido, tienda, árbol).
export async function asset(env, request, path) {
  const res = await env.ASSETS.fetch(new URL(path, request.url));
  if (!res.ok) throw new Error(`No se pudo leer ${path}`);
  return res.json();
}

export function cleanId(value) {
  return typeof value === 'string' && /^[a-z0-9:_-]{1,80}$/i.test(value) ? value : null;
}
