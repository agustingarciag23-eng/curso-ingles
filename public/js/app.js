// Curso Inglés — aplicación principal (rutas, vistas y sesión diaria).
import { api, content, topicContent, LoginRequired } from './api.js';
import { h, renderExercise } from './exercises.js';

const main = document.getElementById('main');
const S = { tree: null, shop: null, state: null };

// ---------------------------------------------------------------- utilidades
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

let toastTimer;
function toast(text) {
  const t = document.getElementById('toast');
  t.textContent = text;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2200);
}

function view(...children) {
  main.replaceChildren(...children.flat().filter((c) => c !== null && c !== undefined && c !== false));
  main.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

function viewLogin(message) {
  document.getElementById('wallet').replaceChildren();
  document.querySelectorAll('.nav, .tabbar').forEach((n) => (n.hidden = true));
  const input = h('input', { type: 'password', id: 'pw', name: 'password', autocomplete: 'current-password' });
  const msg = h('p', { role: 'alert' }, message || '');
  const btn = h('button', { class: 'btn block', type: 'submit' }, 'Entrar');
  const form = h('form', { class: 'panel stack login' },
    h('h1', {}, 'Curso Inglés'),
    h('label', { for: 'pw' }, 'Contraseña'),
    input, btn, msg,
  );
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    msg.textContent = '';
    try {
      await api('login', { password: input.value });
      location.reload();
    } catch (err) {
      msg.textContent = err.message;
      btn.disabled = false;
      input.select();
    }
  });
  view(form);
  input.focus();
}

function showError(e) {
  if (e instanceof LoginRequired) return viewLogin();
  view(
    h('div', { class: 'panel' },
      h('h1', {}, 'Algo ha fallado'),
      h('p', {}, e.message),
      h('button', { class: 'btn', type: 'button', onclick: () => location.reload() }, 'Recargar'),
    ),
  );
}

async function refresh() {
  S.state = await api('state');
  applyLook();
}

function applyLook() {
  const u = S.state.user;
  document.body.dataset.theme = u.theme || 'default';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = getComputedStyle(document.body).getPropertyValue('--bg').trim() || '#edf0f4';
  const wallet = document.getElementById('wallet');
  wallet.replaceChildren(
    h('span', { class: 'pill', title: 'Racha de días' }, '🔥 ', String(u.streak)),
    h('span', { class: 'pill coins', title: 'Monedas' }, '● ', String(u.coins)),
  );
}

function avatarEmoji() {
  const id = S.state.user.avatar;
  return S.shop.items.find((i) => i.id === id)?.emoji || '🙂';
}

function addCoins(n) {
  if (!n) return;
  S.state.user.coins += n;
  applyLook();
  toast(`+${n} monedas`);
}

// ---------------------------------------------------------------- progreso y árbol
const topicInfo = (id) => S.tree.topics[id];
const statusOf = (id) => S.state.progress[id]?.status || null;
const isDone = (id) => statusOf(id) === 'completed';
const missingReqs = (id) => topicInfo(id).requires.filter((r) => !isDone(r));
const isUnlocked = (id) => missingReqs(id).length === 0;

function topicOrder() {
  return S.tree.branches.flatMap((b) => b.topics);
}

// Tema del día: el primer tema desbloqueado con contenido que aún no has superado.
// Los temas dejados para después solo se eligen si no queda otro.
function nextTopic() {
  const candidates = topicOrder().filter((id) => topicInfo(id).content && isUnlocked(id) && !isDone(id));
  return candidates.find((id) => statusOf(id) !== 'skipped') || candidates[0] || null;
}

function branchOf(id) {
  return S.tree.branches.find((b) => b.topics.includes(id));
}

const pct = (x) => Math.round((x ?? 0) * 100) + ' %';

async function answer(topic, ref, kind, correct) {
  try {
    const r = await api('answer', { topic, ref, kind, correct });
    addCoins(r.coins);
    if (correct) S.state.review = S.state.review.filter((x) => x.ref !== ref);
    else if (kind !== 'ai' && !S.state.review.some((x) => x.ref === ref)) S.state.review.push({ ref, topic });
    if (kind === 'practice' || kind === 'ai') (S.state.seen[topic] ||= []).push(ref);
  } catch (e) {
    toast('No se pudo guardar la respuesta: ' + e.message);
  }
}

function reporter(topic, ref, ex) {
  return async (kind, given) => {
    try {
      await api('report', { kind, topic, ref: ex.ai ? ex.id : ref, answer: given, exercise: ex });
    } catch (e) {
      toast('No se pudo enviar: ' + e.message);
    }
  };
}

// Resuelve "tema:id" al ejercicio del banco.
async function resolveRef(ref) {
  const [topic, id] = ref.split(':');
  const c = await topicContent(topic);
  const ex = [...c.checks, ...c.practice, ...c.challenge].find((e) => e.id === id);
  return ex ? { topic, ex } : null;
}

// ---------------------------------------------------------------- vistas
async function viewHome() {
  const u = S.state.user;
  const done = Object.values(S.state.progress).filter((p) => p.status === 'completed').length;
  const total = Object.keys(S.tree.topics).length;
  const next = nextTopic();
  const parts = [];

  parts.push(
    h('div', { class: 'hello' },
      h('span', { class: 'avatar', 'aria-hidden': 'true' }, avatarEmoji()),
      h('div', {},
        h('h1', {}, 'Hola'),
        h('p', { class: 'muted' }, u.lastDay === S.state.today ? 'Sesión de hoy completada. Puedes seguir practicando.' : 'Tu sesión de hoy te espera.'),
      ),
    ),
  );

  if (!u.placementDone) {
    parts.push(
      h('div', { class: 'panel today' },
        h('h2', {}, 'Empieza por el test de nivel'),
        h('p', { class: 'muted' }, '12 preguntas, unos 5 minutos. Los temas que ya domines quedarán superados.'),
        h('a', { class: 'btn', href: '#/test' }, 'Hacer el test'),
      ),
    );
  } else if (next) {
    parts.push(
      h('div', { class: 'panel today' },
        h('p', { class: 'muted' }, 'Sesión de hoy · 15 minutos'),
        h('h2', {}, topicInfo(next).title),
        h('p', { class: 'muted' }, 'Calentamiento, lección, práctica guiada, reto y resumen.'),
        h('a', { class: 'btn', href: '#/sesion' }, 'Empezar sesión'),
      ),
    );
  } else {
    parts.push(
      h('div', { class: 'panel today' },
        h('h2', {}, 'Has superado todo el contenido disponible'),
        h('p', { class: 'muted' }, 'Repasa tus fallos o practica cualquier tema mientras llegan los nuevos.'),
        h('a', { class: 'btn', href: '#/mapa' }, 'Ver el mapa'),
      ),
    );
  }

  const weekNote = u.freeWeek && u.freeWeek === isoWeekNow() ? 'Día libre de esta semana: usado' : 'Día libre de esta semana: disponible';
  parts.push(
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, String(u.streak)), h('span', {}, u.streak === 1 ? 'día de racha' : 'días de racha')),
      h('div', { class: 'stat' }, h('b', {}, `${done}/${total}`), h('span', {}, 'temas superados')),
      h('div', { class: 'stat' }, h('b', {}, String(S.state.review.length)), h('span', {}, 'fallos por repasar')),
    ),
    h('p', { class: 'muted small' }, weekNote + '. Si un día no estudias, la racha se mantiene una vez por semana.'),
  );

  if (S.state.review.length) {
    parts.push(h('a', { class: 'btn secondary', href: '#/repaso' }, `Repasar ${S.state.review.length} fallos`));
  }
  const logout = h('button', { class: 'btn ghost small', type: 'button' }, 'Cerrar sesión');
  logout.addEventListener('click', async () => {
    await api('logout', {});
    location.reload();
  });
  parts.push(h('div', { class: 'row', style: 'margin-top:24px; justify-content:space-between' },
    h('a', { class: 'small', href: '#/revisar' }, 'Respuestas guardadas para revisar'), logout));
  view(...parts);
}

function isoWeekNow() {
  const d = new Date(Date.parse(S.state.today + 'T00:00:00Z'));
  const dow = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dow);
  const week = Math.ceil(((d - Date.UTC(d.getUTCFullYear(), 0, 1)) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, '0')}`;
}

function viewMap() {
  const lines = S.tree.branches.map((b) => {
    const loose = b.id === 'sueltos';
    const items = b.topics.map((id, i) => {
      const t = topicInfo(id);
      const st = statusOf(id);
      let cls = 'station';
      let why = '';
      if (!t.content) {
        cls += ' soon';
        why = 'Próximamente';
      } else if (isDone(id)) {
        cls += ' done';
        why = 'Superado · mejor nota ' + pct(S.state.progress[id].best);
      } else if (!isUnlocked(id)) {
        cls += ' locked';
        why = 'Necesitas: ' + missingReqs(id).map((r) => topicInfo(r).title).join(', ');
      } else if (st === 'skipped') {
        cls += ' skipped';
        why = 'Dejado para después · vuelve en los repasos';
      } else {
        why = 'Disponible';
      }
      const label = [h('span', { class: 'dot', 'aria-hidden': 'true' }, isDone(id) ? '✓' : loose ? '' : String(i + 1)), h('span', { class: 'name' }, t.title, h('span', { class: 'why' }, why))];
      return h('li', { class: cls }, t.content ? h('a', { href: `#/tema/${id}` }, ...label) : h('div', {}, ...label));
    });
    return h('section', { class: 'line' + (loose ? ' loose' : ''), style: `--c: var(--l-${b.id})` },
      h('div', { class: 'line-head' }, h('span', { class: 'line-badge', 'aria-hidden': 'true' }), h('h2', {}, b.title)),
      h('ol', { class: 'stations' }, ...items),
    );
  });
  view(
    h('h1', {}, 'Mapa de temas'),
    h('p', { class: 'muted' }, `Cada línea es una rama. Un tema se abre cuando superas sus requisitos con un ${Math.round(S.tree.threshold * 100)} % en el reto.`),
    h('div', { class: 'lines' }, ...lines),
  );
}

async function viewTopic(id) {
  const t = topicInfo(id);
  if (!t?.content) return go('#/mapa');
  const c = await topicContent(id);
  const p = S.state.progress[id];
  const unlocked = isUnlocked(id);
  const seen = new Set(S.state.seen[id] || []);
  const allSeen = c.practice.every((e) => seen.has(`${id}:${e.id}`));

  const actions = h('div', { class: 'stack' });
  if (unlocked) {
    actions.append(
      h('a', { class: 'btn block', href: `#/sesion/${id}` }, 'Sesión con este tema'),
      h('a', { class: 'btn secondary block', href: `#/practica/${id}` }, 'Practicar más'),
    );
    if (allSeen && S.state.aiEnabled) {
      actions.append(h('a', { class: 'btn secondary block', href: `#/extra/${id}` }, 'Práctica extra (IA)'));
    }
    if (!isDone(id) && statusOf(id) !== 'skipped') {
      const skip = h('button', { class: 'btn ghost block', type: 'button' }, 'Dejar para después');
      skip.addEventListener('click', async () => {
        await api('skip', { topic: id });
        await refresh();
        toast('Tema dejado para después. Volverá en tus repasos.');
        go('#/mapa');
      });
      actions.append(skip);
    }
  } else {
    actions.append(h('p', {}, 'Para abrir este tema supera antes: ' + missingReqs(id).map((r) => topicInfo(r).title).join(', ') + '.'));
  }
  actions.append(h('a', { class: 'btn ghost block', href: `#/apuntes/${id}` }, 'Leer los apuntes'));

  view(
    h('a', { class: 'back', href: '#/mapa' }, '‹ Mapa'),
    h('p', { class: 'muted' }, branchOf(id).title),
    h('h1', {}, t.title),
    h('p', {},
      isDone(id) ? h('span', { class: 'status done' }, 'Superado · ' + pct(p.best))
        : statusOf(id) === 'skipped' ? h('span', { class: 'status' }, 'Dejado para después')
          : p?.attempts ? h('span', { class: 'status' }, `Mejor nota del reto: ${pct(p.best)} (necesitas ${Math.round(S.tree.threshold * 100)} %)`)
            : h('span', { class: 'status' }, unlocked ? 'Sin empezar' : 'Bloqueado'),
    ),
    h('p', { class: 'muted' }, c.lesson.intro),
    h('p', { class: 'muted small' }, `Banco de práctica: ${seen.size ? [...seen].filter((r) => !r.startsWith('ai-')).length : 0} de ${c.practice.length} ejercicios vistos.`),
    actions,
  );
}

function lessonNodes(c) {
  const L = c.lesson;
  return h('article', { class: 'lesson' },
    h('p', {}, L.intro),
    h('h2', {}, 'Cuándo se usa'),
    h('ul', {}, ...L.when.map((w) => h('li', {}, w))),
    h('h2', {}, 'Cómo se forma'),
    ...L.form.map((f) => h('div', { class: 'form-block' }, h('h3', {}, f.label), h('ul', {}, ...f.items.map((i) => h('li', {}, i))))),
    h('h2', {}, 'Ejemplos'),
    h('div', { class: 'panel' }, ...L.examples.map((e) => h('div', { class: 'example' }, h('div', { class: 'en', lang: 'en' }, e.en), h('div', { class: 'es' }, e.es)))),
    h('h2', {}, 'Errores típicos'),
    h('div', { class: 'panel' }, ...L.errors.map((e) => h('div', { class: 'err' },
      h('span', { class: 'wrong', lang: 'en' }, e.wrong),
      h('span', { class: 'right', lang: 'en' }, e.right),
      h('span', { class: 'why' }, e.why),
    ))),
    L.tip ? h('p', { class: 'tip' }, L.tip) : null,
  );
}

async function viewNotes(id) {
  if (id) {
    const c = await topicContent(id);
    return view(h('a', { class: 'back', href: '#/apuntes' }, '‹ Apuntes'), h('h1', {}, c.title), lessonNodes(c));
  }
  const ids = topicOrder().filter((t) => topicInfo(t).content);
  view(
    h('h1', {}, 'Apuntes'),
    h('p', { class: 'muted' }, 'Todas las lecciones para releerlas cuando quieras.'),
    h('div', { class: 'panel' }, ...ids.map((t) => h('div', { class: 'example' },
      h('a', { href: `#/apuntes/${t}`, class: 'en' }, topicInfo(t).title),
      h('div', { class: 'es' }, branchOf(t).title + (isDone(t) ? ' · superado' : '')),
    ))),
  );
}

// Ejecuta una lista de ejercicios uno tras otro dentro de "host". Devuelve los aciertos.
function runQueue(host, items, { kind, header, onAnswered } = {}) {
  return new Promise((resolve) => {
    let i = 0;
    let correct = 0;
    const results = [];
    const step = () => {
      if (i >= items.length) return resolve({ correct, total: items.length, results });
      const { topic, ex } = items[i];
      const ref = ex.ai ? ex.id : `${topic}:${ex.id}`;
      const k = typeof kind === 'function' ? kind(items[i]) : kind;
      const node = renderExercise(ex, {
        onResult: async (ok, given) => {
          if (ok) correct++;
          results.push({ topic, ex, ok, given });
          await answer(topic, ref, ex.ai ? 'ai' : k, ok);
          onAnswered?.(ok);
        },
        onNext: () => {
          i++;
          step();
        },
        onReport: reporter(topic, ref, ex),
      });
      host.replaceChildren(
        ...(header ? [header()] : []),
        h('p', { class: 'counter' }, `${i + 1} de ${items.length}`),
        node,
      );
      window.scrollTo(0, 0);
      node.querySelector('input, textarea, button.option, button.chip')?.focus({ preventScroll: true });
    };
    step();
  });
}

// ---------------------------------------------------------------- sesión diaria
const STEP_NAMES = ['Calentamiento', 'Lección', 'Práctica', 'Reto', 'Resumen'];

function stepsBar(current) {
  return h('ol', { class: 'steps', 'aria-label': 'Pasos de la sesión' },
    ...STEP_NAMES.map((n, i) => h('li', { class: i === current ? 'on' : i < current ? 'past' : '', 'aria-current': i === current ? 'step' : null }, n)),
  );
}

async function warmupItems(topicId) {
  const items = [];
  for (const r of S.state.review.slice(0, 5)) {
    const it = await resolveRef(r.ref);
    if (it) items.push(it);
  }
  // Rellenar con temas dejados para después y, si no, con temas ya superados.
  const pools = [
    topicOrder().filter((t) => statusOf(t) === 'skipped' && t !== topicId),
    topicOrder().filter((t) => isDone(t) && topicInfo(t).content && t !== topicId),
  ];
  for (const pool of pools) {
    for (const t of shuffle(pool)) {
      if (items.length >= 3) break;
      const c = await topicContent(t);
      const ex = shuffle(c.practice)[0];
      if (!items.some((x) => x.topic === t && x.ex.id === ex.id)) items.push({ topic: t, ex });
    }
  }
  return items.slice(0, 5);
}

function pickPractice(topicId, c, n) {
  const seen = new Set(S.state.seen[topicId] || []);
  const unseen = shuffle(c.practice.filter((e) => !seen.has(`${topicId}:${e.id}`)));
  const rest = shuffle(c.practice.filter((e) => seen.has(`${topicId}:${e.id}`)));
  return [...unseen, ...rest].slice(0, n).map((ex) => ({ topic: topicId, ex }));
}

async function viewSession(forced) {
  if (!S.state.user.placementDone && !forced) return go('#/test');
  const topicId = forced || nextTopic();
  if (!topicId) return go('#/mapa');
  if (!isUnlocked(topicId)) return go(`#/tema/${topicId}`);
  const c = await topicContent(topicId);
  const coinsStart = S.state.user.coins;
  const host = h('div');
  const title = () => h('div', {}, h('p', { class: 'muted' }, 'Sesión de hoy'), h('h1', {}, c.title));

  // 1. Calentamiento
  const warm = await warmupItems(topicId);
  if (warm.length) {
    view(host);
    await runQueue(host, warm, { kind: 'warmup', header: () => h('div', {}, stepsBar(0), title()) });
  }

  // 2. Lección con preguntas de comprobación
  await new Promise((resolve) => {
    view(stepsBar(1), title(), lessonNodes(c), h('h2', {}, 'Comprueba que lo has entendido'), host);
    const startChecks = h('button', { class: 'btn', type: 'button' }, 'Hacer las preguntas');
    host.replaceChildren(startChecks);
    startChecks.addEventListener('click', async () => {
      const box = h('div');
      host.replaceChildren(box);
      await runQueue(box, c.checks.map((ex) => ({ topic: topicId, ex })), { kind: 'check' });
      resolve();
    });
  });

  // 3. Práctica guiada
  view(host);
  const practice = pickPractice(topicId, c, 4);
  await runQueue(host, practice, { kind: 'practice', header: () => h('div', {}, stepsBar(2), title()) });

  // 4. Reto
  await new Promise((resolve) => {
    view(
      stepsBar(3), title(),
      h('div', { class: 'panel' },
        h('h2', {}, 'Reto final'),
        h('p', {}, `${c.challenge.length} ejercicios. Con un ${Math.round(S.tree.threshold * 100)} % o más superas el tema y se abren los siguientes.`),
        h('button', { class: 'btn', type: 'button', onclick: resolve }, 'Empezar el reto'),
      ),
    );
  });
  view(host);
  const res = await runQueue(host, c.challenge.map((ex) => ({ topic: topicId, ex })), {
    kind: 'challenge',
    header: () => h('div', {}, stepsBar(3), title()),
  });
  const ch = await api('challenge', { topic: topicId, correct: res.correct, total: res.total });
  const sess = await api('session', {});
  await refresh();

  // 5. Resumen
  const earned = S.state.user.coins - coinsStart;
  const failed = res.results.filter((r) => !r.ok);
  view(
    stepsBar(4), title(),
    h('div', { class: 'panel' },
      h('p', { class: 'muted' }, 'Reto final'),
      h('div', { class: 'big-score' }, `${res.correct}/${res.total}`),
      h('p', {}, ch.passed
        ? ch.newlyCompleted ? 'Tema superado. Se han abierto los temas que dependían de él.' : 'Tema superado otra vez.'
        : `Te falta para el ${Math.round(ch.threshold * 100)} %. Los fallos volverán en el calentamiento.`),
    ),
    h('div', { class: 'stats' },
      h('div', { class: 'stat' }, h('b', {}, `+${earned}`), h('span', {}, 'monedas')),
      h('div', { class: 'stat' }, h('b', {}, String(sess.streak)), h('span', {}, 'días de racha')),
      h('div', { class: 'stat' }, h('b', {}, String(S.state.review.length)), h('span', {}, 'fallos por repasar')),
    ),
    sess.usedFreeDay ? h('p', { class: 'muted' }, 'Ayer no estudiaste: has usado el día libre de esta semana y la racha sigue.') : null,
    failed.length
      ? h('div', { class: 'panel' }, h('h2', {}, 'Repasa estos fallos'),
        ...failed.map((r) => h('div', { class: 'err' }, h('span', { class: 'right', lang: 'en' }, r.ex.sentence || r.ex.prompt || r.ex.es), h('span', { class: 'why' }, r.ex.explain))))
      : null,
    h('div', { class: 'stack' },
      h('a', { class: 'btn block', href: `#/practica/${topicId}` }, 'Seguir practicando (sesión de 30 min)'),
      h('a', { class: 'btn secondary block', href: '#/' }, 'Terminar por hoy'),
    ),
  );
}

// ---------------------------------------------------------------- práctica libre y repaso
async function viewPractice(id) {
  if (!isUnlocked(id)) return go(`#/tema/${id}`);
  const c = await topicContent(id);
  const host = h('div');
  view(host);
  const head = () => h('div', {}, h('a', { class: 'back', href: `#/tema/${id}` }, '‹ ' + c.title), h('h1', {}, 'Práctica'));
  await runQueue(host, pickPractice(id, c, 6), { kind: 'practice', header: head });
  const seen = new Set(S.state.seen[id] || []);
  const allSeen = c.practice.every((e) => seen.has(`${id}:${e.id}`));
  view(
    head(),
    h('div', { class: 'panel' },
      h('p', {}, allSeen ? 'Ya has hecho todos los ejercicios del banco de este tema.' : 'Bloque terminado.'),
      h('div', { class: 'stack' },
        h('a', { class: 'btn block', href: `#/practica/${id}?r=${Date.now()}` }, 'Otro bloque'),
        allSeen && S.state.aiEnabled ? h('a', { class: 'btn secondary block', href: `#/extra/${id}` }, 'Práctica extra (IA)') : null,
        h('a', { class: 'btn ghost block', href: '#/' }, 'Volver al inicio'),
      ),
    ),
  );
}

async function viewExtra(id) {
  const c = await topicContent(id);
  view(h('a', { class: 'back', href: `#/tema/${id}` }, '‹ ' + c.title), h('h1', {}, 'Práctica extra (IA)'), h('p', { class: 'muted' }, 'Preparando ejercicios nuevos…'));
  let data;
  try {
    data = await api('generate', { topic: id });
  } catch (e) {
    return view(
      h('a', { class: 'back', href: `#/tema/${id}` }, '‹ ' + c.title),
      h('div', { class: 'panel' }, h('h1', {}, 'Ahora no hay práctica extra'), h('p', {}, e.message),
        h('a', { class: 'btn', href: `#/practica/${id}` }, 'Repasar el banco del tema')),
    );
  }
  const host = h('div');
  view(host);
  await runQueue(host, data.exercises.map((ex) => ({ topic: id, ex })), {
    kind: 'ai',
    header: () => h('div', {}, h('a', { class: 'back', href: `#/tema/${id}` }, '‹ ' + c.title), h('h1', {}, 'Práctica extra (IA)'),
      h('p', { class: 'muted small' }, 'Generados con IA: si ves un error, repórtalo y no volverá a salir.')),
  });
  view(h('div', { class: 'panel' }, h('h2', {}, 'Bloque terminado'), h('div', { class: 'stack' },
    h('a', { class: 'btn block', href: `#/extra/${id}?r=${Date.now()}` }, 'Más práctica extra'),
    h('a', { class: 'btn secondary block', href: '#/' }, 'Volver al inicio'))));
}

async function viewReview() {
  const items = [];
  for (const r of S.state.review.slice(0, 10)) {
    const it = await resolveRef(r.ref);
    if (it) items.push(it);
  }
  if (!items.length) return view(h('h1', {}, 'Repaso'), h('p', {}, 'No tienes fallos pendientes.'), h('a', { class: 'btn', href: '#/' }, 'Volver'));
  const host = h('div');
  view(host);
  const r = await runQueue(host, items, { kind: 'warmup', header: () => h('h1', {}, 'Repaso de fallos') });
  view(h('h1', {}, 'Repaso de fallos'), h('div', { class: 'panel' }, h('div', { class: 'big-score' }, `${r.correct}/${r.total}`),
    h('p', {}, 'Los que has acertado salen de la lista de repaso.'), h('a', { class: 'btn', href: '#/' }, 'Volver al inicio')));
}

// ---------------------------------------------------------------- test de nivel
async function viewTest() {
  const p = await content('placement.json');
  await new Promise((resolve) => {
    view(
      h('h1', {}, 'Test de nivel'),
      h('div', { class: 'panel' }, h('p', {}, p.intro), h('button', { class: 'btn', type: 'button', onclick: resolve }, 'Empezar')),
    );
  });
  const host = h('div');
  view(host);
  const results = {};
  let i = 0;
  await new Promise((resolve) => {
    const step = () => {
      if (i >= p.questions.length) return resolve();
      const q = p.questions[i];
      host.replaceChildren(
        h('h1', {}, 'Test de nivel'),
        h('p', { class: 'counter' }, `${i + 1} de ${p.questions.length}`),
        renderExercise(q, {
          onResult: (ok) => {
            (results[q.topic] ||= []).push(ok);
          },
          onNext: () => {
            i++;
            step();
          },
        }),
      );
      window.scrollTo(0, 0);
    };
    step();
  });
  // Un tema solo queda superado si también lo están sus requisitos (no se salta la base).
  const ok = new Set(Object.entries(results).filter(([, r]) => r.every(Boolean)).map(([t]) => t));
  const passed = topicOrder().filter((t) => ok.has(t));
  for (const t of [...passed]) {
    const reqsOk = (id) => topicInfo(id).requires.every((r) => (passed.includes(r) || isDone(r)) && reqsOk(r));
    if (!reqsOk(t)) passed.splice(passed.indexOf(t), 1);
  }
  await api('placement', { passed });
  await refresh();
  view(
    h('h1', {}, 'Resultado del test'),
    h('div', { class: 'panel' },
      passed.length
        ? h('div', {}, h('p', {}, 'Temas superados directamente:'), h('ul', {}, ...passed.map((t) => h('li', {}, topicInfo(t).title))))
        : h('p', {}, 'Empezarás desde el principio de cada rama. Así afianzas la base, que es justo lo que hace falta para escribir bien.'),
      h('a', { class: 'btn', href: '#/' }, 'Ir a la sesión de hoy'),
    ),
  );
}

// ---------------------------------------------------------------- tienda
function viewShop() {
  const owned = new Set(S.state.purchases);
  const u = S.state.user;
  const groups = [
    { kind: 'theme', title: 'Temas de color' },
    { kind: 'avatar', title: 'Avatares' },
    { kind: 'card', title: 'Postales coleccionables' },
  ];
  const itemNode = (it) => {
    const has = owned.has(it.id);
    const look = it.kind === 'theme'
      ? h('span', { class: 'swatch', style: `background:${it.preview}` })
      : h('span', { 'aria-hidden': 'true' }, it.emoji);
    const inUse = (it.kind === 'theme' && u.theme === it.id) || (it.kind === 'avatar' && u.avatar === it.id);
    let action;
    if (!has) {
      action = h('button', { class: 'btn small', type: 'button', disabled: u.coins < it.price }, `Comprar por ${it.price}`);
      action.addEventListener('click', async () => {
        try {
          await api('buy', { item: it.id });
          await refresh();
          toast(`${it.name}: comprado`);
          viewShop();
        } catch (e) {
          toast(e.message);
        }
      });
    } else if (it.kind === 'card') {
      action = null;
    } else {
      action = h('button', { class: 'btn small secondary', type: 'button', disabled: inUse }, inUse ? 'En uso' : 'Usar');
      action.addEventListener('click', async () => {
        await api('equip', { [it.kind]: it.id });
        await refresh();
        viewShop();
      });
    }
    return h('div', { class: 'item' + (it.kind === 'card' ? ' postcard' : '') },
      h('div', { class: 'look' }, look),
      h('b', {}, it.name),
      has && it.fact ? h('span', { class: 'fact' }, it.fact) : null,
      action,
    );
  };
  const resetBtn = (field, label) => {
    const b = h('button', { class: 'btn small ghost', type: 'button', disabled: u[field] === 'default' }, label);
    b.addEventListener('click', async () => {
      await api('equip', { [field]: 'default' });
      await refresh();
      viewShop();
    });
    return b;
  };
  view(
    h('h1', {}, 'Tienda'),
    h('p', { class: 'muted' }, `Tienes ${u.coins} monedas. Todo es personalización: nada de esto te ayuda a resolver ejercicios.`),
    ...groups.flatMap((g) => [
      h('div', { class: 'row' }, h('h2', { style: 'margin:0' }, g.title),
        g.kind === 'theme' ? resetBtn('theme', 'Volver al tema original') : g.kind === 'avatar' ? resetBtn('avatar', 'Quitar avatar') : null),
      h('div', { class: 'shop-grid' }, ...S.shop.items.filter((i) => i.kind === g.kind).map(itemNode)),
    ]),
  );
}

// ---------------------------------------------------------------- respuestas guardadas
async function viewReports() {
  const { reports } = await api('reports');
  const node = (r) => {
    const ex = r.exercise || {};
    const done = h('button', { class: 'btn small secondary', type: 'button' }, 'Revisado');
    const box = h('div', { class: 'err' },
      h('span', { class: 'why' }, (r.kind === 'ai_error' ? 'Error en ejercicio de IA' : 'Mi respuesta también vale') + ' · ' + (topicInfo(r.topic)?.title || r.topic)),
      h('span', { lang: 'en' }, 'Ejercicio: ' + (ex.sentence || ex.prompt || ex.es || '')),
      r.answer ? h('span', { class: 'right', lang: 'en' }, 'Tu respuesta: ' + r.answer) : null,
      ex.answers ? h('span', { class: 'why' }, 'Aceptadas: ' + ex.answers.join(' | ')) : null,
      h('div', { class: 'row' }, done),
    );
    done.addEventListener('click', async () => {
      await api('reports', { id: r.id });
      box.remove();
    });
    return box;
  };
  view(
    h('h1', {}, 'Para revisar'),
    h('p', { class: 'muted' }, 'Respuestas que marcaste como válidas y errores reportados en ejercicios de IA. Cuando una respuesta sea correcta, añádela a "answers" en el contenido del tema.'),
    reports.length ? h('div', { class: 'panel' }, ...reports.map(node)) : h('p', {}, 'No hay nada pendiente.'),
  );
}

// ---------------------------------------------------------------- rutas
function go(hash) {
  busy = false; // una redirección no es abandonar una sesión
  if (location.hash === hash) route();
  else location.hash = hash;
}

let busy = false;
async function route() {
  const hash = location.hash.replace(/\?.*$/, '') || '#/';
  const [, section, arg] = hash.split('/');
  document.querySelectorAll('[data-nav]').forEach((a) => {
    const nav = a.dataset.nav;
    const active = (nav === 'home' && !section) || nav === section || (nav === 'mapa' && section === 'tema');
    if (active) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  });
  if (busy) {
    // Cambiar de pantalla a mitad de una sesión: se recarga para empezar limpio.
    location.reload();
    return;
  }
  busy = ['sesion', 'practica', 'extra', 'repaso', 'test'].includes(section);
  try {
    switch (section) {
      case undefined:
      case '':
        await viewHome();
        break;
      case 'mapa':
        viewMap();
        break;
      case 'tema':
        await viewTopic(arg);
        break;
      case 'apuntes':
        await viewNotes(arg);
        break;
      case 'tienda':
        viewShop();
        break;
      case 'sesion':
        await viewSession(arg);
        break;
      case 'practica':
        await viewPractice(arg);
        break;
      case 'extra':
        await viewExtra(arg);
        break;
      case 'repaso':
        await viewReview();
        break;
      case 'test':
        await viewTest();
        break;
      case 'revisar':
        await viewReports();
        break;
      default:
        go('#/');
    }
  } catch (e) {
    console.error(e);
    showError(e);
  } finally {
    busy = false;
  }
}

async function start() {
  try {
    [S.tree, S.shop] = await Promise.all([content('tree.json'), content('shop.json')]);
    await refresh();
  } catch (e) {
    return showError(e);
  }
  window.addEventListener('hashchange', route);
  route();
  if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
}

start();
