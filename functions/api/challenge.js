// POST /api/challenge { topic, correct, total }
// Registra el resultado del reto final. Con el umbral (80 %) o más, el tema queda superado.
import { json, error, readBody, asset, cleanId } from '../../src/lib/util.js';

export async function onRequestPost({ request, env, data }) {
  const email = data.email;
  const body = await readBody(request);
  const topic = cleanId(body.topic);
  const total = Number(body.total);
  const correct = Number(body.correct);
  if (!topic || !Number.isInteger(total) || total < 1 || !Number.isInteger(correct) || correct < 0 || correct > total) {
    return error('Resultado del reto no válido');
  }

  const [tree, shop] = await Promise.all([
    asset(env, request, '/content/tree.json'),
    asset(env, request, '/content/shop.json'),
  ]);
  if (!tree.topics[topic]) return error('Tema desconocido');

  const score = correct / total;
  const passed = score >= tree.threshold;
  const db = env.DB;
  const prev = await db
    .prepare('SELECT status, best FROM topic_progress WHERE email = ? AND topic = ?')
    .bind(email, topic)
    .first();
  const wasCompleted = prev?.status === 'completed';
  const status = passed || wasCompleted ? 'completed' : prev?.status === 'skipped' ? 'skipped' : 'started';
  const best = Math.max(prev?.best ?? 0, score);

  let coins = correct * shop.coins.challenge;
  if (correct === total) coins += shop.coins.perfectBonus;
  const newlyCompleted = passed && !wasCompleted;
  if (newlyCompleted) coins += shop.coins.topicComplete;

  await db.batch([
    db
      .prepare(
        `INSERT INTO topic_progress (email, topic, status, best, attempts, updated_at)
         VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP)
         ON CONFLICT (email, topic) DO UPDATE SET status = excluded.status, best = excluded.best,
           attempts = topic_progress.attempts + 1, updated_at = CURRENT_TIMESTAMP`,
      )
      .bind(email, topic, status, best),
    db.prepare('UPDATE users SET coins = coins + ? WHERE email = ?').bind(coins, email),
  ]);

  return json({ ok: true, passed, newlyCompleted, score, best, coins, threshold: tree.threshold });
}
