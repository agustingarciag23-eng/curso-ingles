// Cálculo de la racha. Un día libre por semana no la rompe.
import { dayDiff, addDays, isoWeek } from './util.js';

export function nextStreak(user, day) {
  const last = user.last_day;
  if (!last) return { streak: 1, freeWeek: user.free_week, usedFreeDay: false, alreadyToday: false };
  const diff = dayDiff(last, day);
  if (diff <= 0) return { streak: user.streak, freeWeek: user.free_week, usedFreeDay: false, alreadyToday: true };
  if (diff === 1) return { streak: user.streak + 1, freeWeek: user.free_week, usedFreeDay: false, alreadyToday: false };
  if (diff === 2) {
    const missedWeek = isoWeek(addDays(last, 1));
    if (user.free_week !== missedWeek) {
      return { streak: user.streak + 1, freeWeek: missedWeek, usedFreeDay: true, alreadyToday: false };
    }
  }
  return { streak: 1, freeWeek: user.free_week, usedFreeDay: false, alreadyToday: false };
}
