import test from 'node:test';
import assert from 'node:assert/strict';
import { nextStreak } from '../src/lib/streak.js';

const u = (last_day, streak, free_week = null) => ({ last_day, streak, free_week });

test('primer día', () => assert.equal(nextStreak(u(null, 0), '2026-10-27').streak, 1));
test('día seguido suma', () => assert.equal(nextStreak(u('2026-10-26', 4), '2026-10-27').streak, 5));
test('mismo día no suma', () => {
  const r = nextStreak(u('2026-10-27', 4), '2026-10-27');
  assert.equal(r.streak, 4);
  assert.ok(r.alreadyToday);
});
test('un día sin estudiar usa el día libre de la semana', () => {
  const r = nextStreak(u('2026-10-25', 4), '2026-10-27'); // falta el 26 (lunes, semana 44)
  assert.equal(r.streak, 5);
  assert.ok(r.usedFreeDay);
  assert.equal(r.freeWeek, '2026-W44');
});
test('segundo día sin estudiar en la misma semana reinicia', () => {
  const r = nextStreak(u('2026-10-27', 5, '2026-W44'), '2026-10-29'); // falta el 28, misma semana
  assert.equal(r.streak, 1);
});
test('el día libre se renueva la semana siguiente', () => {
  const r = nextStreak(u('2026-11-01', 7, '2026-W44'), '2026-11-03'); // falta el 2 (semana 45)
  assert.equal(r.streak, 8);
});
test('dos días seguidos sin estudiar reinicia', () => {
  assert.equal(nextStreak(u('2026-10-24', 4), '2026-10-27').streak, 1);
});
