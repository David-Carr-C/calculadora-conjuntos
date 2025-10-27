// app/page.tsx (Next.js 13+ con /app). Si usas /pages, cambia a pages/index.tsx
"use client";
import React, { useMemo, useState } from "react";

// ————————————————————————————————————————————————————————————
// Utilidades de conjuntos
// ————————————————————————————————————————————————————————————

type Elem = string; // Usamos string para manejar números o texto

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

// Segmentos del diagrama (8 regiones dentro del universo U)
// 0: fuera de A,B,C (U \\ (A∪B∪C)) — lo mostramos aparte
// 1: solo A
// 2: solo B
// 3: solo C
// 4: A∩B solo (sin C)
// 5: A∩C solo (sin B)
// 6: B∩C solo (sin A)
// 7: A∩B∩C

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

// ————————————————————————————————————————————————————————————
// Componente principal
// ————————————————————————————————————————————————————————————

export default function Page() {
  // Valores por defecto: universo 1..15 y subconjuntos
  const [UText, setUText] = useState("1,2,3,4,5,6,7,8,9");
  const [AText, setAText] = useState("1,2,3,4,8");
  const [BText, setBText] = useState("1,4,5,6,7");
  const [CText, setCText] = useState("1,6,7,8,9");

  const U = useMemo(() => toSet(uniq(parseCSV(UText))), [UText]);
  const A = useMemo(() => toSet(uniq(parseCSV(AText))), [AText]);
  const B = useMemo(() => toSet(uniq(parseCSV(BText))), [BText]);
  const C = useMemo(() => toSet(uniq(parseCSV(CText))), [CText]);

  const buckets = useMemo(() => bucketize(U, A, B, C), [U, A, B, C]);

  // Operaciones principales (4): ∪, ∩, diferencia (A\B), complemento (A')
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
    // complemento se define sobre un solo operando L
    if (op === "complement") return difference(U, L);
    return new Set<Elem>();
  }, [op, left, right, A, B, C, U]);

  // De Morgan
  const demorgan1_left = useMemo(() => difference(U, union(A, B)), [U, A, B]);
  const demorgan1_right = useMemo(() => intersection(difference(U, A), difference(U, B)), [U, A, B]);
  const demorgan1_ok = equals(demorgan1_left, demorgan1_right);

  const demorgan2_left = useMemo(() => difference(U, intersection(A, B)), [U, A, B]);
  const demorgan2_right = useMemo(() => union(difference(U, A), difference(U, B)), [U, A, B]);
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

  // Colores por región (semejante a la imagen de referencia)
  const regionFill = {
    onlyA: "fill-emerald-400/25",
    onlyB: "fill-amber-400/25",
    onlyC: "fill-sky-400/25",
    AandB: "fill-rose-400/25",
    AandC: "fill-violet-400/25",
    BandC: "fill-lime-400/25",
    AandBandC: "fill-fuchsia-400/30",
  } as const;

  // Resaltado del resultado
  function isInResult(x: Elem): boolean {
    return resultSet.has(x);
  }

  const circles = {
    A: { cx: 220, cy: 180, r: 150 },
    B: { cx: 380, cy: 180, r: 150 }, // ← B AHORA A LA DERECHA
    C: { cx: 300, cy: 300, r: 150 }, // ← C AHORA ABAJO
  } as const;

  // Para pintar regiones usamos máscaras de SVG
  function Circle({ cx, cy, r }: { cx: number; cy: number; r: number }) {
    return <circle cx={cx} cy={cy} r={r} className="stroke-emerald-300/60" strokeWidth={3} fill="none" />;
  }

  // Render
  return (
    <main className="min-h-screen p-6 md:p-10 bg-slate-900 text-slate-100">
      <div className="max-w-6xl mx-auto grid lg:grid-cols-2 gap-8">
        {/* Panel izquierdo: Diagrama */}
        <section className="bg-slate-800/60 rounded-2xl p-5 shadow-xl">
          <h1 className="text-2xl font-semibold mb-4">Diagrama de Venn (A, B, C)</h1>
          <div className="w-full flex justify-center">
            <svg viewBox="0 0 600 460" className="w-full max-w-[720px]">
              {/* Círculos base */}
              <Circle {...circles.A} />
              <Circle {...circles.B} />
              <Circle {...circles.C} />

              {/* Etiquetas */}
              <text x={circles.A.cx - 140} y={circles.A.cy - 60} className="fill-slate-200 text-[20px] font-semibold">A</text>
              <text x={circles.B.cx + 120} y={circles.B.cy - 60} className="fill-slate-200 text-[20px] font-semibold">B</text> {/* derecha */}
              <text x={circles.C.cx - 10}  y={circles.C.cy + 120} className="fill-slate-200 text-[20px] font-semibold">C</text> {/* abajo */}

              {/* Regiones mediante <clipPath> y <path> booleanas */}
              <defs>
                <clipPath id="clipA"><circle {...circles.A as any} /></clipPath>
                <clipPath id="clipB"><circle {...circles.B as any} /></clipPath>
                <clipPath id="clipC"><circle {...circles.C as any} /></clipPath>
              </defs>

              {/* Solo A */}
              <g clipPath="url(#clipA)">
                <rect x="0" y="0" width="600" height="420" className={"pointer-events-none " + regionFill.onlyA} />
              </g>
              <g clipPath="url(#clipA)">
                <g clipPath="url(#clipB)">
                  {/* A∩B (lo cubrimos con draw order para restar sobre lo previo) */}
                  <rect x="0" y="0" width="600" height="420" className="fill-slate-900/60" />
                </g>
                <g clipPath="url(#clipC)">
                  <rect x="0" y="0" width="600" height="420" className="fill-slate-900/60" />
                </g>
              </g>

              {/* Solo B */}
              <g clipPath="url(#clipB)">
                <rect x="0" y="0" width="600" height="420" className={"pointer-events-none " + regionFill.onlyB} />
              </g>
              <g clipPath="url(#clipB)">
                <g clipPath="url(#clipA)"><rect x="0" y="0" width="600" height="420" className="fill-slate-900/60" /></g>
                <g clipPath="url(#clipC)"><rect x="0" y="0" width="600" height="420" className="fill-slate-900/60" /></g>
              </g>

              {/* Solo C */}
              <g clipPath="url(#clipC)">
                <rect x="0" y="0" width="600" height="420" className={"pointer-events-none " + regionFill.onlyC} />
              </g>
              <g clipPath="url(#clipC)">
                <g clipPath="url(#clipA)"><rect x="0" y="0" width="600" height="420" className="fill-slate-900/60" /></g>
                <g clipPath="url(#clipB)"><rect x="0" y="0" width="600" height="420" className="fill-slate-900/60" /></g>
              </g>

              {/* A∩B sin C */}
              <g clipPath="url(#clipA)"><g clipPath="url(#clipB)">
                <rect x="0" y="0" width="600" height="420" className={regionFill.AandB} />
              </g></g>
              <g clipPath="url(#clipA)"><g clipPath="url(#clipB)"><g clipPath="url(#clipC)">
                <rect x="0" y="0" width="600" height="420" className="fill-slate-900/60" />
              </g></g></g>

              {/* A∩C sin B */}
              <g clipPath="url(#clipA)"><g clipPath="url(#clipC)">
                <rect x="0" y="0" width="600" height="420" className={regionFill.AandC} />
              </g></g>
              <g clipPath="url(#clipA)"><g clipPath="url(#clipC)"><g clipPath="url(#clipB)">
                <rect x="0" y="0" width="600" height="420" className="fill-slate-900/60" />
              </g></g></g>

              {/* B∩C sin A */}
              <g clipPath="url(#clipB)"><g clipPath="url(#clipC)">
                <rect x="0" y="0" width="600" height="420" className={regionFill.BandC} />
              </g></g>
              <g clipPath="url(#clipB)"><g clipPath="url(#clipC)"><g clipPath="url(#clipA)">
                <rect x="0" y="0" width="600" height="420" className="fill-slate-900/60" />
              </g></g></g>

              {/* Triple intersección */}
              <g clipPath="url(#clipA)"><g clipPath="url(#clipB)"><g clipPath="url(#clipC)">
                <rect x="0" y="0" width="600" height="420" className={regionFill.AandBandC} />
              </g></g></g>
                          {/* Números dentro de cada región */}
              <g className="font-medium fill-slate-100">
                {(() => {
                  const lines = (arr: string[]) => {
                    const s = arr.join(", ");
                    // Wrap simple: en líneas de ~22 caracteres
                    const chunks: string[] = [];
                    let cur = "";
                    for (const ch of s.split("")) {
                      cur += ch;
                      if (cur.length >= 22 && ch === " ") { chunks.push(cur); cur = ""; }
                    }
                    if (cur) chunks.push(cur);
                    return chunks;
                  };
                  const texts = [
                    { x: 120, y: 170, items: buckets.onlyA },           // solo A (igual)
                    { x: 480, y: 170, items: buckets.onlyB },           // B → derecha (antes estaba en abajo)
                    { x: 300, y: 360, items: buckets.onlyC },           // C → abajo (antes estaba a la derecha)
                    { x: 290, y: 120, items: buckets.AandB },           // A∩B ahora es A con B a la derecha (antes A∩C)
                    { x: 190, y: 240, items: buckets.AandC },           // A∩C ahora es A con C abajo (antes A∩B)
                    { x: 390, y: 240, items: buckets.BandC },           // B∩C (derecha∩abajo) se mantiene bien en esta zona
                    { x: 300, y: 200, items: buckets.AandBandC },       // triple (igual)
                  ];

                  return texts.map((t, i) => (
                    <text key={i} x={t.x} y={t.y} className="text-[12px]">
                      {lines(t.items).map((ln, j) => (
                        <tspan key={j} x={t.x} dy={j === 0 ? 0 : 14}>{ln}</tspan>
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
            <Segment title="Fuera (U − (A ∪ B ∪ C))" items={buckets.outside} />
          </div>
        </section>

        {/* Panel derecho: Edición y operaciones */}
        <section className="bg-slate-800/60 rounded-2xl p-5 shadow-xl">
          <h2 className="text-xl font-semibold">Editor de conjuntos</h2>
          <p className="text-slate-300 mb-3 text-sm">Escribe elementos separados por coma, espacio o salto de línea.</p>
          <div className="grid md:grid-cols-2 gap-4">
            <TextArea label="Universo U" value={UText} setValue={setUText} helper="Ej. 1,2,3,4,5 …" />
            <div className="grid grid-cols-1 gap-4">
              <TextArea label="Conjunto A" value={AText} setValue={setAText} />
              <TextArea label="Conjunto B" value={BText} setValue={setBText} />
              <TextArea label="Conjunto C" value={CText} setValue={setCText} />
            </div>
          </div>

          <hr className="my-5 border-slate-600/60" />

          <h3 className="text-lg font-semibold mb-2">Operaciones principales</h3>
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <Select value={op} onChange={(v: Op) => setOp(v)} options={[
              { label: "Unión (L ∪ R)", value: "union" },
              { label: "Intersección (L ∩ R)", value: "intersection" },
              { label: "Diferencia (L − R)", value: "difference" },
              { label: "Complemento (L′)", value: "complement" },
            ]} />
            <Select value={left} onChange={setLeft} options={[
              { label: "A", value: "A" },
              { label: "B", value: "B" },
              { label: "C", value: "C" },
              { label: "A′", value: "A'" },
              { label: "B′", value: "B'" },
              { label: "C′", value: "C'" },
            ]} />
            {op !== "complement" && (
              <Select value={right} onChange={setRight} options={[
                { label: "A", value: "A" },
                { label: "B", value: "B" },
                { label: "C", value: "C" },
                { label: "A′", value: "A'" },
                { label: "B′", value: "B'" },
                { label: "C′", value: "C'" },
              ]} />
            )}
          </div>

          <div className="bg-slate-900/50 rounded-xl p-4 border border-slate-700 mb-5">
            <div className="flex items-center gap-2 mb-2">
              {pill("Resultado")}
              {chip(`${resultSet.size} elemento(s)`)}
            </div>
            <div className="flex flex-wrap gap-2">
              {Array.from(resultSet).map((x) => (
                <span key={x} className={`px-2 py-1 rounded-md bg-slate-700/60 border ${isInResult(x) ? "ring-1 ring-emerald-300" : ""}`}>{x}</span>
              ))}
              {resultSet.size === 0 && <span className="text-slate-400">∅ (vacío)</span>}
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

      <footer className="max-w-6xl mx-auto mt-8 text-sm text-slate-400">
        David Carrillo Castillo 202064212
        <br />
        Samanta Reyes Tlapanco 202074145
      </footer>
    </main>
  );
}

// ————————————————————————————————————————————————————————————
// Subcomponentes
// ————————————————————————————————————————————————————————————

function TextArea({ label, value, setValue, helper }: { label: string; value: string; setValue: (v: string) => void; helper?: string; }) {
  return (
    <label className="block">
      <span className="text-sm text-slate-300">{label}</span>
      <textarea
        value={value}
        onChange={(e) => setValue(e.target.value)}
        rows={label === "Universo U" ? 3 : 2}
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
        {items.length === 0 && <span className="text-slate-400 text-sm">∅ (vacío)</span>}
        {items.map((x) => (
          <span key={x} className="px-2 py-0.5 rounded-md bg-slate-800/60 border border-slate-700 text-xs">{x}</span>
        ))}
      </div>
    </div>
  );
}

function Select<T extends string>({ value, onChange, options }: { value: T; onChange: (v: T) => void; options: { label: string; value: T }[]; }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value as T)}
      className="rounded-xl bg-slate-900/60 border border-slate-700 px-3 py-2 outline-none focus:ring-2 focus:ring-emerald-400"
    >
      {options.map((o) => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}

function DeMorganRow({ lhs, rhs, ok, setA, setB }: { lhs: string; rhs: string; ok: boolean; setA: Set<Elem>; setB: Set<Elem>; }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/50 p-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><span className="font-medium">{lhs}</span><span className="text-slate-400">=</span><span className="font-medium">{rhs}</span></div>
        <span className={`text-xs px-2 py-1 rounded-full border ${ok ? "border-emerald-400 text-emerald-300" : "border-rose-400 text-rose-300"}`}>{ok ? "Se cumple" : "No se cumple"}</span>
      </div>
      <div className="grid md:grid-cols-2 gap-2 mt-2 text-sm">
        <div className="flex flex-wrap gap-1">{Array.from(setA).map((x) => (<span key={"a"+x} className="px-2 py-0.5 rounded bg-slate-800/60 border text-xs">{x}</span>))}{setA.size===0&&<span className="text-slate-400">∅</span>}</div>
        <div className="flex flex-wrap gap-1">{Array.from(setB).map((x) => (<span key={"b"+x} className="px-2 py-0.5 rounded bg-slate-800/60 border text-xs">{x}</span>))}{setB.size===0&&<span className="text-slate-400">∅</span>}</div>
      </div>
    </div>
  );
}
