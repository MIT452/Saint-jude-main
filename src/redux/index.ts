import { configureStore } from "@reduxjs/toolkit";
import stJude from "./feature/stJude";
import users from "./feature/users"; 
import roles from "./feature/roles";
import { ThunkAction, Action } from "@reduxjs/toolkit";

export const store = configureStore({
  reducer: {
    stJude: stJude,
    users: users,
    roles: roles,
  },
});
export type AppThunk<ReturnType = void> = ThunkAction<
  ReturnType,
  RootState,
  unknown,
  Action<string>
>;
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

