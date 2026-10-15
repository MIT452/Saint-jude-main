import { FC, useMemo, useState } from "react";
import { Button } from "./ui/button";
import {
  Filter, Fuel, Plus, Search, RotateCcw, Ship, User, Route,
  Droplets, Banknote, ListChecks, Gauge,
} from "lucide-react";
import AiFinanceChat from "./AiFinanceChat";
import CashFuelConsumption from "./FuelConsumptionForm";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import { findBoat, findTrip, findUser, formatCurrency, formatDate } from "../Tools/Tools";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";

const PALETTE = ["#2563eb", "#16a34a", "#f59e0b", "#a855f7", "#ef4444", "#0ea5e9"];
const MONTHS = ["Jan", "Fév", "Mar", "Avr", "Mai", "Juin", "Juil", "Août", "Sep", "Oct", "Nov", "Déc"];

const formatTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" });

const nf = (n: number) => Math.round(n).toLocaleString("fr-FR");

const FuelConsumption: FC = () => {
  const [showFuel, setShowFuel] = useState<boolean>(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [tripFilter, setTripFilter] = useState("all");
  const [userFilter, setUserFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const { boat: allBoat, trip: allTrip, fuelConsumption } = useSelector((state: RootState) => state.stJude);
  const { allUser, currentUser } = useSelector((state: RootState) => state.users);

  // Lignes enrichies (utilisateur, trajet, bateau, quantité estimée)
  const rows = useMemo(() => {
    return fuelConsumption
      .map((f) => {
        const user = findUser(f.userId, allUser);
        const trip = findTrip(f.tripId, allTrip);
        const boat = findBoat(trip.boatId, allBoat);
        const price = Number(f.fuelPrice) || 0;
        const cost = Number(f.cost) || 0;
        const liters = price > 0 ? cost / price : 0; // quantité = coût total / prix par litre
        return { f, user, trip, boat, price, cost, liters, route: `${trip.from} → ${trip.to}` };
      })
      .filter(({ boat }) => {
        // Restriction par rôle
        if (currentUser && currentUser.role === "Capitaine") {
          return boat.crew.includes(currentUser.id);
        }
        return true;
      })
      .sort((a, b) => new Date(b.f.createdAt as string).getTime() - new Date(a.f.createdAt as string).getTime());
  }, [fuelConsumption, allUser, allTrip, allBoat, currentUser]);

  // Options des filtres (dynamiques)
  const tripOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.route))), [rows]);
  const userOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((r) => map.set(String(r.f.userId), `${r.user.name} ${r.user.lastName}`));
    return Array.from(map.entries());
  }, [rows]);
  const typeOptions = useMemo(() => Array.from(new Set(rows.map((r) => r.f.fuelType))), [rows]);

  const filtered = rows.filter((r) => {
    const search = searchTerm.toLowerCase();
    if (tripFilter !== "all" && r.route !== tripFilter) return false;
    if (userFilter !== "all" && String(r.f.userId) !== userFilter) return false;
    if (typeFilter !== "all" && r.f.fuelType !== typeFilter) return false;

    const d = new Date(r.f.createdAt as string);
    if (dateFrom && d < new Date(dateFrom + "T00:00:00")) return false;
    if (dateTo && d > new Date(dateTo + "T23:59:59")) return false;

    return (
      r.user.name.toLowerCase().includes(search) ||
      r.user.lastName.toLowerCase().includes(search) ||
      r.route.toLowerCase().includes(search) ||
      r.boat.name.toLowerCase().includes(search) ||
      r.f.fuelType.toLowerCase().includes(search) ||
      r.f.fuelPrice.toString().includes(search) ||
      r.f.cost.toString().includes(search)
    );
  });

  const resetFilters = () => {
    setSearchTerm("");
    setTripFilter("all");
    setUserFilter("all");
    setTypeFilter("all");
    setDateFrom("");
    setDateTo("");
  };

  // Indicateurs
  const totalLiters = filtered.reduce((s, r) => s + r.liters, 0);
  const totalCost = filtered.reduce((s, r) => s + r.cost, 0);
  const avgPrice = totalLiters > 0 ? totalCost / totalLiters : 0;

  // Répartition par type
  const byType = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => map.set(r.f.fuelType, (map.get(r.f.fuelType) || 0) + r.liters));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
  }, [filtered]);

  const donutBackground = useMemo(() => {
    if (totalLiters <= 0) return "#e5e7eb";
    let acc = 0;
    const parts = byType.map(([, v], i) => {
      const start = acc;
      acc += (v / totalLiters) * 100;
      return `${PALETTE[i % PALETTE.length]} ${start}% ${acc}%`;
    });
    return `conic-gradient(${parts.join(", ")})`;
  }, [byType, totalLiters]);

  // Top 5 bateaux
  const topBoats = useMemo(() => {
    const map = new Map<string, number>();
    filtered.forEach((r) => map.set(r.boat.name, (map.get(r.boat.name) || 0) + r.liters));
    return Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 5);
  }, [filtered]);
  const maxBoat = topBoats.length ? topBoats[0][1] : 0;

  // Évolution mensuelle
  const monthly = useMemo(() => {
    const map = new Map<string, { label: string; liters: number; cost: number }>();
    [...filtered]
      .sort((a, b) => new Date(a.f.createdAt as string).getTime() - new Date(b.f.createdAt as string).getTime())
      .forEach((r) => {
        const d = new Date(r.f.createdAt as string);
        const key = `${d.getFullYear()}-${String(d.getMonth()).padStart(2, "0")}`;
        const cur = map.get(key) || { label: MONTHS[d.getMonth()], liters: 0, cost: 0 };
        cur.liters += r.liters;
        cur.cost += r.cost;
        map.set(key, cur);
      });
    return Array.from(map.values()).slice(-12);
  }, [filtered]);
  const maxL = Math.max(1, ...monthly.map((m) => m.liters));
  const maxC = Math.max(1, ...monthly.map((m) => m.cost));
  const linePoints = monthly
    .map((m, i) => {
      const x = ((i + 0.5) / monthly.length) * 100;
      const y = 100 - (m.cost / maxC) * 100;
      return `${x},${y}`;
    })
    .join(" ");

  return (
    <div className="flex flex-col bg-slate-50/60 p-4 min-h-screen text-primary">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-primary">Consommation de carburant</h2>
          <p className="text-gray-600">Suivez et analysez la consommation de carburant de vos bateaux et véhicules</p>
        </div>
        {currentUser && currentUser.role === "Capitaine" && (
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowFuel(true)}>
            <Plus className="h-5 w-5 mr-1" /> Gestion de Carburant
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* Colonne gauche */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Filtres */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Filter className="h-5 w-5 text-blue-600" /> Filtres et recherche
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="relative md:col-span-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher par trajet, bateau, utilisateur..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Select value={tripFilter} onValueChange={setTripFilter}>
                  <SelectTrigger>
                    <Route className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Tous les trajets" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les trajets</SelectItem>
                    {tripOptions.map((t) => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Select value={userFilter} onValueChange={setUserFilter}>
                  <SelectTrigger>
                    <User className="h-4 w-4 mr-2" />
                    <SelectValue placeholder="Tous les utilisateurs" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Tous les utilisateurs</SelectItem>
                    {userOptions.map(([id, name]) => (
                      <SelectItem key={id} value={id}>{name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col md:flex-row md:items-end gap-4">
                <div className="w-full md:w-52">
                  <p className="text-xs font-medium mb-1">Type de carburant</p>
                  <Select value={typeFilter} onValueChange={setTypeFilter}>
                    <SelectTrigger>
                      <Fuel className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Tous les types" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      {typeOptions.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <p className="text-xs font-medium mb-1">Période</p>
                  <div className="flex items-center gap-2">
                    <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                    <span className="text-gray-400">→</span>
                    <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
                  </div>
                </div>
                <Button variant="ghost" className="text-blue-600" onClick={resetFilters}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Réinitialiser
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Cartes indicateurs */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-full bg-blue-600 text-white flex items-center justify-center"><Fuel className="h-5 w-5" /></span>
                  <p className="text-sm font-medium text-blue-700">Consommation totale</p>
                </div>
                <p className="mt-3 text-2xl font-bold text-blue-800">{nf(totalLiters)} L</p>
              </CardContent>
            </Card>
            <Card className="border border-green-200 bg-gradient-to-br from-green-50 to-white shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-full bg-green-600 text-white flex items-center justify-center"><Banknote className="h-5 w-5" /></span>
                  <p className="text-sm font-medium text-green-700">Coût total carburant</p>
                </div>
                <p className="mt-3 text-2xl font-bold text-green-800">{formatCurrency(totalCost)}</p>
              </CardContent>
            </Card>
            <Card className="border border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-full bg-purple-600 text-white flex items-center justify-center"><Droplets className="h-5 w-5" /></span>
                  <p className="text-sm font-medium text-purple-700">Prix moyen / L</p>
                </div>
                <p className="mt-3 text-2xl font-bold text-purple-800">{formatCurrency(avgPrice)}</p>
              </CardContent>
            </Card>
            <Card className="border border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-sm">
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <span className="h-11 w-11 rounded-full bg-orange-500 text-white flex items-center justify-center"><Gauge className="h-5 w-5" /></span>
                  <p className="text-sm font-medium text-orange-700">Nombre de transactions</p>
                </div>
                <p className="mt-3 text-2xl font-bold text-orange-800">{filtered.length}</p>
              </CardContent>
            </Card>
          </div>

          {/* Tableau */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <span className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                  <ListChecks className="h-5 w-5" />
                </span>
                Détail des consommations de carburant ({filtered.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50/60">
                      <TableHead>Date</TableHead>
                      <TableHead>Trajet</TableHead>
                      <TableHead>Bateau / Véhicule</TableHead>
                      <TableHead>Utilisateur</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Quantité (L)</TableHead>
                      <TableHead className="text-right">Prix/L (Ar)</TableHead>
                      <TableHead className="text-right">Total (Ar)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filtered.map(({ f, user, trip, boat, liters }) => {
                      const typeIdx = Math.max(0, typeOptions.indexOf(f.fuelType));
                      return (
                        <TableRow key={f.id} className="hover:bg-blue-50/40">
                          <TableCell className="text-xs text-gray-600">
                            <div>{formatDate(f.createdAt as string)}</div>
                            <div>{formatTime(f.createdAt as string)}</div>
                          </TableCell>
                          <TableCell className="text-sm">
                            {trip.from} → {trip.to}
                            <div className="text-xs text-gray-500">{formatDate(trip.depart)}</div>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2 text-sm">
                              <Ship className="h-4 w-4 text-blue-600" /> {boat.name}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="flex items-center gap-2 text-sm">
                              <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                <User className="h-3.5 w-3.5" />
                              </span>
                              {`${user.name} ${user.lastName}`}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span
                              className="text-xs font-medium px-2 py-1 rounded"
                              style={{
                                background: `${PALETTE[typeIdx % PALETTE.length]}20`,
                                color: PALETTE[typeIdx % PALETTE.length],
                              }}
                            >
                              {f.fuelType}
                            </span>
                          </TableCell>
                          <TableCell className="text-right">{nf(liters)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(f.fuelPrice)}</TableCell>
                          <TableCell className="text-right font-semibold">{formatCurrency(f.cost)}</TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {filtered.length === 0 && (
                <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                  <Fuel className="h-12 w-12 mb-2" />
                  <p>Aucune consommation trouvée</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colonne droite */}
        <div className="flex flex-col gap-6">
          {/* Évolution */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center justify-between text-base">
                <span className="flex items-center gap-2"><Fuel className="h-5 w-5" /> Évolution de la consommation</span>
                <span className="flex items-center gap-3 text-[11px] font-normal">
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-blue-500" /> Quantité (L)</span>
                  <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-green-500" /> Coût (Ar)</span>
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {monthly.length === 0 ? (
                <p className="text-sm text-gray-500">Aucune donnée</p>
              ) : (
                <div>
                  <div className="relative h-40">
                    <div className="absolute inset-0 flex items-end gap-2">
                      {monthly.map((m, i) => (
                        <div
                          key={i}
                          className="flex-1 rounded-t bg-blue-400/80"
                          style={{ height: `${(m.liters / maxL) * 100}%` }}
                          title={`${m.label} : ${nf(m.liters)} L`}
                        />
                      ))}
                    </div>
                    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                      <polyline fill="none" stroke="#16a34a" strokeWidth="1.5" vectorEffect="non-scaling-stroke" points={linePoints} />
                    </svg>
                  </div>
                  <div className="flex gap-2 mt-1">
                    {monthly.map((m, i) => (
                      <span key={i} className="flex-1 text-center text-[10px] text-gray-500">{m.label}</span>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Répartition par type */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Fuel className="h-5 w-5" /> Répartition par type de carburant
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative h-36 w-36 rounded-full shrink-0" style={{ background: donutBackground }}>
                  <div className="absolute inset-[18%] rounded-full bg-white flex flex-col items-center justify-center">
                    <span className="text-[11px] text-gray-500">Total</span>
                    <span className="text-sm font-bold">{nf(totalLiters)} L</span>
                  </div>
                </div>
                <ul className="flex-1 space-y-3 text-sm">
                  {byType.map(([type, v], i) => (
                    <li key={type} className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PALETTE[i % PALETTE.length] }} />
                        {type}
                      </span>
                      <span className="font-semibold">{totalLiters > 0 ? Math.round((v / totalLiters) * 100) : 0}%</span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Top 5 */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Fuel className="h-5 w-5" /> Top 5 des bateaux / véhicules
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {topBoats.map(([name, v]) => (
                <div key={name} className="flex items-center gap-3 text-sm">
                  <Ship className="h-4 w-4 text-blue-600 shrink-0" />
                  <span className="w-32 truncate">{name}</span>
                  <div className="flex-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                    <div className="h-full rounded-full bg-blue-600" style={{ width: `${maxBoat ? (v / maxBoat) * 100 : 0}%` }} />
                  </div>
                  <span className="w-16 text-right text-xs">{nf(v)} L</span>
                </div>
              ))}
              {topBoats.length === 0 && <p className="text-sm text-gray-500">Aucune donnée</p>}
            </CardContent>
          </Card>

          {/* Assistant IA (Groq via le backend Render) */}
          <AiFinanceChat scope="fuel" />
        </div>
      </div>

      {showFuel && <CashFuelConsumption onClose={() => setShowFuel(false)} />}
    </div>
  );
};

export default FuelConsumption;