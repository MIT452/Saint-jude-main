import { useState, FC } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/card';
import { Input } from './ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { Calculator, Search, Filter, TrendingUp, TrendingDown, Plus, Fuel } from 'lucide-react';
import { useSelector } from 'react-redux';
import { RootState } from '../redux';
import { findUser, formatCurrency, formatDate } from '../Tools/Tools';
import { Button } from './ui/button';
import CashMovementFrom from './CashMovementForm';
import CashFuelConsumption from './FuelConsumptionForm';

interface PropsGestionCaissePage {
  onSetTofeuldManage: (value : string) => void;
}
const GestionCaissePage: FC<PropsGestionCaissePage> = ({ onSetTofeuldManage }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [showCashForm, setShowCashForm] = useState<boolean>(false);
  const [showFuel, setShowFuel] = useState<boolean>(false);
  const [timeFilter, setTimeFilter] = useState<'all' | 'day' | 'week' | 'month'>('all');


  const cashMovements = useSelector((state: RootState) => state.stJude.cashMouvement);
  const allUser = useSelector((state: RootState) => state.users.allUser);
  const now = new Date();

  const filteredTransactions = cashMovements.filter((t) => {
    const transactionDate = new Date(t.date);

    // Filtre par période
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

    // Filtre par recherche
    const search = searchTerm.toLowerCase();
    if (
      !t.designation.toLowerCase().includes(search) &&
      !findUser(t.userId, allUser).name.toLowerCase().includes(search) &&
      !findUser(t.userId, allUser).lastName.toLowerCase().includes(search)
    ) return false;

    return true;
  });

  // Totaux
  const totalDebit = filteredTransactions.reduce((sum, { debit }) => sum + Number(debit), 0);
  const totalCredit = filteredTransactions.reduce((sum, { credit }) => sum + Number(credit), 0);
  const solde = totalCredit - totalDebit;

  return (
    <div className="min-h-screen">
      <div className="max-w-full text-primary">
        {/* Header */}
        <div className="mb-8 w-full items-center min-h-[100px] sticky z-50 border-b-2 py-4 px-2 top-0 bg-white flex justify-between">
          <div className="flex flex-col">
            <h2 className="text-2xl font-semibold text-primary mb-2">Gestion de Caisse</h2>
            <p className="text-gray-600">Suivi des encaissements et décaissements</p>
          </div>
          <div className="flex gap-2">
            <Button onClick={()=>onSetTofeuldManage("fueldManage")}><Fuel /> Voire la consomation du carburant</Button>
            <Button onClick={() => setShowCashForm(true)}><Plus /> Nouveau Mouvement</Button>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Crédit</CardTitle>
              <TrendingUp className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalCredit)}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Débit</CardTitle>
              <TrendingDown className="h-4 w-4" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{formatCurrency(totalDebit)}</div>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Solde Net</CardTitle>
              <Calculator className="h-5 w-5" />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold`}>{formatCurrency(solde)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="border-0 shadow-sm mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col md:flex-row gap-4">
              <div className="flex-1">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    placeholder="Rechercher par trajet, marchandise, encaisseur..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>
              <div className="w-full md:w-48">
                <Select value={timeFilter} onValueChange={(v) => setTimeFilter(v as 'all' | 'day' | 'week' | 'month')}>
                  <SelectTrigger>
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
              </div>

            </div>
          </CardContent>
        </Card>

        {/* Table */}
        <Card className="border-0 shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-1.5">
              <Calculator className="h-7 w-7" />
              Transactions ({filteredTransactions.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Designation</TableHead>
                    <TableHead>Caissier</TableHead>
                    <TableHead className="text-right">Crédit</TableHead>
                    <TableHead className="text-right">Débit</TableHead>
                    <TableHead className='text-center'>Date</TableHead>
                    {/* <TableHead>Encaisseur</TableHead> */}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredTransactions.map((t) => (
                    <TableRow key={t.id} className="hover:bg-gray-50">
                      <TableCell>{t.designation}</TableCell>
                      <TableCell>{`${findUser(t.userId, allUser).name} ${findUser(t.userId, allUser).lastName}`}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.credit)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(t.debit)}</TableCell>
                      <TableCell className='text-center'>{formatDate(t.date)}</TableCell>
                      {/* <TableCell>{t.caissier}</TableCell> */}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {filteredTransactions.length === 0 && (
              <div className="text-center py-8">
                <Calculator className="h-12 w-12" />
                <p className="">Aucune transaction trouvée</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      {showCashForm && <CashMovementFrom onClose={() => setShowCashForm(false)}></CashMovementFrom>}
      {showFuel && <CashFuelConsumption onClose={() => setShowFuel(false)} />}
    </div>
  );
}
export default GestionCaissePage;