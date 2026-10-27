import test from 'node:test';
import assert from 'node:assert/strict';
import { normalize, matches, wordCount } from '../public/js/normalize.js';

test('ignora mayúsculas, puntuación y espacios', () => {
  assert.ok(matches('  i SAW him yesterday ', ['I saw him yesterday.']));
});
test('apóstrofo del iPhone y contracciones', () => {
  assert.ok(matches('She doesn’t like coffee', ['She does not like coffee.']));
  assert.ok(matches("I haven't finished", ['I have not finished']));
  assert.ok(matches("It's been raining all morning", ['It has been raining all morning.']));
  assert.ok(matches("she is staying with us", ["she's staying with us"]));
  assert.ok(matches("I had never seen the sea", ["I'd never seen the sea."]));
  assert.ok(matches("I can't", ['I cannot']));
});
test('no acepta respuestas distintas', () => {
  assert.ok(!matches('I have seen him yesterday', ['I saw him yesterday.']));
  assert.ok(!matches('', ['x']));
});
test('cuenta palabras como Cambridge (contracción = 2)', () => {
  assert.equal(wordCount("haven't seen her since"), 5);
  assert.equal(wordCount('had already started'), 3);
});
test('normalize es estable', () => {
  assert.equal(normalize(normalize("Don't stop!")), normalize("Don't stop!"));
});
