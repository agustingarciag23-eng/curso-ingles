// Normaliza respuestas escritas para compararlas sin penalizar detalles que no son gramática:
// mayúsculas, espacios, puntuación, apóstrofos del iPhone (’) y contracciones (don't = do not).
// Se usa en la web y también en el servidor (validación de ejercicios generados con IA).

export function normalize(text) {
  let s = String(text ?? '')
    .normalize('NFC')
    .replace(/[’‘`´]/g, "'")
    .toLowerCase();

  s = s.replace(/[.,!?;:"“”«»¡¿()\[\]]/g, ' ');

  // Contracciones (el orden importa: primero las irregulares).
  s = s
    .replace(/\bwon't\b/g, 'will not')
    .replace(/\bshan't\b/g, 'shall not')
    .replace(/\bcan't\b/g, 'can not')
    .replace(/\bcannot\b/g, 'can not')
    .replace(/\bain't\b/g, 'is not')
    .replace(/n't\b/g, ' not')
    .replace(/'m\b/g, ' am')
    .replace(/'re\b/g, ' are')
    .replace(/'ve\b/g, ' have')
    .replace(/'ll\b/g, ' will')
    // 's: "has" delante de been / got / participios frecuentes; si no, "is".
    .replace(/'s (been|got|gone|done|had|seen|made|taken|lost|left|finished|already|just|never)\b/g, ' has $1')
    .replace(/'s\b/g, ' is')
    // 'd: "had" delante de been / never / already / just / participios; si no, "would".
    .replace(/'d (been|never|already|just|gone|done|seen|had|left|lost|eaten|finished|better)\b/g, ' had $1')
    .replace(/'d\b/g, ' would');

  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

export function matches(userAnswer, answers) {
  const u = normalize(userAnswer);
  if (!u) return false;
  return answers.some((a) => normalize(a) === u);
}

// Número de palabras de una respuesta tipo Part 4 (las contracciones cuentan como dos, como en Cambridge).
export function wordCount(text) {
  const n = normalize(text);
  return n ? n.split(' ').length : 0;
}
