// Prueba el flujo completo de la API contra la base de datos simulada.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createD1, createHandler } from './dev-server.mjs';

const env = { DB: createD1(':memory:'), DEV_EMAIL: 'yo@example.com' };
const handle = createHandler(env);
const call = async (path, body) => {
  const res = await handle(new Request('http://localhost/api/' + path, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  }));
  return { status: res.status, data: await res.json() };
};

test('estado inicial', async () => {
  const { data } = await call('state');
  assert.equal(data.user.coins, 0);
  assert.equal(data.user.placementDone, false);
});

test('respuestas: monedas, repaso y visto', async () => {
  let r = await call('answer', { topic: 'present-perfect', ref: 'present-perfect:p1', kind: 'practice', correct: false });
  assert.equal(r.data.coins, 0);
  r = await call('answer', { topic: 'present-perfect', ref: 'present-perfect:p2', kind: 'practice', correct: true });
  assert.equal(r.data.coins, 5);
  const { data } = await call('state');
  assert.equal(data.user.coins, 5);
  assert.deepEqual(data.review.map((x) => x.ref), ['present-perfect:p1']);
  assert.equal(data.seen['present-perfect'].length, 2);
  await call('answer', { topic: 'present-perfect', ref: 'present-perfect:p1', kind: 'warmup', correct: true });
  assert.equal((await call('state')).data.review.length, 0);
});

test('reto: 3/5 no supera, 4/5 sí, con monedas', async () => {
  let r = await call('challenge', { topic: 'pres-simple-cont', correct: 3, total: 5 });
  assert.equal(r.data.passed, false);
  r = await call('challenge', { topic: 'pres-simple-cont', correct: 4, total: 5 });
  assert.equal(r.data.passed, true);
  assert.equal(r.data.newlyCompleted, true);
  assert.equal(r.data.coins, 4 * 10 + 30);
  const { data } = await call('state');
  assert.equal(data.progress['pres-simple-cont'].status, 'completed');
  assert.equal(data.progress['pres-simple-cont'].attempts, 2);
});

test('dejar para después no borra un tema superado', async () => {
  await call('skip', { topic: 'pres-simple-cont' });
  await call('skip', { topic: 'past-simple-cont' });
  const { data } = await call('state');
  assert.equal(data.progress['pres-simple-cont'].status, 'completed');
  assert.equal(data.progress['past-simple-cont'].status, 'skipped');
});

test('tienda: sin monedas no compra; con monedas compra y equipa', async () => {
  let r = await call('buy', { item: 'theme-night' }); // 120 > saldo
  assert.equal(r.status, 400);
  r = await call('buy', { item: 'avatar-fox' });
  assert.equal(r.status, 200);
  r = await call('buy', { item: 'avatar-fox' });
  assert.equal(r.status, 400);
  r = await call('equip', { avatar: 'avatar-fox' });
  assert.equal(r.status, 200);
  r = await call('equip', { theme: 'theme-night' });
  assert.equal(r.status, 400);
  const { data } = await call('state');
  assert.equal(data.user.avatar, 'avatar-fox');
  assert.ok(data.user.coins >= 0);
});

test('sesión: racha y monedas una vez al día', async () => {
  let r = await call('session', {});
  assert.equal(r.data.streak, 1);
  assert.equal(r.data.coins, 10);
  r = await call('session', {});
  assert.equal(r.data.coins, 0);
});

test('test de nivel marca temas superados', async () => {
  await call('placement', { passed: ['past-simple-cont', 'tema-falso'] });
  const { data } = await call('state');
  assert.equal(data.user.placementDone, true);
  assert.equal(data.progress['past-simple-cont'].status, 'completed');
});

test('reportes', async () => {
  await call('report', { kind: 'valid_answer', topic: 'present-perfect', ref: 'present-perfect:p9', answer: 'Did you finish yet?', exercise: { prompt: 'x' } });
  let { data } = await call('reports');
  assert.equal(data.reports.length, 1);
  await call('reports', { id: data.reports[0].id });
  ({ data } = await call('reports'));
  assert.equal(data.reports.length, 0);
});

test('IA sin clave avisa con 503', async () => {
  const r = await call('generate', { topic: 'present-perfect' });
  assert.equal(r.status, 503);
});

test('sin DEV_EMAIL ni Access: 401', async () => {
  const h2 = createHandler({ DB: createD1(':memory:') });
  const res = await h2(new Request('http://localhost/api/state'));
  assert.equal(res.status, 401);
});
