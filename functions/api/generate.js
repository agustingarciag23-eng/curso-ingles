// POST /api/generate { topic }: "Práctica extra (IA)" cuando ya has visto todo el banco de un tema.
// Primero reutiliza ejercicios generados antes que aún no has respondido; si no hay, pide nuevos a Gemini.
import { json, error, readBody, asset, today, cleanId } from '../../src/lib/util.js';
import { validateExercise } from '../../src/lib/schema.js';

const BATCH = 5;

function buildPrompt(topic, lesson) {
  return `Eres profesor de inglés y preparas a un hispanohablante de nivel B1 para el examen Cambridge B2 First.
Tema de gramática: "${topic.title}".
Resumen de la lección que ya ha estudiado:
${lesson.when.map((w) => '- ' + w).join('\n')}

Crea ${BATCH} ejercicios NUEVOS sobre este tema. Varía los tipos entre: mc, gap, fix, translate y kwt.
Reglas obligatorias:
- Inglés británico estándar, correcto y natural, nivel B1-B2.
- Cada ejercicio debe tener UNA sola interpretación correcta. Si existen otras respuestas válidas, inclúyelas TODAS en "answers".
- Las explicaciones ("explain") van en español, breves (una frase).
- kwt (key word transformation, Part 4): "keyword" en MAYÚSCULAS y sin cambiar; cada respuesta tiene entre 2 y 5 palabras (las contracciones cuentan como dos) e incluye la palabra clave; "start" y "end" son el principio y el final de la segunda frase.
- mc: 4 opciones, solo una correcta; "answer" es el índice (0-3); el hueco se marca con ___ en "prompt".
- gap: un solo hueco ___ en "prompt", con el verbo entre paréntesis si hace falta.
- fix: "sentence" contiene un error de este tema; "answers" son las versiones corregidas.
- translate: "es" es una frase en español; "answers" son traducciones correctas.

Devuelve SOLO JSON con esta forma exacta:
{"exercises":[
 {"type":"mc","prompt":"...","options":["...","...","...","..."],"answer":0,"explain":"..."},
 {"type":"gap","prompt":"... ___ ...","answers":["..."],"explain":"..."},
 {"type":"fix","sentence":"...","answers":["..."],"explain":"..."},
 {"type":"translate","es":"...","answers":["..."],"explain":"..."},
 {"type":"kwt","sentence":"...","keyword":"...","start":"...","end":"...","answers":["..."],"explain":"..."}
]}`;
}

async function callGemini(env, prompt) {
  const model = env.GEMINI_MODEL || 'gemini-flash-latest';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': env.GEMINI_API_KEY },
    body: JSON.stringify({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: { responseMimeType: 'application/json', temperature: 0.7 },
    }),
  });
  if (!res.ok) throw new Error(`Gemini respondió ${res.status}`);
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text || '').join('') || '';
  return JSON.parse(text);
}

export async function onRequestPost({ request, env, data }) {
  const email = data.email;
  const body = await readBody(request);
  const topicId = cleanId(body.topic);
  const db = env.DB;

  const tree = await asset(env, request, '/content/tree.json');
  const topic = tree.topics[topicId];
  if (!topic || !topic.content) return error('Tema no disponible');

  // 1) Ejercicios ya generados que no has respondido y nadie ha reportado.
  const { results: stored } = await db
    .prepare(
      `SELECT id, data FROM ai_exercises a WHERE topic = ? AND reported = 0
       AND NOT EXISTS (SELECT 1 FROM answers WHERE email = ? AND ref = 'ai-' || a.id)
       ORDER BY id LIMIT ?`,
    )
    .bind(topicId, email, BATCH)
    .all();
  if (stored.length >= 3) {
    return json({ source: 'stored', exercises: stored.map((r) => ({ ...JSON.parse(r.data), id: `ai-${r.id}`, ai: true })) });
  }

  if (!env.GEMINI_API_KEY) return error('La práctica con IA no está configurada (falta GEMINI_API_KEY)', 503);

  // 2) Límite diario de generaciones.
  const day = today();
  const limit = Number(env.AI_DAILY_LIMIT || 5);
  const usage = await db.prepare('SELECT count FROM ai_usage WHERE email = ? AND day = ?').bind(email, day).first();
  if ((usage?.count ?? 0) >= limit) {
    return error(`Has llegado al límite de ${limit} generaciones con IA por hoy. Mañana más.`, 429);
  }
  await db
    .prepare(
      `INSERT INTO ai_usage (email, day, count) VALUES (?, ?, 1)
       ON CONFLICT (email, day) DO UPDATE SET count = ai_usage.count + 1`,
    )
    .bind(email, day)
    .run();

  // 3) Generar y validar.
  const content = await asset(env, request, `/content/topics/${topicId}.json`);
  let generated;
  try {
    generated = await callGemini(env, buildPrompt(topic, content.lesson));
  } catch (e) {
    return error('No se pudieron generar ejercicios ahora mismo: ' + e.message, 502);
  }
  const valid = (generated?.exercises || [])
    .map((ex, i) => ({ ...ex, id: `tmp${i}` }))
    .filter((ex) => ['mc', 'gap', 'fix', 'translate', 'kwt'].includes(ex.type) && validateExercise(ex).length === 0);
  if (!valid.length) return error('La IA devolvió ejercicios con formato incorrecto. Prueba otra vez.', 502);

  const saved = [];
  for (const ex of valid) {
    const { id: _tmp, ...clean } = ex;
    const row = await db
      .prepare('INSERT INTO ai_exercises (topic, data) VALUES (?, ?) RETURNING id')
      .bind(topicId, JSON.stringify(clean))
      .first();
    saved.push({ ...clean, id: `ai-${row.id}`, ai: true });
  }
  const all = [...stored.map((r) => ({ ...JSON.parse(r.data), id: `ai-${r.id}`, ai: true })), ...saved];
  return json({ source: 'gemini', exercises: all });
}
