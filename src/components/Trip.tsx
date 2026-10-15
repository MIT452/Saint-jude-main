import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Badge } from './ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import {
  Ship, Plus, MapPin, Calendar, User, Filter, Search, Clock, ArrowRight,
  ArrowUpDown, MoreVertical, Play, CheckCircle2, CalendarClock, Route,
} from 'lucide-react';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from './ui/select';
import TripeForm from './TripeForm';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { findBoat, formatHour, getDuration } from '../Tools/Tools';
import TripModal from './TripModal';
import { statusTrip, Trip } from '../data/type';

type SortKey = 'from' | 'to' | 'boat' | 'depart' | 'arrive';

const norm = (s: string) =>
  s.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();

export default function GestionTrajetPage() {
  const [showModal, setShowModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<'all' | statusTrip>('all');
  const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'week' | 'month'>('all');
  const [specificDate, setSpecificDate] = useState<string>('');
  const [showModalUpdate, setShowModalUpdate] = useState<boolean>(false);
  const [boatFilter, setBoatFilter] = useState<string>('all');
  const [capitaineFilter, setCapitaineFilter] = useState<string>('all');
  const [currentTrip, setCurrentTrip] = useState<Trip>();
  const [searchTerm, setSearchTerm] = useState('');
  const [sort, setSort] = useState<{ key: SortKey; dir: 'asc' | 'desc' } | null>(null);

  const { trip: trips, boat: allBoat } = useSelector((state: RootState) => state.stJude);
  const { allUser } = useSelector((state: RootState) => state.users);
  const allCapinaine = allUser.filter((u) => u.role === 'Capitaine');

  // Filtrage combiné (logique d'origine conservée)
  const filteredTrip = trips
    .filter((trip) => (statusFilter === 'all' ? true : trip.status === statusFilter))
    .filter((trip) => {
      if (timeFilter === 'all') return true;
      const departDate = new Date(trip.depart);
      const now = new Date();
      switch (timeFilter) {
        case 'day':
          return departDate.toDateString() === now.toDateString();
        case 'week': {
          const startOfWeek = new Date(now);
          startOfWeek.setDate(now.getDate() - now.getDay());
          startOfWeek.setHours(0, 0, 0, 0);
          const endOfWeek = new Date(startOfWeek);
          endOfWeek.setDate(startOfWeek.getDate() + 6);
          endOfWeek.setHours(23, 59, 59, 999);
          return departDate >= startOfWeek && departDate <= endOfWeek;
        }
        case 'month':
          return departDate.getMonth() === now.getMonth() && departDate.getFullYear() === now.getFullYear();
      }
    })
    .filter((trip) => {
      if (!specificDate) return true;
      const filterDate = new Date(specificDate);
      const departDate = new Date(trip.depart);
      return (
        departDate.getFullYear() === filterDate.getFullYear() &&
        departDate.getMonth() === filterDate.getMonth() &&
        departDate.getDate() === filterDate.getDate()
      );
    })
    .filter((trip) => (boatFilter === 'all' ? true : trip.boatId === boatFilter))
    .filter((trip) => {
      if (capitaineFilter === 'all') return true;
      const boat = findBoat(trip.boatId, allBoat);
      return boat.crew.includes(capitaineFilter);
    });

  // Cartes de statistiques (calculées sur les trajets filtrés)
  const total = filteredTrip.length;
  const planned = filteredTrip.filter((t) => t.status === 'Prévu').length;
  const ongoing = filteredTrip.filter((t) => t.status === 'Encours').length;
  const done = filteredTrip.filter((t) => t.status === 'Arriver').length;

  // Recherche dans la liste + tri
  const rows = useMemo(() => {
    const q = norm(searchTerm);
    const list = filteredTrip.filter((t) => {
      if (!q) return true;
      const boat = findBoat(t.boatId, allBoat);
      return (
        norm(String(t.from)).includes(q) ||
        norm(String(t.to)).includes(q) ||
        norm(String(boat?.name ?? '')).includes(q)
      );
    });
    if (!sort) return list;

    const time = (v: unknown) => (v ? new Date(v as string).getTime() : 0);
    const value = (t: Trip): string | number => {
      switch (sort.key) {
        case 'from': return norm(String(t.from));
        case 'to': return norm(String(t.to));
        case 'boat': return norm(String(findBoat(t.boatId, allBoat)?.name ?? ''));
        case 'depart': return time(t.depart);
        case 'arrive': return time(t.arrive);
      }
    };
    return [...list].sort((a, b) => {
      const va = value(a);
      const vb = value(b);
      const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredTrip, searchTerm, sort, allBoat]);

  const toggleSort = (key: SortKey) =>
    setSort((s) => (s && s.key === key ? (s.dir === 'asc' ? { key, dir: 'desc' } : null) : { key, dir: 'asc' }));

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
  };

  const getStatusBadge = (statut: statusTrip) => {
    switch (statut) {
      case 'Arriver': return <Badge className="bg-green-100 text-green-800">Terminé</Badge>;
      case 'Encours': return <Badge className="bg-blue-100 text-blue-800">En cours</Badge>;
      case 'Prévu': return <Badge className="bg-orange-100 text-orange-800">Programmé</Badge>;
      default: return <Badge variant="secondary">{statut}</Badge>;
    }
  };

  const onShowUpdate = (trip: Trip) => {
    setCurrentTrip(trip);
    setShowModalUpdate(true);
  };

  const SortHead = ({ label, k, className }: { label: string; k: SortKey; className?: string }) => (
    <TableHead className={className}>
      <button type="button" className="inline-flex items-center gap-1 hover:text-blue-700" onClick={() => toggleSort(k)}>
        {label}
        <ArrowUpDown className={`h-3.5 w-3.5 ${sort?.key === k ? 'text-blue-600' : 'text-gray-400'}`} />
      </button>
    </TableHead>
  );

  return (
    <div className="min-h-screen bg-slate-50/60 p-4 text-gray-900">
      <div className="max-w-full flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-3">
            <span className="h-12 w-12 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Route className="h-7 w-7" />
            </span>
            <div>
              <h2 className="text-2xl font-semibold text-primary">Gestion des Trajets</h2>
              <p className="text-gray-600">Planification et suivi des voyages</p>
            </div>
          </div>
          <Button className="bg-blue-600 hover:bg-blue-700 text-white" onClick={() => setShowModal(true)}>
            <Plus className="h-4 w-4 mr-2" /> Ajouter un trajet
          </Button>
        </div>

        {/* Filtres */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4">
          <Card className="border border-blue-100 shadow-sm">
            <CardContent className="p-4">
              <label className="text-sm font-semibold mb-1 block">Statut</label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as 'all' | statusTrip)}>
                <SelectTrigger className="w-full">
                  <Filter className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="Arriver">Terminé</SelectItem>
                  <SelectItem value="Encours">En cours</SelectItem>
                  <SelectItem value="Prévu">Programmé</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border border-blue-100 shadow-sm">
            <CardContent className="p-4">
              <label className="text-sm font-semibold mb-1 block">Période</label>
              <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as 'all' | 'day' | 'week' | 'month')}>
                <SelectTrigger className="w-full">
                  <Calendar className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous</SelectItem>
                  <SelectItem value="day">Aujourd'hui</SelectItem>
                  <SelectItem value="week">Cette semaine</SelectItem>
                  <SelectItem value="month">Ce mois</SelectItem>
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border border-blue-100 shadow-sm">
            <CardContent className="p-4">
              <label className="text-sm font-semibold mb-1 block">Date spécifique</label>
              <Input type="date" value={specificDate} onChange={(e) => setSpecificDate(e.target.value)} className="w-full" />
            </CardContent>
          </Card>

          <Card className="border border-blue-100 shadow-sm">
            <CardContent className="p-4">
              <label className="text-sm font-semibold mb-1 block">Bateau</label>
              <Select value={boatFilter} onValueChange={setBoatFilter}>
                <SelectTrigger className="w-full">
                  <Ship className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les bateaux</SelectItem>
                  {allBoat.map((b, ke) => (
                    <SelectItem key={ke} value={b.id}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>

          <Card className="border border-blue-100 shadow-sm">
            <CardContent className="p-4">
              <label className="text-sm font-semibold mb-1 block">Capitaine</label>
              <Select value={capitaineFilter} onValueChange={setCapitaineFilter}>
                <SelectTrigger className="w-full">
                  <User className="h-4 w-4 mr-2" />
                  <SelectValue placeholder="Sélectionner" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tous les capitaines</SelectItem>
                  {allCapinaine.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} {c.lastName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
          </Card>
        </div>

        {/* Cartes de statistiques */}
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
          <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <span className="h-14 w-14 rounded-full bg-blue-600 text-white flex items-center justify-center">
                <Ship className="h-7 w-7" />
              </span>
              <div>
                <p className="text-3xl font-bold">{total}</p>
                <p className="text-sm text-blue-700">trajets au total</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-green-200 bg-gradient-to-br from-green-50 to-white shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <span className="h-14 w-14 rounded-full bg-green-600 text-white flex items-center justify-center">
                <CalendarClock className="h-7 w-7" />
              </span>
              <div>
                <p className="text-3xl font-bold">{planned}</p>
                <p className="text-sm text-green-700">programmés</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-sky-200 bg-gradient-to-br from-sky-50 to-white shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <span className="h-14 w-14 rounded-full bg-blue-500 text-white flex items-center justify-center">
                <Play className="h-7 w-7" />
              </span>
              <div>
                <p className="text-3xl font-bold">{ongoing}</p>
                <p className="text-sm text-sky-700">en cours</p>
              </div>
            </CardContent>
          </Card>
          <Card className="border border-purple-200 bg-gradient-to-br from-purple-50 to-white shadow-sm">
            <CardContent className="p-5 flex items-center gap-4">
              <span className="h-14 w-14 rounded-full bg-purple-600 text-white flex items-center justify-center">
                <CheckCircle2 className="h-7 w-7" />
              </span>
              <div>
                <p className="text-3xl font-bold">{done}</p>
                <p className="text-sm text-purple-700">terminés</p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Liste des trajets */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <CardTitle className="flex items-center gap-2">
                <Ship className="h-6 w-6 text-blue-700" /> Liste des Trajets ({rows.length})
              </CardTitle>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <Input
                  placeholder="Rechercher dans la liste..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10 md:w-72"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-blue-50/60">
                    <TableHead className="w-10">#</TableHead>
                    <SortHead label="Départ" k="from" />
                    <TableHead className="w-8" />
                    <SortHead label="Arrivée" k="to" />
                    <SortHead label="Bateau" k="boat" />
                    <SortHead label="Date Départ" k="depart" />
                    <SortHead label="Date Arrivée" k="arrive" />
                    <TableHead>Durée</TableHead>
                    <TableHead>Statut</TableHead>
                    <TableHead className="text-center">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((trip, key) => {
                    const boat = findBoat(trip.boatId, allBoat);
                    return (
                      <TableRow key={key} className="hover:bg-blue-50/40 cursor-pointer" onClick={() => onShowUpdate(trip)}>
                        <TableCell className="text-gray-500">{key + 1}</TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-blue-600" /> {trip.from}
                          </span>
                        </TableCell>
                        <TableCell><ArrowRight className="h-4 w-4 text-gray-400" /></TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <MapPin className="h-4 w-4 text-blue-600" /> {trip.to}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5">
                            <Ship className="h-4 w-4 text-blue-700" /> {boat ? boat.name : '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(trip.depart)} {formatHour(trip.depart)}
                        </TableCell>
                        <TableCell className="text-sm">
                          {formatDate(trip.arrive)} {formatHour(trip.arrive)}
                        </TableCell>
                        <TableCell>
                          <span className="inline-flex items-center gap-1.5 text-sm">
                            <Clock className="h-4 w-4 text-gray-500" /> {getDuration(trip.arrive, trip.depart)}
                          </span>
                        </TableCell>
                        <TableCell>{getStatusBadge(trip.status)}</TableCell>
                        <TableCell className="text-center">
                          <Button
                            size="icon"
                            variant="ghost"
                            title="Ouvrir le trajet"
                            onClick={(e) => {
                              e.stopPropagation();
                              onShowUpdate(trip);
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {rows.length === 0 && (
              <div className="text-center py-8">
                <MapPin className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-500">Aucun trajet trouvé</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {showModal && <TripeForm onClose={() => setShowModal(false)} />}
      {showModalUpdate && currentTrip && (
        <TripModal currentTrip={currentTrip} onClose={() => setShowModalUpdate(false)}></TripModal>
      )}
    </div>
  );
}