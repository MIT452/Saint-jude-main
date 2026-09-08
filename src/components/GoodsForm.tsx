import { useState, useEffect, FC } from "react";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import { CheckCircle, XCircle } from "lucide-react";
import { InputField } from "./tools/InputField";
import { CashMovement, Goods, Reservation, ReservationFormData, TABLE_DATA_BASE } from "../data/type";
import { useDispatch, useSelector } from "react-redux";
import { RootState } from "../redux";
import { v4 as uuid } from 'uuid';
import { setCashMouvement, setGoods, setReservation } from "../redux/feature/stJude";
import QrCode from "./tools/QrCode";
import { toast } from "react-toastify";
import { Input } from "./ui/input";
import { cashMouvementVoid, formeReservationVoid, reservationVoid } from "../data/dataVoid";
import Tables from "./tools/TableGoods";
import { findBoat, findTrip } from "../Tools/Tools";
import { inputFields } from "./goodsForms";
import { onAddService } from "../data/service";

interface ReservationFormProps {
  onClose: () => void;
  idReservation: string
}

const ReservationForm: FC<ReservationFormProps> = ({ onClose, idReservation }) => {
  const [currentGoods, setCurrentGoods] = useState<Goods[]>([]);
  const [priceTotal, setPrice] = useState<number>(0);
  const [lotNumber, setLotNumber] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [currenReservation, setCurrentReservation] = useState<Reservation>(reservationVoid);
  const [cashMouvement, setCashMouvements] = useState<CashMovement>(cashMouvementVoid);
  const [formData, setFormData] = useState<ReservationFormData>(formeReservationVoid);
  const [idBoatSelected, setIdBoat] = useState<string>('');
  const [weightTrip, setWeightTrip] = useState<number>(0);
  const [readOnlyValue, setReadOnly] = useState<string>('option1');

  const [idCashMouvement] = useState(() => uuid());
  const { trip: trips, boat: allBoat, goods: allGoods } = useSelector((state: RootState) => state.stJude);
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const dispatch = useDispatch();

  const now = new Date();
  const futureTrips = trips.filter((trip) => new Date(trip.depart) > now);

  const handleInput = (field: keyof ReservationFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  }
  const calculateDerivedValues = () => {
    const { quantity, unitWeight, unitPrice } = formData;
    const totalWeight = quantity && unitWeight ? (quantity * unitWeight) : 0;
    const totalPrice = quantity && unitPrice ? (quantity * unitPrice) : 0;
    readOnlyValue === "option1" ?
      setFormData((prev) => ({ ...prev, totalWeight, totalPrice, amountToBePaidByClient: totalPrice })) :
      setFormData((prev) => ({ ...prev, totalWeight, }));
  }
  const calculateUnitPrice = () => {
    const { totalPrice, quantity } = formData;
    const unitP = quantity && totalPrice / quantity;

    setFormData((prev) => ({ ...prev, unitPrice: unitP }));
  }
  const totalWeightInTrip = () => {
    let goodsInTrip = allGoods.filter(({ tripId }) => tripId === formData.tripId);
    setWeightTrip(goodsInTrip.reduce((acc, { totalWeight }) => acc + Number(totalWeight), 0))
  }
  const payTotal = (total: number) => {
    formData.rest = 0;
    formData.amountPaidByClient = total;
    formData.paymentStatus = true;
    setFormData((prev) => ({ ...prev, amountPaidByClient: formData.amountPaidByClient, rest: formData.rest, paymentStatus: formData.paymentStatus }));
  }
  const calculatePrice = () => {
    let totalPrice = currentGoods.reduce((acc, { totalPrice }) => acc + Number(totalPrice), 0)
    setPrice(totalPrice);
  }
  const setCashMouvementFct = () => {
    let currentCashMouvement: CashMovement = {
      ...cashMouvement,
      credit: formData.amountPaidByClient,
      designation: `Paiement du client ${formData.senderName}`,
      userId: currentUser?.id ? currentUser.id : "",
    }
    setCashMouvements(currentCashMouvement)
  }
  const generateLotNumber = () => {
    const prefix =
      formData.cargoType === "fragile"
        ? "FR"
        : formData.cargoType === "agricultural"
          ? "AG"
          : "GN"
    const timestamp = Date.now().toString().slice(-6)
    const random = Math.random().toString(36).substring(2, 4).toUpperCase()
    setLotNumber(`${prefix}${timestamp}${random}`)
  }

  const validateForm = () => {
    let newErrors: { [key: string]: string } = {}

    // Champs expéditeur/destinataire obligatoires
    const requiredFields = [
      "senderName",
      "senderPhone",
      "senderAddress",
      "recipientName",
      "recipientPhone",
      "recipientAddress",
      "cargoType",
      ...inputFields.filter(f => f.required).map(f => f.key)
    ]

    requiredFields.forEach((field) => {
      if (!formData[field as keyof typeof formData]) {
        newErrors[field] = "Ce champ est requis"
      }
    })

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const onHadlSubmit = () => {
    if (!validateForm()) return;

    let goods: Goods = {
      id: uuid(),
      amountToPay: formData.amountToBePaidByClient,
      embarkDate: formData.dateOfGoodsEntry,
      itemName: formData.goods,
      quantity: formData.quantity,
      totalPrice: formData.totalPrice,
      totalWeight: formData.totalWeight, types: formData.cargoType,
      unitPrice: formData.unitPrice, unitWeight: formData.unitWeight,
      userId: currentUser?.id ? currentUser.id : "",
      reservationId: idReservation,
      status: false,
      state: "Prévu",
      numberLot: '',
      tripId: formData.tripId
    };
    setCurrentGoods([...currentGoods, goods]);
  }
const onAdd = async () => {
  if (currentGoods.length === 0 || !currenReservation) {
    toast.error("Aucune marchandise à ajouter ou réservation invalide.");
    return;
  }

  const promises = currentGoods.map(good => 
    onAddService(TABLE_DATA_BASE.GOODS, good)
  );

  promises.push(onAddService(TABLE_DATA_BASE.RESERVATION, currenReservation));

  if (formData.amountPaidByClient !== 0) {
    const currentCashMouvement: CashMovement = {
      ...cashMouvement,
      id: idCashMouvement,
      date: new Date().toISOString(),
      tripId: currenReservation.tripId
    };
    promises.push(onAddService(TABLE_DATA_BASE.CASHMOVEMENT, currentCashMouvement));
  }

  const results = await Promise.all(promises);

  // Vérifie si toutes ont réussi
  if (results.every(r => r === "success")) {
    dispatch(setGoods(currentGoods));
    dispatch(setReservation(currenReservation));

    if (formData.amountPaidByClient !== 0) {
      dispatch(setCashMouvement({
        ...cashMouvement,
        id: idCashMouvement,
        date: new Date().toISOString(),
        tripId: currenReservation.tripId
      }));
    }

    toast.success("Toutes les données ont été ajoutées avec succès !");
    onReset();
    onClose();
  } else {
    toast.error("Une erreur est survenue lors de l'ajout de certaines données.");
  }
};

  const onReset = () => {
    setFormData(formeReservationVoid);
    setCurrentGoods([]);
    setPrice(0);
    setLotNumber("");
    setErrors({});
    setCurrentReservation(reservationVoid);
  }
  const calculateReste = () => {
    formData.amountPaidByClient === 0 ? formData.rest = priceTotal : formData.rest = priceTotal - formData.amountPaidByClient;
    setFormData((prev) => ({ ...prev, rest: formData.rest }));
  }
  const setReservationData = () => {
    let reservation: Reservation = {
      id: idReservation,
      clientName: formData.senderName,
      clientTel: formData.senderPhone,
      clientAdresse: formData.senderAddress,
      destName: formData.recipientName,
      destTel: formData.recipientPhone,
      destAdresse: formData.recipientAddress,
      status: "En cours",
      date: `${new Date().toISOString()}`,
      quantity: currentGoods.reduce((acc, { quantity }) => acc + Number(quantity), 0),
      weight: currentGoods.reduce((acc, { totalWeight }) => acc + Number(totalWeight), 0),
      tripId: formData.tripId,
      amountPaid: formData.amountPaidByClient,
      amountToPay: currentGoods.reduce((acc, { totalPrice }) => acc + Number(totalPrice), 0) - formData.amountPaidByClient,
      paymentStatus: formData.amountToBePaidByClient === 0 ? true : false,
      totalPrice: currentGoods.reduce((acc, { totalPrice }) => acc + Number(totalPrice), 0),
      userId: currentUser?.id ? currentUser.id : "",
      idCashMovement: idCashMouvement,
    }
    setCurrentReservation(reservation);
  }
  useEffect(() => { calculateUnitPrice() }, [formData.totalPrice]);
  useEffect(() => { setReservationData() }, [currentGoods, formData.amountPaidByClient, priceTotal]);
  useEffect(() => { calculateDerivedValues() }, [formData.quantity, formData.unitWeight, formData.unitPrice, formData.totalPrice]);
  useEffect(() => { calculatePrice() }, [currentGoods, formData.weight, formData.volume, formData.cargoType]);
  useEffect(() => { calculateReste(), setCashMouvementFct() }, [formData.amountPaidByClient, priceTotal]);
  useEffect(() => {
    let currentTrip = findTrip(formData.tripId, futureTrips);
    setIdBoat(currentTrip.boatId);
    totalWeightInTrip()
  }, [formData.tripId])
  const handleUpdateGood = (updatedGood: Goods) => {
    setCurrentGoods((prevGoods) =>
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
  const onDeleteGood = (id: string) => {
    setCurrentGoods((prevGoods) => prevGoods.filter((good) => good.id !== id));
  };
  return (
    <div className="flex fixed items-center justify-center inset-0 flex-col p-2.5 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={() => onClose()}></div>
      <div className="z-50 w-[80%] space-y-6 overflow-auto bg-white p-6 rounded-lg max-h-[90vh]">
        {/* Expéditeur */}
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold text-xl">
              Informations Expéditeur
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField label="Nom complet" value={formData.senderName} error={errors.senderName} onChange={(v) => handleInput("senderName", v)} />
            <InputField label="Téléphone" value={formData.senderPhone} error={errors.senderPhone} onChange={(v) => handleInput("senderPhone", v)} />
            <InputField label="Adresse" value={formData.senderAddress} error={errors.senderAddress} onChange={(v) => handleInput("senderAddress", v)} />
          </CardContent>
        </Card>
        {/* Destinataire */}
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold text-xl">Informations Destinataire</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <InputField label="Nom complet" value={formData.recipientName} error={errors.recipientName} onChange={(v) => handleInput("recipientName", v)} />
            <InputField label="Téléphone" value={formData.recipientPhone} error={errors.recipientPhone} onChange={(v) => handleInput("recipientPhone", v)} />
            <InputField label="Adresse" value={formData.recipientAddress} error={errors.recipientAddress} onChange={(v) => handleInput("recipientAddress", v)} />
          </CardContent>
        </Card>
        {/* Marchandise */}
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold text-xl"> Informations Marchandise</CardTitle>
            <CardContent className="flex flex-col gap-2">
              <Label>Prevue le</Label>
              <Select onValueChange={(v) => handleInput('tripId', v)}>
                <SelectTrigger>
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  {futureTrips.map((trip) => (
                    <SelectItem key={trip.id} value={trip.id}>{`${trip.from} → ${trip.to} ( ${new Date(trip.depart).toLocaleString('fr-Fr', {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })} )`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardContent>
            {/* <SelectField handleInput={handleInput} trips={trips}></SelectField> */}
          </CardHeader>

          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* Select */}
            <div className="flex flex-col gap-2">
              <Label>Type de marchandise</Label>
              <Select onValueChange={(v) => handleInput("cargoType", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Marchandise générale</SelectItem>
                  <SelectItem value="fragile">Fragile</SelectItem>
                  <SelectItem value="agricole">Agricole</SelectItem>
                </SelectContent>
              </Select>
              {errors.cargoType && (<span className="text-red-500 text-sm">{errors.cargoType}</span>)}
            </div>

            {/* Champs dynamiques */}
            {inputFields.map(({ key, label, type }) => (
              <InputField key={key} label={label} type={type} value={formData[key as keyof typeof formData] || ""} error={errors[key]} onChange={(v) => handleInput(key as keyof ReservationFormData, v)} />
            ))}
            {/* Champs calculés */}
            <InputField label="Poids total" value={formData.totalWeight} readOnly />
            {/* <InputField label="Prix total" value={formData.totalPrice} readOnly /> */}
            <div className="flex flex-col gap-2">
              <Label>Moyen de payement</Label>
              <Select value={readOnlyValue} onValueChange={(v) => setReadOnly(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option1">Option 1</SelectItem>
                  <SelectItem value="option2">Option 2</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <InputField label="Montant payer par le client" type="number" value={formData.totalPrice} readOnly={readOnlyValue === 'option1' ? true : false} onChange={(v) => handleInput('totalPrice', v)} />
          </CardContent>
          <CardFooter className="flex justify-end gap-4">
            <Button variant="default" onClick={onHadlSubmit}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Ajouter
            </Button>
            <Button variant="outline" onClick={() => onClose()}>
              <XCircle className="w-4 h-4 mr-2" />
              Annuler
            </Button>
          </CardFooter>
        </Card>
        <div className="overflow-x-auto text-primary">
          <Tables currentGoods={currentGoods} reservationClient={formData.senderName} onUpdateGood={handleUpdateGood} onDeleteGoods={onDeleteGood}></Tables>
        </div>
        {/* Actions */}
        <div className="flex flex-col gap-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Information sur le bateau</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col px-3">
                  <div className="flex gap-2 py-2 justify-between">
                    <span>Poid supporter par le bateau :</span>
                    <span>{findBoat(idBoatSelected, allBoat).capacity} T</span>
                  </div>
                  <div className="flex gap-2 py-2 justify-between">
                    <span>Poid restant : </span>
                    <span>{findBoat(idBoatSelected, allBoat).capacity * 1000 - (weightTrip + currentGoods.reduce((acc, { totalWeight }) => acc + Number(totalWeight), 0))} Kg ou {(findBoat(idBoatSelected, allBoat).capacity * 1000 - (weightTrip + currentGoods.reduce((acc, { totalWeight }) => acc + Number(totalWeight), 0))) / 1000} T</span>
                  </div>
                  <div className="flex gap-2 py-2 justify-between">
                    <span>Poid Actuelle :</span>
                    <span>{currentGoods.reduce((acc, { totalWeight }) => acc + Number(totalWeight), 0)} kg ou {(currentGoods.reduce((acc, { totalWeight }) => acc + Number(totalWeight), 0)) / 1000} T</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            {/* Étiquette + Prix */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-3">
                  <Button onClick={() => payTotal(priceTotal)}>
                    Payer la totalité
                  </Button>
                  <Button onClick={generateLotNumber}>
                    Générer étiquette
                  </Button>
                </div>
                <div className="text-sm font-medium">
                  Numéro de lot :{" "}
                  <span className="font-bold">{lotNumber || "Non généré"}</span>
                </div>
                {lotNumber !== "" && <QrCode idendifiant={lotNumber} />}
              </CardContent>
            </Card>
            {/* Paiement */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Paiement</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="text-xl font-bold">Prix total : {priceTotal} Ar</div>
                <div className="flex items-center gap-2">
                  <Label className="whitespace-nowrap">Montant payé :</Label>
                  <Input type="number" value={formData.amountPaidByClient} onChange={(v) => handleInput("amountPaidByClient", v.target.value)} className="w-40" />
                </div>

                <div className="text-sm text-muted-foreground">
                  {formData.rest >= 0 ? (
                    <span className="text-green-600">Montant restant : {formData.rest} Ar</span>
                  ) : (
                    <span className="text-red-600">Le montant saisi est supérieur</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
          {/* Confirmer */}
          <Button className="px-6 py-6 text-lg" onClick={onAdd}>Confirmer réservation</Button>
        </div>
      </div>
    </div>
  )
}

export default ReservationForm;