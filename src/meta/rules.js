// Unlock rules, shared by species and cosmetics. Pure: the caller passes a
// query object so tests can drive every rule without a profile.
//
// q = {
//   stars(worldId) -> [b, b, b], totalStars() -> n, finished(worldId) -> bool, journalPct() -> 0..100,
//   goldenFound(worldId) -> bool, egg(id) -> bool, storyDone() -> bool,
//   bought(key) -> bool, achievement(id) -> bool
// }

export const UNLOCK_KINDS = ['start', 'stars', 'finish', 'journal', 'golden', 'secret', 'egg', 'story', 'price', 'achievement'];

export function starCount(arr) {
  if (!arr) return 0;
  let n = 0;
  for (const s of arr) if (s) n++;
  return n;
}

// Does the rule's condition hold (ignoring any purchase)?
export function ruleMet(rule, q) {
  if (!rule || !rule.kind) return true;
  switch (rule.kind) {
    case 'start': return true;
    case 'stars':
      // With a world: stars in that world. Without: total stars across all worlds.
      if (!rule.world) return (q.totalStars ? q.totalStars() : 0) >= (rule.count ?? 1);
      return starCount(q.stars(rule.world)) >= (rule.count ?? 1);
    case 'finish': return !!q.finished(rule.world || 'w1');
    case 'journal': return q.journalPct() >= (rule.pct ?? 100);
    case 'golden': return !!q.goldenFound(rule.world || 'w1');
    case 'secret':
    case 'egg': return !!(rule.egg && q.egg(rule.egg));
    case 'story': return !!q.storyDone();
    case 'achievement': return !!(rule.id && q.achievement && q.achievement(rule.id));
    case 'price': return false; // only by buying
    default: return false;
  }
}

// Unlocked = condition met, or bought when the rule carries a price.
export function isRuleUnlocked(rule, q, key) {
  if (ruleMet(rule, q)) return true;
  if (rule && rule.price != null && q.bought && q.bought(key)) return true;
  return false;
}

// A purchase is allowed when the rule offers a price and the thing isn't already unlocked.
export function canBuyRule(rule) {
  return !!(rule && rule.price != null && rule.price >= 0);
}
