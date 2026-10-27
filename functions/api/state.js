// GET /api/state: todo el progreso del usuario en una sola llamada.
import { json, today } from '../../src/lib/util.js';

export async function onRequestGet({ env, data }) {
  const email = data.email;
  const db = env.DB;
  const [user, progress, review, seen, purchases] = await db.batch([
    db.prepare('SELECT * FROM users WHERE email = ?').bind(email),
    db.prepare('SELECT topic, status, best, attempts FROM topic_progress WHERE email = ?').bind(email),
    db.prepare('SELECT ref, topic FROM review WHERE email = ? ORDER BY added_at').bind(email),
    db
      .prepare("SELECT DISTINCT topic, ref FROM answers WHERE email = ? AND kind IN ('practice', 'ai')")
      .bind(email),
    db.prepare('SELECT item FROM purchases WHERE email = ?').bind(email),
  ]);

  const u = user.results[0];
  const progressMap = {};
  for (const p of progress.results) progressMap[p.topic] = { status: p.status, best: p.best, attempts: p.attempts };
  const seenMap = {};
  for (const s of seen.results) (seenMap[s.topic] ||= []).push(s.ref);

  return json({
    today: today(),
    user: {
      email: u.email,
      coins: u.coins,
      streak: u.streak,
      lastDay: u.last_day,
      freeWeek: u.free_week,
      theme: u.theme,
      avatar: u.avatar,
      placementDone: !!u.placement_done,
    },
    progress: progressMap,
    review: review.results,
    seen: seenMap,
    purchases: purchases.results.map((p) => p.item),
    aiEnabled: !!env.GEMINI_API_KEY,
  });
}
