import React, { useEffect, useState } from "react";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "../redux/index";
import { InputField } from "./tools/InputField";
import { Label } from "./ui/label";
import {
  fetchPersonnels,
  addPersonnel,
  updatePersonnel,
  deletePersonnel,
} from "../redux/feature/users";
import { addRoleWithPermissions, removeRole } from "../redux/feature/roles";
import { updateRolePermissions } from "../redux/feature/roles";
import { permissionLabels } from "../data/type";
import { User, Permission } from "../data/type";
import { v4 as uuidv4 } from "uuid";
import { Input } from "./ui/input";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "./ui/select";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from "./ui/dialog";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "./ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/table';
import { Edit, Trash, Plus, Search, Filter, Users } from "lucide-react";

const allPermissions: Permission[] = [
  "dashboard:read",
  "merchandise:manage",
  "caisse:manage",
  "boat:manage",
  "trajets:manage",
  "users:manage",
  "profile:read",
  "fueldManage:manage",
];

const PersonnelManagement = () => {
  const dispatch = useDispatch<AppDispatch>();
  const { allUser: personnels, loading, error } = useSelector(
    (state: RootState) => state.users
  );
  const currentUser = useSelector(
    (state: RootState) => state.users.currentUser
  );

  const rolesState = useSelector((state: RootState) => state.roles);

  const [searchTerm, setSearchTerm] = useState("");
  const [filterRole, setFilterRole] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [editPersonnel, setEditPersonnel] = useState<User | null>(null);
  const [formData, setFormData] = useState<User>({
    id: uuidv4(),
    name: "",
    lastName: "",
    password: "",
    email: "",
    tel: "",
    role: "Agent",
  });

  // Modal pour ajouter un rôle personnalisé
  const [isAddingRole, setIsAddingRole] = useState(false);
  const [newRole, setNewRole] = useState("");
  const [selectedPermissions, setSelectedPermissions] = useState<Permission[]>([]);

  //Etat pour le modal de modification des permissions
  const [isEditingRole, setIsEditingRole] = useState(false);
  const [editingRole, setEditingRole] = useState<string>("");
  const [editingRolePermissions, setEditingRolePermissions] = useState<Permission[]>([]);

  useEffect(() => {
    dispatch(fetchPersonnels());
  }, [dispatch]);

  const filteredPersonnels = personnels.filter((personnel) => {
    const matchesSearch =
      personnel.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      personnel.lastName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      personnel.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole =
      filterRole === "all" || personnel.role === filterRole;
    return matchesSearch && matchesRole;
  });

  const statsData = [
    { name: "Total", value: personnels.length, color: "#2563eb" },
    { name: "Capitaines", value: personnels.filter(p => p.role === "Capitaine").length, color: "#3b82f6" },
    { name: "Gestionnaires", value: personnels.filter(p => p.role === "Gestionnaire").length, color: "#06b6d4" },
    { name: "Agents", value: personnels.filter(p => p.role === "Agent").length, color: "#6366f1" },
  ];

  const handleAdd = (user: User) => {
    dispatch(addPersonnel(user));
  };
  const handleUpdate = (user: User) => {
    dispatch(updatePersonnel(user));
  };
  const handleDelete = (id: string) => {
    dispatch(deletePersonnel(id));
  };

  const canEdit = currentUser && currentUser.role === "Propriétaire";

  const openAddForm = () => {
    setEditPersonnel(null);
    setFormData({
      id: uuidv4(),
      name: "",
      lastName: "",
      password: "",
      email: "",
      tel: "",
      role: "Agent",
    });
    setShowForm(true);
  };

  const openEditForm = (personnel: User) => {
    setEditPersonnel(personnel);
    setFormData(personnel);
    setShowForm(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (editPersonnel) {
      handleUpdate(formData);
    } else {
      handleAdd({ ...formData, id: uuidv4() });
    }
    setShowForm(false);
  };

  const togglePermission = (perm: Permission) => {
    setSelectedPermissions((prev) =>
      prev.includes(perm) ? prev.filter((p) => p !== perm) : [...prev, perm]
    );
  };

  const openEditRole = (role: string) => {
    setEditingRole(role);
    setEditingRolePermissions(rolesState.permissions[role] || []);
    setIsEditingRole(true);
  };

  const toggleEditPermission = (perm: Permission) => {
    setEditingRolePermissions(prev =>
      prev.includes(perm) ? prev.filter(p => p !== perm) : [...prev, perm]
    );
  };

  const handleSaveRolePermissions = () => {
    dispatch(updateRolePermissions({ role: editingRole, permissions: editingRolePermissions }));
    setIsEditingRole(false);
  };

  const defaultRoles = ["Propriétaire", "Gestionnaire", "Capitaine", "Agent"];

  return (
    <div className="space-y-6">
      <div className="w-full min-h-[100px] sticky z-50 border-b-2 py-4 px-2 top-0 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-primary">Gestion des personnels</h1>
          <p className="text-muted-foreground">
            Gérez tous les personnels, leurs rôles et accès à la plateforme
          </p>
        </div>
        {canEdit && (
          <Button variant="default" onClick={openAddForm}>
            <Plus className="h-4 w-4 mr-2" />Ajouter un personnel
          </Button>
        )}
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {statsData.map(stat => (
          <Card key={stat.name} className="border-border hover:shadow-md transition-shadow p-4 text-center">
            <CardHeader>
              <CardTitle style={{ color: stat.color }}>{stat.value}</CardTitle>
              <CardDescription>{stat.name}</CardDescription>
            </CardHeader>
          </Card>
        ))}
      </div>

      {/* Formulaire modal */}
      <Dialog open={showForm} onOpenChange={setShowForm}>
        <DialogContent>
          <form className="space-y-4" onSubmit={handleSubmit}>
            <DialogHeader>
              <DialogTitle>
                {editPersonnel ? "Modifier" : "Ajouter"} un personnel
              </DialogTitle>
            </DialogHeader>

            {/* Champ prénom */}
            <InputField
              label="Prénom"
              value={formData.name}
              onChange={(v) => setFormData({ ...formData, name: v })}
            />

            {/* Champ nom */}
            <InputField
              label="Nom"
              value={formData.lastName}
              onChange={(v) => setFormData({ ...formData, lastName: v })}
            />

            {/* Champ email */}
            <InputField
              label="Email"
              type="email"
              value={formData.email}
              onChange={(v) => setFormData({ ...formData, email: v })}
            />

            {/* Champ téléphone */}
            <InputField
              label="Téléphone"
              value={formData.tel}
              onChange={(v) => setFormData({ ...formData, tel: v })}
            />

            {/* Select rôle */}
            <div className="flex flex-col gap-1">
              <Label>Rôle</Label>
              <Select
                value={formData.role}
                onValueChange={(value) => {
                  if (value === "Autres") {
                    setIsAddingRole(true); // ouvre le champ pour ajouter
                  } else {
                    setFormData({ ...formData, role: value as User["role"] });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Rôle" />
                </SelectTrigger>
                <SelectContent>
                  {rolesState.list.map((r) => (
                    <div key={r} className="flex items-center justify-between">
                      <SelectItem value={r}>{r}</SelectItem>
                      <div className="flex gap-1">
                        {/* Bouton Edit */}
                        {!defaultRoles.includes(r) && canEdit && (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => openEditRole(r)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                        )}

                        {/* Bouton Delete */}
                        {!defaultRoles.includes(r) && canEdit && (
                          <Button
                            size="sm"
                            variant="destructive" // style rouge si tu utilises shadcn/ui
                            onClick={() => dispatch(removeRole(r))}
                          >
                            <Trash className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                    </div>
                  ))}
                  <SelectItem value="Autres">
                    <Plus className="h-4 w-4 mr-2" />Autres…
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Boutons */}
            <DialogFooter>
              <DialogClose asChild>
                <Button
                  variant="secondary"
                  type="button"
                  onClick={() => setShowForm(false)}
                >
                  Annuler
                </Button>
              </DialogClose>
              <Button type="submit">
                {editPersonnel ? "Enregistrer" : "Ajouter"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal d’ajout d’un nouveau rôle */}
      <Dialog open={isAddingRole} onOpenChange={setIsAddingRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ajouter un nouveau rôle</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <InputField
              label="Nom du nouveau rôle"
              value={newRole}
              onChange={(v) => setNewRole(v)}
            />
            <Label>Choisir les accès du rôle</Label>
            <div className="grid grid-cols-2 gap-2">
              {allPermissions.map((perm) => (
                <label key={perm} className="flex items-center gap-2 text-gray-800">
                  <input
                    type="checkbox"
                    checked={selectedPermissions.includes(perm) || perm === "profile:read"}
                    disabled={perm === "profile:read"}
                    onChange={() => togglePermission(perm)}
                  />
                  <span className={perm === "profile:read" ? "text-gray-500" : ""}>
                    {permissionLabels[perm] || perm}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button
              onClick={() => {
                if (newRole.trim() !== "") {
                  dispatch(
                    addRoleWithPermissions({
                      role: newRole,
                      permissions: selectedPermissions,
                    })
                  );
                  setFormData({ ...formData, role: newRole });
                  setNewRole("");
                  setSelectedPermissions([]);
                  setIsAddingRole(false);
                }
              }}
            >
              Valider
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal de modification des permissions d’un rôle */}
      <Dialog open={isEditingRole} onOpenChange={setIsEditingRole}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier les permissions du rôle {editingRole}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-2">
              {allPermissions.map((perm) => (
                <label key={perm} className="flex items-center gap-2 text-gray-800">
                  <input
                    type="checkbox"
                    checked={editingRolePermissions.includes(perm) || perm === "profile:read"}
                    disabled={perm === "profile:read"}
                    onChange={() => toggleEditPermission(perm)}
                  />
                  <span className={perm === "profile:read" ? "text-gray-500" : ""}>
                    {permissionLabels[perm] || perm}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button variant="secondary">Annuler</Button>
            </DialogClose>
            <Button onClick={handleSaveRolePermissions}>Enregistrer</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Onglets */}
      <div className="tabs space-y-4">
        <div className="tab-content space-y-4">
          <Card className="border-border hover:shadow-md transition-shadow mb-6">
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                {/* Champ recherche */}
                <div className="flex-1 relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Rechercher..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 w-full"
                  />
                </div>

                {/* Filtre rôle */}
                <div className="w-full md:w-48 relative">
                  <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 z-10" />
                  <Select value={filterRole} onValueChange={setFilterRole}>
                    <SelectTrigger className="pl-10">
                      <SelectValue placeholder="Tous les rôles" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les rôles</SelectItem>
                      {rolesState.list.map((r) => (
                        <SelectItem key={r} value={r}>
                          {r}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardContent>
          </Card>

          {loading && <div>Chargement...</div>}
          {error && <div className="text-red-500">{error}</div>}
          <Card className="border-border hover:shadow-md transition-shadow mt-4">
            <CardHeader>
              <CardTitle className="flex items-center text-[#001F3F]">
                <Users className="h-5 w-5 mr-2" />
                Liste des personnels ({filteredPersonnels.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="px-4 py-2">Nom</TableHead>
                      <TableHead className="px-4 py-2">Email</TableHead>
                      <TableHead className="px-4 py-2">Téléphone</TableHead>
                      <TableHead className="px-4 py-2">Rôle</TableHead>
                      {canEdit && <TableHead className="px-4 py-2 text-center">Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredPersonnels.map(personnel => (
                      <TableRow key={personnel.id} className="hover:bg-gray-50">
                        <TableCell className="px-4 py-2">{personnel.name} {personnel.lastName}</TableCell>
                        <TableCell className="px-4 py-2">{personnel.email}</TableCell>
                        <TableCell className="px-4 py-2">{personnel.tel}</TableCell>
                        <TableCell className="px-4 py-2">{personnel.role}</TableCell>
                        {canEdit && (
                          <TableCell className="px-4 py-2 text-center flex justify-center gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => openEditForm(personnel)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="destructive"
                              size="sm"
                              onClick={() => handleDelete(personnel.id)}
                            >
                              <Trash className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default PersonnelManagement;