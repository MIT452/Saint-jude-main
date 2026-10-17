import { useState, useEffect, Fragment, FC, ReactNode } from "react";
import { Card, CardContent } from "./ui/card";
import { Button } from "./ui/button";
import { Label } from "./ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "./ui/select";
import {
  CheckCircle, XCircle, PlusCircle, Package, MapPin, Calendar, Hash, Scale, Banknote,
  Ship, Zap, Wallet, CreditCard, Tag, User, ArrowRight, AlertTriangle, Phone,
  Eye, Pencil, Trash2, Mail, StickyNote, Barcode,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
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
import { findBoat, findTrip } from "../Tools/Tools";
import { inputFields } from "./goodsForms";
import { onAddService } from "../data/service";
import ConfirmDialog from "./ConfirmDialog";
import GoodsIcon from "./GoodsIcon";
import { nettoyerTelephone, validerMarchandise, validerTelephone } from "../utils/validation";

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

// Icône affichée à côté de chaque champ dynamique (inputFields). Icône par défaut : Package
const ICONES_CHAMPS: Record<string, LucideIcon> = {
  goods: Package,
  dateOfGoodsEntry: Calendar,
  quantity: Hash,
  unitWeight: Scale,
  unitPrice: Banknote,
};

type ChampTelephone = "senderPhone" | "recipientPhone";
const MESSAGE_TELEPHONE_INVALIDE = "Numéro de téléphone invalide : 10 chiffres exactement, sans lettres.";

/* =========================
   Petits composants de présentation (aucune logique métier)
========================= */
const SectionTitle: FC<{ icon: LucideIcon; title: string; subtitle?: string; color?: string }> = ({
  icon: Icon, title, subtitle, color = "bg-primary",
}) => (
  <div className="flex items-center gap-3 mb-4">
    <div className={`h-11 w-11 rounded-full ${color} text-white flex items-center justify-center shrink-0`}>
      <Icon className="h-5 w-5" />
    </div>
    <div>
      <h3 className="text-lg font-semibold text-[#001F3F] leading-tight">{title}</h3>
      {subtitle && <p className="text-sm text-muted-foreground">{subtitle}</p>}
    </div>
  </div>
);

const FieldBox: FC<{ icon: LucideIcon; children: ReactNode }> = ({ icon: Icon, children }) => (
  <div className="flex items-start gap-3 rounded-xl border bg-slate-50/70 p-3">
    <div className="h-10 w-10 rounded-full bg-white border text-primary flex items-center justify-center shrink-0 mt-1">
      <Icon className="h-5 w-5" />
    </div>
    <div className="flex-1 min-w-0">{children}</div>
  </div>
);

const StatBox: FC<{ icon: LucideIcon; label: string; value: string; tone?: "blue" | "red" | "green" }> = ({
  icon: Icon, label, value, tone = "blue",
}) => {
  const tones = {
    blue: "bg-blue-50 text-primary",
    red: "bg-red-50 text-red-600",
    green: "bg-green-50 text-green-700",
  };
  return (
    <div className={`flex items-center gap-3 rounded-xl p-4 ${tones[tone]}`}>
      <div className="h-12 w-12 rounded-xl bg-white/80 flex items-center justify-center shrink-0">
        <Icon className="h-6 w-6" />
      </div>
      <div>
        <div className="text-sm text-gray-600">{label}</div>
        <div className="text-2xl font-bold leading-tight">{value}</div>
      </div>
    </div>
  );
};

const LigneInfo: FC<{ icon: LucideIcon; label: string; value: ReactNode; danger?: boolean }> = ({
  icon: Icon, label, value, danger,
}) => (
  <div className={`flex items-center justify-between gap-2 rounded-lg px-3 py-2 ${danger ? "bg-red-50 text-red-600" : "bg-slate-50"}`}>
    <span className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4" />
      {label}
    </span>
    <span className="font-semibold">{value}</span>
  </div>
);

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
  // E-mail et notes du client (affichage / saisie uniquement : pas de champ correspondant dans ReservationFormData)
  const [clientEmail, setClientEmail] = useState("");
  const [clientNotes, setClientNotes] = useState("");
  // Marchandise dont on affiche le détail (icône œil)
  const [viewedGoodId, setViewedGoodId] = useState<string | null>(null);

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

  // Téléphone : les lettres sont refusées en direct, la saisie est limitée à 10 chiffres
  const handlePhone = (field: ChampTelephone, value: string | number) => {
    const nettoye = nettoyerTelephone(value);
    const chiffres = nettoye.replace(/\D/g, "");
    let erreur = "";
    if (nettoye !== chiffres) erreur = "Chiffres uniquement : les lettres ne sont pas valides.";
    else if (chiffres.length > 10) erreur = "Le numéro ne doit pas dépasser 10 chiffres.";
    if (erreur) toast.error(erreur, { toastId: `tel-${field}` });
    setFormData((prev) => ({ ...prev, [field]: chiffres.slice(0, 10) }));
    setErrors((prev) => ({ ...prev, [field]: erreur }));
  }

  // Contrôle des téléphones avant l'enregistrement final
  // (les coordonnées peuvent être remplies après l'ajout des marchandises)
  const validerTelephones = () => {
    const erreurExpediteur = validerTelephone(formData.senderPhone);
    const erreurDestinataire = validerTelephone(formData.recipientPhone);
    if (!erreurExpediteur && !erreurDestinataire) return true;
    setErrors((prev) => ({
      ...prev,
      ...(erreurExpediteur ? { senderPhone: erreurExpediteur } : {}),
      ...(erreurDestinataire ? { recipientPhone: erreurDestinataire } : {}),
    }));
    toast.error(MESSAGE_TELEPHONE_INVALIDE);
    return false;
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

    // Une marchandise doit être transportable (« maison » seule est refusée)
    const erreurMarchandise = validerMarchandise(String(formData.goods ?? ""))
    if (erreurMarchandise) {
      newErrors["goods"] = erreurMarchandise
      toast.error(erreurMarchandise)
    }

    // Téléphones : exactement 10 chiffres, sans lettres
    for (const champ of ["senderPhone", "recipientPhone"] as const) {
      const erreur = validerTelephone(formData[champ])
      if (erreur) newErrors[champ] = erreur
    }
    if (newErrors.senderPhone || newErrors.recipientPhone) {
      toast.error(MESSAGE_TELEPHONE_INVALIDE)
    }

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

    // Les coordonnées peuvent avoir été saisies après l'ajout des marchandises : on revérifie
    if (!validerTelephones()) return;
    const marchandiseRefusee = currentGoods
      .map((good) => validerMarchandise(String(good.itemName ?? "")))
      .find(Boolean);
    if (marchandiseRefusee) {
      toast.error(marchandiseRefusee);
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

      // 3) Marchandises (l'icône est calculée à l'affichage : rien de plus n'est envoyé au backend)
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
  useEffect(() => { setReservationData() }, [currentGoods, formData.amountPaidByClient, priceTotal, formData.senderName, formData.senderPhone, formData.senderAddress, formData.recipientName, formData.recipientPhone, formData.recipientAddress, formData.tripId]);
  useEffect(() => { calculateDerivedValues() }, [formData.quantity, formData.unitWeight, formData.unitPrice, formData.totalPrice, priceMode]);
  useEffect(() => { calculatePrice() }, [currentGoods, formData.weight, formData.volume, formData.cargoType]);
  useEffect(() => { calculateReste(), setCashMouvementFct() }, [formData.amountPaidByClient, priceTotal, paymentMethod]);
  useEffect(() => {
    if (!formData.tripId) return;
    let currentTrip = findTrip(formData.tripId, futureTrips);
    setIdBoat(currentTrip?.boatId ?? '');
    totalWeightInTrip()
  }, [formData.tripId])

  // Icône crayon : remet la marchandise dans le formulaire de saisie pour la modifier
  const onEditGood = (good: Goods) => {
    setFormData((prev) => ({
      ...prev,
      goods: good.itemName,
      dateOfGoodsEntry: good.embarkDate,
      quantity: good.quantity,
      unitWeight: good.unitWeight,
      unitPrice: good.unitPrice,
      totalPrice: good.totalPrice,
      cargoType: good.types,
    }));
    setCurrentGoods((prev) => prev.filter((g) => g.id !== good.id));
  };
  const onDeleteGood = (id: string) => {
    setCurrentGoods((prevGoods) => prevGoods.filter((good) => good.id !== id));
  };
  // Clic sur la corbeille : on demande d'abord confirmation
  const requestDeleteGood = (id: string) => {
    setGoodToDeleteId(id);
  };
  const goodToDelete = currentGoods.find((good) => good.id === goodToDeleteId);

  /* =========================
     Valeurs d'affichage (calculées, sans effet sur la logique)
  ========================= */
  const selectedTrip = formData.tripId ? findTrip(formData.tripId, futureTrips) : undefined;
  const selectedBoat = findBoat(idBoatSelected, allBoat);
  const capacityKg = Number(selectedBoat?.capacity || 0) * 1000;
  const currentWeightKg = currentGoods.reduce((acc, { totalWeight }) => acc + Number(totalWeight), 0);
  const remainingKg = capacityKg - (weightTrip + currentWeightKg);
  const isOverloaded = remainingKg < 0;
  const cashierName = [currentUser?.name, currentUser?.lastName].filter(Boolean).join(" ") || "Caissier";
  // Champs optionnels du bateau (absents du modèle actuel : affichés s'ils existent, sinon « — »)
  const boatExtra = (selectedBoat ?? {}) as { photo?: string; image?: string; places?: number; equipments?: string[] | string };
  const boatPhoto = boatExtra.photo || boatExtra.image;
  const boatPlaces = boatExtra.places;
  const boatEquipments = Array.isArray(boatExtra.equipments) ? boatExtra.equipments.join(" • ") : boatExtra.equipments;
  const fmtAr = (n: number) => `${Number(n || 0).toLocaleString("fr-FR")} Ar`;
  const fmtDate = (d: string) =>
    new Date(d).toLocaleString("fr-FR", { day: "2-digit", month: "long", year: "numeric" });

  return (
    <div className="flex fixed items-center justify-center inset-0 flex-col p-2.5 z-50">
      <div className="fixed inset-0 bg-black/50" onClick={() => onClose()}></div>
      <div className="z-50 w-[92%] max-w-6xl space-y-5 overflow-auto bg-slate-100 p-5 rounded-xl max-h-[92vh]">

        {/* ===== En-tête : titre + ligne / date du voyage ===== */}
        <Card className="border-blue-100 bg-gradient-to-r from-blue-50 to-white">
          <CardContent className="pt-6 flex flex-col lg:flex-row gap-4 lg:items-center lg:justify-between">
            <SectionTitle
              icon={Package}
              title="Enregistrement des marchandises"
              subtitle="Saisissez les informations de vos marchandises pour la réservation."
            />
            <div className="rounded-xl bg-blue-100/60 p-3 min-w-[300px] space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-5 w-5 text-primary mt-1 shrink-0" />
                <div className="flex-1 text-sm">
                  <Label className="text-xs text-gray-600">Voyage prévu</Label>
                  <Select onValueChange={(v) => handleInput('tripId', v)}>
                    <SelectTrigger className="bg-white">
                      <SelectValue placeholder="Choisir un voyage..." />
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
                </div>
              </div>
              {selectedTrip && (
                <div className="text-sm pl-7">
                  <div className="flex items-center gap-1 font-semibold text-[#001F3F]">
                    {selectedTrip.from} <ArrowRight className="h-4 w-4" /> {selectedTrip.to}
                  </div>
                  <div className="text-gray-600">Date : <b>{fmtDate(selectedTrip.depart)}</b></div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* ===== Saisie de la marchandise ===== */}
        <Card>
          <CardContent className="pt-6 space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Type de marchandise */}
              <FieldBox icon={Package}>
                <Label>Type de marchandise <span className="text-red-500">*</span></Label>
                <Select onValueChange={(v) => handleInput("cargoType", v)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="general">Marchandise générale</SelectItem>
                    <SelectItem value="fragile">Fragile</SelectItem>
                    <SelectItem value="agricole">Agricole</SelectItem>
                  </SelectContent>
                </Select>
                {errors.cargoType && (<span className="text-red-500 text-sm">{errors.cargoType}</span>)}
              </FieldBox>

              {/* Champs dynamiques (marchandise, date, quantité, poids unitaire, prix unitaire...) */}
              {inputFields.map(({ key, label, type }) => (
                <FieldBox key={key} icon={ICONES_CHAMPS[key] ?? Package}>
                  <InputField label={label} type={type} value={formData[key as keyof typeof formData] || ""} error={errors[key]} onChange={(v) => handleInput(key as keyof ReservationFormData, v)} />
                </FieldBox>
              ))}
            </div>

            {/* Résumé calculé + moyen de paiement + boutons */}
            <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 items-stretch">
              <StatBox icon={Scale} label="Poids total" value={`${Number(formData.totalWeight || 0)} kg`} />
              <StatBox icon={Banknote} label="Montant à payer par le client" value={fmtAr(formData.totalPrice)} />

              <div className="rounded-xl bg-blue-50 p-4 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-700">
                  <CreditCard className="h-4 w-4 text-primary" /> Moyen de paiement
                </div>
                <Select value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as MoyenPaiement)}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="banque">Banque</SelectItem>
                    <SelectItem value="mvola">MVola</SelectItem>
                    <SelectItem value="caisse">Caisse</SelectItem>
                  </SelectContent>
                </Select>
                <Label className="text-xs text-gray-600">Calcul du prix</Label>
                <Select value={priceMode} onValueChange={(v) => setPriceMode(v as "auto" | "manual")}>
                  <SelectTrigger className="bg-white">
                    <SelectValue placeholder="..." />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="auto">Automatique (quantité × prix unitaire)</SelectItem>
                    <SelectItem value="manual">Saisie du prix total</SelectItem>
                  </SelectContent>
                </Select>
                {priceMode === "manual" && (
                  <Input
                    type="number"
                    placeholder="Prix total (Ar)"
                    value={formData.totalPrice}
                    onChange={(e) => handleInput('totalPrice', e.target.value)}
                    className="bg-white"
                  />
                )}
              </div>

              <div className="flex flex-col justify-center gap-2 rounded-xl border p-4">
                <Button className="bg-green-700 hover:bg-green-800 text-white" onClick={onHadlSubmit}>
                  <PlusCircle className="w-4 h-4 mr-2" />
                  Ajouter
                </Button>
                <Button variant="outline" onClick={() => onClose()}>
                  <XCircle className="w-4 h-4 mr-2" />
                  Annuler
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== Récapitulatif des marchandises ===== */}
        <Card>
          <CardContent className="pt-6">
            <SectionTitle
              icon={CheckCircle}
              color="bg-green-700"
              title="Récapitulatif des marchandises"
              subtitle="Liste des marchandises ajoutées à cette réservation."
            />
            <div className="overflow-x-auto rounded-xl border">
              <table className="w-full text-sm text-center">
                <thead className="bg-blue-50 text-[#001F3F]">
                  <tr>
                    {["Client", "Marchandise", "Caissier", "Quantité", "Poids Unit. (kg)", "Poids Total (kg)", "Prix Unitaire", "Prix Total", "Action"].map((h) => (
                      <th key={h} className="px-3 py-2 font-semibold whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {currentGoods.length === 0 && (
                    <tr><td colSpan={9} className="py-6 text-muted-foreground">Aucune marchandise ajoutée.</td></tr>
                  )}
                  {currentGoods.map((good) => (
                    <Fragment key={good.id}>
                      <tr className="border-t">
                        <td className="px-3 py-2 text-left whitespace-nowrap">
                          <span className="inline-flex items-center gap-2"><User className="h-4 w-4 text-primary" />{formData.senderName || "—"}</span>
                        </td>
                        <td className="px-3 py-2 text-left font-medium">
                          <span className="inline-flex items-center gap-2">
                            <GoodsIcon name={String(good.itemName ?? "")} />
                            {good.itemName}
                          </span>
                        </td>
                        <td className="px-3 py-2 whitespace-nowrap">
                          <span className="inline-flex items-center gap-2"><User className="h-4 w-4 text-primary" />{cashierName}</span>
                        </td>
                        <td className="px-3 py-2">{good.quantity}</td>
                        <td className="px-3 py-2">{good.unitWeight}</td>
                        <td className="px-3 py-2">{good.totalWeight}</td>
                        <td className="px-3 py-2 whitespace-nowrap">{fmtAr(good.unitPrice)}</td>
                        <td className="px-3 py-2 font-bold whitespace-nowrap">{fmtAr(good.totalPrice)}</td>
                        <td className="px-3 py-2">
                          <div className="flex items-center justify-center gap-2">
                            <button type="button" title="Voir" className="h-8 w-8 rounded-md bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700"
                              onClick={() => setViewedGoodId(viewedGoodId === good.id ? null : good.id)}>
                              <Eye className="h-4 w-4" />
                            </button>
                            <button type="button" title="Modifier" className="h-8 w-8 rounded-md bg-blue-600 text-white flex items-center justify-center hover:bg-blue-700"
                              onClick={() => onEditGood(good)}>
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button type="button" title="Supprimer" className="h-8 w-8 rounded-md bg-red-500 text-white flex items-center justify-center hover:bg-red-600"
                              onClick={() => requestDeleteGood(good.id)}>
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                      {viewedGoodId === good.id && (
                        <tr className="bg-slate-50 text-left">
                          <td colSpan={9} className="px-4 py-2 text-sm">
                            Type : <b>{good.types}</b> · Date d'entrée : <b>{good.embarkDate}</b> · Montant à payer : <b>{fmtAr(Number(good.amountToPay))}</b>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-end items-center gap-6 mt-3 pr-2 font-semibold">
              <span>Total général : {currentWeightKg} kg</span>
              <span className="text-lg text-green-700">{fmtAr(priceTotal)}</span>
            </div>
          </CardContent>
        </Card>

        {/* ===== Bateau / Actions rapides / Paiement ===== */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Informations sur le bateau */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <SectionTitle icon={Ship} title="Informations sur le bateau" />
              {idBoatSelected ? (
                <>
                  <div className="flex gap-3">
                    {boatPhoto ? (
                      <img src={boatPhoto} alt={selectedBoat?.name} className="h-28 w-36 rounded-lg object-cover shrink-0" />
                    ) : (
                      <div className="h-28 w-36 rounded-lg bg-gradient-to-br from-blue-100 to-blue-300 text-primary flex items-center justify-center shrink-0">
                        <Ship className="h-12 w-12" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-1 text-sm">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-semibold text-[#001F3F]">{selectedBoat?.name}</span>
                        <span className="text-xs rounded-full bg-green-100 text-green-700 px-2 py-0.5">{selectedBoat?.state}</span>
                      </div>
                      <div>Capacité totale : <b>{selectedBoat?.capacity} T</b></div>
                      <div>Places disponibles : <b>{boatPlaces ?? "—"}</b></div>
                      <div className="text-gray-600">{boatEquipments || "Équipements : —"}</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-blue-50 p-2 text-primary">
                      <div className="text-[11px] text-gray-600">Poids supporté par le bateau</div>
                      <div className="font-bold">{selectedBoat?.capacity} T</div>
                    </div>
                    <div className={`rounded-lg p-2 ${isOverloaded ? "bg-red-50 text-red-600" : "bg-green-50 text-green-700"}`}>
                      <div className="text-[11px]">Poids restant</div>
                      <div className="font-bold">{remainingKg / 1000} T</div>
                      {isOverloaded && (
                        <div className="flex items-center justify-center gap-1 text-[10px]">
                          <AlertTriangle className="h-3 w-3" /> Dépassement
                        </div>
                      )}
                    </div>
                    <div className="rounded-lg bg-green-50 p-2 text-green-700">
                      <div className="text-[11px]">Poids actuel</div>
                      <div className="font-bold">{currentWeightKg / 1000} T</div>
                    </div>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Choisissez d'abord un voyage.</p>
              )}
            </CardContent>
          </Card>

          {/* Actions rapides */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <SectionTitle icon={Zap} title="Actions rapides" />
              <Button className="w-full" onClick={() => payTotal(priceTotal)}>
                <CreditCard className="w-4 h-4 mr-2" />
                Payer la totalité
              </Button>
              <Button className="w-full" variant="outline" onClick={generateLotNumber}>
                <Tag className="w-4 h-4 mr-2" />
                Générer étiquette
              </Button>
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm flex items-center gap-2">
                <Barcode className="h-4 w-4" /> Numéro de lot :
                <span className="rounded bg-slate-200/70 px-2 py-0.5 font-medium">{lotNumber || "Non généré"}</span>
              </div>
              {lotNumber !== "" && <QrCode idendifiant={lotNumber} />}
            </CardContent>
          </Card>

          {/* Paiement */}
          <Card>
            <CardContent className="pt-6 space-y-3">
              <SectionTitle icon={Wallet} color="bg-green-700" title="Paiement" />
              <LigneInfo icon={Banknote} label="Prix total" value={fmtAr(priceTotal)} />
              <div className="flex items-center gap-2">
                <Label className="whitespace-nowrap">Montant payé :</Label>
                <Input type="number" value={formData.amountPaidByClient} onChange={(v) => handleInput("amountPaidByClient", Number(v.target.value) || 0)} className="w-full" />
              </div>
              <div className="text-sm">
                Moyen de paiement : <span className="font-medium">{MOYENS_PAIEMENT[paymentMethod]}</span>
              </div>
              {formData.rest >= 0 ? (
                <LigneInfo icon={Wallet} label="Montant restant" value={fmtAr(formData.rest)} danger={formData.rest > 0} />
              ) : (
                <p className="text-red-600 text-sm">Le montant saisi est supérieur</p>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ===== Informations sur le client (expéditeur + destinataire) ===== */}
        <Card>
          <CardContent className="pt-6 space-y-5">
            <SectionTitle icon={User} title="Informations sur le client" subtitle="Vos coordonnées pour la réservation." />

            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <FieldBox icon={User}>
                <InputField label="Nom complet *" value={formData.senderName} error={errors.senderName} onChange={(v) => handleInput("senderName", v)} />
              </FieldBox>
              <FieldBox icon={Phone}>
                <InputField label="Téléphone * (10 chiffres)" value={formData.senderPhone} error={errors.senderPhone} onChange={(v) => handlePhone("senderPhone", v)} />
              </FieldBox>
              <FieldBox icon={Mail}>
                <InputField label="E-mail" value={clientEmail} onChange={(v) => setClientEmail(String(v))} />
              </FieldBox>
              <FieldBox icon={StickyNote}>
                <InputField label="Notes (facultatif)" value={clientNotes} onChange={(v) => setClientNotes(String(v))} />
              </FieldBox>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <FieldBox icon={MapPin}>
                <InputField label="Adresse de l'expéditeur *" value={formData.senderAddress} error={errors.senderAddress} onChange={(v) => handleInput("senderAddress", v)} />
              </FieldBox>
            </div>

            <div>
              <h4 className="font-semibold mb-2 flex items-center gap-2"><User className="h-4 w-4" /> Destinataire</h4>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <FieldBox icon={User}>
                  <InputField label="Nom complet" value={formData.recipientName} error={errors.recipientName} onChange={(v) => handleInput("recipientName", v)} />
                </FieldBox>
                <FieldBox icon={Phone}>
                  <InputField label="Téléphone (10 chiffres)" value={formData.recipientPhone} error={errors.recipientPhone} onChange={(v) => handlePhone("recipientPhone", v)} />
                </FieldBox>
                <FieldBox icon={MapPin}>
                  <InputField label="Adresse" value={formData.recipientAddress} error={errors.recipientAddress} onChange={(v) => handleInput("recipientAddress", v)} />
                </FieldBox>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* ===== Confirmer ===== */}
        <Button className="w-full px-6 py-6 text-lg rounded-xl" onClick={onAdd} disabled={isSaving}>
          <CheckCircle className="w-5 h-5 mr-2" />
          {isSaving ? "Enregistrement..." : "Confirmer réservation"}
          {!isSaving && <ArrowRight className="w-5 h-5 ml-2" />}
        </Button>
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