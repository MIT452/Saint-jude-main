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
import ConfirmDialog from "./ConfirmDialog";

interface ReservationFormProps {
  onClose: () => void;
  idReservation: string
}

// Moyens de paiement proposés
type MoyenPaiement = "banque" | "mvola" | "caisse";
const MOYENS_PAIEMENT: Record<MoyenPaiement, string> = {
  banque: "Banque",
  mvola: "MVola",
  caisse: "Caisse",
};

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
  // Mode de calcul du prix : automatique (quantité x prix unitaire) ou saisie manuelle du prix total
  const [priceMode, setPriceMode] = useState<"auto" | "manual">("auto");
  // Moyen de paiement : Banque, MVola ou Caisse
  const [paymentMethod, setPaymentMethod] = useState<MoyenPaiement>("caisse");
  // Marchandise en attente de confirmation de suppression
  const [goodToDeleteId, setGoodToDeleteId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

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
    priceMode === "auto" ?
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
    setFormData((prev) => ({ ...prev, amountPaidByClient: total, rest: 0, paymentStatus: true }));
  }
  const calculatePrice = () => {
    let totalPrice = currentGoods.reduce((acc, { totalPrice }) => acc + Number(totalPrice), 0)
    setPrice(totalPrice);
  }
  const setCashMouvementFct = () => {
    let currentCashMouvement: CashMovement = {
      ...cashMouvement,
      credit: Number(formData.amountPaidByClient) || 0,
      designation: `Paiement du client ${formData.senderName} (${MOYENS_PAIEMENT[paymentMethod]})`,
      userId: currentUser?.id ? currentUser.id : "",
    }
    setCashMouvements(currentCashMouvement)
  }
  const generateLotNumber = () => {
    const prefix =
      formData.cargoType === "fragile"
        ? "FR"
        : formData.cargoType === "agricole"
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

  /**
   * Enregistrement SÉQUENTIEL (et non plus en parallèle) :
   * 1) paiement en caisse (si un montant est payé)
   * 2) réservation
   * 3) marchandises (qui dépendent de la réservation via reservationId)
   * En cas d'échec, le message indique l'étape exacte.
   */
  const onAdd = async () => {
    if (isSaving) return;
    if (currentGoods.length === 0 || !currenReservation) {
      toast.error("Aucune marchandise à ajouter ou réservation invalide.");
      return;
    }

    const paid = Number(formData.amountPaidByClient) || 0;
    if (paid > priceTotal) {
      toast.error("Le montant payé dépasse le prix total.");
      return;
    }

    setIsSaving(true);
    try {
      const currentCashMouvement: CashMovement = {
        ...cashMouvement,
        id: idCashMouvement,
        date: new Date().toISOString(),
        tripId: currenReservation.tripId
      };

      // 1) Paiement
      if (paid > 0) {
        const cashResult = await onAddService(TABLE_DATA_BASE.CASHMOVEMENT, currentCashMouvement);
        if (cashResult !== "success") {
          toast.error("Échec de l'enregistrement du paiement (caisse).");
          return;
        }
      }

      // 2) Réservation
      const reservationResult = await onAddService(TABLE_DATA_BASE.RESERVATION, currenReservation);
      if (reservationResult !== "success") {
        toast.error("Échec de l'enregistrement de la réservation.");
        return;
      }

      // 3) Marchandises
      for (const good of currentGoods) {
        const goodResult = await onAddService(TABLE_DATA_BASE.GOODS, good);
        if (goodResult !== "success") {
          toast.error(`Échec de l'ajout de la marchandise « ${good.itemName} ».`);
          return;
        }
      }

      dispatch(setGoods(currentGoods));
      dispatch(setReservation(currenReservation));
      if (paid > 0) {
        dispatch(setCashMouvement(currentCashMouvement));
      }

      toast.success("Toutes les données ont été ajoutées avec succès !");
      onReset();
      onClose();
    } catch (error) {
      console.error(error);
      toast.error("Une erreur est survenue lors de l'ajout des données.");
    } finally {
      setIsSaving(false);
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
    const paid = Number(formData.amountPaidByClient) || 0;
    setFormData((prev) => ({ ...prev, rest: priceTotal - paid }));
  }
  const setReservationData = () => {
    const total = currentGoods.reduce((acc, { totalPrice }) => acc + Number(totalPrice), 0);
    const paid = Number(formData.amountPaidByClient) || 0;
    let reservation: Reservation = {
      id: idReservation,
      clientName: formData.senderName,
      clientTel: formData.senderPhone,
      clientAdresse: formData.senderAddress,
      destName: formData.recipientName,
      destTel: formData.recipientPhone,
      destAdresse: formData.recipientAddress,
      status: "EN_ATTENTE",
      date: `${new Date().toISOString()}`,
      quantity: currentGoods.reduce((acc, { quantity }) => acc + Number(quantity), 0),
      weight: currentGoods.reduce((acc, { totalWeight }) => acc + Number(totalWeight), 0),
      tripId: formData.tripId,
      amountPaid: paid,
      amountToPay: total - paid,
      paymentStatus: total > 0 && paid >= total,
      totalPrice: total,
      userId: currentUser?.id ? currentUser.id : "",
      idCashMovement: idCashMouvement,
    }
    setCurrentReservation(reservation);
  }
  useEffect(() => { calculateUnitPrice() }, [formData.totalPrice]);
  useEffect(() => { setReservationData() }, [currentGoods, formData.amountPaidByClient, priceTotal]);
  useEffect(() => { calculateDerivedValues() }, [formData.quantity, formData.unitWeight, formData.unitPrice, formData.totalPrice, priceMode]);
  useEffect(() => { calculatePrice() }, [currentGoods, formData.weight, formData.volume, formData.cargoType]);
  useEffect(() => { calculateReste(), setCashMouvementFct() }, [formData.amountPaidByClient, priceTotal, paymentMethod]);
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
  // Clic sur la corbeille : on demande d'abord confirmation
  const requestDeleteGood = (id: string) => {
    setGoodToDeleteId(id);
  };
  const goodToDelete = currentGoods.find((good) => good.id === goodToDeleteId);

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

            {/* Moyen de paiement */}
            <div className="flex flex-col gap-2">
              <Label>Moyen de payement</Label>
              <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as MoyenPaiement)}>
                <SelectTrigger>
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="banque">Banque</SelectItem>
                  <SelectItem value="mvola">MVola</SelectItem>
                  <SelectItem value="caisse">Caisse</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Mode de calcul du prix */}
            <div className="flex flex-col gap-2">
              <Label>Calcul du prix</Label>
              <Select value={priceMode} onValueChange={(v) => setPriceMode(v as "auto" | "manual")}>
                <SelectTrigger>
                  <SelectValue placeholder="..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="auto">Automatique (quantité × prix unitaire)</SelectItem>
                  <SelectItem value="manual">Saisie du prix total</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <InputField label="Montant payer par le client" type="number" value={formData.totalPrice} readOnly={priceMode === 'auto'} onChange={(v) => handleInput('totalPrice', v)} />
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
          <Tables currentGoods={currentGoods} reservationClient={formData.senderName} onUpdateGood={handleUpdateGood} onDeleteGoods={requestDeleteGood}></Tables>
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
                  <Input type="number" value={formData.amountPaidByClient} onChange={(v) => handleInput("amountPaidByClient", Number(v.target.value) || 0)} className="w-40" />
                </div>
                <div className="text-sm">
                  Moyen de paiement : <span className="font-medium">{MOYENS_PAIEMENT[paymentMethod]}</span>
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
          <Button className="px-6 py-6 text-lg" onClick={onAdd} disabled={isSaving}>
            {isSaving ? "Enregistrement..." : "Confirmer réservation"}
          </Button>
        </div>
      </div>

      {/* Confirmation avant suppression d'une marchandise */}
      <ConfirmDialog
        open={goodToDeleteId !== null}
        title="Supprimer la marchandise"
        message={`Voulez-vous vraiment supprimer ${goodToDelete?.itemName ? `« ${goodToDelete.itemName} »` : "cette marchandise"} ?`}
        confirmLabel="Oui, supprimer"
        cancelLabel="Non"
        onCancel={() => setGoodToDeleteId(null)}
        onConfirm={() => {
          if (goodToDeleteId) onDeleteGood(goodToDeleteId);
          setGoodToDeleteId(null);
        }}
      />
    </div>
  )
}

export default ReservationForm;