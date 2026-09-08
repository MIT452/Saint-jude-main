import { createAsyncThunk } from "@reduxjs/toolkit";
import { onAddService, onUpdateService, onDeleteService } from "../../data/service";
import { TABLE_DATA_BASE, Boat, User, Goods, Reservation, Trip, CashMovement, FuelConsumption } from "../../data/type";

type EntityType = Boat | User | Goods | Reservation | Trip | CashMovement | FuelConsumption;
type EntityName = keyof typeof TABLE_DATA_BASE;

export const createCrudThunks = <T extends EntityType>(entity: EntityName) => {
  // CREATE
  const add = createAsyncThunk<T | T[], T | T[], { rejectValue: string }>(
    `${entity}/add`,
    async (payload, { rejectWithValue }) => {
      const items = Array.isArray(payload) ? payload : [payload];
      const results: T[] = [];

      for (const item of items) {
        const res = await onAddService(TABLE_DATA_BASE[entity], item);
        if (res === "success") {
          results.push(item);
        } else {
          return rejectWithValue(`Erreur lors de l'ajout dans ${entity}`);
        }
      }

      return Array.isArray(payload) ? results : results[0];
    }
  );

  // UPDATE
  const update = createAsyncThunk<T, T, { rejectValue: string }>(
    `${entity}/update`,
    async (item, { rejectWithValue }) => {
      const res = await onUpdateService(TABLE_DATA_BASE[entity], item);
      if (res === "success") {
        return item;
      }
      return rejectWithValue(`Erreur lors de la mise à jour dans ${entity}`);
    }
  );

  // DELETE
  const remove = createAsyncThunk<string, string, { rejectValue: string }>(
    `${entity}/delete`,
    async (id, { rejectWithValue }) => {
      const res = await onDeleteService(TABLE_DATA_BASE[entity], id);
      if (res === "success") {
        return id;
      }
      return rejectWithValue(`Erreur lors de la suppression dans ${entity}`);
    }
  );

  return { add, update, remove };
};
