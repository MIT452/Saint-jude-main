import { useState, FC, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { CashMovement, Goods, Reservation } from "../data/type";
import { useDispatch, useSelector } from "react-redux";
import { deletGoods, setCashMouvement, setReservation, upDateGood } from "../redux/feature/stJude";
import { Input } from "./ui/input";
import Tables from "./tools/TableGoods";
import { RootState } from "../redux";
import { findBoat, formatCurrency } from "../Tools/Tools";
import { v4 as uuid } from "uuid";

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

  const onUpdate = () => {
    for (const currentGood of stateGoods) {
      dispatch(upDateGood(currentGood));
    }
    if (idGoodsDeleted.length !== 0) {
      for (const idGoods of idGoodsDeleted) {
        dispatch(deletGoods(idGoods));
      }
    }
    dispatch(setReservation(cReservation));
    let currentCashMouvement = cashMouvement.find(({ id }) => cReservation.idCashMovement === id);
    if (currentCashMouvement) {
      let cashMouvement: CashMovement = {
        ...currentCashMouvement,
        credit: cReservation.amountPaid,
        userId: currentUser ? currentUser.id : '',
        date: new Date().toISOString(),
      }
      let reservation: Reservation = {
        ...cReservation,
        totalPrice: stateGoods.reduce((acc, g) => acc + Number(g.totalPrice), 0),
        amountToPay: stateGoods.reduce((acc, g) => acc + Number(g.totalPrice), 0) - cReservation.amountPaid,
      }
      dispatch(setCashMouvement(cashMouvement));
      dispatch(setReservation(reservation));
    }
    // si il n'a pas encore payer 
    else {
      let cashMouvement: CashMovement = {
        id: uuid(),
        credit: cReservation.amountPaid,
        userId: currentUser ? currentUser.id : '',
        date: new Date().toISOString(),
        tripId: cReservation.tripId,
        designation: `Paiement du client ${cReservation.clientName}`,
        type: 'credit',
        debit: 0,
      }
      let reservation: Reservation = {
        ...cReservation,
        idCashMovement: cashMouvement.id,
      }
      dispatch(setReservation(reservation));
      dispatch(setCashMouvement(cashMouvement));
    }
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
