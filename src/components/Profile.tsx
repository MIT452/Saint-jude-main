// src/components/Profile.tsx
import { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import type { RootState, AppDispatch } from "../redux";
import { updateOwnPassword } from "../redux/feature/users";
import { Card, CardHeader, CardTitle, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { InputField } from "./tools/InputField";
import { User } from "lucide-react";
import { toast } from "react-toastify";


const Profile = () => {
  const dispatch = useDispatch<AppDispatch>();
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const {error, success} = useSelector((state: RootState) => state.users);

  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  const handleChangePassword = async () => {
    if (!currentUser) return;
    if (!oldPassword.trim() || !newPassword.trim() || !confirmPassword.trim()) {
      toast("Veuillez remplir tous les champs.");
      return;
    } 
    if (newPassword.trim() !== confirmPassword.trim()) {
      toast("Le nouveau mot de passe et la confirmation ne correspondent pas.");
      return;
    }

    try {
      await dispatch(
        updateOwnPassword({
           userId: currentUser.id, 
           oldPassword: oldPassword.trim(), 
           newPassword: newPassword.trim(), 
        })
      ).unwrap();
      setOldPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("Mot de passe modifié avec succès.");
    } catch {
      toast("Échec de la modification du mot de passe.");
    }
  };

  if (!currentUser) {
    return <p>Veuillez vous connecter.</p>;
  }

  return (
    <div className="space-y-6">
      <div className="w-full min-h-[100px] sticky z-50 border-b-2 py-4 px-2 top-0 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-primary">Mon profil</h1>
          <p className="text-muted-foreground">
            Modifiez votre mot de passe pour protéger l’accès à votre compte
          </p>
        </div>
      </div>
      <div className="p-2">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-lg">
            <User className="h-5 w-5 mr-2" />
            Mon Profil
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <p><strong>Nom :</strong> {currentUser.name} {currentUser.lastName}</p>
          <p><strong>Email :</strong> {currentUser.email}</p>
          <p><strong>Rôle :</strong> {currentUser.role}</p>

          <div className="mt-6 space-y-4">
            <p><strong>Changer mon mot de passe</strong></p>
            <div className="flex flex-col gap-4">
              <InputField
                label="Ancien mot de passe"
                type="password"
                value={oldPassword}
                onChange={setOldPassword}
              />
              <InputField
                label="Nouveau mot de passe"
                type="password"
                value={newPassword}
                onChange={setNewPassword}
              />
              <InputField
                  label="Confirmer le nouveau mot de passe"
                  type="password"
                  value={confirmPassword}
                  onChange={setConfirmPassword}
                  error={
                    confirmPassword && confirmPassword !== newPassword
                      ? "Les mots de passe ne correspondent pas"
                      : undefined
                  }
              />
              <Button
                onClick={handleChangePassword}
                disabled={newPassword.trim().length < 4 || newPassword !== confirmPassword}
              >
                Modifier
              </Button>
            
              <p className="text-xs text-muted-foreground">
                Le mot de passe doit contenir au moins 4 caractères.
              </p>
            </div>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            {success && <p className="text-green-600 text-sm">{success}</p>}
          </div>
        </CardContent>
      </Card>
      </div>
    </div>
  );
};

export default Profile;
