type Elem = string;
type Pair = [Elem, Elem];

export function buildRelationMatrix(Uarr: Elem[], pairs: Pair[]): number[][] {
  const n = Uarr.length;
  const idx = new Map<Elem, number>(Uarr.map((e, i) => [e, i]));
  const M = Array.from({ length: n }, () => Array(n).fill(0));
  for (const [a, b] of pairs) {
    const i = idx.get(a);
    const j = idx.get(b);
    if (i !== undefined && j !== undefined) M[i][j] = 1;
  }
  return M;
}

export function buildAdjacencyMatrix(Uarr: Elem[], covers: Pair[]): number[][] {
  const n = Uarr.length;
  const idx = new Map<Elem, number>(Uarr.map((e, i) => [e, i]));
  const A = Array.from({ length: n }, () => Array(n).fill(0));
  for (const [a, b] of covers) {
    const i = idx.get(a);
    const j = idx.get(b);
    if (i !== undefined && j !== undefined) A[i][j] = 1;
  }
  return A;
}

export function MatrixTable({
  labels,
  data,
  title,
}: {
  labels: Elem[];
  data: number[][];
  title?: string;
}) {
  return (
    <div className="mt-2">
      {title && <div className="text-sm text-slate-300 mb-2">{title}</div>}
      <div className="overflow-auto rounded-xl border border-slate-700">
        <table className="min-w-full border-collapse text-xs">
          <thead className="bg-slate-900/60">
            <tr>
              <th className="px-2 py-1 border border-slate-700 text-slate-400 text-left">
                —
              </th>
              {labels.map((c) => (
                <th
                  key={"c-" + c}
                  className="px-2 py-1 border border-slate-700 text-slate-200"
                >
                  {c}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, i) => (
              <tr key={"r-" + labels[i]} className="odd:bg-slate-900/30">
                <th className="px-2 py-1 border border-slate-700 text-slate-200 text-left sticky left-0 bg-slate-900/50">
                  {labels[i]}
                </th>
                {row.map((v, j) => (
                  <td
                    key={`cell-${i}-${j}`}
                    className={
                      "px-2 py-1 border border-slate-700 text-center font-mono " +
                      (v
                        ? "bg-emerald-500/10 text-emerald-300"
                        : "text-slate-300")
                    }
                  >
                    {v}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
