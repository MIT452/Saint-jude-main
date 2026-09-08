import axios from "axios";
import { Boat, User, Goods, Reservation, Trip, CashMovement, FuelConsumption } from "./type";


const API = "https://saint-jude-back.onrender.com/api";


// CREATE
export const onAddService = async (
  nameAdd: string,
  params: Boat | User | Goods | Reservation | Trip | CashMovement | FuelConsumption
): Promise<"success" | "error"> => {
  try {
    const response = await axios.post(`${API}/${nameAdd.toLowerCase()}`, params);
    return response.status >= 200 && response.status < 300 ? "success" : "error";
  } catch (error) {
    console.error(error);
    return "error";
  }
};

// UPDATE
export const onUpdateService = async (
  nameUpdate: string,
  params: Boat | User | Goods | Reservation | Trip | CashMovement | FuelConsumption
): Promise<"success" | "error"> => {
  try {
    const response = await axios.put(`${API}/${nameUpdate.toLowerCase()}/${params.id}`, params);
    return response.status >= 200 && response.status < 300 ? "success" : "error";
  } catch (error) {
    console.log(error);
    return "error";
  }
};

// GET (all)
export const onGetService = async <T>(endPoint: string): Promise<T[]> => {
  try {
    const response = await axios.get<T[]>(`${API}/${endPoint.toLowerCase()}`);
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la requête GET", error);
    return [];
  }
};
// GET (one by id)
export const onGetByIdService = async <T>(endPoint: string, id: string): Promise<T | null> => {
  try {
    const response = await axios.get<T>(`${API}/${endPoint.toLowerCase()}/${id}`);
    return response.data;
  } catch (error) {
    console.error("Erreur lors de la requête GET by ID", error);
    return null;
  }
};

// DELETE
export const onDeleteService = async (nameDelete: string, id: string): Promise<"success" | "error"> => {
  try {
    const response = await axios.delete(`${API}/${nameDelete.toLowerCase()}/${id}`);
    return response.status >= 200 && response.status < 300 ? "success" : "error";
  } catch (error) {
    console.error(error);
    return "error";
  }
};
