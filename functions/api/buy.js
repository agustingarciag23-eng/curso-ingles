// POST /api/buy { item }: compra un objeto de personalización con monedas.
import { json, error, readBody, asset } from '../../src/lib/util.js';

export async function onRequestPost({ request, env, data }) {
  const email = data.email;
  const body = await readBody(request);
  const shop = await asset(env, request, '/content/shop.json');
  const item = shop.items.find((i) => i.id === body.item);
  if (!item) return error('Ese objeto no existe');

  const db = env.DB;
  const owned = await db.prepare('SELECT 1 FROM purchases WHERE email = ? AND item = ?').bind(email, item.id).first();
  if (owned) return error('Ya lo tienes');

  // La resta solo se aplica si hay monedas suficientes (evita saldos negativos).
  const res = await db
    .prepare('UPDATE users SET coins = coins - ? WHERE email = ? AND coins >= ?')
    .bind(item.price, email, item.price)
    .run();
  if (!res.meta.changes) return error('No tienes monedas suficientes');

  await db.prepare('INSERT OR IGNORE INTO purchases (email, item) VALUES (?, ?)').bind(email, item.id).run();
  return json({ ok: true, item: item.id });
}
