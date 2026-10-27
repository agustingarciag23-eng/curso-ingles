// POST /api/placement { passed: [temas] }: resultado del test de nivel.
import { json, readBody, asset } from '../../src/lib/util.js';

export async function onRequestPost({ request, env, data }) {
  const email = data.email;
  const body = await readBody(request);
  const tree = await asset(env, request, '/content/tree.json');
  const passed = Array.isArray(body.passed) ? body.passed.filter((t) => tree.topics[t]) : [];
  const db = env.DB;
  const stmts = passed.map((topic) =>
    db
      .prepare(
        `INSERT INTO topic_progress (email, topic, status, best, attempts) VALUES (?, ?, 'completed', 1, 0)
         ON CONFLICT (email, topic) DO UPDATE SET status = 'completed', best = MAX(COALESCE(topic_progress.best, 0), 1),
           updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(email, topic),
  );
  stmts.push(db.prepare('UPDATE users SET placement_done = 1 WHERE email = ?').bind(email));
  await db.batch(stmts);
  return json({ ok: true, passed });
}
