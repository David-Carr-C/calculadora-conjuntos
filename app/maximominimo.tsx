// Extremos usando la relación R (reflexiva, antisimétrica, transitiva)
type Elem = string;
type Pair = [Elem, Elem];
const pairKey = (a: Elem, b: Elem) => `${a}|||${b}`;

export function computeExtremaByR(U: Set<Elem>, relSet: Set<string>) {
  const arr = Array.from(U);
  const leq = (a: Elem, b: Elem) => relSet.has(pairKey(a, b));

  const minimals: Elem[] = [];
  const maximals: Elem[] = [];

  for (const x of arr) {
    const hasSmaller = arr.some((y) => y !== x && leq(y, x)); // y ≤ x con y≠x
    const hasGreater = arr.some((y) => y !== x && leq(x, y)); // x ≤ y con y≠x
    if (!hasSmaller) minimals.push(x);
    if (!hasGreater) maximals.push(x);
  }

  // mínimo/máximo (si existen, únicos)
  const minimum = minimals.find((m) => arr.every((y) => leq(m, y))) ?? null;
  const maximum = maximals.find((M) => arr.every((y) => leq(y, M))) ?? null;

  return { minimals, maximals, minimum, maximum };
}

// Minimales/maximales directamente desde aristas de Hasse (pred/succ)
export function computeMinMaxByHasse(universe: Elem[], covers: Pair[]) {
  const preds = new Map<Elem, Set<Elem>>();
  const succs = new Map<Elem, Set<Elem>>();
  for (const u of universe) {
    preds.set(u, new Set());
    succs.set(u, new Set());
  }
  for (const [a, b] of covers) {
    if (!preds.has(b) || !succs.has(a)) continue;
    preds.get(b)!.add(a);
    succs.get(a)!.add(b);
  }
  const minimals: Elem[] = [];
  const maximals: Elem[] = [];
  for (const u of universe) {
    if ((preds.get(u)?.size ?? 0) === 0) minimals.push(u);
    if ((succs.get(u)?.size ?? 0) === 0) maximals.push(u);
  }
  return { minimals, maximals };
}

export function closureFromRelation(U: Set<Elem>, relPairs: Pair[]): Set<string> {
  const adj = new Map<Elem, Set<Elem>>();
  for (const u of U) adj.set(u, new Set([u])); // reflexivo
  for (const [a, b] of relPairs) {
    if (U.has(a) && U.has(b)) {
      if (!adj.has(a)) adj.set(a, new Set());
      adj.get(a)!.add(b);
    }
  }
  // DFS por nodo para cierre transitivo
  const reach = new Set<string>();
  for (const a of U) {
    const stack = [...(adj.get(a) ?? [])];
    const seen = new Set<Elem>();
    while (stack.length) {
      const v = stack.pop()!;
      if (seen.has(v)) continue;
      seen.add(v);
      reach.add(pairKey(a, v));
      for (const nxt of adj.get(v) ?? []) {
        if (!seen.has(nxt)) stack.push(nxt);
      }
    }
  }
  return reach;
}

export function computeExtremaByClosure(U: Set<Elem>, closure: Set<string>) {
  const arr = Array.from(U);
  const leq = (a: Elem, b: Elem) => closure.has(pairKey(a, b));

  const minimals: Elem[] = [];
  const maximals: Elem[] = [];

  for (const x of arr) {
    const hasSmaller = arr.some((y) => y !== x && leq(y, x));
    const hasGreater = arr.some((y) => y !== x && leq(x, y));
    if (!hasSmaller) minimals.push(x);
    if (!hasGreater) maximals.push(x);
  }

  const minimum = minimals.find((m) => arr.every((y) => leq(m, y))) ?? null;
  const maximum = maximals.find((M) => arr.every((y) => leq(y, M))) ?? null;

  return { minimals, maximals, minimum, maximum };
}