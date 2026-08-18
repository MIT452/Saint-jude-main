import { TypedUseSelectorHook, useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "./index";

// Hook typé pour le dispatch
export const useAppDispatch: () => AppDispatch = useDispatch;

// Hook typé pour le selector
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;
