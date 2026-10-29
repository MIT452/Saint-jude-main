import { FC, useMemo, useState } from "react";
import { Button } from "./ui/button";
import {
  Hammer, Plus, Ship, Search, Filter, Eye, Wrench, CheckCircle2, Gauge,
  ChevronLeft, ChevronRight, ArrowRight, ListChecks, Cog, AlertTriangle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Input } from "./ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { useSelector } from "react-redux";
import { RootState } from "../redux";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "./ui/table";
import BoatForm from "./BoatForm";
import BoatModal from "./BoatModal";
import AiFinanceChat from "./AiFinanceChat";
import { Boat } from "../data/type";

const PAGE_SIZE = 5;

const norm = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
const nf = (n: number) => n.toLocaleString("fr-FR");

// Couleur et badge selon l'état du bateau
function stateMeta(state: string) {
  const s = norm(state);
  // "Hors service" et "En panne" avant "service" (sinon "Hors service" passait en vert)
  if (s.includes("hors") || s.includes("panne"))
    return { color: "#dc2626", badge: "bg-red-100 text-red-700", Icon: AlertTriangle };
  if (s.includes("service")) return { color: "#16a34a", badge: "bg-green-100 text-green-700", Icon: Cog };
  if (s.includes("maintenance")) return { color: "#f59e0b", badge: "bg-amber-100 text-amber-700", Icon: Wrench };
  if (s.includes("construction")) return { color: "#f97316", badge: "bg-orange-100 text-orange-700", Icon: Hammer };
  if (s.includes("dispon")) return { color: "#2563eb", badge: "bg-blue-100 text-blue-700", Icon: CheckCircle2 };
  return { color: "#94a3b8", badge: "bg-gray-100 text-gray-700", Icon: Ship };
}

const StateBadge: FC<{ state: string }> = ({ state }) => {
  const { badge, Icon } = stateMeta(state);
  return (
    <span className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium ${badge}`}>
      <Icon className="h-3.5 w-3.5" /> {state}
    </span>
  );
};

// Miniature du bateau (image ou icône par défaut)
const BoatThumb: FC<{ boat: Boat; className?: string }> = ({ boat, className = "h-12 w-16" }) =>
  boat.image ? (
    <img
      src={boat.image}
      alt={String(boat.name)}
      className={`${className} rounded-md object-cover border bg-slate-100`}
    />
  ) : (
    <span className={`${className} rounded-md bg-slate-100 border flex items-center justify-center`}>
      <Ship className="h-5 w-5 text-gray-400" />
    </span>
  );

const BoatComponant: FC = () => {
  const [showModalForm, setShowModalForm] = useState<boolean>(false);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [currentBoat, setCurrentBoat] = useState<Boat>();
  const [searchTerm, setSearchTerm] = useState("");
  const [stateFilter, setStateFilter] = useState("all");
  const [page, setPage] = useState(1);

  const boats = useSelector((state: RootState) => state.stJude.boat);
  const allUsers = useSelector((state: RootState) => state.users.allUser);

  const capitaines = allUsers.filter(({ role }) => role === "Capitaine");
  const boatS = boats.filter(({ state }) => state === "En service");
  const boatC = boats.filter(({ state }) => state === "En construction");

  const capitaineOf = (boat: Boat) => {
    const c = capitaines.find(({ id }) => boat.crew?.includes(id));
    return c ? `${c.name} ${c.lastName}` : "-";
  };

  const openBoat = (boat: Boat) => {
    setCurrentBoat(boat);
    setShowModal(true);
  };

  // Totaux
  const totalCapacity = boats.reduce((s, b) => s + (Number(b.capacity) || 0), 0);
  const pct = (n: number) => (boats.length ? Math.round((n / boats.length) * 100) : 0);

  // États présents (pour le filtre et le donut)
  const byState = useMemo(() => {
    const map = new Map<string, number>();
    boats.forEach((b) => map.set(b.state, (map.get(b.state) || 0) + 1));
    return Array.from(map.entries());
  }, [boats]);

  const donut = useMemo(() => {
    if (!boats.length) return "#e5e7eb";
    let acc = 0;
    const parts = byState.map(([state, n]) => {
      const start = acc;
      acc += (n / boats.length) * 100;
      return `${stateMeta(state).color} ${start}% ${acc}%`;
    });
    return `conic-gradient(${parts.join(", ")})`;
  }, [byState, boats.length]);

  // Filtres + pagination
  const filtered = boats.filter((b) => {
    if (stateFilter !== "all" && b.state !== stateFilter) return false;
    const q = norm(searchTerm);
    if (!q) return true;
    return (
      norm(String(b.name)).includes(q) ||
      norm(String(b.id)).includes(q) ||
      norm(String(b.state)).includes(q)
    );
  });
  const pages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const startIdx = (current - 1) * PAGE_SIZE;
  const visible = filtered.slice(startIdx, startIdx + PAGE_SIZE);

  return (
    <div className="flex flex-col bg-slate-50/60 p-4 min-h-screen text-primary">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-primary">Gestion des Bateaux</h2>
        <p className="text-gray-600">Construction des nouveaux bateaux, tonnage et volume</p>
      </div>

      {/* Cartes */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center">
                <Ship className="h-6 w-6" />
              </span>
              <p className="font-semibold">Total des bateaux</p>
            </div>
            <p className="mt-3 text-3xl font-bold">{boats.length}</p>
            <p className="text-xs text-gray-500">bateaux enregistrés</p>
          </CardContent>
        </Card>

        <Card className="border border-green-200 bg-gradient-to-br from-green-50 to-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-full bg-green-600 text-white flex items-center justify-center">
                <Cog className="h-6 w-6" />
              </span>
              <p className="font-semibold">En service</p>
            </div>
            <p className="mt-3 text-3xl font-bold">{boatS.length}</p>
            <p className="text-xs text-gray-500">bateaux disponibles</p>
            <span className="mt-2 inline-block rounded-full bg-green-100 px-2 py-0.5 text-[11px] text-green-700">
              {pct(boatS.length)}% en service
            </span>
          </CardContent>
        </Card>

        <Card className="border border-orange-200 bg-gradient-to-br from-orange-50 to-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-full bg-orange-500 text-white flex items-center justify-center">
                <Hammer className="h-6 w-6" />
              </span>
              <p className="font-semibold">En construction</p>
            </div>
            <p className="mt-3 text-3xl font-bold">{boatC.length}</p>
            <p className="text-xs text-gray-500">bateaux en cours</p>
            <span className="mt-2 inline-block rounded-full bg-orange-100 px-2 py-0.5 text-[11px] text-orange-700">
              {pct(boatC.length)}% en construction
            </span>
          </CardContent>
        </Card>

        <Card className="border border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-sm">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <span className="h-12 w-12 rounded-full bg-purple-600 text-white flex items-center justify-center">
                <Gauge className="h-6 w-6" />
              </span>
              <p className="font-semibold">Capacité totale</p>
            </div>
            <p className="mt-3 text-3xl font-bold text-purple-800">{nf(totalCapacity)} T</p>
            <p className="text-xs text-gray-500">tonnage total</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-[1fr_380px] gap-6">
        {/* Colonne gauche */}
        <div className="flex flex-col gap-6 min-w-0">
          {/* Liste */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <CardTitle className="flex items-center gap-3">
                  <span className="h-9 w-9 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <ListChecks className="h-5 w-5" />
                  </span>
                  <span>
                    Liste des bateaux <span className="text-blue-600">({filtered.length})</span>
                  </span>
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-3">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Rechercher un bateau..."
                      value={searchTerm}
                      onChange={(e) => {
                        setSearchTerm(e.target.value);
                        setPage(1);
                      }}
                      className="pl-10 sm:w-56"
                    />
                  </div>
                  <Select
                    value={stateFilter}
                    onValueChange={(v) => {
                      setStateFilter(v);
                      setPage(1);
                    }}
                  >
                    <SelectTrigger className="w-full sm:w-40">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Tous" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      {byState.map(([state]) => (
                        <SelectItem key={state} value={state}>{state}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowModalForm(true)}>
                    <Plus className="h-4 w-4 mr-2" /> Nouveau bateau
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50/60">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Image</TableHead>
                      <TableHead>Matricule</TableHead>
                      <TableHead>Nom</TableHead>
                      <TableHead>Capacité (T)</TableHead>
                      <TableHead>État</TableHead>
                      <TableHead>Capitaine</TableHead>
                      <TableHead className="text-center">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visible.map((boat, i) => (
                      <TableRow
                        key={`${boat.id}-${startIdx + i}`}
                        className="hover:bg-blue-50/40 cursor-pointer"
                        onClick={() => openBoat(boat)}
                      >
                        <TableCell className="text-gray-500">{startIdx + i + 1}</TableCell>
                        <TableCell>
                          <BoatThumb boat={boat} />
                        </TableCell>
                        <TableCell className="font-medium text-[#001F3F]">{boat.id}</TableCell>
                        <TableCell className="font-medium">{boat.name}</TableCell>
                        <TableCell>{nf(Number(boat.capacity) || 0)}</TableCell>
                        <TableCell><StateBadge state={boat.state} /></TableCell>
                        <TableCell>{capitaineOf(boat)}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="text-blue-600"
                            title="Voir les détails"
                            onClick={(e) => {
                              e.stopPropagation();
                              openBoat(boat);
                            }}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                  <Ship className="h-12 w-12 mb-2" />
                  <p>Aucun bateau trouvé</p>
                </div>
              )}

              {filtered.length > 0 && (
                <div className="mt-4 flex items-center justify-between text-xs text-gray-500">
                  <span>
                    Affichage de {startIdx + 1} à {startIdx + visible.length} sur {filtered.length} bateaux
                  </span>
                  <div className="flex items-center gap-2">
                    <Button size="icon" variant="outline" disabled={current <= 1} onClick={() => setPage(current - 1)}>
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <span className="h-8 min-w-8 px-2 rounded-md bg-blue-600 text-white flex items-center justify-center">
                      {current}
                    </span>
                    <Button size="icon" variant="outline" disabled={current >= pages} onClick={() => setPage(current + 1)}>
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Détails des bateaux */}
          <Card className="border-0 shadow-sm overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-[240px_1fr]">
              <div className="relative min-h-[200px] bg-gradient-to-b from-sky-500 via-blue-700 to-blue-950 text-white p-5 flex flex-col justify-end">
                <Ship className="absolute top-6 left-1/2 -translate-x-1/2 h-20 w-20 opacity-30" />
                <p className="text-2xl font-bold">{boats.length} {boats.length > 1 ? "bateaux" : "bateau"}</p>
                <p className="text-sm text-blue-100">pour vos opérations de transport</p>
              </div>
              <div className="p-5">
                <h3 className="font-semibold mb-4">Détails des bateaux</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                  {boats.slice(0, 4).map((boat, i) => (
                    <div key={`${boat.id}-${i}`} className="rounded-xl border bg-white p-4 shadow-sm">
                      <BoatThumb boat={boat} className="mb-3 h-32 w-full" />
                      <p className="flex items-center gap-2 font-semibold">
                        <Ship className="h-5 w-5 text-blue-700" /> Bateau {boat.id} ({boat.name})
                      </p>
                      <p className="mt-2 text-sm text-gray-600">Capacité : {nf(Number(boat.capacity) || 0)} T</p>
                      <p className="mt-1 text-sm text-gray-600 flex items-center gap-2">
                        État : <StateBadge state={boat.state} />
                      </p>
                      <p className="mt-1 text-sm text-gray-600">Capitaine : {capitaineOf(boat)}</p>
                      <button
                        type="button"
                        className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline"
                        onClick={() => openBoat(boat)}
                      >
                        Voir les détails <ArrowRight className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                {boats.length === 0 && <p className="text-sm text-gray-500">Aucun bateau enregistré</p>}
              </div>
            </div>
          </Card>
        </div>

        {/* Colonne droite */}
        <div className="flex flex-col gap-6">
          {/* Répartition par état */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Ship className="h-5 w-5" /> Répartition par état
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4">
                <div className="relative h-36 w-36 rounded-full shrink-0" style={{ background: donut }}>
                  <div className="absolute inset-[18%] rounded-full bg-white flex flex-col items-center justify-center">
                    <span className="text-[11px] text-gray-500">Total</span>
                    <span className="text-xl font-bold">{boats.length}</span>
                  </div>
                </div>
                <ul className="flex-1 space-y-2 text-sm">
                  {byState.map(([state, n]) => (
                    <li key={state} className="flex items-start gap-2">
                      <span className="mt-1.5 h-2.5 w-2.5 rounded-full shrink-0" style={{ background: stateMeta(state).color }} />
                      <span>
                        {state}
                        <span className="block text-xs text-gray-500">{n} ({pct(n)}%)</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </CardContent>
          </Card>

          {/* Capacité par bateau */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <Gauge className="h-5 w-5" /> Capacité par bateau
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {boats.slice(0, 6).map((boat, i) => {
                const cap = Number(boat.capacity) || 0;
                const share = totalCapacity > 0 ? (cap / totalCapacity) * 100 : 0;
                return (
                  <div key={`${boat.id}-${i}`}>
                    <div className="flex justify-between text-xs">
                      <span className="font-medium">Bateau {boat.id} ({boat.name})</span>
                      <span className="text-gray-500">
                        {nf(cap)} T / {nf(totalCapacity)} T
                        <span className="ml-2 font-semibold text-blue-700">
                          {share.toLocaleString("fr-FR", { maximumFractionDigits: 2 })}%
                        </span>
                      </span>
                    </div>
                    <div className="mt-1 h-2 rounded-full bg-gray-100 overflow-hidden">
                      <div className="h-full rounded-full bg-blue-600" style={{ width: `${Math.max(share, 1)}%` }} />
                    </div>
                  </div>
                );
              })}
              {boats.length === 0 && <p className="text-sm text-gray-500">Aucune donnée</p>}
            </CardContent>
          </Card>

          {/* Assistant IA – Bateaux */}
          <AiFinanceChat scope="boats" />
        </div>
      </div>

      {showModalForm && <BoatForm onClose={() => setShowModalForm(false)} />}
      {showModal && currentBoat && (
        <BoatModal currentBoat={currentBoat} onClose={() => setShowModal(false)} />
      )}
    </div>
  );
};

export default BoatComponant;