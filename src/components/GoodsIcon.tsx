// src/components/GoodsIcon.tsx
// Petite icône ronde d'une marchandise, choisie automatiquement par l'IA selon le nom.
// Utilisable partout : <GoodsIcon name={good.itemName} />
import { useEffect, useState, FC } from "react";
import { FALLBACK_ICON, getKnownIcon, resolveIcon } from "../utils/goodsIcons";

interface GoodsIconProps {
  name: string;
  className?: string;
}

const GoodsIcon: FC<GoodsIconProps> = ({ name, className = "" }) => {
  const [icon, setIcon] = useState<string>(() => getKnownIcon(name) ?? FALLBACK_ICON);
  const [loading, setLoading] = useState<boolean>(() => !getKnownIcon(name));

  useEffect(() => {
    let cancelled = false;
    const known = getKnownIcon(name);
    if (known) {
      setIcon(known);
      setLoading(false);
      return;
    }
    setIcon(FALLBACK_ICON);
    setLoading(true);
    resolveIcon(name).then((i) => {
      if (cancelled) return;
      setIcon(i);
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [name]);

  return (
    <span
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100 text-lg ${loading ? "animate-pulse" : ""} ${className}`}
      title={name}
      aria-label={name}
    >
      {icon}
    </span>
  );
};

export default GoodsIcon;