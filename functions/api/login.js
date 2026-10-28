// POST /api/login { password }: comprueba la contraseña y guarda la sesión en una cookie.
// Máximo 10 intentos fallidos por hora desde la misma conexión.
import { json, error, readBody } from '../../src/lib/util.js';
import { checkPassword, createSession, sessionCookie } from '../../src/lib/session.js';

const MAX_FAILS = 10;

export async function onRequestPost({ request, env }) {
  if (!env.APP_PASSWORD) return error('La contraseña de la app no está configurada (secreto APP_PASSWORD).', 503);
  const db = env.DB;
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  const hour = new Date().toISOString().slice(0, 13);

  const row = await db.prepare('SELECT count FROM login_attempts WHERE ip = ? AND hour = ?').bind(ip, hour).first();
  if ((row?.count ?? 0) >= MAX_FAILS) {
    return error('Demasiados intentos fallidos. Espera una hora y vuelve a probar.', 429);
  }

  const body = await readBody(request);
  if (!(await checkPassword(body.password, env))) {
    await db
      .prepare(
        `INSERT INTO login_attempts (ip, hour, count) VALUES (?, ?, 1)
         ON CONFLICT (ip, hour) DO UPDATE SET count = login_attempts.count + 1`,
      )
      .bind(ip, hour)
      .run();
    return error('Contraseña incorrecta.', 401);
  }

  const email = (env.ALLOWED_EMAIL || 'yo').toLowerCase();
  const token = await createSession(email, env);
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': sessionCookie(token, request) },
  });
}
