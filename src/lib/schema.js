// Valida la forma de un ejercicio. Se usa para el contenido del banco (scripts/check-content.mjs)
// y para descartar ejercicios generados con IA que vengan mal formados.
import { normalize, wordCount } from '../../public/js/normalize.js';

export const TYPES = ['mc', 'gap', 'wordform', 'kwt', 'order', 'write', 'translate', 'fix'];

const str = (v) => typeof v === 'string' && v.trim().length > 0;
const strArr = (v, min = 1) => Array.isArray(v) && v.length >= min && v.every(str);

export function validateExercise(ex) {
  const errs = [];
  if (!ex || typeof ex !== 'object') return ['no es un objeto'];
  if (!str(ex.id)) errs.push('falta id');
  if (!TYPES.includes(ex.type)) errs.push(`tipo desconocido: ${ex.type}`);
  if (!str(ex.explain)) errs.push('falta explicación');

  switch (ex.type) {
    case 'mc':
      if (!str(ex.prompt)) errs.push('mc: falta prompt');
      if (!strArr(ex.options, 3) || ex.options.length > 4) errs.push('mc: necesita 3 o 4 opciones');
      if (!Number.isInteger(ex.answer) || ex.answer < 0 || ex.answer >= (ex.options?.length ?? 0)) errs.push('mc: answer fuera de rango');
      if (ex.options && new Set(ex.options.map(normalize)).size !== ex.options.length) errs.push('mc: opciones repetidas');
      break;
    case 'gap':
    case 'wordform':
      if (!str(ex.prompt) || ex.prompt.split('___').length !== 2) errs.push(`${ex.type}: el prompt necesita exactamente un ___`);
      if (!strArr(ex.answers)) errs.push(`${ex.type}: faltan respuestas`);
      if (ex.type === 'wordform' && !str(ex.root)) errs.push('wordform: falta la palabra raíz');
      break;
    case 'kwt':
      for (const k of ['sentence', 'keyword', 'start', 'end']) if (typeof ex[k] !== 'string') errs.push(`kwt: falta ${k}`);
      if (!strArr(ex.answers)) errs.push('kwt: faltan respuestas');
      for (const a of ex.answers || []) {
        const n = wordCount(a);
        if (n < 2 || n > 5) errs.push(`kwt: "${a}" tiene ${n} palabras (deben ser 2-5)`);
        if (str(ex.keyword) && !normalize(a).split(' ').includes(normalize(ex.keyword))) {
          errs.push(`kwt: "${a}" no contiene la palabra clave ${ex.keyword}`);
        }
      }
      break;
    case 'order': {
      if (!strArr(ex.words, 3)) errs.push('order: faltan palabras');
      if (!strArr(ex.answers)) errs.push('order: faltan respuestas');
      if (strArr(ex.words, 3) && strArr(ex.answers)) {
        const bag = (s) => normalize(s).split(' ').sort().join(' ');
        const words = bag(ex.words.join(' '));
        for (const a of ex.answers) if (bag(a) !== words) errs.push(`order: "${a}" no usa exactamente las palabras dadas`);
      }
      break;
    }
    case 'write':
      if (!str(ex.prompt)) errs.push('write: falta la frase en español');
      if (!strArr(ex.answers)) errs.push('write: faltan respuestas');
      break;
    case 'translate':
      if (!str(ex.es)) errs.push('translate: falta la frase en español');
      if (!strArr(ex.answers)) errs.push('translate: faltan respuestas');
      break;
    case 'fix':
      if (!str(ex.sentence)) errs.push('fix: falta la frase con error');
      if (!strArr(ex.answers)) errs.push('fix: faltan respuestas');
      if (str(ex.sentence) && (ex.answers || []).some((a) => normalize(a) === normalize(ex.sentence))) {
        errs.push('fix: la frase con error coincide con una respuesta');
      }
      break;
  }
  return errs;
}
