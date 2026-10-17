import { useState, FC, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { CashMovement, Goods, Reservation, TABLE_DATA_BASE } from "../data/type";
import { useDispatch, useSelector } from "react-redux";
import { deletGoods, setCashMouvement, setReservation, upDateGood } from "../redux/feature/stJude";
import { Input } from "./ui/input";
import Tables from "./tools/TableGoods";
import ConfirmDialog from "./ConfirmDialog";
import { RootState } from "../redux";
import { findBoat, formatCurrency } from "../Tools/Tools";
import { v4 as uuid } from "uuid";
import { toast } from "react-toastify";
import { onAddService, onDeleteService, onUpdateService } from "../data/service";

interface ReservationFormProps {
  onClose: () => void;
  currentReservation: Reservation;
  currentGoods: Goods[];
}

const UpdateGood: FC<ReservationFormProps> = ({ onClose, currentReservation, currentGoods }) => {
  const [cReservation, setCReservation] = useState<Reservation>(currentReservation);
  const [stateGoods, setStateGoods] = useState<Goods[]>(currentGoods);
  const [idGoodsDeleted, setIdGoodsDeleted] = useState<string[]>([]);
  // Marchandise en attente de confirmation de suppression
  const [aSupprimer, setASupprimer] = useState<Goods | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    setStateGoods(currentGoods);
    setIdGoodsDeleted([]);
  }, [currentGoods]);

  const dispatch = useDispatch();
  const { boat: allBoat, cashMouvement, trip } = useSelector((state: RootState) => state.stJude);
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const curretTripe = trip.find(({ id }) => id === currentReservation.tripId);
  const boatTrip = curretTripe ? findBoat(curretTripe.boatId as string, allBoat) : undefined;

  const handleInput = (field: keyof Reservation, value: string | number) => {
    if (field === "amountPaid") {
      const paid = Number(value);
      const rest = cReservation.totalPrice - paid;
      setCReservation((prev) => ({ ...prev, amountPaid: paid, amountToPay: rest >= 0 ? rest : 0, paymentStatus: paid >= prev.totalPrice }));
    } else {
      setCReservation((prev) => ({ ...prev, [field]: value }));
    }
  };

  const payTotal = () => {
    setCReservation((prev) => ({ ...prev, amountPaid: prev.totalPrice, amountToPay: 0, paymentStatus: true }));
  };

  /**
   * Enregistrement SÉQUENTIEL : chaque étape est vérifiée, et le message indique l'étape en échec.
   * 1) suppression des marchandises retirées (vrai appel DELETE)
   * 2) mise à jour des marchandises modifiées
   * 3) mise à jour de la réservation (totaux recalculés)
   * 4) mouvement de caisse (mis à jour, ou créé s'il n'existe pas encore et qu'un montant est payé)
   * Le store local n'est modifié qu'une fois le serveur à jour.
   */
  const onUpdate = async () => {
    if (isSaving) return;
    if (stateGoods.length === 0 && idGoodsDeleted.length === 0) {
      toast.error("Aucune donnée à mettre à jour.");
      return;
    }

    setIsSaving(true);
    try {
      // 1) Suppressions
      for (const id of idGoodsDeleted) {
        const result = await onDeleteService(TABLE_DATA_BASE.GOODS, id);
        if (result !== "success") {
          toast.error("Échec de la suppression d'une marchandise.");
          return;
        }
      }

      // 2) Marchandises modifiées seulement
      const modifiees = stateGoods.filter((good) => {
        const origine = currentGoods.find(({ id }) => id === good.id);
        return JSON.stringify(good) !== JSON.stringify(origine);
      });
      for (const good of modifiees) {
        const result = await onUpdateService(TABLE_DATA_BASE.GOODS, good);
        if (result !== "success") {
          toast.error("Échec de la mise à jour d'une marchandise.");
          return;
        }
      }

      // 3) Réservation : totaux recalculés d'après les marchandises restantes
      const totalPrice = stateGoods.reduce((acc, g) => acc + Number(g.totalPrice), 0);
      const quantity = stateGoods.reduce((acc, g) => acc + Number(g.quantity), 0);
      const weight = stateGoods.reduce((acc, g) => acc + Number(g.totalWeight), 0);
      const updatedReservation: Reservation = {
        ...cReservation,
        totalPrice,
        quantity,
        weight,
        amountToPay: Math.max(totalPrice - cReservation.amountPaid, 0),
        paymentStatus: totalPrice > 0 && cReservation.amountPaid >= totalPrice,
      };

      // 4) Caisse
      const existant = cashMouvement.find(({ id }) => cReservation.idCashMovement === id);
      let mouvement: CashMovement | null = null;
      if (existant) {
        mouvement = {
          ...existant,
          credit: cReservation.amountPaid,
          userId: currentUser ? currentUser.id : "",
          date: new Date().toISOString(),
        };
        const result = await onUpdateService(TABLE_DATA_BASE.CASHMOVEMENT, mouvement);
        if (result !== "success") {
          toast.error("Échec de la mise à jour du paiement (caisse).");
          return;
        }
      } else if (cReservation.amountPaid > 0) {
        // Pas encore de mouvement en base : on le CRÉE (et non « update »)
        mouvement = {
          id: cReservation.idCashMovement || uuid(),
          credit: cReservation.amountPaid,
          userId: currentUser ? currentUser.id : "",
          date: new Date().toISOString(),
          tripId: cReservation.tripId,
          designation: `Paiement du client ${cReservation.clientName}`,
          type: "credit",
          debit: 0,
        };
        const result = await onAddService(TABLE_DATA_BASE.CASHMOVEMENT, mouvement);
        if (result !== "success") {
          toast.error("Échec de l'enregistrement du paiement (caisse).");
          return;
        }
        updatedReservation.idCashMovement = mouvement.id;
      }

      const reservationResult = await onUpdateService(TABLE_DATA_BASE.RESERVATION, updatedReservation);
      if (reservationResult !== "success") {
        toast.error("Échec de la mise à jour de la réservation.");
        return;
      }

      // Tout est enregistré : mise à jour du store local
      modifiees.forEach((good) => dispatch(upDateGood(good)));
      idGoodsDeleted.forEach((id) => dispatch(deletGoods(id)));
      dispatch(setReservation(updatedReservation));
      if (mouvement) dispatch(setCashMouvement(mouvement));

      toast.success("Mise à jour réussie !");
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Une erreur est survenue lors de la mise à jour.");
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateGood = (updatedGood: Goods) => {
    setStateGoods((prevGoods) =>
      prevGoods.map((good) =>
        good.id === updatedGood.id
          ? {
              ...good,
              ...updatedGood,
              totalWeight: updatedGood.quantity * updatedGood.unitWeight,
              totalPrice: updatedGood.quantity * updatedGood.unitPrice,
            }
          : good
      )
    );
  };

  // Clic sur la corbeille : on demande d'abord confirmation
  const onDeleteGoods = (idGoods: string) => {
    const good = stateGoods.find(({ id }) => id === idGoods);
    if (good) setASupprimer(good);
  };

  // « Oui » : la marchandise disparaît de la liste ; elle sera supprimée du serveur à « Confirmer la modification »
  const confirmerSuppression = () => {
    if (!aSupprimer) return;
    const idGoods = aSupprimer.id;
    setStateGoods((prev) => prev.filter(({ id }) => id !== idGoods));
    setIdGoodsDeleted((prev) => (prev.includes(idGoods) ? prev : [...prev, idGoods]));
    setASupprimer(null);
  };

  // Remet les marchandises retirées (avant l'enregistrement)
  const annulerSuppressions = () => {
    setStateGoods((prev) => [...prev, ...currentGoods.filter(({ id }) => idGoodsDeleted.includes(id))]);
    setIdGoodsDeleted([]);
  };

  useEffect(() => {
    const total = stateGoods.reduce((acc, g) => acc + Number(g.totalPrice), 0);
    setCReservation((prev) => ({
      ...prev,
      totalPrice: total,
      amountToPay: Math.max(total - prev.amountPaid, 0),
    }));
  }, [stateGoods]);

  const nomASupprimer = (() => {
    const record = aSupprimer as unknown as Record<string, unknown> | null;
    for (const cle of ["itemName", "name", "goodsName", "designation"]) {
      const valeur = record?.[cle];
      if (typeof valeur === "string" && valeur.trim()) return valeur.trim();
    }
    return "cette marchandise";
  })();

  const messageSuppression =
    `Voulez-vous vraiment supprimer « ${nomASupprimer} » de la réservation de ${currentReservation.clientName} ?` +
    (stateGoods.length === 1
      ? " C'est la dernière marchandise : la réservation disparaîtra de la liste." +
        (cReservation.amountPaid > 0
          ? ` Le paiement de ${formatCurrency(cReservation.amountPaid)} reste enregistré en caisse.`
          : "")
      : "") +
    " La suppression est enregistrée quand vous cliquez sur « Confirmer la modification ».";

  return (
    <div className="flex fixed items-center justify-center inset-0 flex-col p-2.5 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
      <div className="z-50 w-[80%] space-y-6 overflow-auto bg-white p-6 rounded-lg max-h-[90vh]">
        {idGoodsDeleted.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-800">
            <span>
              {idGoodsDeleted.length} marchandise(s) à supprimer. Cliquez sur « Confirmer la modification » pour
              enregistrer.
            </span>
            <Button size="sm" variant="outline" onClick={annulerSuppressions}>
              Annuler la suppression
            </Button>
          </div>
        )}
        <div className="overflow-x-auto">
          <Tables
            currentGoods={stateGoods}
            reservationClient={currentReservation.clientName}
            onUpdateGood={handleUpdateGood}
            onDeleteGoods={onDeleteGoods}
          />
        </div>
        {/* Actions */}
        <div className="flex flex-col gap-4 mt-6">
          <div className="grid grid-cols-2 gap-3">
            {/* Paiement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Paiement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xl font-bold flex gap-6 items-center">
                  <span>Prix total : {formatCurrency(cReservation.totalPrice)}</span>
                  {currentUser && currentUser.role !== "Capitaine" && (
                    <Button onClick={payTotal} className="w-fit">
                      Payer la totalité
                    </Button>
                  )}
                </div>
                {currentUser && currentUser.role !== "Capitaine" && (
                  <div className="flex items-center gap-2">
                    <Label className="whitespace-nowrap">Montant payé :</Label>
                    <Input
                      type="number"
                      value={cReservation.amountPaid || ""}
                      onChange={(e) => handleInput("amountPaid", e.target.value)}
                      className="w-40"
                    />
                  </div>
                )}

                <div className="text-sm text-muted-foreground">
                  {cReservation.amountPaid <= cReservation.totalPrice ? (
                    <span className="text-green-600">
                      Montant restant : {formatCurrency(cReservation.totalPrice - cReservation.amountPaid)}
                    </span>
                  ) : (
                    <span className="text-red-600">Le montant saisi est supérieur</span>
                  )}
                </div>
              </CardContent>
            </Card>
            <Card className="border rounded-lg overflow-hidden">
              <CardHeader className="bg-primary px-4 py-2">
                <CardTitle className="text-lg font-bold text-white">Informations de la réservation</CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-4">
                {/* Voyage */}
                <div className="flex justify-between border-b pb-2">
                  <span className="font-semibold text-gray-700">Voyage :</span>
                  <div className="flex flex-col text-gray-600">
                    <span>
                      {curretTripe &&
                        `${curretTripe.from} → ${curretTripe.to} ( ${new Date(curretTripe.depart).toLocaleString("fr-FR", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })} )`}
                    </span>
                    {boatTrip && <span>avec {boatTrip.name}</span>}
                  </div>
                </div>

                {/* Poids */}
                <div className="flex justify-between border-b pb-2">
                  <span className="font-semibold text-gray-700">Poids total :</span>
                  <span className="text-gray-600">{currentReservation.weight} kg</span>
                </div>

                {/* Expéditeur */}
                <div className="border-b pb-2">
                  <span className="font-semibold text-gray-700">Expéditeur :</span>
                  <div className="ml-4 mt-1 space-y-1 text-gray-600">
                    <div>Nom : {currentReservation.clientName}</div>
                    <div>Adresse : {currentReservation.clientAdresse}</div>
                    <div>Téléphone : {currentReservation.clientTel}</div>
                  </div>
                </div>

                {/* Destinataire */}
                <div className="pb-2">
                  <span className="font-semibold text-gray-700">Destinataire :</span>
                  <div className="ml-4 mt-1 space-y-1 text-gray-600">
                    <div>Nom : {currentReservation.destName}</div>
                    <div>Adresse : {currentReservation.destAdresse}</div>
                    <div>Téléphone : {currentReservation.destTel}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Confirmer */}
          <Button className="px-6 py-6 text-lg" onClick={onUpdate} disabled={isSaving}>
            {isSaving ? "Enregistrement..." : "Confirmer la modification"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={aSupprimer !== null}
        title="Supprimer la marchandise"
        message={messageSuppression}
        confirmLabel="Oui, supprimer"
        cancelLabel="Non"
        onCancel={() => setASupprimer(null)}
        onConfirm={confirmerSuppression}
      />
    </div>
  );
};

export default UpdateGood;