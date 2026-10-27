// POST /api/equip { theme } o { avatar }: usa un tema o avatar comprado ('default' siempre vale).
import { json, error, readBody } from '../../src/lib/util.js';

export async function onRequestPost({ request, env, data }) {
  const email = data.email;
  const body = await readBody(request);
  const field = body.theme ? 'theme' : body.avatar ? 'avatar' : null;
  const value = body.theme || body.avatar;
  if (!field || typeof value !== 'string') return error('Nada que equipar');

  if (value !== 'default') {
    const owned = await env.DB
      .prepare('SELECT 1 FROM purchases WHERE email = ? AND item = ?')
      .bind(email, value)
      .first();
    if (!owned) return error('Primero tienes que comprarlo');
  }
  await env.DB.prepare(`UPDATE users SET ${field} = ? WHERE email = ?`).bind(value, email).run();
  return json({ ok: true });
}
