import { FC, useEffect, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select"
import { AreaChart, Area, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend } from "recharts"
import { Ship, Calculator, TrendingUp, TrendingDown, ClipboardList } from "lucide-react"
import { useSelector } from "react-redux"
import { RootState } from "../redux"
import { formatCurrency, generateRevenueDataSets } from "../Tools/Tools"
import { RevenueDataSets } from "../data/type"
import { revenueDataSetsVoid } from "../data/dataVoid"
import { Button } from "./ui/button";

interface PropsDashboard {
  onSetToAudit : (value : string)=> void
}

const Dashboard: FC<PropsDashboard> = ({ onSetToAudit }) => {
  const [revenuePeriod, setRevenuePeriod] = useState("mensuelle");
  const [revenueDataSets, setRevenueDataSets] = useState<RevenueDataSets>(revenueDataSetsVoid);

  const cashMouvement = useSelector((state: RootState) => state.stJude.cashMouvement);
  const trip = useSelector((state: RootState) => state.stJude.trip);
  const reservation = useSelector((state: RootState) => state.stJude.reservation);
  const currentUser = useSelector((state :RootState)=> state.users.currentUser)

  const stats = [
    {
      title: "Total Crédit",
      value: cashMouvement.reduce((acc, { credit }) => acc + Number(credit), 0),
      trend: "up",
      icon: TrendingUp
    },
    {
      title: "Total Débit",
      value: cashMouvement.reduce((acc, { debit }) => acc + Number(debit), 0),
      trend: "down",
      icon: TrendingDown
    },
    {
      title: "Solde net",
      value: cashMouvement.reduce((acc, { credit }) => acc + Number(credit), 0) -
        cashMouvement.reduce((acc, { debit }) => acc + Number(debit), 0),
      trend: "up",
      icon: Calculator
    }
  ];

  const tripStat = {
    title: "Nombre de voyages",
    value: trip.length,
    trend: "up",
    icon: Ship
  };

  // Mise à jour des revenus
  useEffect(() => {
    let rev = generateRevenueDataSets(cashMouvement);
    setRevenueDataSets(rev);
  }, [cashMouvement]);

  const getRevenueUnit = (period: string) => {
    switch (period) {
      case "hebdomadaire": return "Mille MGA par semaine";
      case "mensuelle": return "Mille MGA par mois";
      case "trimestrielle": return "Mille MGA par trimestre";
      case "semestrielle": return "Mille MGA par semestre";
      case "annuelle": return "Mille MGA par année";
      default: return "Mille MGA";
    }
  };

  const getCurrentData = () => {
    return revenueDataSets[revenuePeriod as keyof typeof revenueDataSets] || revenueDataSets.mensuelle;
  };

  const currentData = getCurrentData();
  const lastRevenue = currentData.length > 0 ? currentData[currentData.length - 1].revenus : 0;

  const paymentData = [
    { id: 'paid', name: "Frais Payés", value: reservation.reduce((acc, { amountPaid }) => acc + Number(amountPaid), 0), color: "#22c55e" },
    { id: 'unPaid', name: "Frais Non Payés", value: reservation.reduce((acc, { amountToPay }) => acc + Number(amountToPay), 0), color: "#ef4444" },
  ];

  return (
    <div className="space-y-6">
      <div className="mb-8 w-full min-h-[100px] sticky z-50 border-b-2 py-4 px-2 top-0 bg-white flex items-center justify-between">
        <div className="flex flex-col">
          <h1 className="text-primary">Tableau de Bord</h1>
          <p className="text-muted-foreground">Vue d'ensemble de vos opérations de cargaison</p>
        </div>
        <div className="flex">
          {currentUser && currentUser.role === "Propriétaire" &&
           <Button onClick={()=> onSetToAudit('Audit')}><ClipboardList /> Voire les suivie des action</Button>}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title} className="border-border hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-card-foreground">{stat.title}</CardTitle>
                {Icon && <Icon className="h-4 w-4 text-primary" />}
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-primary">{formatCurrency(stat.value)}</div>
              </CardContent>
            </Card>
          );
        })}

        {/* Trip stat */}
        <Card key={tripStat.title} className="border-border hover:shadow-md transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-card-foreground">{tripStat.title}</CardTitle>
            {(() => {
              const TripIcon = tripStat.icon;
              return <TripIcon className="h-4 w-4 text-primary" />;
            })()}
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{tripStat.value}</div>
          </CardContent>
        </Card>
      </div>

      {/* Graphiques principaux */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Évolution du Volume */}
        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-primary">
                  Évolution des Revenus
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {getRevenueUnit(revenuePeriod)}
                </p>
              </div>
              <Select value={revenuePeriod} onValueChange={setRevenuePeriod}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="hebdomadaire">Hebdomadaire</SelectItem>
                  <SelectItem value="mensuelle">Mensuelle</SelectItem>
                  <SelectItem value="trimestrielle">Trimestrielle</SelectItem>
                  <SelectItem value="semestrielle">Semestrielle</SelectItem>
                  <SelectItem value="annuelle">Annuelle</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <AreaChart data={currentData}>
                <defs>
                  <linearGradient id="colorRevenus" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#1e40af" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#1e40af" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="periode" stroke="#64748b" />
                <YAxis stroke="#64748b" />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "white",
                    border: "1px solid #e2e8f0",
                    borderRadius: "8px",
                    color: "#1e3a8a",
                  }}
                  formatter={(value: number | string) => [`${Number(value).toLocaleString()} Mille MGA`, "Revenus"]}
                  labelFormatter={(label: string, payload: any[]) => {
                    const data = payload?.[0]?.payload;
                    return data?.date || label;
                  }}
                />
                <Area type="monotone" dataKey="revenus" stroke="#1e40af" strokeWidth={2} fillOpacity={1} fill="url(#colorRevenus)" />
              </AreaChart>
            </ResponsiveContainer>
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              <div>
                <div className="text-muted-foreground">Période actuelle</div>
                <div className="font-medium text-primary">
                  {lastRevenue} Mille Ar
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">Total</div>
                <div className="font-medium text-primary">
                  {currentData.reduce((sum, { revenus }) => sum + Number(revenus), 0).toFixed(1)} Mille Ar
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Répartition des Statuts */}
        <Card className="border-border">
          <CardHeader>
            <CardTitle className="text-primary"> Répartition de Paiement</CardTitle>
            <p className="text-sm text-muted-foreground">Frais de transport de marchandises</p>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                {paymentData.map((p) => (
                  <div key={p.id} className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${p.id === 'paid' ? "bg-green-500" : "bg-red-500"}`}></div>
                    <div>
                      <div className="text-sm font-medium">{p.name}</div>
                      <div className={`text-lg font-bold ${p.id === 'paid' ? "text-green-600" : "text-red-600"}`}>
                        {formatCurrency(p.value)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={paymentData} cx="50%" cy="50%" innerRadius={60} outerRadius={110} paddingAngle={0} dataKey="value">
                    {paymentData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    contentStyle={{ backgroundColor: "white", border: "1px solid #e2e8f0", borderRadius: "8px", color: "#1e3a8a" }}
                    formatter={(value: number | string) => [`${Number(value).toLocaleString()} Ar`, "Montant"]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;
