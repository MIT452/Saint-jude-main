import { ActionReducerMapBuilder, Draft } from "@reduxjs/toolkit";

export function addCrudReducers<T extends { id: string }>(
  builder: ActionReducerMapBuilder<any>,
  thunks: { add: any; update: any; remove: any },
  key: keyof any
) {
  builder
    // CREATE
    .addCase(thunks.add.fulfilled, (state: Draft<any>, action: { payload: T | T[] }) => {
      const items = Array.isArray(action.payload) ? action.payload : [action.payload];
      state[key].push(...items);
    })
    // UPDATE
    .addCase(thunks.update.fulfilled, (state: Draft<any>, action: { payload: T }) => {
      const index = state[key].findIndex((item: T) => item.id === action.payload.id);
      if (index !== -1) state[key][index] = action.payload;
    })
    // DELETE
    .addCase(thunks.remove.fulfilled, (state: Draft<any>, action: { payload: string }) => {
      state[key] = state[key].filter((item: T) => item.id !== action.payload);
    });
}
