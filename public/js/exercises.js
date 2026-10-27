// Motor de ejercicios: dibuja cada tipo, corrige y muestra la explicación.
import { matches } from './normalize.js';

export const TYPE_LABEL = {
  mc: 'Elige la opción correcta',
  gap: 'Completa el hueco',
  wordform: 'Formación de palabras',
  kwt: 'Key word transformation',
  order: 'Ordena la frase',
  write: 'Escríbelo en inglés',
  translate: 'Traduce al inglés',
  fix: 'Corrige el error',
};

const FREE_TEXT = ['gap', 'wordform', 'kwt', 'write', 'translate', 'fix'];

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v === undefined || v === null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat()) {
    if (c === null || c === undefined || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const noAuto = { autocomplete: 'off', autocorrect: 'off', autocapitalize: 'off', spellcheck: 'false' };

// Texto de la respuesta modelo para enseñarla tras fallar.
export function modelAnswer(ex) {
  switch (ex.type) {
    case 'mc':
      return ex.options[ex.answer];
    case 'gap':
    case 'wordform':
      return ex.prompt.replace(/\(.*?\)\s*/, '').replace('___', ex.answers[0]).replace(/\s+/g, ' ');
    case 'kwt':
      return `${ex.start} ${ex.answers[0]} ${ex.end}`;
    default:
      return ex.answers[0];
  }
}

/**
 * Dibuja un ejercicio.
 * opts.onResult(correct, given) se llama al comprobar (puede devolver una promesa).
 * opts.onNext() se llama al pulsar "Continuar".
 * opts.onReport(kind, given) para "mi respuesta también vale" o "reportar error de IA".
 */
export function renderExercise(ex, opts) {
  const sheet = h('section', { class: 'sheet', 'aria-label': TYPE_LABEL[ex.type] });
  sheet.append(h('span', { class: 'kind' + (ex.ai ? ' ai' : '') }, ex.ai ? 'Práctica extra (IA) · ' + TYPE_LABEL[ex.type] : TYPE_LABEL[ex.type]));

  const body = h('div');
  sheet.append(body);
  const actions = h('div', { class: 'actions' });
  const checkBtn = h('button', { class: 'btn', type: 'button' }, 'Comprobar');
  let getAnswer = () => '';
  let done = false;

  const finish = async (correct, given) => {
    if (done) return;
    done = true;
    sheet.querySelectorAll('input, textarea, button.option, button.chip').forEach((el) => (el.disabled = true));
    checkBtn.remove();
    const fb = h('div', { class: 'feedback ' + (correct ? 'ok' : 'no'), role: 'status' });
    fb.append(h('div', { class: 'verdict' }, correct ? 'Correcto' : 'No es correcto'));
    if (!correct) fb.append(h('div', { class: 'model' }, 'Respuesta: ' + modelAnswer(ex)));
    fb.append(h('div', {}, ex.explain));
    const fbActions = h('div', { class: 'actions' });
    const next = h('button', { class: 'btn', type: 'button', onclick: () => opts.onNext?.() }, 'Continuar');
    fbActions.append(next);
    if (!correct && FREE_TEXT.includes(ex.type) && opts.onReport && given) {
      const claim = h('button', { class: 'btn secondary small', type: 'button' }, 'Mi respuesta también vale');
      claim.addEventListener('click', async () => {
        claim.disabled = true;
        await opts.onReport('valid_answer', given);
        claim.textContent = 'Guardada para revisar';
      });
      fbActions.append(claim);
    }
    if (ex.ai && opts.onReport) {
      const rep = h('button', { class: 'btn ghost small', type: 'button' }, 'Este ejercicio tiene un error');
      rep.addEventListener('click', async () => {
        rep.disabled = true;
        await opts.onReport('ai_error', given);
        rep.textContent = 'Reportado. No volverá a salir.';
      });
      fbActions.append(rep);
    }
    fb.append(fbActions);
    sheet.append(fb);
    next.focus({ preventScroll: true });
    fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    await opts.onResult?.(correct, given);
  };

  const check = () => {
    const given = getAnswer().trim();
    if (!given) return;
    let accepted = ex.answers;
    if (ex.type === 'kwt') accepted = ex.answers.map((a) => `${ex.start} ${a} ${ex.end}`);
    const full = ex.type === 'kwt' ? `${ex.start} ${given} ${ex.end}` : given;
    finish(matches(full, accepted), given);
  };
  checkBtn.addEventListener('click', check);
  const onEnter = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      check();
    }
  };

  switch (ex.type) {
    case 'mc': {
      const [before, after] = ex.prompt.split('___');
      body.append(h('p', { class: 'sentence' }, before, h('span', { class: 'muted' }, '_____'), after ?? ''));
      const list = h('div', { class: 'options' });
      ex.options.forEach((opt, i) => {
        const b = h('button', { class: 'option', type: 'button' }, h('span', { class: 'letter' }, 'ABCD'[i]), opt);
        b.addEventListener('click', () => {
          const ok = i === ex.answer;
          b.classList.add(ok ? 'correct' : 'wrong');
          list.children[ex.answer].classList.add('correct');
          finish(ok, opt);
        });
        list.append(b);
      });
      body.append(list);
      return sheet;
    }
    case 'gap':
    case 'wordform': {
      const [before, after] = ex.prompt.split('___');
      const input = h('input', { class: 'blank', type: 'text', 'aria-label': 'Tu respuesta', ...noAuto, onkeydown: onEnter });
      body.append(h('p', { class: 'sentence' }, before, input, after));
      if (ex.type === 'wordform') body.append(h('p', {}, 'Palabra base: ', h('span', { class: 'keyword' }, ex.root)));
      getAnswer = () => input.value;
      break;
    }
    case 'kwt': {
      body.append(h('p', { class: 'sentence' }, ex.sentence));
      body.append(h('div', { class: 'keyword', 'aria-label': 'Palabra clave' }, ex.keyword));
      const input = h('input', { class: 'blank', type: 'text', 'aria-label': 'Tu respuesta', ...noAuto, onkeydown: onEnter });
      input.style.width = '22ch';
      body.append(h('p', { class: 'sentence' }, ex.start + ' ', input, ' ' + ex.end));
      body.append(h('p', { class: 'muted small' }, 'Usa la palabra clave sin cambiarla. Entre 2 y 5 palabras.'));
      getAnswer = () => input.value;
      break;
    }
    case 'order': {
      const built = h('p', { class: 'sentence built', 'aria-live': 'polite' });
      const chips = h('div', { class: 'chips' });
      const picked = [];
      const redraw = () => {
        built.replaceChildren(...picked.map((p, k) => {
          const c = h('button', { class: 'chip', type: 'button', 'aria-label': 'Quitar ' + p.word }, p.word);
          c.addEventListener('click', () => {
            picked.splice(k, 1);
            p.btn.disabled = false;
            redraw();
          });
          return c;
        }));
      };
      shuffle(ex.words).forEach((w) => {
        const b = h('button', { class: 'chip', type: 'button' }, w);
        b.addEventListener('click', () => {
          picked.push({ word: w, btn: b });
          b.disabled = true;
          redraw();
        });
        chips.append(b);
      });
      body.append(built, chips);
      getAnswer = () => picked.map((p) => p.word).join(' ');
      break;
    }
    case 'write':
    case 'translate': {
      body.append(h('p', { class: 'ask' }, 'Escribe esta frase en inglés:'));
      body.append(h('p', { class: 'es-line' }, ex.type === 'write' ? ex.prompt : ex.es));
      const ta = h('textarea', { class: 'free', 'aria-label': 'Tu frase en inglés', ...noAuto, onkeydown: onEnter });
      body.append(ta);
      getAnswer = () => ta.value;
      break;
    }
    case 'fix': {
      body.append(h('p', { class: 'ask' }, 'Esta frase tiene un error. Escríbela bien:'));
      body.append(h('p', { class: 'wrongline' }, ex.sentence));
      const ta = h('textarea', { class: 'free', 'aria-label': 'Frase corregida', ...noAuto, onkeydown: onEnter });
      ta.value = ex.sentence;
      body.append(ta);
      getAnswer = () => ta.value;
      break;
    }
  }
  actions.append(checkBtn);
  sheet.append(actions);
  return sheet;
}
