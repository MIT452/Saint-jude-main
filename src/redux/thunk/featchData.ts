import { AppThunk } from "../index";
import {
  TABLE_DATA_BASE,
  Boat,
  CashMovement,
  FuelConsumption,
  Goods,
  Reservation,
  Trip,
} from "../../data/type";
import { onGetService } from "../../data/service";
import {
  setBoatsInStore,
  setCashMovementsInStore,
  setFuelConsumptionsInStore,
  setGoodsInStore,
  setReservationsInStore,
  setTripsInStore,
} from "../feature/stJude";

export const fetchDatabase = (): AppThunk => async (dispatch) => {
  try {
    const [goods, reservations, trips, boats, cashMovements, fuelConsumptions] =
      await Promise.all([
        onGetService<Goods>(TABLE_DATA_BASE.GOODS),
        onGetService<Reservation>(TABLE_DATA_BASE.RESERVATION),
        onGetService<Trip>(TABLE_DATA_BASE.TRIP),
        onGetService<Boat>(TABLE_DATA_BASE.BOAT),
        onGetService<CashMovement>(TABLE_DATA_BASE.CASHMOVEMENT),
        onGetService<FuelConsumption>(TABLE_DATA_BASE.FUELCONSUMPTION),
      ]);

    dispatch(setGoodsInStore(goods));
    dispatch(setReservationsInStore(reservations));
    dispatch(setTripsInStore(trips));
    dispatch(setBoatsInStore(boats));
    dispatch(setCashMovementsInStore(cashMovements));
    dispatch(setFuelConsumptionsInStore(fuelConsumptions));
  } catch (error) {
    console.error("Erreur fetchDatabase:", error);
  }
};
