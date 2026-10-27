// POST /api/skip { topic }: deja un tema para después. Vuelve en los repasos y
// los temas que dependen de él siguen bloqueados hasta que lo superes.
import { json, error, readBody, cleanId } from '../../src/lib/util.js';

export async function onRequestPost({ request, env, data }) {
  const body = await readBody(request);
  const topic = cleanId(body.topic);
  if (!topic) return error('Tema no válido');
  await env.DB
    .prepare(
      `INSERT INTO topic_progress (email, topic, status, attempts) VALUES (?, ?, 'skipped', 0)
       ON CONFLICT (email, topic) DO UPDATE SET
         status = CASE WHEN topic_progress.status = 'completed' THEN 'completed' ELSE 'skipped' END,
         updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(data.email, topic)
    .run();
  return json({ ok: true });
}
