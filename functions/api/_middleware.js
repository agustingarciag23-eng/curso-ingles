// Se ejecuta antes de cualquier ruta /api/*: identifica al usuario y crea su fila si no existe.
// Formas de entrar, en este orden:
//   1. Contraseña propia (APP_PASSWORD como secreto de Cloudflare) → cookie de sesión. Gratis.
//   2. Cloudflare Access (ACCESS_AUD + ACCESS_TEAM_DOMAIN), si algún día lo activas.
//   3. Modo local (DEV_EMAIL en .dev.vars), solo para probar en tu ordenador.
import { verifyAccessToken } from '../../src/lib/access.js';
import { readSession, getCookie, COOKIE } from '../../src/lib/session.js';
import { json, error } from '../../src/lib/util.js';

const PUBLIC_ROUTES = ['/api/login', '/api/logout'];

async function identify(request, env) {
  if (env.APP_PASSWORD) {
    const email = await readSession(getCookie(request, COOKIE), env);
    return email || null;
  }
  if (env.ACCESS_AUD) {
    const token = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!token) throw new Error('Falta el token de Cloudflare Access');
    const email = await verifyAccessToken(token, env);
    if (env.ALLOWED_EMAIL && email !== env.ALLOWED_EMAIL.toLowerCase()) {
      throw new Error('Este correo no tiene acceso');
    }
    return email;
  }
  if (env.DEV_EMAIL) return env.DEV_EMAIL.toLowerCase();
  throw new Error('Falta configurar la contraseña de la app (secreto APP_PASSWORD). Mira el README.');
}

export async function onRequest(context) {
  const { request, env } = context;
  if (!env.DB) return error('Falta la base de datos D1 (binding DB)', 500);
  if (PUBLIC_ROUTES.includes(new URL(request.url).pathname)) return context.next();

  let email;
  try {
    email = await identify(request, env);
  } catch (e) {
    return error(e.message, 401);
  }
  if (!email) return json({ error: 'Tienes que iniciar sesión', login: true }, 401);

  await env.DB.prepare('INSERT OR IGNORE INTO users (email) VALUES (?)').bind(email).run();
  context.data.email = email;

  try {
    return await context.next();
  } catch (e) {
    console.error(e);
    return error('Error interno: ' + e.message, 500);
  }
}
