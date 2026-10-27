// Comprueba que todo el contenido tiene el formato correcto antes de publicarlo.
// Uso: node scripts/check-content.mjs
import { readFileSync, existsSync } from 'node:fs';
import { validateExercise } from '../src/lib/schema.js';

const root = new URL('../public/content/', import.meta.url);
const read = (p) => JSON.parse(readFileSync(new URL(p, root), 'utf8'));
let problems = 0;
const fail = (msg) => {
  problems++;
  console.log('  ✗ ' + msg);
};

const tree = read('tree.json');
const inBranches = new Set(tree.branches.flatMap((b) => b.topics));
for (const [id, t] of Object.entries(tree.topics)) {
  if (!inBranches.has(id)) fail(`${id} no está en ninguna rama`);
  for (const r of t.requires) if (!tree.topics[r]) fail(`${id} requiere un tema inexistente: ${r}`);
  const file = new URL(`topics/${id}.json`, root);
  if (t.content && !existsSync(file)) fail(`${id} dice tener contenido pero falta topics/${id}.json`);
}

for (const [id, t] of Object.entries(tree.topics)) {
  if (!t.content) continue;
  console.log(`Tema ${id}`);
  const topic = read(`topics/${id}.json`);
  if (topic.id !== id) fail(`id interno ${topic.id} no coincide`);
  const L = topic.lesson;
  if (!L?.intro || !L.when?.length || !L.form?.length || !L.examples?.length || !L.errors?.length) fail('lección incompleta');
  const ids = new Set();
  for (const part of ['checks', 'practice', 'challenge']) {
    if (!topic[part]?.length) fail(`faltan ejercicios en ${part}`);
    for (const ex of topic[part] || []) {
      if (ids.has(ex.id)) fail(`id repetido ${ex.id}`);
      ids.add(ex.id);
      for (const e of validateExercise(ex)) fail(`${part}/${ex.id}: ${e}`);
    }
  }
  if ((topic.challenge || []).length < 5) fail('el reto debería tener al menos 5 ejercicios');
}

console.log('Test de nivel');
const placement = read('placement.json');
for (const q of placement.questions) {
  if (!tree.topics[q.topic]?.content) fail(`${q.id}: tema sin contenido ${q.topic}`);
  for (const e of validateExercise(q)) fail(`${q.id}: ${e}`);
}

console.log('Tienda');
const shop = read('shop.json');
const shopIds = new Set();
for (const i of shop.items) {
  if (shopIds.has(i.id)) fail(`objeto repetido ${i.id}`);
  shopIds.add(i.id);
  if (!(i.price > 0)) fail(`${i.id} sin precio`);
}

console.log(problems ? `\n${problems} problema(s)` : '\nTodo correcto ✓');
process.exit(problems ? 1 : 0);
