// POST /api/answer { topic, ref, kind, correct }
// Guarda la respuesta, actualiza la lista de repaso y da monedas en práctica.
import { json, error, readBody, asset, cleanId } from '../../src/lib/util.js';

const KINDS = ['check', 'practice', 'challenge', 'warmup', 'ai'];

export async function onRequestPost({ request, env, data }) {
  const email = data.email;
  const body = await readBody(request);
  const topic = cleanId(body.topic);
  const ref = cleanId(body.ref);
  const kind = KINDS.includes(body.kind) ? body.kind : null;
  if (!topic || !ref || !kind) return error('Datos de respuesta no válidos');
  const correct = body.correct ? 1 : 0;

  const shop = await asset(env, request, '/content/shop.json');
  // En el reto las monedas se dan al terminarlo (ver /api/challenge).
  const coins = correct && kind !== 'challenge' ? shop.coins.practice : 0;

  const db = env.DB;
  const stmts = [
    db.prepare('INSERT INTO answers (email, topic, ref, kind, correct) VALUES (?, ?, ?, ?, ?)').bind(
      email, topic, ref, kind, correct,
    ),
  ];
  // Los ejercicios del banco fallados vuelven en el calentamiento; al acertarlos salen del repaso.
  if (kind !== 'ai') {
    stmts.push(
      correct
        ? db.prepare('DELETE FROM review WHERE email = ? AND ref = ?').bind(email, ref)
        : db.prepare('INSERT OR IGNORE INTO review (email, ref, topic) VALUES (?, ?, ?)').bind(email, ref, topic),
    );
  }
  if (coins) stmts.push(db.prepare('UPDATE users SET coins = coins + ? WHERE email = ?').bind(coins, email));
  await db.batch(stmts);

  return json({ ok: true, coins });
}
