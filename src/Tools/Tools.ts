import {
  boatVoid,
  goodVoid,
  reservationVoid as reservationVoids,
  tripVoid,
  userVoid,
} from "../data/dataVoid";
import { Boat, CashMovement, Goods, Reservation, Trip, User } from "../data/type";
import {
  parseISO,
  format,
  getISOWeek,
  getMonth,
  getQuarter,
  getYear,
} from "date-fns";
import { fr } from "date-fns/locale";

const reservationVoid = reservationVoids;

export const findUser = (idUser: string, allUser: User[]) => {
  const user = allUser.find((u) => u.id === idUser);
  return user ? user : userVoid;
};

export const findReservation = (
  idReservation: string,
  allReservation: Reservation[]
) => {
  const reservation = allReservation.find((r) => r.id === idReservation);
  return reservation ? reservation : reservationVoid;
};

export const findTrip = (tripId: string, allTripe: Trip[]) => {
  const trip = allTripe.find((trip) => trip.id === tripId);
  return trip ? trip : tripVoid;
};
//Internationnale
// export const formatCurrency = (amount: number) => {
//   return new Intl.NumberFormat("fr-FR", {
//     style: "currency",
//     currency: "MGA",
//     minimumFractionDigits: 0,
//   }).format(amount);
// };
export const formatCurrency = (amount: number) => {
  return (
    new Intl.NumberFormat("fr-FR", {
      minimumFractionDigits: 0,
    }).format(amount) + " Ar"
  );
};

export const formatCityName = (name: string): string => {
  if (!name) return "";
  const firstLetter = name.charAt(0).toUpperCase();
  const lastPart = name.slice(-2).toLowerCase();
  return `${firstLetter}/${lastPart}`;
};
export const formatDate = (date: string) => {
  if (!date) return "";
  const dateR = new Date(date).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return dateR;
};
export const findBoat = (idBoat: string, allBoat: Boat[]) => {
  const boat = allBoat.find(({ id }) => id === idBoat);
  return boat ? boat : boatVoid;
};
export const findGoods = (idGoods : string , allGoods : Goods[])=>{
  const good = allGoods.find(({id})=> id === idGoods);
  return good ? good : goodVoid
} 
// Pour le data du dashBoard
export const generateRevenueDataSets = (cashMouvement: CashMovement[]) => {
  // Helper pour parser les dates
  const parseDate = (d: string) => parseISO(d);

  // Agrégateur générique
  const aggregateBy = (
    getKey: (date: Date) => string,
    formatDate: (date: Date) => string
  ) => {
    const map = new Map<string, { revenus: number; date: string }>();

    cashMouvement.forEach((cm) => {
      const d = parseDate(cm.date);
      const key = getKey(d);
      const display = formatDate(d);
      const revenus = (cm.credit || 0) - (cm.debit || 0);

      if (!map.has(key)) {
        map.set(key, { revenus: 0, date: display });
      }
      map.get(key)!.revenus += revenus / 1000; // en milliers pour être lisible
    });

    return Array.from(map, ([periode, { revenus, date }]) => ({
      periode,
      revenus: Number(revenus.toFixed(1)),
      date,
    }));
  };

  return {
    hebdomadaire: aggregateBy(
      (d) => "S" + getISOWeek(d),
      (d) => format(d, "dd MMM", { locale: fr })
    ),
    mensuelle: aggregateBy(
      (d) => format(d, "MMM", { locale: fr }),
      (d) => format(d, "MMMM yyyy", { locale: fr })
    ),
    trimestrielle: aggregateBy(
      (d) => "T" + getQuarter(d) + " " + getYear(d),
      (d) => {
        const q = getQuarter(d);
        const y = getYear(d);
        const labels = ["Jan-Mar", "Avr-Juin", "Juil-Sep", "Oct-Déc"];
        return `${labels[q - 1]} ${y}`;
      }
    ),
    semestrielle: aggregateBy(
      (d) => (getMonth(d) < 6 ? "S1" : "S2") + " " + getYear(d),
      (d) => (getMonth(d) < 6 ? "Jan-Juin" : "Juil-Déc") + " " + getYear(d)
    ),
    annuelle: aggregateBy(
      (d) => getYear(d).toString(),
      (d) => "Année " + getYear(d)
    ),
  };
};

export const formatHour = (date: string): string => {
  return new Date(date).toLocaleTimeString("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
  });
};

export const getDuration = (start: string, end: string) => {
  const s = new Date(start);
  const e = new Date(end);
  const diffMs = Math.abs(e.getTime() - s.getTime()); // différence en ms

  const totalSeconds = Math.floor(diffMs / 1000);
  const heures = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const secondes = totalSeconds % 60;

  return `${heures.toString().padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${secondes.toString().padStart(2, "0")}`;
};
