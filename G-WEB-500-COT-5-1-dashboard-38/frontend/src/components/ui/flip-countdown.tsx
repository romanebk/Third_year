"use client";

// Affiche à cartes basculantes, adaptée d'un composant fourni à l'origine.
// Chaque chiffre est une FlipUnit (deux demi-cartes + un basculeur en 3D) ; le
// CSS qui fait le reste est dans src/app/globals.css (.flip-*).
//
// Écarts assumés par rapport à la version d'origine :
// - `cn` vient de @/lib/utils (le composant provided le redéfinissait, en
//   doublant l'utilitaire déjà présent dans le projet) ;
// - la conversion en BigInt est défensive : `BigInt("abc")` lève, ce qui faisait
//   tomber tout l'arbre au premier caractère non numérique ;
// - prop `digits` : sans elle, la largeur d'un groupe suit la longueur du
//   nombre et saute au passage de 9 à 10 chiffres (minutes, heures) ;
// - `aria-hidden` sur les chiffres, le sens porté par aria-label + role="timer".

import { useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

// Le projet compile en target ES2017, où les littéraux BigInt (0n) sont refusés
// par TypeScript. On passe donc par le constructeur — le type BigInt reste
// disponible puisque "lib" inclut esnext.
const BIG_ZERO = BigInt(0);
const BIG_ONE = BigInt(1);
const BIG_MINUS_ONE = BigInt(-1);

function toBigInt(value: number | string | bigint | undefined, fallback: bigint): bigint {
  if (value === undefined) return fallback;
  try {
    return BigInt(value);
  } catch {
    return fallback;
  }
}

// Une seule position. Les deux demi-cartes statiques portent l'état de repos,
// le basculeur porte l'animation.
function FlipUnit({
  digit,
  cardStyle,
  duration,
}: {
  digit: string;
  cardStyle: React.CSSProperties;
  duration?: string;
}) {
  const [currentDigit, setCurrentDigit] = useState(digit);
  const [previousDigit, setPreviousDigit] = useState(digit);
  const [isFlipping, setIsFlipping] = useState(false);

  useEffect(() => {
    if (digit === currentDigit) return;
    setPreviousDigit(currentDigit);
    setCurrentDigit(digit);
    setIsFlipping(true);
  }, [digit, currentDigit]);

  // `forwards` laisse le basculeur à -180deg (nouvelle face visible) ; on
  // referrals l'état de repos une fois l'animation terminée.
  const handleAnimationEnd = () => {
    setIsFlipping(false);
    setPreviousDigit(digit);
  };

  const flipperStyle = duration ? ({ "--flip-duration": duration } as React.CSSProperties) : undefined;

  return (
    <div className="flip-unit" style={cardStyle} aria-hidden="true">
      <div className="flip-card flip-card__bottom">
        <span className="flip-glyph">{currentDigit}</span>
      </div>
      <div className="flip-card flip-card__top">
        <span className="flip-glyph">{previousDigit}</span>
      </div>
      <div
        className={cn("flipper", isFlipping && "is-flipping")}
        style={flipperStyle}
        onAnimationEnd={handleAnimationEnd}
      >
        <div className="flip-card flipper__top">
          <span className="flip-glyph">{previousDigit}</span>
        </div>
        <div className="flip-card flipper__bottom">
          <span className="flip-glyph">{currentDigit}</span>
        </div>
      </div>
    </div>
  );
}

export const FlipCountdown = ({
  countFrom = 99,
  countTo = 0,
  controlled = false,
  digits,
  className,
  cardBgColor,
  textColor,
  separatorColor,
  duration,
  label,
}: {
  countFrom?: number | string | bigint;
  countTo?: number | string | bigint;
  /**
   * Mode piloté : la valeur affichée est celle de `countFrom` et le composant
   * n'anime que le changement de chiffre. À utiliser quand le parent détient
   * l'état du décompte (une échéance, une pause, un reset) — sinon ce composant
   * compte de son côté et affiche une valeur en désaccord avec la source.
   */
  controlled?: boolean;
  /** Nombre de positions fixes ; sinon déduit de la plus grande valeur. */
  digits?: number;
  className?: string;
  cardBgColor?: string;
  textColor?: string;
  separatorColor?: string;
  /** Durée du basculement, ex. "0.55s" (--flip-duration). */
  duration?: string;
  /** annoncé par role="timer" ; les chiffres restent masqués aux lecteurs. */
  label?: string;
}) => {
  const from = useMemo(() => toBigInt(countFrom, BIG_ZERO), [countFrom]);
  const to = useMemo(() => toBigInt(countTo, BIG_ZERO), [countTo]);

  const isCountingDown = from > to;
  const [count, setCount] = useState(from);
  const value = controlled ? from : count;

  useEffect(() => {
    // En mode piloté c'est le parent qui fait avancer la valeur.
    if (controlled) return;
    // Arrivé à la cible : on stoppe (le minuteur 00:00:00 ne repart pas tout seul).
    if ((isCountingDown && count <= to) || (!isCountingDown && count >= to)) return;

    const timer = setInterval(() => {
      setCount((prev) => (isCountingDown ? prev + BIG_MINUS_ONE : prev + BIG_ONE));
    }, 1000);

    return () => clearInterval(timer);
  }, [count, to, isCountingDown, controlled]);

  const paddedCount = useMemo(() => {
    const numDigits = digits ?? String(from > to ? from : to).length;
    // Une valeur négative s'afficherait avec un "-" qui déborde de la carte :
    // on la borne à 0, le minuteur s'arrêtant de toute façon sur `to`.
    const display = value < BIG_ZERO ? BIG_ZERO : value;
    return String(display).padStart(numDigits, "0");
  }, [value, from, to, digits]);

  const cardStyle = {
    "--flip-card-bg": cardBgColor,
    "--flip-card-text": textColor,
    "--flip-separator-color": separatorColor,
  } as React.CSSProperties;

  return (
    <div
      className={cn("flip-countdown-container", className)}
      style={cardStyle}
      // role="timer" seulement si ce composant porte lui-même l'accessibilité ;
      // le minuteur du dashboard annonce l'état sur sa racine et n'en a pas
      // besoin ici (sinon trois minuteurs dans une seule carte).
      role={label ? "timer" : undefined}
      aria-label={label}
    >
      {paddedCount.split("").map((digit, index) => (
        <FlipUnit key={index} digit={digit} cardStyle={cardStyle} duration={duration} />
      ))}
    </div>
  );
};

export default FlipCountdown;
