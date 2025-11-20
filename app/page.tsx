// app/page.tsx (Next.js 13+ con /app). Si usas /pages, cambia a pages/index.tsx
"use client";
import React, { useMemo, useState } from "react";
import { buildAdjacencyMatrix, buildRelationMatrix, MatrixTable } from "./matrix";
import { buildModTable, egcd, modInv, modNorm, powMod, solveLinearCongruence, toInt } from "./modular";

// ————————————————————————————————————————————————————————————
// Tipos y utilidades
// ————————————————————————————————————————————————————————————

type HasseNodePos = {
  id: Elem;
  x: number;
  y: number;
};

function layoutHasse(universe: Elem[], covers: Pair[]): HasseNodePos[] {
  const preds = new Map<Elem, Set<Elem>>();
  const succs = new Map<Elem, Set<Elem>>();

  for (const u of universe) {
    preds.set(u, new Set());
    succs.set(u, new Set());
  }

  for (const [a, b] of covers) {
    if (!universe.includes(a) || !universe.includes(b)) continue;
    preds.get(b)!.add(a);
    succs.get(a)!.add(b);
  }

  const levelMap = new Map<Elem, number>();

  // nodos mínimos (sin predecesores) → nivel 0
  const queue: Elem[] = [];
  for (const u of universe) {
    if (preds.get(u)!.size === 0) {
      levelMap.set(u, 0);
      queue.push(u);
    }
  }
  // por si todo tiene predecesores (ciclo raro), forzamos alguno en nivel 0
  if (queue.length === 0 && universe.length > 0) {
    levelMap.set(universe[0], 0);
    queue.push(universe[0]);
  }

  while (queue.length) {
    const v = queue.shift()!;
    const lv = levelMap.get(v) ?? 0;
    for (const w of succs.get(v) ?? []) {
      const candidate = lv + 1;
      const cur = levelMap.get(w);
      if (cur === undefined || candidate > cur) {
        levelMap.set(w, candidate);
        queue.push(w);
      }
    }
  }

  // asignar nivel 0 a los que faltan
  for (const u of universe) {
    if (!levelMap.has(u)) levelMap.set(u, 0);
  }

  const levels: Map<number, Elem[]> = new Map();
  for (const u of universe) {
    const lv = levelMap.get(u)!;
    if (!levels.has(lv)) levels.set(lv, []);
    levels.get(lv)!.push(u);
  }

  const sortedLevels = Array.from(levels.entries()).sort(
    (a, b) => a[0] - b[0]
  );

  const width = 600;
  const height = 380;
  const vStep = height / (sortedLevels.length + 1);

  // nivel máximo (los máximos del orden)
  const maxLevel = sortedLevels.length > 0 ? sortedLevels[sortedLevels.length - 1][0] : 0;

  const positions: HasseNodePos[] = [];
  sortedLevels.forEach(([lvl, nodes]) => {
    const hStep = width / (nodes.length + 1);
    nodes.forEach((id, i) => {
      const x = (i + 1) * hStep;
      // invertimos verticalmente: niveles pequeños más abajo
      const y = (maxLevel - lvl + 1) * vStep;
      positions.push({ id, x, y });
    });
  });

  return positions;
}

function HasseDiagram({
  universe,
  covers,
}: {
  universe: Elem[];
  covers: Pair[];
}) {
  const positions = useMemo(
    () => layoutHasse(universe, covers),
    [universe, covers]
  );

  const posMap = new Map<Elem, { x: number; y: number }>();
  positions.forEach((p) => posMap.set(p.id, { x: p.x, y: p.y }));

  const w = 600;
  const h = 380;

  return (
    <div className="w-full flex justify-center mt-4">
      <svg viewBox={`0 0 ${w} ${h}`} className="w-full max-w-[720px]">
        {/* aristas */}
        <g stroke="#94a3b8" strokeWidth={2}>
          {covers.map(([a, b], i) => {
            const pa = posMap.get(a);
            const pb = posMap.get(b);
            if (!pa || !pb) return null;
            return (
              <line
                key={`${a}-${b}-${i}`}
                x1={pa.x}
                y1={pa.y}
                x2={pb.x}
                y2={pb.y}
              />
            );
          })}
        </g>

        {/* nodos */}
        <g>
          {positions.map((p) => (
            <g key={p.id} transform={`translate(${p.x},${p.y})`}>
              <circle
                r={16}
                className="fill-slate-900 stroke-emerald-400"
                strokeWidth={2}
              />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                className="fill-slate-100 text-[12px]"
              >
                {p.id}
              </text>
            </g>
          ))}
        </g>
      </svg>
    </div>
  );
}

type Elem = string; // Usamos string para manejar números o texto
type Pair = [Elem, Elem];

function parseCSV(input: string): Elem[] {
  return input
    .split(/[\n,;\s]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0);
}

function uniq<T>(arr: T[]): T[] {
  return Array.from(new Set(arr));
}

function toSet(arr: Elem[]): Set<Elem> {
  return new Set(arr);
}

function intersection<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>();
  a.forEach((x) => b.has(x) && out.add(x));
  return out;
}

function union<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>(a);
  b.forEach((x) => out.add(x));
  return out;
}

function difference<T>(a: Set<T>, b: Set<T>): Set<T> {
  const out = new Set<T>();
  a.forEach((x) => !b.has(x) && out.add(x));
  return out;
}

function equals<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

// Parser de relación R / Hasse: busca pares del tipo (a,b)
function parseRelation(input: string): Pair[] {
  const out: Pair[] = [];
  const matches = input.match(/\(([^)]+)\)/g);
  if (!matches) return out;

  for (const m of matches) {
    const inner = m.slice(1, -1).trim(); // quita paréntesis
    const parts = inner
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0);
    if (parts.length >= 2) {
      out.push([parts[0], parts[1]]);
    }
  }
  return out;
}

// Segmentos del diagrama de Venn
type Buckets = {
  outside: Elem[];
  onlyA: Elem[];
  onlyB: Elem[];
  onlyC: Elem[];
  AandB: Elem[];
  AandC: Elem[];
  BandC: Elem[];
  AandBandC: Elem[];
};

function bucketize(U: Set<Elem>, A: Set<Elem>, B: Set<Elem>, C: Set<Elem>): Buckets {
  const b: Buckets = {
    outside: [],
    onlyA: [],
    onlyB: [],
    onlyC: [],
    AandB: [],
    AandC: [],
    BandC: [],
    AandBandC: [],
  };
  U.forEach((x) => {
    const a = A.has(x);
    const bb = B.has(x);
    const c = C.has(x);
    const sum = (a ? 1 : 0) + (bb ? 1 : 0) + (c ? 1 : 0);
    if (sum === 0) b.outside.push(x);
    else if (sum === 3) b.AandBandC.push(x);
    else if (a && bb) b.AandB.push(x);
    else if (a && c) b.AandC.push(x);
    else if (bb && c) b.BandC.push(x);
    else if (a) b.onlyA.push(x);
    else if (bb) b.onlyB.push(x);
    else if (c) b.onlyC.push(x);
  });
  return b;
}

type RelationProps = {
  reflexive: boolean;
  reflexiveMissing: Elem | null;
  symmetric: boolean;
  symmetricWitness: Pair | null;
  antisymmetric: boolean;
  antisymmetricWitness: Pair | null;
  transitive: boolean;
  transitiveWitness: { ab: Pair; bc: Pair; acMissing: Pair } | null;
};

// ————————————————————————————————————————————————————————————
// Utilidades para Hasse
// ————————————————————————————————————————————————————————————

const pairKey = (a: Elem, b: Elem) => `${a}|||${b}`;

// Desde aristas de Hasse (cubiertas) obtenemos el cierre transitivo + reflexivo (R)
function transitiveClosureFromCovers(U: Set<Elem>, covers: Pair[]): Pair[] {
  debugger;
  const adj = new Map<Elem, Elem[]>();
  for (const [a, b] of covers) { // ! Por cada par (a,b) de los pares
    if (!adj.has(a)) adj.set(a, []); // ! Si no existe, inicializa la lista de adyacencia
    adj.get(a)!.push(b); // ! Agrega b a la lista de adyacencia de a
  }

  const result: Pair[] = [];
  const seen = new Set<string>();

  const addPair = (a: Elem, b: Elem) => { // ! Función para agregar pares únicos
    const k = pairKey(a, b);
    if (!seen.has(k)) {
      seen.add(k);
      result.push([a, b]);
    }
  };

  for (const a of U) { // ! Por cada elemento en el universo
    // Reflexiva
    addPair(a, a); // ! Agrega el par (a,a)

    const visited = new Set<Elem>(); // ! Se prepara la busqueda por nodos
    const stack: Elem[] = [...(adj.get(a) ?? [])];

    while (stack.length) {
      const v = stack.pop()!; // ! Extrae el último elemento de la pila
      if (visited.has(v)) continue; // ! Si ya fue visitado, continúa
      visited.add(v); // ! Marca como visitado
      addPair(a, v); // ! Agrega el par (a,v)
      for (const nxt of adj.get(v) ?? []) { // ! Recorre los vecinos de v (lista de adyacencia)
        if (!visited.has(nxt)) stack.push(nxt); // ! Si no ha sido visitado, lo agrega a la pila
      }
    }
  }

  return result;
}

// Desde la relación R obtenemos las aristas de Hasse (cubiertas)
function coversFromRelation(
  U: Set<Elem>,
  relPairs: Pair[],
  relSet: Set<string>
): Pair[] {
  const covers: Pair[] = [];

  for (const [a, b] of relPairs) {
    if (a === b) continue; // ignorar pares reflexivos
    // nos aseguramos de que a y b estén en U
    if (!U.has(a) || !U.has(b)) continue;

    let isCover = true;
    for (const c of U) {
      if (c === a || c === b) continue;
      // si existe a ≤ c ≤ b (con c distinto) entonces (a,b) NO es cubierta
      if (relSet.has(pairKey(a, c)) && relSet.has(pairKey(c, b))) {
        isCover = false;
        break;
      }
    }
    if (isCover) {
      covers.push([a, b]);
    }
  }

  return covers;
}

// ————————————————————————————————————————————————————————————
// Componente principal con menú (Conjuntos / Relaciones / Hasse)
// ————————————————————————————————————————————————————————————

export default function Page() {
  type Tab = "sets" | "relations" | "hasse" | "modular";
  const [tab, setTab] = useState<Tab>("sets");

  // Valores por defecto: universo y subconjuntos
  const [UText, setUText] = useState("1,2,3,4,5,6,7,8,9");
  const [AText, setAText] = useState("1,2,3,4,8");
  const [BText, setBText] = useState("1,4,5,6,7");
  const [CText, setCText] = useState("1,6,7,8,9");

  // Relación R por defecto (identidad sobre {1,2,3})
  const [RText, setRText] = useState("(1,1),(2,2),(3,3)");

  // Aristas de Hasse (cubiertas)
  const [HText, setHText] = useState("(1,2),(2,3)");

  const U = useMemo(() => toSet(uniq(parseCSV(UText))), [UText]);
  const A = useMemo(() => toSet(uniq(parseCSV(AText))), [AText]);
  const B = useMemo(() => toSet(uniq(parseCSV(BText))), [BText]);
  const C = useMemo(() => toSet(uniq(parseCSV(CText))), [CText]);

  const buckets = useMemo(() => bucketize(U, A, B, C), [U, A, B, C]);

  // ——— Operaciones de conjuntos ———
  type Op = "union" | "intersection" | "difference" | "complement";
  const [op, setOp] = useState<Op>("union");
  const [left, setLeft] = useState("A");
  const [right, setRight] = useState("B");

  function pick(name: string): Set<Elem> {
    switch (name) {
      case "A":
        return A;
      case "B":
        return B;
      case "C":
        return C;
      case "A'":
        return difference(U, A);
      case "B'":
        return difference(U, B);
      case "C'":
        return difference(U, C);
      default:
        return new Set();
    }
  }

  const resultSet = useMemo(() => {
    const L = pick(left);
    const R = pick(right);
    if (op === "union") return union(L, R);
    if (op === "intersection") return intersection(L, R);
    if (op === "difference") return difference(L, R);
    if (op === "complement") return difference(U, L);
    return new Set<Elem>();
  }, [op, left, right, A, B, C, U]);

  // De Morgan
  const demorgan1_left = useMemo(() => difference(U, union(A, B)), [U, A, B]);
  const demorgan1_right = useMemo(
    () => intersection(difference(U, A), difference(U, B)),
    [U, A, B]
  );
  const demorgan1_ok = equals(demorgan1_left, demorgan1_right);

  const demorgan2_left = useMemo(() => difference(U, intersection(A, B)), [U, A, B]);
  const demorgan2_right = useMemo(
    () => union(difference(U, A), difference(U, B)),
    [U, A, B]
  );
  const demorgan2_ok = equals(demorgan2_left, demorgan2_right);

  // UI Helpers
  const pill = (text: string, title?: string) => (
    <span title={title} className="px-2 py-0.5 rounded-full text-xs border shadow-sm">
      {text}
    </span>
  );

  const chip = (text: string) => (
    <span className="text-xs px-2 py-1 rounded-full border">{text}</span>
  );

  const regionFill = {
    onlyA: "fill-emerald-400/25",
    onlyB: "fill-amber-400/25",
    onlyC: "fill-sky-400/25",
    AandB: "fill-rose-400/25",
    AandC: "fill-violet-400/25",
    BandC: "fill-lime-400/25",
    AandBandC: "fill-fuchsia-400/30",
  } as const;

  function isInResult(x: Elem): boolean {
    return resultSet.has(x);
  }

  const circles = {
    A: { cx: 220, cy: 180, r: 150 },
    B: { cx: 380, cy: 180, r: 150 }, // B derecha
    C: { cx: 300, cy: 300, r: 150 }, // C abajo
  } as const;

  function Circle({ cx, cy, r }: { cx: number; cy: number; r: number }) {
    return (
      <circle
        cx={cx}
        cy={cy}
        r={r}
        className="stroke-emerald-300/60"
        strokeWidth={3}
        fill="none"
      />
    );
  }

  // ——— Relación R (pares ordenados) ———
  const relationPairs = useMemo(() => parseRelation(RText), [RText]);

  const relationSet = useMemo(() => { // ? (relationSet) Se hace calculo sobre el conjunto de pares
    const s = new Set<string>(); // ? Cache, para búsquedas rápidas
    relationPairs.forEach(([a, b]) => s.add(pairKey(a, b)));
    return s;
  }, [relationPairs]); // ? Solo rehace el calculo si cambian los pares (relationPairs)

  const relationProps: RelationProps = useMemo(() => {
    // Reflexiva
    let reflexive = true; // ! Se inicia como verdadero, se buscan contraejemplos
    let reflexiveMissing: Elem | null = null;
    for (const x of U) { // ! x pertenece a U
      if (!relationSet.has(pairKey(x, x))) { // ! Para cada x debe haber (x,x) en R
        reflexive = false; // ! Si no existe, no es reflexiva
        reflexiveMissing = x;
        break;
      }
    }

    // Simétrica
    let symmetric = true; // ! Se inicia como verdadero, se buscan contraejemplos
    let symmetricWitness: Pair | null = null;
    for (const [a, b] of relationPairs) { // ! Para cada (a,b) en R
      if (!relationSet.has(pairKey(b, a))) { // ! Debe existir (b,a) en R
        symmetric = false; // ! Si no existe, no es simétrica
        symmetricWitness = [a, b]; // ! Cuando es (1,1) no cuenta como contraejemplo
        break;
      }
    }

    // Antisimétrica
    let antisymmetric = true; // ! Se inicia como verdadero, se buscan contraejemplos
    let antisymmetricWitness: Pair | null = null;
    for (const [a, b] of relationPairs) { // ! Para cada (a,b) en R
      if (a !== b && relationSet.has(pairKey(b, a))) { // ! Siendo a diferente de b, NO debe existir (b,a) en R
        antisymmetric = false; // ! No es antisimétrica
        antisymmetricWitness = [a, b];
        break;
      }
    }

    // Transitiva
    let transitive = true; // ! Se inicia como verdadero, se buscan contraejemplos
    let transitiveWitness: { ab: Pair; bc: Pair; acMissing: Pair } | null = null;
    outer: for (const [a, b] of relationPairs) { // ! Para cada (a,b) en R
      for (const [c, d] of relationPairs) { // ! Para cada (c,d) en R
        if (b === c) { // ! Si b es igual a c, (enganchamos el caso a,b c,d) 
          if (!relationSet.has(pairKey(a, d))) { // ! Entonces buscamos (a,d) en R
            transitive = false; // ! Si no existe, no es transitiva
            transitiveWitness = { ab: [a, b], bc: [c, d], acMissing: [a, d] };
            break outer;
          }
        }
      }
    }

    return {
      reflexive,
      reflexiveMissing,
      symmetric,
      symmetricWitness,
      antisymmetric,
      antisymmetricWitness,
      transitive,
      transitiveWitness,
    };
  }, [U, relationPairs, relationSet]);

  const reflexiveDetail = relationProps.reflexive
    ? "Para todo x ∈ U, (x,x) ∈ R."
    : relationProps.reflexiveMissing
    ? `Falta el par (${relationProps.reflexiveMissing}, ${relationProps.reflexiveMissing}) en R.`
    : "No se cumple la definición de reflexiva.";

  const symmetricDetail = relationProps.symmetric
    ? "Si (a,b) ∈ R entonces (b,a) también está en R."
    : relationProps.symmetricWitness
    ? `Está (${relationProps.symmetricWitness[0]}, ${relationProps.symmetricWitness[1]}) en R pero no (${relationProps.symmetricWitness[1]}, ${relationProps.symmetricWitness[0]}).`
    : "No se cumple la definición de simétrica.";

  const antisymmetricDetail = relationProps.antisymmetric
    ? "Si (a,b) y (b,a) están en R, entonces a = b (no hay pares cruzados con a ≠ b)."
    : relationProps.antisymmetricWitness
    ? `Están (${relationProps.antisymmetricWitness[0]}, ${relationProps.antisymmetricWitness[1]}) y (${relationProps.antisymmetricWitness[1]}, ${relationProps.antisymmetricWitness[0]}) con a ≠ b.`
    : "No se cumple la definición de antisimétrica.";

  const transitiveDetail = relationProps.transitive
    ? "Siempre que (a,b) y (b,c) están en R, también (a,c) está en R."
    : relationProps.transitiveWitness
    ? `Están (${relationProps.transitiveWitness.ab[0]}, ${relationProps.transitiveWitness.ab[1]}) y (${relationProps.transitiveWitness.bc[0]}, ${relationProps.transitiveWitness.bc[1]}) en R, pero falta (${relationProps.transitiveWitness.acMissing[0]}, ${relationProps.transitiveWitness.acMissing[1]}).`
    : "No se cumple la definición de transitiva.";

  // ——— Handlers para Hasse ———
  const handleGenerateRFromHasse = () => {
    const covers = parseRelation(HText); // ! Por cada par
    const closure = transitiveClosureFromCovers(U, covers); // ! Calcula el cierre transitivo + reflexivo
    const text = closure.map(([a, b]) => `(${a},${b})`).join(","); // ! Se formatea el resultado a String
    setRText(text);
  };

  const handleGenerateHasseFromR = () => {
    const covers = coversFromRelation(U, relationPairs, relationSet);
    const text = covers.map(([a, b]) => `(${a},${b})`).join(",");
    setHText(text);
  };

  const hasseCovers = useMemo(() => parseRelation(HText), [HText]);
  const hasseUniverse = useMemo(
    () => Array.from(U).sort(),
    [U]
  );

  const isPartialOrder =
    relationProps.reflexive &&
    relationProps.transitive &&
    relationProps.antisymmetric;

  const isEquivalence =
    relationProps.reflexive &&
    relationProps.transitive &&
    relationProps.symmetric;

  // let classificationLabel = "No es relacion de orden parcial ni de equivalencia.";
  let classificationLabel = "";
  let classificationStyle =
    "border-rose-400 text-rose-300";

  if (isPartialOrder && isEquivalence) {
    classificationLabel =
      "R es una relación de orden parcial y de equivalencia.";
    classificationStyle =
      "border-emerald-400 text-emerald-300";
  } else if (isPartialOrder) {
    classificationLabel = "R es una relación de orden parcial.";
    classificationStyle =
      "border-emerald-400 text-emerald-300";
  } else if (isEquivalence) {
    classificationLabel = "R es una relación de equivalencia.";
    classificationStyle =
      "border-emerald-400 text-emerald-300";
  }

  const UArr = useMemo(() => Array.from(U).sort(), [U]);
  const relationMatrix = useMemo(
    () => buildRelationMatrix(UArr, relationPairs),
    [UArr, relationPairs]
  );
  const hasseAdjacency = useMemo(
    () => buildAdjacencyMatrix(UArr, hasseCovers),
    [UArr, hasseCovers]
  );

  // ——— Álgebra modular (estado) ———
  const [M_n, setM_n] = useState("12");   // módulo
  const [M_a, setM_a] = useState("7");    // a
  const [M_b, setM_b] = useState("5");    // b
  const [M_k, setM_k] = useState("13");   // exponente para a^k (mod n)
  const [showTables, setShowTables] = useState(false);

  const nVal = useMemo(() => Math.max(1, toInt(M_n)), [M_n]);
  const aVal = useMemo(() => toInt(M_a), [M_a]);
  const bVal = useMemo(() => toInt(M_b), [M_b]);
  const kVal = useMemo(() => Math.max(0, toInt(M_k)), [M_k]);

  const modAdd = useMemo(() => modNorm(aVal + bVal, nVal), [aVal, bVal, nVal]);
  const modSub = useMemo(() => modNorm(aVal - bVal, nVal), [aVal, bVal, nVal]);
  const modMul = useMemo(() => modNorm(aVal * bVal, nVal), [aVal, bVal, nVal]);
  const modPow = useMemo(() => powMod(aVal, kVal, nVal), [aVal, kVal, nVal]);

  const gcd_a_n = useMemo(() => egcd(Math.abs(aVal), nVal).g, [aVal, nVal]);
  const inv_a_n = useMemo(() => modInv(aVal, nVal), [aVal, nVal]);

  const linCong = useMemo(() => solveLinearCongruence(aVal, bVal, nVal), [aVal, bVal, nVal]);

  const addTable = useMemo(() => (showTables ? buildModTable(nVal, "add") : []), [showTables, nVal]);
  const mulTable = useMemo(() => (showTables ? buildModTable(nVal, "mul") : []), [showTables, nVal]);


  // ——— Render ———
  return (
    <main className="min-h-screen p-6 md:p-10 bg-slate-900 text-slate-100">
      <div className="max-w-6xl mx-auto">
        {/* Menú de pestañas */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setTab("sets")}
            className={
              "px-4 py-2 rounded-full text-sm border transition " +
              (tab === "sets"
                ? "bg-emerald-400 text-slate-900 border-emerald-300"
                : "bg-slate-800 text-slate-200 border-slate-600 hover:border-emerald-300")
            }
          >
            Conjuntos
          </button>
          <button
            onClick={() => setTab("relations")}
            className={
              "px-4 py-2 rounded-full text-sm border transition " +
              (tab === "relations"
                ? "bg-emerald-400 text-slate-900 border-emerald-300"
                : "bg-slate-800 text-slate-200 border-slate-600 hover:border-emerald-300")
            }
          >
            Relaciones (pares ordenados)
          </button>
          <button
            onClick={() => setTab("hasse")}
            className={
              "px-4 py-2 rounded-full text-sm border transition " +
              (tab === "hasse"
                ? "bg-emerald-400 text-slate-900 border-emerald-300"
                : "bg-slate-800 text-slate-200 border-slate-600 hover:border-emerald-300")
            }
          >
            Diagrama de Hasse
          </button>
          <button
            onClick={() => setTab("modular")}
            className={
              "px-4 py-2 rounded-full text-sm border transition " +
              (tab === "modular"
                ? "bg-emerald-400 text-slate-900 border-emerald-300"
                : "bg-slate-800 text-slate-200 border-slate-600 hover:border-emerald-300")
            }
          >
            Álgebra modular
          </button>
        </div>

        {/* Pestaña Conjuntos */}
        {tab === "sets" && (
          <div className="grid lg:grid-cols-2 gap-8">
            {/* Panel izquierdo: Diagrama de Venn */}
            <section className="bg-slate-800/60 rounded-2xl p-5 shadow-xl">
              <h1 className="text-2xl font-semibold mb-4">
                Diagrama de Venn (A, B, C)
              </h1>
              <div className="w-full flex justify-center">
                <svg viewBox="0 0 600 460" className="w-full max-w-[720px]">
                  {/* Círculos base */}
                  <Circle {...circles.A} />
                  <Circle {...circles.B} />
                  <Circle {...circles.C} />

                  {/* Etiquetas */}
                  <text
                    x={circles.A.cx - 140}
                    y={circles.A.cy - 60}
                    className="fill-slate-200 text-[20px] font-semibold"
                  >
                    A
                  </text>
                  <text
                    x={circles.B.cx + 120}
                    y={circles.B.cy - 60}
                    className="fill-slate-200 text-[20px] font-semibold"
                  >
                    B
                  </text>
                  <text
                    x={circles.C.cx - 10}
                    y={circles.C.cy + 120}
                    className="fill-slate-200 text-[20px] font-semibold"
                  >
                    C
                  </text>

                  {/* Regiones con clipPath */}
                  <defs>
                    <clipPath id="clipA">
                      <circle {...(circles.A as any)} />
                    </clipPath>
                    <clipPath id="clipB">
                      <circle {...(circles.B as any)} />
                    </clipPath>
                    <clipPath id="clipC">
                      <circle {...(circles.C as any)} />
                    </clipPath>
                  </defs>

                  {/* Solo A */}
                  <g clipPath="url(#clipA)">
                    <rect
                      x="0"
                      y="0"
                      width="600"
                      height="420"
                      className={"pointer-events-none " + regionFill.onlyA}
                    />
                  </g>
                  <g clipPath="url(#clipA)">
                    <g clipPath="url(#clipB)">
                      <rect
                        x="0"
                        y="0"
                        width="600"
                        height="420"
                        className="fill-slate-900/60"
                      />
                    </g>
                    <g clipPath="url(#clipC)">
                      <rect
                        x="0"
                        y="0"
                        width="600"
                        height="420"
                        className="fill-slate-900/60"
                      />
                    </g>
                  </g>

                  {/* Solo B */}
                  <g clipPath="url(#clipB)">
                    <rect
                      x="0"
                      y="0"
                      width="600"
                      height="420"
                      className={"pointer-events-none " + regionFill.onlyB}
                    />
                  </g>
                  <g clipPath="url(#clipB)">
                    <g clipPath="url(#clipA)">
                      <rect
                        x="0"
                        y="0"
                        width="600"
                        height="420"
                        className="fill-slate-900/60"
                      />
                    </g>
                    <g clipPath="url(#clipC)">
                      <rect
                        x="0"
                        y="0"
                        width="600"
                        height="420"
                        className="fill-slate-900/60"
                      />
                    </g>
                  </g>

                  {/* Solo C */}
                  <g clipPath="url(#clipC)">
                    <rect
                      x="0"
                      y="0"
                      width="600"
                      height="420"
                      className={"pointer-events-none " + regionFill.onlyC}
                    />
                  </g>
                  <g clipPath="url(#clipC)">
                    <g clipPath="url(#clipA)">
                      <rect
                        x="0"
                        y="0"
                        width="600"
                        height="420"
                        className="fill-slate-900/60"
                      />
                    </g>
                    <g clipPath="url(#clipB)">
                      <rect
                        x="0"
                        y="0"
                        width="600"
                        height="420"
                        className="fill-slate-900/60"
                      />
                    </g>
                  </g>

                  {/* A∩B sin C */}
                  <g clipPath="url(#clipA)">
                    <g clipPath="url(#clipB)">
                      <rect
                        x="0"
                        y="0"
                        width="600"
                        height="420"
                        className={regionFill.AandB}
                      />
                    </g>
                  </g>
                  <g clipPath="url(#clipA)">
                    <g clipPath="url(#clipB)">
                      <g clipPath="url(#clipC)">
                        <rect
                          x="0"
                          y="0"
                          width="600"
                          height="420"
                          className="fill-slate-900/60"
                        />
                      </g>
                    </g>
                  </g>

                  {/* A∩C sin B */}
                  <g clipPath="url(#clipA)">
                    <g clipPath="url(#clipC)">
                      <rect
                        x="0"
                        y="0"
                        width="600"
                        height="420"
                        className={regionFill.AandC}
                      />
                    </g>
                  </g>
                  <g clipPath="url(#clipA)">
                    <g clipPath="url(#clipC)">
                      <g clipPath="url(#clipB)">
                        <rect
                          x="0"
                          y="0"
                          width="600"
                          height="420"
                          className="fill-slate-900/60"
                        />
                      </g>
                    </g>
                  </g>

                  {/* B∩C sin A */}
                  <g clipPath="url(#clipB)">
                    <g clipPath="url(#clipC)">
                      <rect
                        x="0"
                        y="0"
                        width="600"
                        height="420"
                        className={regionFill.BandC}
                      />
                    </g>
                  </g>
                  <g clipPath="url(#clipB)">
                    <g clipPath="url(#clipC)">
                      <g clipPath="url(#clipA)">
                        <rect
                          x="0"
                          y="0"
                          width="600"
                          height="420"
                          className="fill-slate-900/60"
                        />
                      </g>
                    </g>
                  </g>

                  {/* Triple intersección */}
                  <g clipPath="url(#clipA)">
                    <g clipPath="url(#clipB)">
                      <g clipPath="url(#clipC)">
                        <rect
                          x="0"
                          y="0"
                          width="600"
                          height="420"
                          className={regionFill.AandBandC}
                        />
                      </g>
                    </g>
                  </g>

                  {/* Números dentro de cada región */}
                  <g className="font-medium fill-slate-100">
                    {(() => {
                      const lines = (arr: string[]) => {
                        const s = arr.join(", ");
                        const chunks: string[] = [];
                        let cur = "";
                        for (const ch of s.split("")) {
                          cur += ch;
                          if (cur.length >= 22 && ch === " ") {
                            chunks.push(cur);
                            cur = "";
                          }
                        }
                        if (cur) chunks.push(cur);
                        return chunks;
                      };
                      const texts = [
                        { x: 120, y: 170, items: buckets.onlyA },
                        { x: 480, y: 170, items: buckets.onlyB },
                        { x: 300, y: 360, items: buckets.onlyC },
                        { x: 290, y: 120, items: buckets.AandB },
                        { x: 190, y: 240, items: buckets.AandC },
                        { x: 390, y: 240, items: buckets.BandC },
                        { x: 300, y: 200, items: buckets.AandBandC },
                      ];

                      return texts.map((t, i) => (
                        <text key={i} x={t.x} y={t.y} className="text-[12px]">
                          {lines(t.items).map((ln, j) => (
                            <tspan key={j} x={t.x} dy={j === 0 ? 0 : 14}>
                              {ln}
                            </tspan>
                          ))}
                        </text>
                      ));
                    })()}
                  </g>
                </svg>
              </div>

              {/* Listado de segmentos */}
              <div className="grid md:grid-cols-2 gap-3 mt-4 text-sm">
                <Segment title="A solamente" items={buckets.onlyA} />
                <Segment title="B solamente" items={buckets.onlyB} />
                <Segment title="C solamente" items={buckets.onlyC} />
                <Segment title="A ∩ B (sin C)" items={buckets.AandB} />
                <Segment title="A ∩ C (sin B)" items={buckets.AandC} />
                <Segment title="B ∩ C (sin A)" items={buckets.BandC} />
                <Segment title="A ∩ B ∩ C" items={buckets.AandBandC} />
                <Segment
                  title="Fuera (U − (A ∪ B ∪ C))"
                  items={buckets.outside}
                />
              </div>
            </section>

            {/* Panel derecho: Editor + De Morgan */}
            <section className="bg-slate-800/60 rounded-2xl p-5 shadow-xl">
              <h2 className="text-xl font-semibold">Editor de conjuntos</h2>
              <p className="text-slate-300 mb-3 text-sm">
                Escribe elementos separados por coma, espacio o salto de línea.
              </p>
              <div className="grid md:grid-cols-2 gap-4">
                <TextArea
                  label="Universo U"
                  value={UText}
                  setValue={setUText}
                  helper="Ej. 1,2,3,4,5 …"
                />
                <div className="grid grid-cols-1 gap-4">
                  <TextArea
                    label="Conjunto A"
                    value={AText}
                    setValue={setAText}
                  />
                  <TextArea
                    label="Conjunto B"
                    value={BText}
                    setValue={setBText}
                  />
                  <TextArea
                    label="Conjunto C"
                    value={CText}
                    setValue={setCText}
                  />
                </div>
              </div>

              <hr className="my-5 border-slate-600/60" />

              <h3 className="text-lg font-semibold mb-2">Operaciones principales</h3>
              <div className="flex flex-wrap items-center gap-3 mb-3">
                <Select
                  value={op}
                  onChange={(v: Op) => setOp(v)}
                  options={[
                    { label: "Unión (L ∪ R)", value: "union" },
                    { label: "Intersección (L ∩ R)", value: "intersection" },
                    { label: "Diferencia (L − R)", value: "difference" },
                    { label: "Complemento (L′)", value: "complement" },
                  ]}
                />
                <Select
                  value={left}
                  onChange={setLeft}
                  options={[
                    { label: "A", value: "A" },
                    { label: "B", value: "B" },
                    { label: "C", value: "C" },
                    { label: "A′", value: "A'" },
                    { label: "B′", value: "B'" },
                    { label: "C′", value: "C'" },
                  ]}
                />
                {op !== "complement" && (
                  <Select
                    value={right}
                    onChange={setRight}
                    options={[
                      { label: "A", value: "A" },
                      { label: "B", value: "B" },
                      { label: "C", value: "C" },
                      { label: "A′", value: "A'" },
                      { label: "B′", value: "B'" },
                      { label: "C′", value: "C'" },
                    ]}
                  />
                )}
              </div>

              <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 mb-5">
                <div className="flex items-center gap-2 mb-2">
                  {pill("Resultado")}
                  {chip(`${resultSet.size} elemento(s)`)}
                </div>
                <div className="flex flex-wrap gap-2">
                  {Array.from(resultSet).map((x) => (
                    <span
                      key={x}
                      className={`px-2 py-1 rounded-md bg-slate-700/60 border ${
                        isInResult(x) ? "ring-1 ring-emerald-300" : ""
                      }`}
                    >
                      {x}
                    </span>
                  ))}
                  {resultSet.size === 0 && (
                    <span className="text-slate-400">∅ (vacío)</span>
                  )}
                </div>
              </div>

              <h3 className="text-lg font-semibold mb-2">Leyes de De Morgan</h3>
              <div className="space-y-3">
                <DeMorganRow
                  lhs="(A ∪ B)′"
                  rhs="A′ ∩ B′"
                  ok={demorgan1_ok}
                  setA={demorgan1_left}
                  setB={demorgan1_right}
                />
                <DeMorganRow
                  lhs="(A ∩ B)′"
                  rhs="A′ ∪ B′"
                  ok={demorgan2_ok}
                  setA={demorgan2_left}
                  setB={demorgan2_right}
                />
              </div>
            </section>
          </div>
        )}

        {/* Pestaña Relaciones */}
        {tab === "relations" && (
          <section className="bg-slate-800/60 rounded-2xl p-5 shadow-xl">
            <h2 className="text-2xl font-semibold mb-2">
              Relaciones y pares ordenados
            </h2>
            <p className="text-slate-300 mb-4 text-sm">
              Se evalúa si R es reflexiva,
              simétrica, antisimétrica y transitiva.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <TextArea
                label="Universo U"
                value={UText}
                setValue={setUText}
                helper="Ej. 1,2,3,4,5 …"
              />
              <TextArea
                label="Relación R (pares ordenados)"
                value={RText}
                setValue={setRText}
                helper="Ej. (1,1),(1,2),(2,2)"
              />
            </div>

            <h3 className="text-lg font-semibold mb-2">Propiedades de R</h3>
            <div className="grid sm:grid-cols-2 gap-3 mb-6 text-sm">
              <RelationPropertyRow
                name="Reflexiva"
                ok={relationProps.reflexive}
                detail={reflexiveDetail}
              />
              <RelationPropertyRow
                name="Simétrica"
                ok={relationProps.symmetric}
                detail={symmetricDetail}
              />
              <RelationPropertyRow
                name="Antisimétrica"
                ok={relationProps.antisymmetric}
                detail={antisymmetricDetail}
              />
              <RelationPropertyRow
                name="Transitiva"
                ok={relationProps.transitive}
                detail={transitiveDetail}
              />
            </div>
            <h3 className="text-lg font-semibold mb-2">Clasificación de R</h3>
            <div className="rounded-xl border bg-slate-900/50 p-3 mb-6 text-sm">
              <div className="flex items-center justify-between mb-1">
                <span className="font-medium">
                  ¿Orden parcial o relación de equivalencia?
                </span>
                <span
                  className={
                    "text-xs px-2 py-1 rounded-full border " +
                    classificationStyle
                  }
                >
                  {isPartialOrder && isEquivalence
                    ? "Orden parcial y equivalencia"
                    : isPartialOrder
                    ? "Orden parcial"
                    : isEquivalence
                    ? "Equivalencia"
                    : "Ninguna"}
                </span>
              </div>
              <p className="text-slate-300 text-xs">{classificationLabel}</p>
              <ul className="mt-2 text-xs text-slate-400 list-disc list-inside">
                <li>Orden parcial: reflexiva, transitiva y antisimétrica.</li>
                <li>Equivalencia: reflexiva, transitiva y simétrica.</li>
              </ul>
            </div>

            <h3 className="text-lg font-semibold mb-2">Matriz de relación R (U × U)</h3>
            <MatrixTable labels={UArr} data={relationMatrix} />

            <h3 className="text-lg font-semibold mb-2">Lista de pares en R</h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {relationPairs.length === 0 && (
                <span className="text-slate-400">R = ∅ (no hay pares)</span>
              )}
              {relationPairs.map(([a, b], idx) => (
                <span
                  key={`${a}-${b}-${idx}`}
                  className="px-2 py-1 rounded-md bg-slate-900/60 border border-slate-700"
                >
                  ({a}, {b})
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Pestaña Hasse */}
        {tab === "hasse" && (
          <section className="bg-slate-800/60 rounded-2xl p-5 shadow-xl">
            <h2 className="text-2xl font-semibold mb-2">Diagrama de Hasse</h2>
            <p className="text-slate-300 mb-4 text-sm">
              Usa aristas de Hasse (cubiertas) para generar la relación R
              (cierre reflexivo y transitivo), o genera las aristas de Hasse a
              partir de la relación R.
            </p>

            <div className="grid md:grid-cols-2 gap-4 mb-4">
              <TextArea
                label="Universo U"
                value={UText}
                setValue={setUText}
                helper="Ej. 1,2,3"
              />
              <TextArea
                label="Relación R (pares ordenados)"
                value={RText}
                setValue={setRText}
                helper="Ej. (1,1),(1,2),(2,2),(1,3),(2,3),(3,3)"
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4 mb-6">
              <TextArea
                label="Aristas de Hasse (cubiertas)"
                value={HText}
                setValue={setHText}
                helper="Ej. (1,2),(2,3)"
              />
              <div className="flex flex-col gap-2 text-sm">
                <button
                  onClick={handleGenerateRFromHasse}
                  className="px-3 py-2 rounded-lg bg-emerald-500 text-slate-900 text-sm font-medium hover:bg-emerald-400 transition border border-emerald-300"
                >
                  Generar R desde Hasse (cierre reflexivo y transitivo)
                </button>
                <button
                  onClick={handleGenerateHasseFromR}
                  className="px-3 py-2 rounded-lg bg-slate-900 text-slate-100 text-sm font-medium hover:bg-slate-700 transition border border-slate-600"
                >
                  Generar Hasse desde R (pares cubiertos)
                </button>

                <p className="text-slate-300 text-xs mt-2">
                  • De Hasse → R: se asume que las aristas son de un orden
                  parcial, se calcula el cierre transitivo y reflexivo.
                  <br />
                  • De R → Hasse: se buscan pares (a,b) donde no existe ningún
                  c con a &lt; c &lt; b en R (cubiertas).
                </p>
              </div>
            </div>

            {/* <h3 className="text-lg font-semibold mb-2">
              Aristas de Hasse (interpretadas)
            </h3>
            <div className="flex flex-wrap gap-2 text-xs mb-4">
              {parseRelation(HText).length === 0 && (
                <span className="text-slate-400">
                  No hay aristas definidas en Hasse.
                </span>
              )}
              {parseRelation(HText).map(([a, b], i) => (
                <span
                  key={`${a}-${b}-${i}`}
                  className="px-2 py-1 rounded-md bg-slate-900/60 border border-slate-700"
                >
                  {a} &lt; {b}
                </span>
              ))}
            </div> */}

            <h3 className="text-lg font-semibold mb-2">
              Relación R actual (para este Hasse)
            </h3>
            <div className="flex flex-wrap gap-2 text-xs">
              {relationPairs.length === 0 && (
                <span className="text-slate-400">R = ∅ (no hay pares)</span>
              )}
              {relationPairs.map(([a, b], idx) => (
                <span
                  key={`${a}-${b}-hasse-${idx}`}
                  className="px-2 py-1 rounded-md bg-slate-900/60 border border-slate-700"
                >
                  ({a}, {b})
                </span>
              ))}
            </div>
            <h3 className="text-lg font-semibold mb-2 mt-4">
              Diagrama de Hasse (vista tipo árbol)
            </h3>
            <HasseDiagram universe={hasseUniverse} covers={hasseCovers} />
            <h3 className="text-lg font-semibold mb-2">Matriz de adyacencia (Hasse)</h3>
            <MatrixTable labels={UArr} data={hasseAdjacency} />
          </section>
        )}

        {tab === "modular" && (
        <section className="bg-slate-800/60 rounded-2xl p-5 shadow-xl">
          <h2 className="text-2xl font-semibold mb-2">Álgebra modular</h2>
          <p className="text-slate-300 mb-4 text-sm">
            Operaciones en <span className="font-mono">ℤ<sub>n</sub></span>, inverso modular, potencia modular y resolución de
            congruencias lineales <span className="font-mono">a·x ≡ b (mod n)</span>.
          </p>

          <div className="grid md:grid-cols-2 gap-4 mb-4">
            <TextArea label="n (módulo)" value={M_n} setValue={setM_n} helper="Ej. 12" />
            <div className="grid grid-cols-1 gap-4">
              <TextArea label="a" value={M_a} setValue={setM_a} />
              <TextArea label="b" value={M_b} setValue={setM_b} />
              <TextArea label="k (exponente para a^k)" value={M_k} setValue={setM_k} />
            </div>
          </div>

          {/* Resultados básicos */}
          <div className="grid lg:grid-cols-2 gap-4">
            <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-sm">
              <h3 className="text-lg font-semibold mb-2">Operaciones mod n</h3>
              <ul className="space-y-1 text-slate-200">
                <li><span className="font-mono">a + b ≡ {modAdd} (mod {nVal})</span></li>
                <li><span className="font-mono">a − b ≡ {modSub} (mod {nVal})</span></li>
                <li><span className="font-mono">a · b ≡ {modMul} (mod {nVal})</span></li>
                <li><span className="font-mono">a^{kVal} ≡ {modPow} (mod {nVal})</span></li>
              </ul>
            </div>

            <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-sm">
              <h3 className="text-lg font-semibold mb-2">Inverso y mcd</h3>
              <p className="text-slate-200">
                <span className="font-mono">gcd(a, n) = {gcd_a_n}</span>
              </p>
              <p className="text-slate-200 mt-1">
                Inverso de <span className="font-mono">a</span> mod <span className="font-mono">n</span>:{" "}
                {inv_a_n === null ? (
                  <span className="text-rose-300">no existe (gcd ≠ 1)</span>
                ) : (
                  <span className="font-mono">a⁻¹ ≡ {inv_a_n} (mod {nVal})</span>
                )}
              </p>
            </div>
          </div>

          {/* Congruencia lineal */}
          <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-sm mt-4">
            <h3 className="text-lg font-semibold mb-2">Resolver a·x ≡ b (mod n)</h3>
            {linCong.hasSolution ? (
              <div className="text-slate-200">
                <p>
                  Soluciones:{" "}
                  <span className="font-mono">
                    x ≡ {linCong.x0} (mod {linCong.mod})
                  </span>
                </p>
                <p className="text-slate-400 text-xs mt-1">
                  Todas las soluciones en ℤ se obtienen como x = {`{`} {linCong.x0} + k·{linCong.mod} {`}`} para k ∈ ℤ.
                </p>
              </div>
            ) : (
              <p className="text-rose-300">No hay solución (gcd(a, n) ∤ b).</p>
            )}
          </div>

          {/* Tablas modulares */}
          <div className="mt-4">
            <label className="inline-flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={showTables}
                onChange={(e) => setShowTables(e.target.checked)}
              />
              <span className="text-slate-300">Mostrar tablas de suma y producto mod n</span>
            </label>

            {showTables && (
              <>
                <h3 className="text-lg font-semibold mb-2 mt-3">Tabla de suma mod {nVal}</h3>
                <MatrixTable
                  labels={Array.from({ length: nVal }, (_, i) => String(i))}
                  data={addTable}
                />
                <h3 className="text-lg font-semibold mb-2 mt-4">Tabla de producto mod {nVal}</h3>
                <MatrixTable
                  labels={Array.from({ length: nVal }, (_, i) => String(i))}
                  data={mulTable}
                />
              </>
            )}
          </div>
        </section>
      )}


        <footer className="max-w-6xl mx-auto mt-8 text-sm text-slate-400">
          David Carrillo Castillo 202064212
          <br />
          Samanta Reyes Tlapanco 202074145
        </footer>
      </div>
    </main>
  );
}

// ————————————————————————————————————————————————————————————
// Subcomponentes
// ————————————————————————————————————————————————————————————

function TextArea({
  label,
  value,
  setValue,
  helper,
}: {
  label: string;
  value: string;
  setValue: (v: string) => void;
  helper?: string;
}) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={label.includes("Universo") ? 3 : 2}
        className="mt-1 w-full rounded-xl bg-slate-900/50 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
      />
      {helper && <span className="text-xs text-slate-400">{helper}</span>}
    </label>
  );
}

function Segment({ title, items }: { title: string; items: Elem[] }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/40 p-3">
      <div className="flex items-center justify-between mb-1">
        <h4 className="font-medium text-slate-200 text-sm">{title}</h4>
        <span className="text-xs text-slate-400">{items.length}</span>
      </div>
      <div className="flex flex-wrap gap-1">
        {items.length === 0 && (
          <span className="text-slate-400 text-sm">∅ (vacío)</span>
        )}
        {items.map((x) => (
          <span
            key={x}
            className="px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700 text-xs"
          >
            {x}
          </span>
        ))}
      </div>
    </div>
  );
}

function Select<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { label: string; value: T }[];
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

function DeMorganRow({
  lhs,
  rhs,
  ok,
  setA,
  setB,
}: {
  lhs: string;
  rhs: string;
  ok: boolean;
  setA: Set<Elem>;
  setB: Set<Elem>;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium">{lhs}</span>
          <span className="text-slate-400">=</span>
          <span className="font-medium">{rhs}</span>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full border ${
            ok
              ? "border-emerald-400 text-emerald-300"
              : "border-rose-400 text-rose-300"
          }`}
        >
          {ok ? "Se cumple" : "No se cumple"}
        </span>
      </div>
      <div className="grid md:grid-cols-2 gap-2 mt-2 text-sm">
        <div className="flex flex-wrap gap-1">
          {Array.from(setA).map((x) => (
            <span
              key={"a" + x}
              className="px-2 py-0.5 rounded bg-slate-800/60 border text-xs"
            >
              {x}
            </span>
          ))}
          {setA.size === 0 && <span className="text-slate-400">∅</span>}
        </div>
        <div className="flex flex-wrap gap-1">
          {Array.from(setB).map((x) => (
            <span
              key={"b" + x}
              className="px-2 py-0.5 rounded bg-slate-800/60 border text-xs"
            >
              {x}
            </span>
          ))}
          {setB.size === 0 && <span className="text-slate-400">∅</span>}
        </div>
      </div>
    </div>
  );
}

function RelationPropertyRow({
  name,
  ok,
  detail,
}: {
  name: string;
  ok: boolean;
  detail: string;
}) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3 text-sm">
      <div className="flex items-center justify-between mb-1">
        <span className="font-medium">{name}</span>
        <span
          className={`text-xs px-2 py-1 rounded-full border ${
            ok
              ? "border-emerald-400 text-emerald-300"
              : "border-rose-400 text-rose-300"
          }`}
        >
          {ok ? "Se cumple" : "No se cumple"}
        </span>
      </div>
      <p className="text-slate-300 text-xs">{detail}</p>
    </div>
  );
}
