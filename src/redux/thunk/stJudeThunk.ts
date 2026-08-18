import { createCrudThunks } from "./helperThunk";
import { Goods, Reservation, Trip, Boat, CashMovement, FuelConsumption } from "../../data/type";

export const goodsThunks = createCrudThunks<Goods>("GOODS");
export const reservationThunks = createCrudThunks<Reservation>("RESERVATION");
export const tripThunks = createCrudThunks<Trip>("TRIP");
export const boatThunks = createCrudThunks<Boat>("BOAT");
export const cashMovementThunks = createCrudThunks<CashMovement>("CASHMOVEMENT");
export const fuelConsumptionThunks = createCrudThunks<FuelConsumption>("FUELCONSUMPTION");
