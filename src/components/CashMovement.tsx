import { useMemo, useState, FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import {
  Calculator, Search, Filter, TrendingUp, TrendingDown, Plus, Fuel,
  Wallet, ArrowUp, ArrowDown, ChevronRight, ListChecks, User,
} from 'lucide-react';
import AiFinanceChat from './AiFinanceChat';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { findUser, formatCurrency, formatDate } from '../Tools/Tools';
import { Button } from './ui/button';
import CashMovementFrom from './cashMovementForm';
import CashFuelConsumption from './FuelConsumptionForm';

interface PropsGestionCaissePage {
  onSetTofeuldManage: (value: string) => void;
}

type TimeFilter = 'all' | 'day' | 'week' | 'month';

const formatTime = (d: string | Date) =>
  new Date(d).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });

const GestionCaissePage: FC<PropsGestionCaissePage> = ({ onSetTofeuldManage }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCashForm, setShowCashForm] = useState<boolean>(false);
  const [showFuel, setShowFuel] = useState<boolean>(false);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  const cashMovements = useSelector((state: RootState) => state.stJude.cashMouvement);
  const allUser = useSelector((state: RootState) => state.users.allUser);
  const now = new Date();

  // Solde cumulé (calculé sur tous les mouvements, du plus ancien au plus récent)
  const runningBalance = useMemo(() => {
    const map = new Map<string | number, number>();
    let acc = 0;
    [...cashMovements]
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
      .forEach((t) => {
        acc += Number(t.credit) - Number(t.debit);
        map.set(t.id, acc);
      });
    return map;
  }, [cashMovements]);

  const filteredTransactions = cashMovements
    .filter((t) => {
      const transactionDate = new Date(t.date);

      if (timeFilter === 'day') {
        if (
          transactionDate.getDate() !== now.getDate() ||
          transactionDate.getMonth() !== now.getMonth() ||
          transactionDate.getFullYear() !== now.getFullYear()
        ) return false;
      } else if (timeFilter === 'week') {
        const startOfWeek = new Date(now);
        startOfWeek.setDate(now.getDate() - now.getDay());
        startOfWeek.setHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(startOfWeek.getDate() + 6);
        endOfWeek.setHours(23, 59, 59, 999);
        if (transactionDate < startOfWeek || transactionDate > endOfWeek) return false;
      } else if (timeFilter === 'month') {
        if (
          transactionDate.getMonth() !== now.getMonth() ||
          transactionDate.getFullYear() !== now.getFullYear()
        ) return false;
      }

      const search = searchTerm.toLowerCase();
      const user = findUser(t.userId, allUser);
      if (
        !t.designation.toLowerCase().includes(search) &&
        !user.name.toLowerCase().includes(search) &&
        !user.lastName.toLowerCase().includes(search)
      ) return false;

      return true;
    })
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  // Totaux
  const totalDebit = filteredTransactions.reduce((sum, { debit }) => sum + Number(debit), 0);
  const totalCredit = filteredTransactions.reduce((sum, { credit }) => sum + Number(credit), 0);
  const solde = totalCredit - totalDebit;

  // Répartition (donut)
  const totalFlux = totalCredit + totalDebit;
  const pctCredit = totalFlux > 0 ? Math.round((totalCredit / totalFlux) * 100) : 0;
  const pctDebit = totalFlux > 0 ? 100 - pctCredit : 0;
  const donutStyle = {
    background:
      totalFlux > 0
        ? `conic-gradient(#16a34a 0% ${pctCredit}%, #ef4444 ${pctCredit}% 100%)`
        : '#e5e7eb',
  };

  const lastMovements = filteredTransactions.slice(0, 4);

  return (
    <div className="min-h-screen bg-slate-50/60 p-4">
      <div className="max-w-full text-primary">
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-2xl font-semibold text-primary">Gestion de caisse</h2>
          <p className="text-gray-600">Suivez vos entrées et sorties d'argent en toute simplicité</p>
        </div>

        {/* Cartes + boutons */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_1fr_1fr_280px] gap-4 mb-6">
          {/* Total crédit */}
          <Card className="border border-green-200 bg-gradient-to-br from-green-50 to-white shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-green-600 text-white flex items-center justify-center shadow">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">Total Crédit</p>
                  <p className="text-xs text-gray-500">Sommes entrées</p>
                </div>
                <TrendingUp className="h-5 w-5 ml-auto text-green-500" />
              </div>
              <div className="mt-3 text-3xl font-bold text-green-700">{formatCurrency(totalCredit)}</div>
            </CardContent>
          </Card>

          {/* Total débit */}
          <Card className="border border-red-200 bg-gradient-to-br from-red-50 to-white shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-red-500 text-white flex items-center justify-center shadow">
                  <Wallet className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">Total Débit</p>
                  <p className="text-xs text-gray-500">Sommes sorties</p>
                </div>
                <TrendingDown className="h-5 w-5 ml-auto text-red-500" />
              </div>
              <div className="mt-3 text-3xl font-bold text-red-600">{formatCurrency(totalDebit)}</div>
            </CardContent>
          </Card>

          {/* Solde net */}
          <Card className="border border-blue-200 bg-gradient-to-br from-blue-50 to-white shadow-sm">
            <CardContent className="pt-6">
              <div className="flex items-start gap-3">
                <div className="h-12 w-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow">
                  <Calculator className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold">Solde Net</p>
                  <p className="text-xs text-gray-500">Disponible dans la caisse</p>
                </div>
              </div>
              <div className={`mt-3 text-3xl font-bold ${solde >= 0 ? 'text-blue-700' : 'text-red-600'}`}>
                {formatCurrency(solde)}
              </div>
            </CardContent>
          </Card>

          {/* Boutons */}
          <div className="flex flex-col gap-3 self-stretch">
            <Button
              className="flex-1 h-auto min-h-[64px] justify-between bg-blue-600 hover:bg-blue-700 text-white whitespace-normal text-left"
              onClick={() => onSetTofeuldManage('fueldManage')}
            >
              <span className="flex items-center gap-2"><Fuel className="h-5 w-5 shrink-0" /> Voir la consommation du carburant</span>
              <ChevronRight className="h-4 w-4 shrink-0" />
            </Button>
            <Button
              className="flex-1 h-auto min-h-[64px] justify-between bg-green-600 hover:bg-green-700 text-white whitespace-normal text-left"
              onClick={() => setShowCashForm(true)}
            >
              <span className="flex items-center gap-2"><Plus className="h-5 w-5" /> Nouveau Mouvement</span>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 xl:grid-cols-[1fr_340px] gap-6">
          {/* Colonne gauche : transactions */}
          <Card className="border-0 shadow-sm">
            <CardHeader>
              <div className="flex flex-col md:flex-row md:items-center gap-4 justify-between">
                <CardTitle className="flex items-center gap-3">
                  <span className="h-10 w-10 rounded-lg bg-blue-600 text-white flex items-center justify-center">
                    <ListChecks className="h-5 w-5" />
                  </span>
                  <span className="flex flex-col">
                    <span>Transactions ({filteredTransactions.length})</span>
                    <span className="text-xs font-normal text-gray-500">Historique de vos mouvements de caisse</span>
                  </span>
                </CardTitle>
                <div className="flex flex-col sm:flex-row gap-3">
                  <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as TimeFilter)}>
                    <SelectTrigger className="w-full sm:w-48">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue placeholder="Filtrer par période" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous</SelectItem>
                      <SelectItem value="day">Aujourd'hui</SelectItem>
                      <SelectItem value="week">Cette semaine</SelectItem>
                      <SelectItem value="month">Ce mois</SelectItem>
                    </SelectContent>
                  </Select>
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Rechercher une transaction..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 sm:w-64"
                    />
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-blue-50/60">
                      <TableHead className="w-10">#</TableHead>
                      <TableHead>Date</TableHead>
                      <TableHead>Désignation</TableHead>
                      <TableHead>Caissier</TableHead>
                      <TableHead className="text-right">Crédit (Ar)</TableHead>
                      <TableHead className="text-right">Débit (Ar)</TableHead>
                      <TableHead className="text-right">Solde (Ar)</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTransactions.map((t, i) => {
                      const isCredit = Number(t.credit) > 0;
                      const user = findUser(t.userId, allUser);
                      return (
                        <TableRow key={t.id} className="hover:bg-blue-50/40">
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span
                                className={`h-8 w-8 rounded-full flex items-center justify-center ${
                                  isCredit ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
                                }`}
                              >
                                {isCredit ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                              </span>
                              <span className="text-xs text-gray-500">{i + 1}</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs text-gray-600">
                            <div>{formatDate(t.date)}</div>
                            <div>{formatTime(t.date)}</div>
                          </TableCell>
                          <TableCell className="font-medium">{t.designation}</TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2 text-sm">
                              <span className="h-6 w-6 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                                <User className="h-3.5 w-3.5" />
                              </span>
                              {user ? `${user.name} ${user.lastName}` : 'Inconnu'}
                            </div>
                          </TableCell>
                          <TableCell className="text-right font-semibold text-green-600">
                            {isCredit ? `+ ${formatCurrency(t.credit)}` : '-'}
                          </TableCell>
                          <TableCell className="text-right font-semibold text-red-600">
                            {Number(t.debit) > 0 ? formatCurrency(t.debit) : '-'}
                          </TableCell>
                          <TableCell className="text-right text-gray-700">
                            {formatCurrency(runningBalance.get(t.id) ?? 0)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              {filteredTransactions.length === 0 && (
                <div className="text-center py-8 text-gray-500 flex flex-col items-center">
                  <Calculator className="h-12 w-12 mb-2" />
                  <p>Aucune transaction trouvée</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Colonne droite */}
          <div className="flex flex-col gap-6">
            {/* Répartition */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Fuel className="h-5 w-5" /> Répartition des mouvements
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4">
                  <div className="relative h-36 w-36 rounded-full shrink-0" style={donutStyle}>
                    <div className="absolute inset-[18%] rounded-full bg-white flex flex-col items-center justify-center text-center">
                      <span className="text-[11px] text-gray-500">Total</span>
                      <span className="text-sm font-bold">{formatCurrency(totalFlux)}</span>
                    </div>
                  </div>
                  <ul className="flex-1 text-sm space-y-3">
                    <li className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-green-600" /> Entrées
                      </span>
                      <span className="font-semibold">{pctCredit}%</span>
                    </li>
                    <li className="flex items-center justify-between">
                      <span className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-red-500" /> Sorties
                      </span>
                      <span className="font-semibold">{pctDebit}%</span>
                    </li>
                  </ul>
                </div>
              </CardContent>
            </Card>

            {/* Derniers mouvements */}
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <CardTitle className="text-base">Derniers mouvements</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {lastMovements.map((t) => {
                  const isCredit = Number(t.credit) > 0;
                  return (
                    <div key={t.id} className="flex items-center gap-3">
                      <span
                        className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                          isCredit ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
                        }`}
                      >
                        {isCredit ? <ArrowUp className="h-4 w-4" /> : <ArrowDown className="h-4 w-4" />}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{t.designation}</p>
                        <span
                          className={`text-[11px] px-2 py-0.5 rounded ${
                            isCredit ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-600'
                          }`}
                        >
                          {isCredit ? 'Entrée' : 'Sortie'}
                        </span>
                      </div>
                      <div className="text-right">
                        <p className={`text-sm font-semibold ${isCredit ? 'text-green-600' : 'text-red-600'}`}>
                          {isCredit ? '+ ' : '- '}
                          {formatCurrency(isCredit ? t.credit : t.debit)}
                        </p>
                        <p className="text-[11px] text-gray-500">
                          {formatDate(t.date)} {formatTime(t.date)}
                        </p>
                      </div>
                    </div>
                  );
                })}
                {lastMovements.length === 0 && (
                  <p className="text-sm text-gray-500">Aucun mouvement</p>
                )}
              </CardContent>
            </Card>

            {/* Assistant IA (Groq via le backend Render) */}
            <AiFinanceChat scope="cash" />
          </div>
        </div>
      </div>

      {showCashForm && <CashMovementFrom onClose={() => setShowCashForm(false)} />}
      {showFuel && <CashFuelConsumption onClose={() => setShowFuel(false)} />}
    </div>
  );
};

export default GestionCaissePage;