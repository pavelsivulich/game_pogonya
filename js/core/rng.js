/** Детерминированный PRNG — один seed = одна карта (для тестов и реплеев). */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const randInt = (rnd, n) => Math.floor(rnd() * n);
export const pick = (rnd, arr) => arr[randInt(rnd, arr.length)];
