import { createSlice, PayloadAction } from "@reduxjs/toolkit";
import { Role, Permission } from "../../data/type";

type RoleState = {
  list: Role[]; 
  permissions: Record<string, Permission[]>; 
};

const loadPermissionsFromStorage = (): Record<string, Permission[]> => {
  try {
    const stored = localStorage.getItem("rolePermissions");
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
};

const loadRolesFromStorage = (): Role[] => {
    const stored = localStorage.getItem("roleList");
    return stored ? JSON.parse(stored) : [...defaultRoles];
};

const defaultRoles: Role[] = [
  "Propriétaire",
  "Gestionnaire",
  "Capitaine",
  "Agent",
];

const initialState: RoleState = {
  list: loadRolesFromStorage(),
  permissions: {
    Propriétaire: [
      "dashboard:read",
      "merchandise:manage",
      "caisse:manage",
      "boat:manage",
      "trajets:manage",
      "users:manage",
      "profile:read",
    ],
    Gestionnaire: [
      "merchandise:manage",
      "caisse:manage",
      "boat:manage",
      "trajets:manage",
      "users:manage",
      "profile:read",
    ],
    Capitaine: [
      "merchandise:manage",
      "trajets:manage",
      "profile:read",
      "fueldManage:manage"
    ],
    Agent: ["merchandise:manage", "profile:read"],
    // fusionner avec les rôles personnalisés du storage (si déjà ajoutés avant)
    ...loadPermissionsFromStorage(),
  },
};

const rolesSlice = createSlice({
  name: "roles",
  initialState,
  reducers: {
    addRole: (state, action: PayloadAction<Role>) => {
      if (!state.list.includes(action.payload)) {
        state.list.push(action.payload);
        state.permissions[action.payload] = [];
        localStorage.setItem(
          "rolePermissions",
          JSON.stringify(state.permissions)
        );
      }
    },
    addRoleWithPermissions: (
      state,
      action: PayloadAction<{ role: Role; permissions: Permission[] }>
    ) => {
      if (!state.list.includes(action.payload.role)) {
        state.list.push(action.payload.role);
      }
      state.permissions[action.payload.role] = Array.from(
        new Set([...action.payload.permissions, "profile:read"])
      );
      localStorage.setItem(
        "rolePermissions",
        JSON.stringify(state.permissions)
      );
      localStorage.setItem("roleList", JSON.stringify(state.list));
    },
    updateRolePermissions: (
      state,
      action: PayloadAction<{ role: Role; permissions: Permission[] }>
    ) => {
      if (defaultRoles.includes(action.payload.role)) {
        // Ne pas modifier les rôles par défaut
        return;
      }
      state.permissions[action.payload.role] = Array.from(
        new Set([...action.payload.permissions, "profile:read"])
      );
      localStorage.setItem(
        "rolePermissions",
        JSON.stringify(state.permissions)
      );
    },
    removeRole: (state, action: PayloadAction<Role>) => {
      if (defaultRoles.includes(action.payload)) {
        // Ne pas supprimer les rôles par défaut
        return;
      }
      state.list = state.list.filter((r) => r !== action.payload);
      delete state.permissions[action.payload];
      localStorage.setItem(
        "rolePermissions",
        JSON.stringify(state.permissions)
      );
    },
  },
});

export const {
  addRole,
  addRoleWithPermissions,
  updateRolePermissions,
  removeRole,
} = rolesSlice.actions;
export default rolesSlice.reducer;
