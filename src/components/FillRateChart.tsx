// src/components/FillRateChart.tsx
import { useFillRate } from "../hooks/useFillRate";

export default function FillRateChart() {
  const { rows, error } = useFillRate();

  if (error) return <p>{error}</p>;
  if (rows.length === 0) return <p>Aucune donnée de remplissage.</p>;

  return (
    <div className="space-y-3">
      {rows.map((r) => {
        const pct = Math.round(r.fill_rate * 100);
        return (
          <div key={r.trip_id}>
            <div className="flex justify-between text-sm">
              <span>
                {r.from} → {r.to} ({r.day})
              </span>
              <span>{pct} %</span>
            </div>
            <div className="h-2 rounded bg-gray-200">
              <div className="h-2 rounded bg-blue-600" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}