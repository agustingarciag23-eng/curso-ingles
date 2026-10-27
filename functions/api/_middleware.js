// Se ejecuta antes de cualquier ruta /api/*: identifica al usuario y crea su fila si no existe.
import { verifyAccessToken } from '../../src/lib/access.js';
import { error } from '../../src/lib/util.js';

async function identify(request, env) {
  // Modo local: sin Access configurado, se usa DEV_EMAIL (definido solo en .dev.vars).
  if (!env.ACCESS_AUD) {
    if (env.DEV_EMAIL) return env.DEV_EMAIL.toLowerCase();
    throw new Error('Cloudflare Access no está configurado (faltan ACCESS_AUD y ACCESS_TEAM_DOMAIN)');
  }
  const token = request.headers.get('Cf-Access-Jwt-Assertion');
  if (!token) throw new Error('Falta el token de Cloudflare Access');
  const email = await verifyAccessToken(token, env);
  if (env.ALLOWED_EMAIL && email !== env.ALLOWED_EMAIL.toLowerCase()) {
    throw new Error('Este correo no tiene acceso');
  }
  return email;
}

export async function onRequest(context) {
  const { request, env } = context;
  let email;
  try {
    email = await identify(request, env);
  } catch (e) {
    return error(e.message, 401);
  }
  if (!env.DB) return error('Falta la base de datos D1 (binding DB)', 500);

  await env.DB.prepare('INSERT OR IGNORE INTO users (email) VALUES (?)').bind(email).run();
  context.data.email = email;

  try {
    return await context.next();
  } catch (e) {
    console.error(e);
    return error('Error interno: ' + e.message, 500);
  }
}
