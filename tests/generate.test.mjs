// Prueba la práctica extra con IA simulando la respuesta de Gemini (no gasta llamadas reales).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createD1, createHandler } from './dev-server.mjs';

const fake = {
  exercises: [
    { type: 'mc', prompt: 'I ___ him since Monday.', options: ["haven't seen", "didn't see", "don't see", "wasn't seeing"], answer: 0, explain: 'Desde el lunes: present perfect.' },
    { type: 'gap', prompt: 'She ___ (work) here for two years.', answers: ['has worked', 'has been working'], explain: 'Duración hasta ahora.' },
    { type: 'kwt', sentence: 'I met Tom five years ago.', keyword: 'KNOWN', start: 'I', end: 'five years.', answers: ['have known Tom for'], explain: 'Known + for.' },
    { type: 'kwt', sentence: 'Mal formado', keyword: 'FOR', start: 'I', end: 'x', answers: ['have been working here for many many years'], explain: 'demasiadas palabras' },
    { type: 'fix', sentence: 'I have went there.', answers: ['I have gone there.', 'I have been there.'], explain: 'Participio: gone.' },
  ],
};

test('genera, valida, descarta lo mal formado y reutiliza', async () => {
  const realFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async (url, init) => {
    if (String(url).includes('generativelanguage')) {
      calls++;
      assert.equal(init.headers['x-goog-api-key'], 'k');
      return new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text: JSON.stringify(fake) }] } }] }));
    }
    return realFetch(url, init);
  };
  try {
    const env = { DB: createD1(':memory:'), DEV_EMAIL: 'yo@example.com', GEMINI_API_KEY: 'k', AI_DAILY_LIMIT: '1' };
    const handle = createHandler(env);
    const post = async (path, body) => {
      const res = await handle(new Request('http://localhost/api/' + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }));
      return { status: res.status, data: await res.json() };
    };
    let r = await post('generate', { topic: 'present-perfect' });
    assert.equal(r.status, 200);
    assert.equal(r.data.exercises.length, 4); // el kwt de 9 palabras se descarta
    assert.ok(r.data.exercises.every((e) => e.ai && e.id.startsWith('ai-')));
    // Sin responderlos, se reutilizan sin volver a llamar a Gemini.
    r = await post('generate', { topic: 'present-perfect' });
    assert.equal(r.data.source, 'stored');
    assert.equal(calls, 1);
    // Respondidos 2 (quedan 2 < 3) → toca generar, pero el límite diario es 1.
    for (const ex of r.data.exercises.slice(0, 2)) await post('answer', { topic: 'present-perfect', ref: ex.id, kind: 'ai', correct: true });
    r = await post('generate', { topic: 'present-perfect' });
    assert.equal(r.status, 429);
    // Un ejercicio reportado no vuelve a salir.
    await post('report', { kind: 'ai_error', topic: 'present-perfect', ref: 'ai-3', exercise: {} });
    const row = env.DB.sqlite.prepare('SELECT reported FROM ai_exercises WHERE id = 3').get();
    assert.equal(row.reported, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});
