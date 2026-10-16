import { useState, FC, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { CashMovement, Goods, Reservation } from "../data/type";
import { useDispatch, useSelector } from "react-redux";
import { deletGoods, setCashMouvement, setReservation, upDateGood } from "../redux/feature/stJude";
import { Input } from "./ui/input";
import Tables from "./tools/TableGoods";
import ConfirmDialog from "./ConfirmDialog";
import { RootState } from "../redux";
import { findBoat, formatCurrency } from "../Tools/Tools";
import { v4 as uuid } from "uuid";

// URL de l'API Express (à définir dans .env : VITE_API_URL=http://localhost:3000/api)
const API_URL: string = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://localhost:3000/api";

// Supprime une ressource dans la base (Neon) via l'API Express (cookies de session envoyés).
// Un 404 est accepté : la ligne n'existe déjà plus côté base.
const supprimerDansBase = async (chemin: string): Promise<void> => {
  const reponse = await fetch(`${API_URL}${chemin}`, { method: "DELETE", credentials: "include" });
  if (!reponse.ok && reponse.status !== 404) {
    let detail = "";
    try {
      const corps = (await reponse.json()) as { error?: string; message?: string };
      detail = corps.error ?? corps.message ?? "";
    } catch {
      // réponse sans JSON
    }
    throw new Error(`Suppression refusée par le serveur (${reponse.status})${detail ? ` : ${detail}` : ""}`);
  }
};

interface ReservationFormProps {
  onClose: () => void;
  currentReservation: Reservation;
  currentGoods: Goods[];
}

// Nom lisible d'une marchandise pour le message de confirmation
const libelleMarchandise = (good: Goods | null): string => {
  const record = good as unknown as Record<string, unknown> | null;
  for (const cle of ["name", "goodsName", "nom", "designation", "label", "libelle"]) {
    const valeur = record?.[cle];
    if (typeof valeur === "string" && valeur.trim()) return valeur.trim();
  }
  return "cette marchandise";
};

const UpdateGood: FC<ReservationFormProps> = ({ onClose, currentReservation, currentGoods }) => {
  const [cReservation, setCReservation] = useState<Reservation>(currentReservation);
  const [stateGoods, setStateGoods] = useState<Goods[]>(currentGoods);
  const [idGoodsDeleted, setIdGoodsDeleted] = useState<string[]>([]);
  // Marchandise en attente de confirmation de suppression
  const [aSupprimer, setASupprimer] = useState<Goods | null>(null);
  const [enCours, setEnCours] = useState(false);
  const [erreur, setErreur] = useState("");

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

  const onUpdate = async () => {
    if (enCours) return;
    setErreur("");

    // 1. Suppression dans la base AVANT de toucher au store :
    //    si le serveur refuse, rien ne change à l'écran et l'erreur est affichée.
    try {
      setEnCours(true);
      for (const idGoods of idGoodsDeleted) {
        await supprimerDansBase(`/goods/${idGoods}`);
      }
      // Dernière marchandise supprimée : on supprime aussi la réservation vide (et non plus seulement la cacher)
      if (stateGoods.length === 0 && idGoodsDeleted.length > 0) {
        await supprimerDansBase(`/reservations/${currentReservation.id}`);
      }
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur lors de la suppression.");
      setEnCours(false);
      return;
    }

    // 2. Mise à jour du store Redux (comme avant)
    for (const currentGood of stateGoods) {
      dispatch(upDateGood(currentGood));
    }
    for (const idGoods of idGoodsDeleted) {
      dispatch(deletGoods(idGoods));
    }

    // Totaux recalculés à partir des marchandises restantes (quantité, poids, prix)
    const total = stateGoods.reduce((acc, g) => acc + Number(g.totalPrice), 0);
    const quantite = stateGoods.reduce((acc, g) => acc + Number(g.quantity), 0);
    const poids = stateGoods.reduce((acc, g) => acc + Number(g.totalWeight), 0);
    const reservationBase: Reservation = {
      ...cReservation,
      totalPrice: total,
      amountToPay: Math.max(total - cReservation.amountPaid, 0),
      ...({ quantity: quantite, weight: poids } as unknown as Partial<Reservation>),
    };
    const currentCashMouvement = cashMouvement.find(({ id }) => cReservation.idCashMovement === id);
    if (currentCashMouvement) {
      const cashMouvementMaj: CashMovement = {
        ...currentCashMouvement,
        credit: cReservation.amountPaid,
        userId: currentUser ? currentUser.id : "",
        date: new Date().toISOString(),
      };
      const reservation: Reservation = reservationBase;
      dispatch(setCashMouvement(cashMouvementMaj));
      dispatch(setReservation(reservation));
    }
    // s'il n'a pas encore payé
    else {
      const cashMouvementNouveau: CashMovement = {
        id: uuid(),
        credit: cReservation.amountPaid,
        userId: currentUser ? currentUser.id : "",
        date: new Date().toISOString(),
        tripId: cReservation.tripId,
        designation: `Paiement du client ${cReservation.clientName}`,
        type: "credit",
        debit: 0,
      };
      const reservation: Reservation = {
        ...reservationBase,
        idCashMovement: cashMouvementNouveau.id,
      };
      dispatch(setReservation(reservation));
      dispatch(setCashMouvement(cashMouvementNouveau));
    }
    setEnCours(false);
    onClose();
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

  // Confirmation : la marchandise disparaît de la liste (enregistré au clic sur « Confirmer la modification »)
  const confirmerSuppression = () => {
    if (!aSupprimer) return;
    const idGoods = aSupprimer.id;
    setStateGoods((prev) => prev.filter(({ id }) => id !== idGoods));
    setIdGoodsDeleted((prev) => (prev.includes(idGoods) ? prev : [...prev, idGoods]));
    setASupprimer(null);
  };

  // Remet les marchandises supprimées (avant l'enregistrement)
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

  return (
    <div className="flex fixed items-center justify-center inset-0 flex-col p-2.5 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={enCours ? undefined : onClose}></div>
      <div className="z-50 w-[80%] space-y-6 overflow-auto bg-white p-6 rounded-lg max-h-[90vh]">
        {idGoodsDeleted.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-orange-200 bg-orange-50 px-4 py-2 text-sm text-orange-800">
            <span>
              {idGoodsDeleted.length} marchandise(s) supprimée(s). Cliquez sur « Confirmer la modification » pour
              enregistrer.
            </span>
            <Button size="sm" variant="outline" onClick={annulerSuppressions} disabled={enCours}>
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

          {erreur && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">{erreur}</p>
          )}

          {/* Confirmer */}
          <Button className="px-6 py-6 text-lg" onClick={onUpdate} disabled={enCours}>
            {enCours ? "Enregistrement..." : "Confirmer la modification"}
          </Button>
        </div>
      </div>

      <ConfirmDialog
        open={aSupprimer !== null}
        title="Supprimer la marchandise"
        message={`Voulez-vous vraiment supprimer « ${libelleMarchandise(aSupprimer)} » de la réservation de ${
          currentReservation.clientName
        } ?${
          stateGoods.length === 1
            ? " C'est la dernière marchandise : la réservation sera supprimée."
            : ""
        } La suppression sera enregistrée quand vous cliquerez sur « Confirmer la modification ».`}
        onCancel={() => setASupprimer(null)}
        onConfirm={confirmerSuppression}
      />
    </div>
  );
};

export default UpdateGood;