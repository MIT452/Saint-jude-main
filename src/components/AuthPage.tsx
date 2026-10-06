import React, { useState } from "react";
import { useDispatch } from "react-redux";
import { Label } from './ui/label';
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { Card, CardHeader, CardTitle, CardContent} from "./ui/card";
import { AppDispatch } from "../redux";

import { setCurrentUser } from "../redux/feature/users";
import { Lock, Ship, Eye, EyeOff, Mail, Phone } from "lucide-react";
import { loginUser, registerUser } from "../data/service";

const AuthPage = () => {
  const dispatch = useDispatch<AppDispatch>();
  const [isRegistering, setIsRegistering] = useState(false);
  const [name, setName] = useState("");
  const [lastName, setLastName] = useState("");
  const [tel, setTel] = useState("");
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    if (isRegistering && password !== confirmPassword) {
      setError("Les mots de passe ne correspondent pas.");
      return;
    }

    setIsSubmitting(true);
    try {
      const user = isRegistering
        ? await registerUser({ name, lastName, email: login, tel, password })
        : await loginUser({ email: login, password });
      dispatch(setCurrentUser(user));
    } catch (requestError) {
      const responseError = requestError as { response?: { data?: { error?: string } } };
      setError(responseError.response?.data?.error || "Connexion au serveur impossible. Vérifiez le backend et CORS.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-background">
      <Card className="w-full max-w-md p-6 shadow-lg border-1 border-primary bg-white/20 backdrop-blur-md">
        <CardHeader className="text-center space-y-4">
            <div className="flex justify-center">
              <div className="bg-blue-100 p-3 rounded-full">
                <Ship className="h-8 w-8 text-blue-600" />
              </div>
            </div>
            <div>
              <CardTitle className="text-2xl text-black mb-2">{isRegistering ? "Créer un compte Saint Jude" : "Bienvenue sur Saint Jude"}</CardTitle>
              <p className="text-sm text-slate-600 mt-1">Gestion du transport maritime de marchandises</p>
            </div>
          </CardHeader>
        <CardContent>
          <form className="space-y-5" onSubmit={handleSubmit}>
            <div className="space-y-4">
              {isRegistering && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="name" className="text-black">Prénom</Label>
                    <Input id="name" autoComplete="given-name" value={name} onChange={(e) => setName(e.target.value)} required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-black">Nom</Label>
                    <Input id="lastName" autoComplete="family-name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email" className="text-black">Adresse email</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder="nom@exemple.com"
                    value={login}
                    onChange={(e) => setLogin(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-[#001F3F] focus:ring-[#001F3F]"
                    required
                  />
                </div>
              </div>
              {isRegistering && (
                <div className="space-y-2">
                  <Label htmlFor="tel" className="text-black">Téléphone</Label>
                  <div className="relative">
                    <Phone className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input id="tel" type="tel" autoComplete="tel" value={tel} onChange={(e) => setTel(e.target.value)} className="pl-10" required />
                  </div>
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="password" className="text-black">Mot de passe</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Mot de passe"
                    autoComplete={isRegistering ? "new-password" : "current-password"}
                    minLength={isRegistering ? 8 : undefined}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-10 border-gray-300 focus:border-[#001F3F] focus:ring-[#001F3F]"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>
              {isRegistering && (
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword" className="text-black">Confirmer le mot de passe</Label>
                  <Input
                    id="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                  />
                </div>
              )}
            </div>
            {error && <div className="text-red-500 text-sm">{error}</div>}
              <Button type="submit" className="w-full" disabled={isSubmitting}>
                {isSubmitting ? "Veuillez patienter…" : isRegistering ? "Créer mon compte" : "Se connecter"}
              </Button>
          </form>
        </CardContent>
        <div className="px-6 pb-4 text-center text-sm">
          {isRegistering ? "Déjà inscrit ? " : "Pas encore de compte ? "}
          <button
            type="button"
            className="font-medium text-primary underline-offset-4 hover:underline"
            onClick={() => { setIsRegistering((value) => !value); setError(""); }}
          >
            {isRegistering ? "Se connecter" : "Créer un compte"}
          </button>
        </div>
        <div className="text-center text-xs text-gray-500">
              Saint Jude - Transport Maritime Antalaha ↔ Toamasina
        </div>
      </Card>
    </div>
  );
};

export default AuthPage;