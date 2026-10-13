// src/components/GoodsIcon.tsx
// Petite icône ronde d'une marchandise. Utilisable partout :
// <GoodsIcon name={good.itemName} />
import { useEffect, useState, FC } from "react";
import { ICONS, getKnownIconKey, resolveIconKey } from "../utils/goodsIcons";

interface GoodsIconProps {
  name: string;
  className?: string;
}

const GoodsIcon: FC<GoodsIconProps> = ({ name, className = "" }) => {
  const [key, setKey] = useState<string>(() => getKnownIconKey(name) ?? "package");

  useEffect(() => {
    let cancelled = false;
    const known = getKnownIconKey(name);
    if (known) {
      setKey(known);
      return;
    }
    setKey("package"); // affichage immédiat du secours, puis l'IA corrige
    resolveIconKey(name).then((k) => {
      if (!cancelled) setKey(k);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg ${className}`}
      title={name}
      aria-label={name}
    >
      {ICONS[key] ?? ICONS.package}
    </span>
  );
};

export default GoodsIcon;