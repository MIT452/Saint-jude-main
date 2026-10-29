// src/services/mlService.ts
export async function getDemandForecast(
  reservations: any[],
  periods = 30
) {
  // Grouper par jour
  const byDay = new Map<string, number>();
  reservations.forEach((r) => {
    if (r.status === "Annulée") return;
    const d = (r.date || r.createdAt || r.dateReservation || "").slice(0, 10);
    if (d) byDay.set(d, (byDay.get(d) || 0) + 1);
  });

  const history = Array.from(byDay.entries())
    .map(([date, value]) => ({ date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));

  if (history.length < 14) {
    console.warn("Pas assez d'historique pour la prévision ML");
    return [];
  }

  const res = await fetch("http://localhost:8001/forecast", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      history,
      periods,
      target: "demand"
    })
  });

  if (!res.ok) throw new Error("Erreur ML service");
  return res.json();          // [{ date, prevision, basse, haute }, ...]
}