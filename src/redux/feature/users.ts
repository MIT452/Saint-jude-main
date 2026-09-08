import { createSlice, PayloadAction, createAsyncThunk } from "@reduxjs/toolkit";
import { User } from "../../data/type";
import { v4 as uuid } from "uuid";

export interface usersState {
  allUser: User[];
  loading: boolean;
  error: string | null;
  success: string | null;
  currentUser: User | null;
}

// Fonction utilitaire pour charger et parser depuis localStorage
function loadFromLocalStorage<T>(key: string, fallback: T): T {
  const raw = localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.error(`Erreur de parsing localStorage clé="${key}"`, error);
    return fallback;
  }
}

// Sauvegarde auto dans localStorage
// const saveToLocalStorage = (state: usersState) => {
//   localStorage.setItem("users", JSON.stringify(state.allUser));
// };

// Charger depuis localStorage si dispo
// const storedList = localStorage.getItem("users");
// const initialState: usersState = {
//   currentUser: localStorage.getItem("currentUser")
//     ? JSON.parse(localStorage.getItem("currentUser") as string)
//     : null,
//   allUser: storedList
//     ? JSON.parse(storedList)
//     : [
// Initial State
const initialState: usersState = {
  currentUser: loadFromLocalStorage<User | null>("currentUser", null),
  allUser: loadFromLocalStorage<User[]>("users", [
        {
          id: "u1",
          name: "Jean",
          lastName: "Paul",
          password: "abcdef",
          email: "jean@example.com",
          tel: "0347654321",
          role: "Propriétaire",
        },
        {
          id: "u2",
          name: "Marie",
          lastName: "Dupont",
          password: "0000",
          email: "marie@example.com",
          tel: "0341234567",
          role: "Agent",
        },
        {
          id: "u4",
          name: "Nathan",
          lastName: "Jao",
          password: "0000",
          email: "nathan@example.com",
          tel: "0341234567",
          role: "Capitaine",
        },
        {
          id: "u3",
          name: "Maël",
          lastName: "Fix",
          password: "0000",
          email: "mael@example.com",
          tel: "0341234567",
          role: "Agent",
        },
      ]),
  loading: false,
  error: null,
  success: null,
};

// Sauvegarde automatique dans localStorage (middleware possible)
const saveToLocalStorage = (state: usersState) => {
  try {
    localStorage.setItem("users", JSON.stringify(state.allUser));
    if (state.currentUser) {
      localStorage.setItem("currentUser", JSON.stringify(state.currentUser));
    } else {
      localStorage.removeItem("currentUser");
    }
  } catch (error) {
    console.error("Erreur lors de la sauvegarde dans localStorage", error);
  }
};

// Thunks simulant le backend
export const fetchPersonnels = createAsyncThunk<User[]>(
  "users/fetchPersonnels",
  async () => {
    return new Promise<User[]>((resolve) =>
      setTimeout(() => resolve(initialState.allUser), 500)
    );
  }
);

export const addPersonnel = createAsyncThunk<
  User,
  Omit<User, "id" | "password">
>("users/addPersonnel", async (newUser) => {
  return new Promise<User>((resolve) =>
    setTimeout(
      () =>
        resolve({
          ...newUser,
          id: uuid(),
          password: "0000", // mot de passe par défaut
        }),
      500
    )
  );
});

export const updatePersonnel = createAsyncThunk<User, User>(
  "users/updatePersonnel",
  async (updatedUser) => {
    return new Promise<User>((resolve) =>
      setTimeout(() => resolve(updatedUser), 500)
    );
  }
);

export const deletePersonnel = createAsyncThunk<string, string>(
  "users/deletePersonnel",
  async (userId) => {
    return new Promise<string>((resolve) =>
      setTimeout(() => resolve(userId), 500)
    );
  }
);

export const updateOwnPassword = createAsyncThunk<
  { userId: string; newPassword: string },
  { userId: string; oldPassword: string; newPassword: string },
  { state: { users: usersState } }
>(
  "users/updateOwnPassword",
  async (
    { userId, oldPassword, newPassword },
    { getState, rejectWithValue }
  ) => {
    const state = getState().users;
    const user = state.allUser.find((u) => u.id === userId);

    if (!user) {
      return rejectWithValue("Utilisateur introuvable");
    }

    if (user.password !== oldPassword) {
      return rejectWithValue("Ancien mot de passe incorrect");
    }

    return { userId, newPassword };
  }
);

const usersSlice = createSlice({
  name: "users",
  initialState,
  reducers: {
    clearMessages: (state) => {
      state.error = null;
      state.success = null;
    },
    setCurrentUser(state, action: PayloadAction<User>) {
      state.currentUser = action.payload;
    },
    logout(state) {
      state.currentUser = null;
      localStorage.removeItem("currentUser");
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPersonnels.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(
        fetchPersonnels.fulfilled,
        (state, action: PayloadAction<User[]>) => {
          state.allUser = action.payload;
          state.loading = false;
        }
      )
      .addCase(fetchPersonnels.rejected, (state, action) => {
        state.loading = false;
        state.error = action.error.message || "Erreur de chargement";
      })

      .addCase(addPersonnel.fulfilled, (state, action: PayloadAction<User>) => {
        state.allUser.push(action.payload); // déjà avec password: "0000"
        saveToLocalStorage(state);
      })

      .addCase(
        updatePersonnel.fulfilled,
        (state, action: PayloadAction<User>) => {
          const idx = state.allUser.findIndex(
            (u) => u.id === action.payload.id
          );
          if (idx !== -1) {
            // garder l’ancien mot de passe
            const oldPassword = state.allUser[idx].password;
            state.allUser[idx] = {
              ...action.payload,
              password: oldPassword,
            };
            saveToLocalStorage(state);
          }
        }
      )

      .addCase(
        deletePersonnel.fulfilled,
        (state, action: PayloadAction<string>) => {
          state.allUser = state.allUser.filter((u) => u.id !== action.payload);
          saveToLocalStorage(state);
        }
      )

      .addCase(updateOwnPassword.fulfilled, (state, action) => {
        const user = state.allUser.find((u) => u.id === action.payload.userId);
        if (user) {
          user.password = action.payload.newPassword;
          state.success = "Mot de passe changé avec succès.";
          saveToLocalStorage(state);
        }
      })
      .addCase(updateOwnPassword.rejected, (state, action) => {
        state.error = action.payload as string;
      });
  },
});

export const { setCurrentUser, logout } = usersSlice.actions;
export default usersSlice.reducer;
