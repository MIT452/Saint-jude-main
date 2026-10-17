// src/components/GoodsIcon.tsx
// Petite icône ronde d'une marchandise, choisie automatiquement par l'IA selon le nom.
// Utilisable partout : <GoodsIcon name={good.itemName} />
import { useEffect, useState, FC } from "react";
import { FALLBACK_ICON, getKnownIcon, resolveIcon } from "../utils/goodsIcons";

interface GoodsIconProps {
  name: string;
  className?: string;
}

// Si l'IA n'a pas répondu (serveur qui se réveille, limite d'appels...), on réessaie après 15 s, 30 s, 45 s
const MAX_RETRIES = 3;
const RETRY_STEP_MS = 15000;

const GoodsIcon: FC<GoodsIconProps> = ({ name, className = "" }) => {
  const [icon, setIcon] = useState<string>(() => getKnownIcon(name) ?? FALLBACK_ICON);
  const [loading, setLoading] = useState<boolean>(() => !getKnownIcon(name) && name.trim() !== "");

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let tries = 0;

    const load = () => {
      const known = getKnownIcon(name);
      if (known) {
        setIcon(known);
        setLoading(false);
        return;
      }
      if (!name.trim()) {
        setIcon(FALLBACK_ICON);
        setLoading(false);
        return;
      }
      setIcon(FALLBACK_ICON);
      setLoading(true);
      resolveIcon(name).then((i) => {
        if (cancelled) return;
        setIcon(i);
        setLoading(false);
        // Pas d'icône trouvée : nouvel essai plus tard
        if (i === FALLBACK_ICON && !getKnownIcon(name) && tries < MAX_RETRIES) {
          tries += 1;
          timer = setTimeout(load, RETRY_STEP_MS * tries);
        }
      });
    };

    load();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
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