// POST /api/logout: cierra la sesión en este dispositivo.
import { clearCookie } from '../../src/lib/session.js';

export async function onRequestPost({ request }) {
  return new Response(JSON.stringify({ ok: true }), {
    headers: { 'content-type': 'application/json; charset=utf-8', 'set-cookie': clearCookie(request) },
  });
}
