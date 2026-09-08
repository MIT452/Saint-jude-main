import { Card, CardContent, CardHeader, CardTitle } from "./ui/card"
import { Badge } from "./ui/badge"
import { Button } from "./ui/button"
import { Progress } from "./ui/progress"
import {
  Ship,
  MapPin,
  Clock,
  Users,
  Package,
  // Fuel,
  Calendar,
  Plus
} from "lucide-react"
import { FC } from "react"

const VoyagePlanning: FC = () => {
  const activeVoyages = [
    {
      id: "VOY-2024-001",
      route: "Marseille → Hamburg → Rotterdam",
      ship: "MS Ocean Explorer",
      captain: "Capitaine Dubois",
      departure: "2024-07-20",
      arrival: "2024-07-28",
      progress: 65,
      currentPort: "En mer Méditerranée",
      cargo: 847,
      capacity: 1200,
      crew: 24,
      fuelLevel: 78
    },
    {
      id: "VOY-2024-002",
      route: "Le Havre → Bremen → Antwerp",
      ship: "MS Atlantic Star",
      captain: "Capitaine Martin",
      departure: "2024-07-22",
      arrival: "2024-07-26",
      progress: 45,
      currentPort: "Le Havre",
      cargo: 923,
      capacity: 1500,
      crew: 28,
      fuelLevel: 92
    }
  ]

  const upcomingVoyages = [
    {
      id: "VOY-2024-003",
      route: "Barcelona → Genova → Valencia",
      ship: "MS Mediterranean",
      departure: "2024-07-25",
      estimatedDuration: "5 jours",
      cargoBooked: 654,
      status: "Planifié"
    },
    {
      id: "VOY-2024-004",
      route: "Amsterdam → Copenhagen → Göteborg",
      ship: "MS Nordic Wind",
      departure: "2024-07-27",
      estimatedDuration: "4 jours",
      cargoBooked: 789,
      status: "En préparation"
    }
  ]

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1>Planification des Voyages FOOOOO</h1>
          <p className="text-muted-foreground">Gérez et suivez tous vos voyages maritimes</p>
        </div>
        <Button className="gap-2">
          <Plus className="h-4 w-4" />
          Planifier Voyage
        </Button>
      </div>

      {/* Active Voyages */}
      <div>
        <h2 className="mb-4">Voyages Actifs</h2>
        <div className="grid gap-6">
          {activeVoyages.map((voyage) => (
            <Card key={voyage.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary text-primary-foreground rounded-full">
                      <Ship className="h-4 w-4" />
                    </div>
                    <div>
                      <CardTitle>{voyage.id}</CardTitle>
                      <p className="text-sm text-muted-foreground">{voyage.route}</p>
                    </div>
                  </div>
                  <Badge variant="default">En cours</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Ship className="h-4 w-4 text-muted-foreground" />
                      <span>{voyage.ship}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span>{voyage.captain}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <span>{voyage.currentPort}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span>Départ: {voyage.departure}</span>
                    </div>
                    <div className="flex items-center gap-2 text-sm">
                      <Clock className="h-4 w-4 text-muted-foreground" />
                      <span>Arrivée: {voyage.arrival}</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div>
                      <div className="flex justify-between text-sm mb-1">
                        <span>Progression</span>
                        <span>{voyage.progress}%</span>
                      </div>
                      <Progress value={voyage.progress} />
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-medium">{voyage.cargo}/{voyage.capacity}</div>
                        <div className="text-muted-foreground">TEU</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{voyage.crew}</div>
                        <div className="text-muted-foreground">Équipage</div>
                      </div>
                      <div className="text-center">
                        <div className="font-medium">{voyage.fuelLevel}%</div>
                        <div className="text-muted-foreground">Carburant</div>
                      </div>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Upcoming Voyages */}
      <div>
        <h2 className="mb-4">Voyages Prochains</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {upcomingVoyages.map((voyage) => (
            <Card key={voyage.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{voyage.id}</CardTitle>
                  <Badge variant="secondary">{voyage.status}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{voyage.route}</p>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2 text-sm">
                  <Ship className="h-4 w-4 text-muted-foreground" />
                  <span>{voyage.ship}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span>Départ: {voyage.departure}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <span>Durée: {voyage.estimatedDuration}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Package className="h-4 w-4 text-muted-foreground" />
                  <span>Cargaison réservée: {voyage.cargoBooked} TEU</span>
                </div>
                <div className="pt-2">
                  <Button variant="outline" className="w-full">
                    Voir détails
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}

export default VoyagePlanning;