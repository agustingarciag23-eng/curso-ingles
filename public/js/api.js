// Comunicación con la API y carga del contenido.

export class LoginRequired extends Error {}

export async function api(path, body) {
  const res = await fetch('/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
    credentials: 'same-origin',
  });
  let data = {};
  try {
    data = await res.json();
  } catch {
    // Si Cloudflare Access ha caducado la sesión, devuelve una página HTML en lugar de JSON.
    if (res.status === 401 || res.status === 403 || res.redirected) {
      location.reload();
    }
    throw new Error('Respuesta inesperada del servidor');
  }
  if (res.status === 401 && data.login) throw new LoginRequired(data.error);
  if (!res.ok) throw new Error(data.error || `Error ${res.status}`);
  return data;
}

const cache = new Map();
export async function content(path) {
  if (!cache.has(path)) {
    cache.set(
      path,
      fetch('/content/' + path, { credentials: 'same-origin' }).then((r) => {
        if (!r.ok) throw new Error('No se pudo cargar ' + path);
        return r.json();
      }),
    );
  }
  return cache.get(path);
}

export const topicContent = (id) => content(`topics/${id}.json`);
