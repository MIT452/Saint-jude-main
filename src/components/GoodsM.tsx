import { useState, FC, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { CashMovement, Goods, Reservation, TABLE_DATA_BASE } from "../data/type";
import { useDispatch, useSelector } from "react-redux";
import { deletGoods, setCashMouvement, setReservation, upDateGood } from "../redux/feature/stJude";
import { Input } from "./ui/input";
import Tables from "./tools/TableGoods";
import { RootState } from "../redux";
import { findBoat, formatCurrency } from "../Tools/Tools";
import { v4 as uuid } from "uuid";
import { toast } from "react-toastify";
import { onUpdateService } from "../data/service";

interface ReservationFormProps {
  onClose: () => void;
  currentReservation: Reservation;
  currentGoods: Goods[];
}

const UpdateGood: FC<ReservationFormProps> = ({ onClose, currentReservation, currentGoods }) => {
  const [cReservation, setCReservation] = useState<Reservation>(currentReservation);
  const [stateGoods, setStateGoods] = useState<Goods[]>(currentGoods);
  const [idGoodsDeleted, setIdGoodsDeleted] = useState<string[]>([]);

  useEffect(() => { setStateGoods(stateGoods) }, [currentGoods])

  const dispatch = useDispatch();
  const { boat: allBoat, cashMouvement, trip } = useSelector((state: RootState) => state.stJude);
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const curretTripe = trip.find(({ id }) => id === currentReservation.tripId)

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
  if (!cReservation || stateGoods.length === 0) {
    toast.error("Aucune donnée à mettre à jour.");
    return;
  }

  // Mettre à jour tous les goods
  const goodsPromises = stateGoods.map(good =>
    onUpdateService(TABLE_DATA_BASE.GOODS, good)
  );

  // Supprimer les goods supprimés
  const deleteGoodsPromises = idGoodsDeleted.map(id =>
    onUpdateService(TABLE_DATA_BASE.GOODS, { id } as Goods) // on envoie juste l'id pour delete
  );

  // Mettre à jour la réservation
  const totalPrice = stateGoods.reduce((acc, g) => acc + Number(g.totalPrice), 0);
  const updatedReservation: Reservation = {
    ...cReservation,
    totalPrice,
    amountToPay: totalPrice - cReservation.amountPaid,
  };

  const reservationPromise = onUpdateService(TABLE_DATA_BASE.RESERVATION, updatedReservation);

  // Gérer le cash movement
  let cashMovementPromise: Promise<"success" | "error"> | null = null;
  let currentCashMouvement = cashMouvement.find(({ id }) => cReservation.idCashMovement === id);

  if (currentCashMouvement) {
    const updatedCashMouvement: CashMovement = {
      ...currentCashMouvement,
      credit: cReservation.amountPaid,
      userId: currentUser ? currentUser.id : '',
      date: new Date().toISOString(),
    };
    cashMovementPromise = onUpdateService(TABLE_DATA_BASE.CASHMOVEMENT, updatedCashMouvement);
  } else {
    const newCashMouvement: CashMovement = {
      id: uuid(),
      credit: cReservation.amountPaid,
      userId: currentUser ? currentUser.id : '',
      date: new Date().toISOString(),
      tripId: cReservation.tripId,
      designation: `Paiement du client ${cReservation.clientName}`,
      type: 'credit',
      debit: 0,
    };
    updatedReservation.idCashMovement = newCashMouvement.id;
    cashMovementPromise = onUpdateService(TABLE_DATA_BASE.CASHMOVEMENT, newCashMouvement);
  }

  // Tous les appels à l'API
  const allPromises = [...goodsPromises, ...deleteGoodsPromises, reservationPromise, cashMovementPromise!];

  const results = await Promise.all(allPromises);

  if (results.every(r => r === "success")) {
    // Mise à jour du store local
    stateGoods.forEach(good => dispatch(upDateGood(good)));
    idGoodsDeleted.forEach(id => dispatch(deletGoods(id)));
    dispatch(setReservation(updatedReservation));
    if (currentCashMouvement) {
      dispatch(setCashMouvement({ ...currentCashMouvement, credit: cReservation.amountPaid }));
    } else {
      dispatch(setCashMouvement({
        id: updatedReservation.idCashMovement!,
        credit: cReservation.amountPaid,
        userId: currentUser ? currentUser.id : '',
        date: new Date().toISOString(),
        tripId: cReservation.tripId,
        designation: `Paiement du client ${cReservation.clientName}`,
        type: 'credit',
        debit: 0,
      }));
    }

    toast.success("Mise à jour réussie !");
    onClose();
  } else {
    toast.error("Une erreur est survenue lors de la mise à jour.");
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
  const onDeleteGoods = (idGoods: string) => {
    setStateGoods((prev) => prev.filter(({ id }) => id !== idGoods))
    setIdGoodsDeleted([...idGoodsDeleted, idGoods]);
  }
  useEffect(() => {
    setCReservation({
      ...cReservation,
      totalPrice: stateGoods.reduce((acc, g) => acc + Number(g.totalPrice), 0),
      amountToPay: stateGoods.reduce((acc, g) => acc + Number(g.totalPrice), 0) - cReservation.amountPaid,
    })
  }, [stateGoods])
  return (
    <div className="flex fixed items-center justify-center inset-0 flex-col p-2.5 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={onClose}></div>
      <div className="z-50 w-[80%] space-y-6 overflow-auto bg-white p-6 rounded-lg max-h-[90vh]">
        <div className="overflow-x-auto">
          <Tables currentGoods={stateGoods} reservationClient={currentReservation.clientName} onUpdateGood={handleUpdateGood} onDeleteGoods={onDeleteGoods} />
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
                  {currentUser && currentUser.role !== "Capitaine" && <Button onClick={payTotal} className="w-fit">Payer la totalité</Button>}
                </div>
                {currentUser && currentUser.role !== "Capitaine" &&
                  <div className="flex items-center gap-2">
                    <Label className="whitespace-nowrap">Montant payé :</Label>
                    <Input
                      type="number"
                      value={cReservation.amountPaid || ""}
                      onChange={(e) => handleInput("amountPaid", e.target.value)}
                      className="w-40"
                    />
                  </div>}

                <div className="text-sm text-muted-foreground">
                  {cReservation.amountPaid <= cReservation.totalPrice ? (
                    <span className="text-green-600">
                      Montant restant :{" "}{formatCurrency(cReservation.totalPrice - cReservation.amountPaid)}
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
                      {curretTripe && `${curretTripe.from} → ${curretTripe.to} ( ${new Date(curretTripe.depart).toLocaleString('fr-FR', {
                        day: "2-digit",
                        month: "short",
                        year: "numeric",
                      })} )`}</span>
                    <span>avec {findBoat(curretTripe?.boatId as string, allBoat).name}</span>
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
          <Button className="px-6 py-6 text-lg" onClick={onUpdate}>Confirmer la modification</Button>
        </div>
      </div>
    </div>
  );
};

export default UpdateGood;
