// Verifica el token de Cloudflare Access (cabecera Cf-Access-Jwt-Assertion).
// Cloudflare Access ya bloquea a quien no está autorizado antes de llegar aquí;
// esta comprobación es una segunda capa por si alguien llega a la API saltándose Access.

let certCache = { at: 0, keys: [] };

function b64urlToBytes(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/');
  while (s.length % 4) s += '=';
  const bin = atob(s);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

function decodePart(part) {
  return JSON.parse(new TextDecoder().decode(b64urlToBytes(part)));
}

async function getKeys(teamDomain) {
  if (Date.now() - certCache.at < 60 * 60 * 1000 && certCache.keys.length) return certCache.keys;
  const res = await fetch(`https://${teamDomain}/cdn-cgi/access/certs`);
  if (!res.ok) throw new Error('No se pudieron descargar las claves de Access');
  const data = await res.json();
  certCache = { at: Date.now(), keys: data.keys || [] };
  return certCache.keys;
}

export async function verifyAccessToken(token, env) {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Token mal formado');
  const header = decodePart(parts[0]);
  const payload = decodePart(parts[1]);

  const keys = await getKeys(env.ACCESS_TEAM_DOMAIN);
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) throw new Error('Clave del token desconocida');

  const key = await crypto.subtle.importKey(
    'jwk',
    jwk,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['verify'],
  );
  const ok = await crypto.subtle.verify(
    'RSASSA-PKCS1-v1_5',
    key,
    b64urlToBytes(parts[2]),
    new TextEncoder().encode(`${parts[0]}.${parts[1]}`),
  );
  if (!ok) throw new Error('Firma no válida');

  const now = Math.floor(Date.now() / 1000);
  if (payload.exp && payload.exp < now) throw new Error('Token caducado');
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(env.ACCESS_AUD)) throw new Error('Token de otra aplicación');
  if (!payload.email) throw new Error('El token no tiene email');
  return payload.email.toLowerCase();
}
