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
import { v4 as uuid } from "uuid";
import { setCashMouvement, setGoods, setReservation } from "../redux/feature/stJude";
import QrCode from "./tools/QrCode";
import { toast } from "react-toastify";
import { Input } from "./ui/input";
import { formeReservationVoid } from "../data/dataVoid";
import Tables from "./tools/TableGoods";
import { findBoat, formatCityName, formatCurrency } from "../Tools/Tools";
import { inputFields } from "./goodsForms";
import { onAddService } from "../data/service";

interface ReservationFormProps {
  onClose: () => void;
  idReservation: string;
}

const ReservationForm: FC<ReservationFormProps> = ({ onClose, idReservation }) => {
  const [currentGoods, setCurrentGoods] = useState<Goods[]>([]);
  const [lotNumber, setLotNumber] = useState("");
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [formData, setFormData] = useState<ReservationFormData>(formeReservationVoid);
  const [readOnlyValue, setReadOnly] = useState<string>("option1");
  const [isSaving, setIsSaving] = useState(false);

  const [idCashMouvement] = useState(() => uuid());
  const { trip: trips, boat: allBoat, reservation: allReservation } = useSelector((state: RootState) => state.stJude);
  const currentUser = useSelector((state: RootState) => state.users.currentUser);
  const dispatch = useDispatch();

  const now = new Date();
  const futureTrips = trips.filter((trip) => new Date(trip.depart) > now);

  // ---------- Valeurs calculées (plus besoin de useState / useEffect) ----------
  const priceTotal = currentGoods.reduce((acc, { totalPrice }) => acc + Number(totalPrice), 0);
  const currentWeight = currentGoods.reduce((acc, { totalWeight }) => acc + Number(totalWeight), 0);
  const currentQuantity = currentGoods.reduce((acc, { quantity }) => acc + Number(quantity), 0);
  const amountPaid = Number(formData.amountPaidByClient) || 0;
  const rest = priceTotal - amountPaid;

  const selectedTrip = futureTrips.find(({ id }) => id === formData.tripId);
  const boat = findBoat(selectedTrip?.boatId ?? "", allBoat);

  // Même règle que le serveur : seules les réservations confirmées / terminées occupent de la place
  const weightTrip = allReservation
    .filter((r) => r.tripId === formData.tripId && (r.status === "CONFIRMEE" || r.status === "TERMINEE"))
    .reduce((acc, r) => acc + Number(r.weight), 0);
  const remainingKg = boat.capacity * 1000 - (weightTrip + currentWeight);

  // ---------- Saisie ----------
  const handleInput = (field: keyof ReservationFormData, value: string | number) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: "" }));
  };

  const calculateDerivedValues = () => {
    const { quantity, unitWeight, unitPrice } = formData;
    const totalWeight = quantity && unitWeight ? quantity * unitWeight : 0;
    const totalPrice = quantity && unitPrice ? quantity * unitPrice : 0;
    readOnlyValue === "option1"
      ? setFormData((prev) => ({ ...prev, totalWeight, totalPrice, amountToBePaidByClient: totalPrice }))
      : setFormData((prev) => ({ ...prev, totalWeight }));
  };

  const calculateUnitPrice = () => {
    const { totalPrice, quantity } = formData;
    const unitP = quantity && totalPrice / quantity;
    setFormData((prev) => ({ ...prev, unitPrice: unitP }));
  };

  const payTotal = (total: number) => {
    setFormData((prev) => ({ ...prev, amountPaidByClient: total, rest: 0, paymentStatus: true }));
  };

  const generateLotNumber = () => {
    const prefix =
      formData.cargoType === "fragile" ? "FR" : formData.cargoType === "agricole" ? "AG" : "GN";
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.random().toString(36).substring(2, 4).toUpperCase();
    setLotNumber(`${prefix}${timestamp}${random}`);
  };

  const validateForm = () => {
    const newErrors: { [key: string]: string } = {};
    const requiredFields = [
      "tripId",
      "senderName",
      "senderPhone",
      "senderAddress",
      "recipientName",
      "recipientPhone",
      "recipientAddress",
      "cargoType",
      ...inputFields.filter((f) => f.required).map((f) => f.key),
    ];

    requiredFields.forEach((field) => {
      if (!formData[field as keyof typeof formData]) {
        newErrors[field] = "Ce champ est requis";
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ---------- Ajout d'une marchandise à la liste ----------
  const onHadlSubmit = () => {
    if (!validateForm()) return;

    const goods: Goods = {
      id: uuid(),
      amountToPay: formData.amountToBePaidByClient,
      embarkDate: formData.dateOfGoodsEntry,
      itemName: formData.goods,
      quantity: formData.quantity,
      totalPrice: formData.totalPrice,
      totalWeight: formData.totalWeight,
      types: formData.cargoType,
      unitPrice: formData.unitPrice,
      unitWeight: formData.unitWeight,
      userId: currentUser?.id ?? "",
      reservationId: idReservation,
      status: false,
      state: "Prévu",
      numberLot: "",
      tripId: formData.tripId,
    };
    setCurrentGoods([...currentGoods, goods]);
  };

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

  const onReset = () => {
    setFormData(formeReservationVoid);
    setCurrentGoods([]);
    setLotNumber("");
    setErrors({});
  };

  // ---------- Enregistrement ----------
  const onAdd = async () => {
    if (isSaving) return;

    if (!formData.tripId) {
      setErrors((prev) => ({ ...prev, tripId: "Ce champ est requis" }));
      toast.error("Choisissez un voyage.");
      return;
    }
    if (currentGoods.length === 0) {
      toast.error("Ajoutez au moins une marchandise.");
      return;
    }
    if (amountPaid < 0 || amountPaid > priceTotal) {
      toast.error("Le montant payé doit être compris entre 0 et le prix total.");
      return;
    }

    const userId = currentUser?.id ?? "";

    // Marchandises : on force le voyage choisi et le numéro de lot généré
    const goodsToSave: Goods[] = currentGoods.map((g) => ({
      ...g,
      tripId: formData.tripId,
      numberLot: g.numberLot || lotNumber,
    }));

    // Réservation créée avec le statut EN_ATTENTE (confirmation ensuite, selon la place disponible)
    const reservationToSave: Reservation = {
      id: idReservation,
      clientName: formData.senderName,
      clientTel: formData.senderPhone,
      clientAdresse: formData.senderAddress,
      destName: formData.recipientName,
      destTel: formData.recipientPhone,
      destAdresse: formData.recipientAddress,
      status: "EN_ATTENTE",
      date: new Date().toISOString(),
      quantity: currentQuantity,
      weight: currentWeight,
      tripId: formData.tripId,
      amountPaid,
      amountToPay: Math.max(rest, 0),
      paymentStatus: priceTotal > 0 && amountPaid >= priceTotal,
      totalPrice: priceTotal,
      userId,
      idCashMovement: idCashMouvement,
    };

    const cashMovementToSave: CashMovement = {
      id: idCashMouvement,
      designation: `Paiement du client ${formData.senderName}`,
      credit: amountPaid,
      debit: 0,
      type: "credit",
      tripId: formData.tripId,
      userId,
      date: new Date().toISOString(),
    };

    setIsSaving(true);
    const promises = goodsToSave.map((good) => onAddService(TABLE_DATA_BASE.GOODS, good));
    promises.push(onAddService(TABLE_DATA_BASE.RESERVATION, reservationToSave));
    if (amountPaid !== 0) {
      promises.push(onAddService(TABLE_DATA_BASE.CASHMOVEMENT, cashMovementToSave));
    }

    const results = await Promise.all(promises);
    setIsSaving(false);

    if (results.every((r) => r === "success")) {
      dispatch(setGoods(goodsToSave));
      dispatch(setReservation(reservationToSave));
      if (amountPaid !== 0) dispatch(setCashMouvement(cashMovementToSave));

      toast.success("Réservation enregistrée (en attente de confirmation).");
      onReset();
      onClose();
    } else {
      toast.error("Une erreur est survenue lors de l'enregistrement de certaines données.");
    }
  };

  // ---------- Effets (calculs de prix / poids) ----------
  useEffect(() => { calculateUnitPrice(); }, [formData.totalPrice]);
  useEffect(() => { calculateDerivedValues(); }, [formData.quantity, formData.unitWeight, formData.unitPrice, formData.totalPrice]);

  return (
    <div className="flex fixed items-center justify-center inset-0 flex-col p-2.5 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={() => onClose()}></div>
      <div className="z-50 w-[80%] space-y-6 overflow-auto bg-white p-6 rounded-lg max-h-[90vh]">
        {/* Expéditeur */}
        <Card>
          <CardHeader>
            <CardTitle className="font-semibold text-xl">Informations de l'expéditeur</CardTitle>
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
            <CardTitle className="font-semibold text-xl">Informations du destinataire</CardTitle>
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
            <CardTitle className="font-semibold text-xl">Informations de la marchandise</CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col gap-2">
            <Label>Voyage prévu</Label>
            <Select value={formData.tripId} onValueChange={(v) => handleInput("tripId", v)}>
              <SelectTrigger>
                <SelectValue placeholder="Choisir un voyage..." />
              </SelectTrigger>
              <SelectContent>
                {futureTrips.map((trip) => (
                  <SelectItem key={trip.id} value={trip.id}>
                    {`${formatCityName(trip.from)} → ${formatCityName(trip.to)} ( ${new Date(trip.depart).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })} )`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.tripId && <span className="text-red-500 text-sm">{errors.tripId}</span>}
          </CardContent>

          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="flex flex-col gap-2">
              <Label>Type de marchandise</Label>
              <Select value={formData.cargoType} onValueChange={(v) => handleInput("cargoType", v)}>
                <SelectTrigger>
                  <SelectValue placeholder="Choisir un type..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">Marchandise générale</SelectItem>
                  <SelectItem value="fragile">Fragile</SelectItem>
                  <SelectItem value="agricole">Agricole</SelectItem>
                </SelectContent>
              </Select>
              {errors.cargoType && <span className="text-red-500 text-sm">{errors.cargoType}</span>}
            </div>

            {/* Champs dynamiques (libellés définis dans ./goodsForms) */}
            {inputFields.map(({ key, label, type }) => (
              <InputField
                key={key}
                label={label}
                type={type}
                value={formData[key as keyof typeof formData] || ""}
                error={errors[key]}
                onChange={(v) => handleInput(key as keyof ReservationFormData, v)}
              />
            ))}

            {/* Champs calculés */}
            <InputField label="Poids total (kg)" value={formData.totalWeight} readOnly />

            <div className="flex flex-col gap-2">
              <Label>Mode de calcul du prix</Label>
              <Select value={readOnlyValue} onValueChange={(v) => setReadOnly(v)}>
                <SelectTrigger>
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="option1">Prix unitaire × quantité</SelectItem>
                  <SelectItem value="option2">Prix total saisi manuellement</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <InputField
              label="Prix total (Ar)"
              type="number"
              value={formData.totalPrice}
              readOnly={readOnlyValue === "option1"}
              onChange={(v) => handleInput("totalPrice", v)}
            />
          </CardContent>

          <CardFooter className="flex justify-end gap-4">
            <Button variant="default" onClick={onHadlSubmit}>
              <CheckCircle className="w-4 h-4 mr-2" />
              Ajouter la marchandise
            </Button>
            <Button variant="outline" onClick={() => onClose()}>
              <XCircle className="w-4 h-4 mr-2" />
              Annuler
            </Button>
          </CardFooter>
        </Card>

        <div className="overflow-x-auto text-primary">
          <Tables currentGoods={currentGoods} reservationClient={formData.senderName} onUpdateGood={handleUpdateGood} onDeleteGoods={onDeleteGood} />
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-4 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {/* Bateau */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Informations sur le bateau</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col px-3">
                  <div className="flex gap-2 py-2 justify-between">
                    <span>Capacité du bateau :</span>
                    <span>{boat.capacity} T</span>
                  </div>
                  <div className="flex gap-2 py-2 justify-between">
                    <span>Poids restant :</span>
                    <span className={remainingKg < 0 ? "text-red-600 font-semibold" : ""}>
                      {remainingKg.toLocaleString("fr-FR")} kg ({(remainingKg / 1000).toLocaleString("fr-FR")} T)
                    </span>
                  </div>
                  <div className="flex gap-2 py-2 justify-between">
                    <span>Poids de cette réservation :</span>
                    <span>{currentWeight.toLocaleString("fr-FR")} kg ({(currentWeight / 1000).toLocaleString("fr-FR")} T)</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Le poids restant tient compte des réservations confirmées uniquement.
                  </p>
                  {remainingKg < 0 && (
                    <p className="text-xs text-red-600 mt-1">
                      Capacité dépassée : la réservation risque d'être refusée lors de la confirmation.
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Étiquette */}
            <Card>
              <CardHeader>
                <CardTitle className="text-xl font-semibold">Actions rapides</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex flex-col gap-3">
                  <Button onClick={() => payTotal(priceTotal)}>Payer la totalité</Button>
                  <Button onClick={generateLotNumber}>Générer l'étiquette</Button>
                </div>
                <div className="text-sm font-medium">
                  Numéro de lot : <span className="font-bold">{lotNumber || "Non généré"}</span>
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
                <div className="text-xl font-bold">Prix total : {formatCurrency(priceTotal)}</div>
                <div className="flex items-center gap-2">
                  <Label className="whitespace-nowrap">Montant payé :</Label>
                  <Input
                    type="number"
                    min={0}
                    value={formData.amountPaidByClient || ""}
                    onChange={(e) => handleInput("amountPaidByClient", Number(e.target.value))}
                    className="w-40"
                  />
                </div>
                <div className="text-sm text-muted-foreground">
                  {rest >= 0 ? (
                    <span className="text-green-600">Montant restant : {formatCurrency(rest)}</span>
                  ) : (
                    <span className="text-red-600">Le montant saisi est supérieur au prix total</span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Confirmer */}
          <Button className="px-6 py-6 text-lg" onClick={onAdd} disabled={isSaving}>
            {isSaving ? "Enregistrement..." : "Confirmer la réservation"}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ReservationForm;