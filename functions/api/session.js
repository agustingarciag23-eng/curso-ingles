// POST /api/session: marca la sesión diaria como hecha, actualiza la racha y da monedas.
// Racha: un día libre por semana no la rompe; un segundo día sin estudiar esa semana la reinicia.
import { json, asset, today } from '../../src/lib/util.js';
import { nextStreak } from '../../src/lib/streak.js';

export async function onRequestPost({ request, env, data }) {
  const email = data.email;
  const db = env.DB;
  const day = today();
  const user = await db.prepare('SELECT * FROM users WHERE email = ?').bind(email).first();
  const next = nextStreak(user, day);
  const shop = await asset(env, request, '/content/shop.json');
  const coins = next.alreadyToday ? 0 : shop.coins.session;

  await db
    .prepare('UPDATE users SET streak = ?, last_day = ?, free_week = ?, coins = coins + ? WHERE email = ?')
    .bind(next.streak, day, next.freeWeek, coins, email)
    .run();

  return json({ ok: true, streak: next.streak, usedFreeDay: next.usedFreeDay, alreadyToday: next.alreadyToday, coins });
}
