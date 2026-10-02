import { useEffect, useState } from "react";
import { CATEGORIES } from "../data/seed.js";

export function Logo({ size = "sm", className = "" }) {
  return (
    <img
      src={size === "lg" ? "/brand/logo.webp" : "/brand/logo-sm.webp"}
      alt="Alma"
      className={`logo logo-${size} ${className}`}
      width={size === "lg" ? 1100 : 360}
      height={size === "lg" ? 659 : 216}
    />
  );
}

export function BrandIcon({ name, size = 32, alt = "", className = "" }) {
  return <img src={`/brand/icons/${name}.webp`} alt={alt} width={size} height={size} className={`brand-icon ${className}`} style={{ width: size, height: size }} loading="lazy" />;
}

export function productIcon(p) {
  return p.icon || CATEGORIES.find((c) => c.id === p.category)?.icon || "basket";
}

const MOOD_LABEL = {
  alma: "Alma",
  neutral: "Alma atenta",
  smile: "Alma sonriendo",
  happy: "Alma contenta",
  surprised: "Alma sorprendida",
  sad: "Alma preocupada",
  wink: "Alma guiñando el ojo",
};

// El isotipo es una marca viva: cambia de gesto según lo que pasa en el local.
export function AlmaFace({ mood = "smile", size = 120, className = "", alt, animate = true }) {
  const [shown, setShown] = useState(mood);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (mood === shown) return;
    setShown(mood);
    if (!animate) return;
    setPop(true);
    const t = setTimeout(() => setPop(false), 420);
    return () => clearTimeout(t);
  }, [mood, shown, animate]);

  return (
    <img
      src={`/brand/faces/${shown}.webp`}
      alt={alt ?? MOOD_LABEL[shown]}
      className={`alma-face ${pop ? "is-pop" : ""} ${className}`}
      style={{ width: size, height: "auto" }}
      width={size}
      height={Math.round(size * 1.1)}
    />
  );
}

export function SectionTitle({ title, kicker, as: Tag = "h2", size = "md", className = "" }) {
  return (
    <div className={`section-title st-${size} ${className}`}>
      <Tag className="display">{title}</Tag>
      {kicker && <p className="kicker">{kicker}</p>}
    </div>
  );
}

// Preload de gestos para que el cambio de cara sea instantáneo.
export function preloadFaces() {
  ["neutral", "smile", "happy", "surprised", "sad", "wink"].forEach((m) => {
    const img = new Image();
    img.src = `/brand/faces/${m}.webp`;
  });
}
