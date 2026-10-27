// GET /api/reports: lista de reportes pendientes para revisarlos.
// POST /api/reports { id }: marca un reporte como revisado.
import { json, error, readBody } from '../../src/lib/util.js';

export async function onRequestGet({ env, data }) {
  const { results } = await env.DB
    .prepare('SELECT id, kind, topic, ref, answer, exercise, at FROM reports WHERE email = ? AND resolved = 0 ORDER BY at DESC LIMIT 100')
    .bind(data.email)
    .all();
  return json({ reports: results.map((r) => ({ ...r, exercise: JSON.parse(r.exercise || 'null') })) });
}

export async function onRequestPost({ request, env, data }) {
  const body = await readBody(request);
  if (!Number.isInteger(body.id)) return error('Falta el id');
  await env.DB.prepare('UPDATE reports SET resolved = 1 WHERE id = ? AND email = ?').bind(body.id, data.email).run();
  return json({ ok: true });
}
