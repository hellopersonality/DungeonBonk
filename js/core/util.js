// Small math and helper functions shared everywhere. No game state lives here.
export const V3 = THREE.Vector3;

export const W = () => innerWidth;
export const H = () => innerHeight;

export const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
export const lerp = (a, b, t) => a + (b - a) * t;

/** Signed shortest difference between two angles (radians). */
export function angDiff(a, b) {
  let d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Rotate angle a toward b by at most `max` radians. */
export function turnTo(a, b, max) {
  return a + clamp(angDiff(a, b), -max, max);
}

export const fmtTime = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');

export function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

export const rand = (a, b) => a + Math.random() * (b - a);
