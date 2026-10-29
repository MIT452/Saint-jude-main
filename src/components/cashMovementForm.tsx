import { FC, FormEvent, useState } from "react";
import { CashMovement, TABLE_DATA_BASE } from "../data/type";
import { cashMouvementVoid } from "../data/dataVoid";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "./ui/select";
import { Input } from "./ui/input";
import { v4 as uuid } from "uuid";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../redux";
import { Card } from "./ui/card";
import { setCashMouvement } from "../redux/feature/stJude";
import { onAddService } from "../data/service";
import { toast } from "react-toastify";
import {
  ArrowLeftRight,
  FileText,
  DollarSign,
  Ship,
  X,
  Plus,
  Coins,
  Info,
} from "lucide-react";

interface PropsCashForm {
  onClose: () => void;
}

const CashMouvementForm: FC<PropsCashForm> = ({ onClose }) => {
  const [cashMouvement, setCurrentCashMouvement] =
    useState<CashMovement>(cashMouvementVoid);

  const dispatch = useDispatch();
  const currentUser = useSelector(
    (state: RootState) => state.users.currentUser
  );
  const trips = useSelector((state: RootState) => state.stJude.trip);

  const onAdd = async (e: FormEvent) => {
    e.preventDefault();

    if (!cashMouvement.type) {
      toast.error("Veuillez sélectionner le type de mouvement.");
      return;
    }
    if (!cashMouvement.designation?.trim()) {
      toast.error("Veuillez saisir une désignation.");
      return;
    }
    if (
      (cashMouvement.type === "debit" && !cashMouvement.debit) ||
      (cashMouvement.type === "credit" && !cashMouvement.credit)
    ) {
      toast.error("Veuillez saisir un montant valide.");
      return;
    }
    if (!cashMouvement.tripId) {
      toast.error("Veuillez sélectionner un voyage.");
      return;
    }

    const finalCashMouvement: CashMovement = {
      ...cashMouvement,
      id: uuid(),
      date: new Date().toISOString(),
      userId: currentUser?.id ? currentUser.id : "",
      debit: cashMouvement.type === "debit" ? cashMouvement.debit : 0,
      credit: cashMouvement.type === "credit" ? cashMouvement.credit : 0,
    };

    const responce = await onAddService(
      TABLE_DATA_BASE.CASHMOVEMENT,
      finalCashMouvement
    );

    if (responce === "success") {
      toast.success("Mouvement de caisse ajouté avec succès !");
      dispatch(setCashMouvement(finalCashMouvement));
      onClose();
    } else {
      toast.error("Erreur lors de l'ajout du mouvement de caisse.");
    }
  };

  const handleInput = (field: keyof CashMovement, value: string | number) => {
    setCurrentCashMouvement((prev) => ({ ...prev, [field]: value }));
  };

  const designationLength = cashMouvement.designation?.length || 0;

  return (
    <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
        onClick={onClose}
      />

      {/* Modal */}
      <Card className="relative z-50 w-full max-w-2xl bg-white rounded-2xl shadow-2xl border-0 overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between px-6 pt-6 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 text-blue-600">
              <Coins className="h-5 w-5" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-slate-800">
                Ajouter un mouvement financier
              </h2>
              <p className="mt-0.5 text-sm text-slate-500">
                Enregistrez un mouvement dans la caisse ou sur le compte lié à
                l'activité de SAINT-JUDE.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <form onSubmit={onAdd} className="px-6 pb-6 space-y-5">
          {/* Type de mouvement */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <ArrowLeftRight className="h-4 w-4 text-slate-500" />
              Type de mouvement <span className="text-red-500">*</span>
            </Label>
            <Select
              value={cashMouvement.type}
              onValueChange={(v) => handleInput("type", v)}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-blue-500/20">
                <SelectValue placeholder="Choisir..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="debit">
                  <span className="flex items-center gap-2">
                    <span className="text-red-500">↓</span> Débit
                  </span>
                </SelectItem>
                <SelectItem value="credit">
                  <span className="flex items-center gap-2">
                    <span className="text-green-500">↑</span> Crédit
                  </span>
                </SelectItem>
              </SelectContent>
            </Select>
            <p className="text-xs text-slate-500">
              Choisissez si ce mouvement est un débit (sortie) ou un crédit
              (entrée).
            </p>
          </div>

          {/* Désignation */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <FileText className="h-4 w-4 text-slate-500" />
              Désignation <span className="text-red-500">*</span>
            </Label>
            <div className="relative">
              <Input
                value={cashMouvement.designation || ""}
                onChange={(e) => handleInput("designation", e.target.value)}
                placeholder="Ex. : Carburant, Achat de marchandises, Frais de port..."
                maxLength={255}
                className="h-11 rounded-xl border-slate-200 bg-slate-50/50 pr-10 focus-visible:ring-2 focus-visible:ring-blue-500/20"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
                <FileText className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <p className="text-xs text-slate-500">
                Décrivez clairement la nature du mouvement financier.
              </p>
              <span className="text-xs text-slate-400">
                {designationLength}/255
              </span>
            </div>
          </div>

          {/* Montant */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <DollarSign className="h-4 w-4 text-slate-500" />
              {cashMouvement.type === "credit"
                ? "Montant Crédit"
                : "Montant Débit"}{" "}
              <span className="text-red-500">*</span>
            </Label>
            <div className="relative flex">
              <div className="flex items-center rounded-l-xl border border-r-0 border-slate-200 bg-slate-100 px-3 text-sm font-medium text-slate-600">
                Ar
              </div>
              <Input
                type="number"
                min={0}
                value={
                  cashMouvement.type === "credit"
                    ? cashMouvement.credit || ""
                    : cashMouvement.debit || ""
                }
                onChange={(e) =>
                  handleInput(
                    cashMouvement.type === "credit" ? "credit" : "debit",
                    Number(e.target.value)
                  )
                }
                placeholder="0"
                className="h-11 rounded-none rounded-r-xl border-slate-200 bg-slate-50/50 focus-visible:ring-2 focus-visible:ring-blue-500/20"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none">
                <Coins className="h-4 w-4" />
              </div>
            </div>
            <p className="text-xs text-slate-500">
              Saisissez le montant en Ariary (Ar).
            </p>
          </div>

          {/* Voyage */}
          <div className="space-y-1.5">
            <Label className="flex items-center gap-2 text-sm font-medium text-slate-700">
              <Ship className="h-4 w-4 text-slate-500" />
              En relation avec le voyage du{" "}
              <span className="text-red-500">*</span>
            </Label>
            <Select
              value={cashMouvement.tripId || ""}
              onValueChange={(v) => handleInput("tripId", v)}
            >
              <SelectTrigger className="h-11 rounded-xl border-slate-200 bg-slate-50/50 focus:ring-2 focus:ring-blue-500/20">
                <SelectValue placeholder="Sélectionnez un voyage" />
              </SelectTrigger>
              <SelectContent>
                {trips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {`${trip.from} → ${trip.to} (${new Date(
                      trip.depart
                    ).toLocaleString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })})`}
                  </SelectItem>
                ))}
                <SelectItem value="a">Aucun</SelectItem>
              </SelectContent>
            </Select>
            <div className="flex items-start gap-2 rounded-lg bg-blue-50 px-3 py-2.5 text-sm text-blue-700">
              <Info className="mt-0.5 h-4 w-4 shrink-0" />
              <span>
                Associez ce mouvement à un voyage pour un meilleur suivi des
                coûts et des recettes.
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="h-10 rounded-xl px-5 border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              <X className="mr-1.5 h-4 w-4" />
              Annuler
            </Button>
            <Button
              type="submit"
              className="h-10 rounded-xl px-5 bg-blue-600 hover:bg-blue-700 text-white"
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Ajouter
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CashMouvementForm;