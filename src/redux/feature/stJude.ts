import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import {
  Boat,
  CashMovement,
  FuelConsumption,
  Goods,
  Reservation,
  Trip,
} from "../../data/type";
interface StJudeState {
  goods: Goods[];
  reservation: Reservation[];
  trip: Trip[];
  boat: Boat[];
  cashMouvement: CashMovement[];
  fuelConsumption: FuelConsumption[];
}

const initialState: StJudeState = {
  goods: [],
  reservation: [],
  trip: [],
  boat: [],
  cashMouvement: [],
  fuelConsumption: [],
};

const stJudeSlice = createSlice({
  name: "stJude",
  initialState,
  reducers: {
    // Pour l'initialisation depuis la base de donnée
    setGoodsInStore(state, action: PayloadAction<Goods[]>) {
      state.goods = action.payload;
    },
    setReservationsInStore(state, action: PayloadAction<Reservation[]>) {
      state.reservation = action.payload;
    },
    setTripsInStore(state, action: PayloadAction<Trip[]>) {
      state.trip = action.payload;
    },
    setBoatsInStore(state, action: PayloadAction<Boat[]>) {
      state.boat = action.payload;
    },
    setCashMovementsInStore(state, action: PayloadAction<CashMovement[]>) {
      state.cashMouvement = action.payload;
    },
    setFuelConsumptionsInStore(
      state,
      action: PayloadAction<FuelConsumption[]>
    ) {
      state.fuelConsumption = action.payload;
    },

    // Pour les opérations CRUD
    setGoods(state, action: PayloadAction<Goods[]>) {
      state.goods.push(...action.payload);
    },
    upDateGood(state, action: PayloadAction<Goods>) {
      const { id } = action.payload;
      const indexG = state.goods.findIndex((g) => g.id === id);
      if (indexG !== -1) {
        state.goods[indexG] = action.payload;
      }
    },
    deletGoods(state, action: PayloadAction<string>) {
      const idGoods = action.payload;
      state.goods = state.goods.filter(({ id }) => id !== idGoods);
    },
    setReservation(state, action: PayloadAction<Reservation>) {
      const { id } = action.payload;
      const indexR = state.reservation.findIndex((r) => r.id === id);

      if (indexR !== -1) {
        state.reservation[indexR] = action.payload;
      } else {
        state.reservation.push(action.payload);
      }
    },

    setTrip(state, action: PayloadAction<Trip>) {
      const { id } = action.payload;
      const indexT = state.trip.findIndex((t) => t.id === id);
      if (indexT !== -1) {
        state.trip[indexT] = action.payload;
        console.log("update trip", action.payload);
        // onUpdateService(TABLE_DATA_BASE.RESERVATION, action.payload);
      } else {
        state.trip.push(action.payload);
      }
    },
    setBoat(state, action: PayloadAction<Boat>) {
      const { id } = action.payload;
      const indexB = state.boat.findIndex((r) => r.id === id);
      if (indexB !== -1) {
        state.boat[indexB] = action.payload;
      } else {
        state.boat.push(action.payload);
      }
    },
    setCashMouvement(state, action: PayloadAction<CashMovement>) {
      const { id } = action.payload;
      const indexC = state.cashMouvement.findIndex((c) => c.id === id);
      if (indexC !== -1) {
        state.cashMouvement[indexC] = action.payload;
      } else {
        state.cashMouvement.push(action.payload);
      }
    },
    setFuelConsumption(state, action: PayloadAction<FuelConsumption>) {
      const { id } = action.payload;

      const indexF = state.fuelConsumption.findIndex((f) => f.id === id);
      if (indexF !== -1) {
        state.fuelConsumption[indexF] === action.payload;
      } else {
        state.fuelConsumption.push(action.payload);
      }
    },
  },
});

export const {
  setGoodsInStore,
  setReservationsInStore,
  setTripsInStore,
  setBoatsInStore,
  setCashMovementsInStore,
  setFuelConsumptionsInStore,
  setGoods,
  setReservation,
  setTrip,
  setBoat,
  setCashMouvement,
  setFuelConsumption,
  upDateGood,
  deletGoods,
} = stJudeSlice.actions;

export default stJudeSlice.reducer;
