// ——— Álgebra modular ———
export function toInt(x: string | number): number {
  const n = typeof x === "number" ? x : parseInt(String(x).trim(), 10);
  return Number.isFinite(n) ? n : 0;
}

export function modNorm(a: number, m: number): number {
  if (m === 0) return a;
  const r = a % m;
  return r < 0 ? r + Math.abs(m) : r;
}

export function egcd(a: number, b: number): { g: number; x: number; y: number } {
  let x0 = 1, y0 = 0, x1 = 0, y1 = 1;
  while (b !== 0) {
    const q = Math.trunc(a / b);
    [a, b] = [b, a - q * b];
    [x0, x1] = [x1, x0 - q * x1];
    [y0, y1] = [y1, y0 - q * y1];
  }
  return { g: Math.abs(a), x: x0, y: y0 };
}

export function modInv(a: number, m: number): number | null {
  const { g, x } = egcd(a, m);
  if (g !== 1) return null;
  return modNorm(x, m);
}

export function powMod(base: number, exp: number, m: number): number {
  base = modNorm(base, m);
  let res = 1 % (m || 1);
  let b = base, e = exp;
  while (e > 0) {
    if (e & 1) res = modNorm(res * b, m);
    b = modNorm(b * b, m);
    e >>= 1;
  }
  return res;
}

export function solveLinearCongruence(a: number, b: number, m: number): {
  hasSolution: boolean;
  x0?: number; // solución base
  mod?: number; // módulo del conjunto de soluciones
} {
  const { g } = egcd(Math.abs(a), Math.abs(m));
  if (b % g !== 0) return { hasSolution: false };
  const a1 = a / g, b1 = b / g, m1 = m / g;
  const inv = modInv(modNorm(a1, m1), Math.abs(m1));
  if (inv === null) return { hasSolution: false };
  const x0 = modNorm(inv * b1, Math.abs(m1));
  return { hasSolution: true, x0, mod: Math.abs(m1) };
}

export function buildModTable(n: number, op: "add" | "mul"): number[][] {
  const A = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      A[i][j] = op === "add" ? modNorm(i + j, n) : modNorm(i * j, n);
    }
  }
  return A;
}
