// Login propio con contraseña (alternativa gratuita a Cloudflare Access).
// La contraseña vive como secreto de Cloudflare (APP_PASSWORD). Al entrar se guarda una
// cookie firmada que dura un año, así cada dispositivo solo pide la contraseña una vez.
// Si cambias la contraseña, todas las sesiones abiertas se cierran.

export const COOKIE = 'ci_session';
export const SESSION_DAYS = 365;

const enc = new TextEncoder();

async function hmac(secret, message) {
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  return btoa(String.fromCharCode(...new Uint8Array(sig))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function sessionKey(env) {
  return 'curso-ingles:' + env.APP_PASSWORD + ':' + (env.SESSION_SECRET || '');
}

function sameString(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Compara la contraseña sin filtrar información por el tiempo de respuesta.
export async function checkPassword(given, env) {
  const a = await hmac('pw-check', String(given ?? ''));
  const b = await hmac('pw-check', env.APP_PASSWORD);
  return sameString(a, b);
}

export async function createSession(email, env, now = Date.now()) {
  const exp = Math.floor(now / 1000) + SESSION_DAYS * 86400;
  const payload = `${email}|${exp}`;
  const sig = await hmac(sessionKey(env), payload);
  return `${btoa(payload).replace(/=+$/, '')}.${sig}`;
}

export async function readSession(token, env, now = Date.now()) {
  if (!token || !token.includes('.')) return null;
  const [p, sig] = token.split('.');
  let payload;
  try {
    payload = atob(p);
  } catch {
    return null;
  }
  const expected = await hmac(sessionKey(env), payload);
  if (!sameString(sig, expected)) return null;
  const [email, exp] = payload.split('|');
  if (!email || !(Number(exp) > now / 1000)) return null;
  return email;
}

export function getCookie(request, name) {
  const header = request.headers.get('cookie') || '';
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

export function sessionCookie(token, request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_DAYS * 86400}${secure}`;
}

export function clearCookie(request) {
  const secure = new URL(request.url).protocol === 'https:' ? '; Secure' : '';
  return `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${secure}`;
}
