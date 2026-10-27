// POST /api/report { kind, topic, ref, answer, exercise }
// "Mi respuesta también vale" o "este ejercicio de IA tiene un error". No da puntos: queda para revisar.
import { json, error, readBody, cleanId } from '../../src/lib/util.js';

export async function onRequestPost({ request, env, data }) {
  const body = await readBody(request);
  const kind = ['valid_answer', 'ai_error'].includes(body.kind) ? body.kind : null;
  if (!kind) return error('Tipo de reporte no válido');
  const topic = cleanId(body.topic);
  const ref = cleanId(body.ref);
  const answer = String(body.answer ?? '').slice(0, 500);
  const exercise = JSON.stringify(body.exercise ?? null).slice(0, 4000);

  const stmts = [
    env.DB
      .prepare('INSERT INTO reports (email, kind, topic, ref, answer, exercise) VALUES (?, ?, ?, ?, ?, ?)')
      .bind(data.email, kind, topic, ref, answer, exercise),
  ];
  // Un ejercicio de IA reportado deja de salir.
  const aiId = ref && ref.startsWith('ai-') ? Number(ref.slice(3)) : null;
  if (kind === 'ai_error' && Number.isInteger(aiId)) {
    stmts.push(env.DB.prepare('UPDATE ai_exercises SET reported = 1 WHERE id = ?').bind(aiId));
  }
  await env.DB.batch(stmts);
  return json({ ok: true });
}
