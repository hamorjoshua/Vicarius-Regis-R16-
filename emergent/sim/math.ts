// The project's own maths, so results never differ between browsers.
// Only +, -, *, / and Math.sqrt are used: IEEE 754 fixes those exactly.

export const LN2 = 0.6931471805599453;
const TWO_PI = 6.283185307179586;

export const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
export const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export const sqrt = (x: number): number => Math.sqrt(x > 0 ? x : 0);

export function exp(x: number): number {
  if (x > 700) return Infinity;
  if (x < -700) return 0;
  let k = 0;
  while (x > 0.5 * LN2) { x -= LN2; k++; }
  while (x < -0.5 * LN2) { x += LN2; k--; }
  let term = 1, sum = 1;
  for (let i = 1; i <= 14; i++) { term = (term * x) / i; sum += term; }
  while (k > 0) { sum *= 2; k--; }
  while (k < 0) { sum /= 2; k++; }
  return sum;
}

export function ln(x: number): number {
  if (x <= 0) return -745;
  let k = 0;
  while (x > 1.4142135623730951) { x /= 2; k++; }
  while (x < 0.7071067811865476) { x *= 2; k--; }
  const s = (x - 1) / (x + 1), s2 = s * s;
  let term = s, sum = s;
  for (let i = 3; i <= 27; i += 2) { term *= s2; sum += term / i; }
  return 2 * sum + k * LN2;
}

export const log2 = (x: number): number => ln(x) / LN2;
export const pow = (x: number, y: number): number => (x <= 0 ? 0 : exp(y * ln(x)));

export function cos(x: number): number {
  x = x - TWO_PI * Math.floor(x / TWO_PI);
  if (x > TWO_PI / 2) x -= TWO_PI;
  const x2 = x * x;
  let term = 1, sum = 1;
  for (let i = 2; i <= 24; i += 2) { term = (-term * x2) / (i * (i - 1)); sum += term; }
  return sum;
}

export const round = (x: number, places = 0): number => {
  let m = 1;
  for (let i = 0; i < places; i++) m *= 10;
  return Math.round(x * m) / m;
};

/** Sum a field over a list. */
export const sum = <T>(xs: readonly T[], f: (x: T) => number): number => {
  let s = 0;
  for (let i = 0; i < xs.length; i++) s += f(xs[i]!);
  return s;
};
