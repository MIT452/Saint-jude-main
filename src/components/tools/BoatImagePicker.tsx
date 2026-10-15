import { FC, useRef } from "react";
import { ImagePlus, Trash2, Ship } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "../ui/button";
import { Label } from "../ui/label";

const MAX_SIZE = 640; // px

// Lit le fichier, le redimensionne et le compresse en JPEG (data URL)
const fileToDataUrl = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Lecture impossible"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("Image invalide"));
      img.onload = () => {
        const ratio = Math.min(1, MAX_SIZE / Math.max(img.width, img.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.round(img.width * ratio);
        canvas.height = Math.round(img.height * ratio);
        const ctx = canvas.getContext("2d");
        if (!ctx) return reject(new Error("Canvas indisponible"));
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", 0.8));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });

interface Props {
  value?: string;
  onChange: (dataUrl: string) => void;
}

const BoatImagePicker: FC<Props> = ({ value, onChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez choisir un fichier image.");
      return;
    }
    try {
      onChange(await fileToDataUrl(file));
    } catch {
      toast.error("Impossible de charger cette image.");
    }
    e.target.value = ""; // permet de re-choisir le même fichier
  };

  return (
    <div className="flex flex-col gap-2">
      <Label>Image du bateau</Label>
      <div className="flex items-center gap-4">
        <div className="h-24 w-32 rounded-lg border bg-slate-100 overflow-hidden flex items-center justify-center">
          {value ? (
            <img src={value} alt="Aperçu du bateau" className="h-full w-full object-cover" />
          ) : (
            <Ship className="h-8 w-8 text-gray-400" />
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          <Button type="button" variant="outline" onClick={() => inputRef.current?.click()}>
            <ImagePlus className="h-4 w-4 mr-2" />
            {value ? "Changer l'image" : "Choisir une image"}
          </Button>
          {value && (
            <Button type="button" variant="ghost" className="text-red-600" onClick={() => onChange("")}>
              <Trash2 className="h-4 w-4 mr-2" /> Supprimer
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BoatImagePicker;