/**
 * LexoRank-like fractional indexing for card ordering.
 * Generates string keys that sort lexicographically between two given keys.
 */

const CHARS = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz';
const BASE = CHARS.length;

function midpoint(a: number, b: number): number {
  return Math.floor((a + b) / 2);
}

function charToIndex(c: string): number {
  return CHARS.indexOf(c);
}

function indexToChar(i: number): string {
  return CHARS[i];
}

/**
 * Generate a position string between `before` and `after`.
 * If both are empty, returns a midpoint position.
 * If `before` is empty, generates position before `after`.
 * If `after` is empty, generates position after `before`.
 */
export function generatePosition(before?: string, after?: string): string {
  if (!before && !after) {
    return 'U'; // Midpoint of the alphabet
  }

  if (!before) {
    // Generate something before `after`
    const first = charToIndex(after![0]);
    if (first > 1) {
      return indexToChar(midpoint(0, first));
    }
    return after![0] + generatePosition(undefined, after!.slice(1) || undefined);
  }

  if (!after) {
    // Generate something after `before`
    const last = charToIndex(before[before.length - 1]);
    if (last < BASE - 2) {
      return before.slice(0, -1) + indexToChar(midpoint(last, BASE - 1));
    }
    return before + indexToChar(midpoint(0, BASE - 1));
  }

  // Generate between `before` and `after`
  let i = 0;
  while (i < before.length && i < after.length && before[i] === after[i]) {
    i++;
  }

  const prefix = before.slice(0, i);

  const a = i < before.length ? charToIndex(before[i]) : 0;
  const b = i < after.length ? charToIndex(after[i]) : BASE - 1;

  if (b - a > 1) {
    return prefix + indexToChar(midpoint(a, b));
  }

  // Need to go deeper
  const nextA = i + 1 < before.length ? charToIndex(before[i + 1]) : 0;
  return prefix + before[i] + indexToChar(midpoint(nextA, BASE - 1));
}

/**
 * Generate initial positions for N items evenly spread.
 */
export function generateInitialPositions(count: number): string[] {
  const positions: string[] = [];
  const step = Math.floor(BASE / (count + 1));

  for (let i = 1; i <= count; i++) {
    const idx = Math.min(step * i, BASE - 1);
    positions.push(indexToChar(idx));
  }

  return positions;
}
