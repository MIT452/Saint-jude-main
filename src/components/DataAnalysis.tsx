import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "./ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Label } from "./ui/label";
import { formatCurrency } from "../Tools/Tools";
import {
  getCash, getFuelByBoat, getFuelByTrip, getGoodsStats, getReservationStats,
} from "../services/analyticsService";

const toDate = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

type Data = {
  cash: Awaited<ReturnType<typeof getCash>>;
  fuelBoat: Awaited<ReturnType<typeof getFuelByBoat>>;
  fuelTrip: Awaited<ReturnType<typeof getFuelByTrip>>;
  reservations: Awaited<ReturnType<typeof getReservationStats>>;
  goods: Awaited<ReturnType<typeof getGoodsStats>>;
};

export default function DataAnalysis() {
  const now = new Date();
  const [from, setFrom] = useState(toDate(new Date(now.getFullYear(), now.getMonth(), 1)));
  const [to, setTo] = useState(toDate(now));
  const [data, setData] = useState<Data | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = async () => {
    setLoading(true);
    setError("");
    try {
      const [cash, fuelBoat, fuelTrip, reservations, goods] = await Promise.all([
        getCash(from, to), getFuelByBoat(from, to), getFuelByTrip(from, to),
        getReservationStats(from, to), getGoodsStats(from, to),
      ]);
      setData({ cash, fuelBoat, fuelTrip, reservations, goods });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erreur inconnue");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void load(); }, []); // chargement initial

  const topBoat = data?.fuelBoat[0];
  const revenue = data?.goods.reduce((sum, g) => sum + g.revenue, 0) ?? 0;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end gap-3">
        <div>
          <h1 className="text-2xl font-semibold">Analyse des données</h1>
          <p className="text-sm text-muted-foreground">Caisse, carburant, réservations et marchandises.</p>
        </div>
        <div className="ml-auto flex items-end gap-2">
          <div><Label>Du</Label><Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
          <div><Label>Au</Label><Input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></div>
          <Button onClick={load} disabled={loading}>{loading ? "Chargement..." : "Appliquer"}</Button>
        </div>
      </div>

      {error && <p className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</p>}

      {data && (
        <>
          {/* KPI */}
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <Kpi title="Solde net" value={formatCurrency(data.cash.net)} sub={`+${formatCurrency(data.cash.credits)} / -${formatCurrency(data.cash.debits)}`} />
            <Kpi title="Plus gros consommateur" value={topBoat ? topBoat.boat : "—"} sub={topBoat ? `${topBoat.liters} L sur la période` : "Aucune donnée"} />
            <Kpi title="Clients" value={String(data.reservations.clients)} sub={`${data.reservations.cancelled} annulation(s)`} />
            <Kpi title="Recettes marchandises" value={formatCurrency(revenue)} sub={`${data.goods.length} type(s) de marchandise`} />
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <ChartCard title="Caisse par jour">
              <LineChart data={data.cash.daily}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="day" /><YAxis /><Tooltip /><Legend />
                <Line dataKey="credits" name="Crédits" stroke="#16a34a" />
                <Line dataKey="debits" name="Débits" stroke="#dc2626" />
              </LineChart>
            </ChartCard>

            <ChartCard title="Carburant par bateau (L)">
              <BarChart data={data.fuelBoat}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="boat" /><YAxis /><Tooltip />
                <Bar dataKey="liters" name="Litres" fill="#1d4ed8" />
              </BarChart>
            </ChartCard>

            <ChartCard title="Carburant par trajet (L)">
              <BarChart data={data.fuelTrip}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="trip" /><YAxis /><Tooltip />
                <Bar dataKey="liters" name="Litres" fill="#0ea5e9" />
              </BarChart>
            </ChartCard>

            <ChartCard title="Réservations par statut">
              <BarChart data={data.reservations.byStatus}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="status" /><YAxis allowDecimals={false} /><Tooltip />
                <Bar dataKey="total" name="Réservations" fill="#f59e0b" />
              </BarChart>
            </ChartCard>

            <ChartCard title="Marchandises : recettes">
              <BarChart data={data.goods}>
                <CartesianGrid strokeDasharray="3 3" /><XAxis dataKey="good" /><YAxis /><Tooltip />
                <Bar dataKey="revenue" name="Recettes (Ar)" fill="#8b5cf6" />
              </BarChart>
            </ChartCard>

            <Card>
              <CardHeader><CardTitle className="text-base">Places restantes par voyage</CardTitle></CardHeader>
              <CardContent className="space-y-2 text-sm">
                {data.reservations.places.map((p) => (
                  <div key={`${p.trip}-${p.boat}`} className="flex justify-between border-b pb-1">
                    <span>{p.trip} ({p.boat})</span>
                    <span className="font-medium">{p.places_left} / {p.capacity}</span>
                  </div>
                ))}
                {data.reservations.places.length === 0 && <p className="text-muted-foreground">Aucun voyage sur la période.</p>}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

function Kpi({ title, value, sub }: { title: string; value: string; sub: string }) {
  return (
    <Card>
      <CardContent className="p-4">
        <p className="text-sm text-muted-foreground">{title}</p>
        <p className="mt-1 text-2xl font-semibold">{value}</p>
        <p className="mt-1 text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactElement }) {
  return (
    <Card>
      <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={260}>{children}</ResponsiveContainer>
      </CardContent>
    </Card>
  );
}