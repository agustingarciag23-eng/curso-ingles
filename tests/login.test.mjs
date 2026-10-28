// Login con contraseña propia: cookie firmada, contraseña incorrecta, límite de intentos y logout.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createD1, createHandler } from './dev-server.mjs';
import { createSession, readSession } from '../src/lib/session.js';

const env = { DB: createD1(':memory:'), APP_PASSWORD: 'secreto-largo-123', ALLOWED_EMAIL: 'Yo@Example.com' };
const handle = createHandler(env);
const call = (path, { body, cookie, ip = '1.1.1.1' } = {}) =>
  handle(new Request('https://curso-ingles.pages.dev/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', 'CF-Connecting-IP': ip, ...(cookie ? { cookie } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));

test('sin sesión pide login', async () => {
  const res = await call('state');
  assert.equal(res.status, 401);
  assert.equal((await res.json()).login, true);
});

test('contraseña incorrecta', async () => {
  const res = await call('login', { body: { password: 'nope' } });
  assert.equal(res.status, 401);
});

test('contraseña correcta da cookie y acceso', async () => {
  const res = await call('login', { body: { password: 'secreto-largo-123' } });
  assert.equal(res.status, 200);
  const setCookie = res.headers.get('set-cookie');
  assert.match(setCookie, /HttpOnly/);
  assert.match(setCookie, /Secure/);
  assert.match(setCookie, /Max-Age=31536000/);
  const cookie = setCookie.split(';')[0];
  const st = await call('state', { cookie });
  assert.equal(st.status, 200);
  assert.equal((await st.json()).user.email, 'yo@example.com');
});

test('cookie manipulada o caducada no vale', async () => {
  const good = await createSession('yo@example.com', env);
  const forged = await createSession('yo@example.com', { ...env, APP_PASSWORD: 'otra' });
  assert.equal(await readSession(good, env), 'yo@example.com');
  assert.equal(await readSession(forged, env), null);
  assert.equal(await readSession(good.slice(0, -2) + 'xx', env), null);
  const old = await createSession('yo@example.com', env, Date.now() - 400 * 86400000);
  assert.equal(await readSession(old, env), null);
  assert.equal((await call('state', { cookie: 'ci_session=' + forged })).status, 401);
});

test('bloquea tras 10 fallos por hora y conexión', async () => {
  for (let i = 0; i < 10; i++) await call('login', { body: { password: 'x' }, ip: '9.9.9.9' });
  let res = await call('login', { body: { password: 'secreto-largo-123' }, ip: '9.9.9.9' });
  assert.equal(res.status, 429);
  res = await call('login', { body: { password: 'secreto-largo-123' }, ip: '8.8.8.8' });
  assert.equal(res.status, 200);
});

test('logout borra la cookie', async () => {
  const res = await call('logout', { body: {} });
  assert.match(res.headers.get('set-cookie'), /Max-Age=0/);
});
