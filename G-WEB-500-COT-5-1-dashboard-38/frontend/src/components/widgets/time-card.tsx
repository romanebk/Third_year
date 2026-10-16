"use client";

// Carte "heure du jour" adaptée du composant styled-components fourni : fond en
// dégradé marine (rgb(20,30,48) -> rgb(36,59,85)), heure en gros + petit suffixe
// AM/PM, jour, une lune en haut à droite qui grossit doucement au survol, ombre
// profonde. Contrairement au modèle statique ("11:11 PM / Wednesday, June 15th"),
// elle affiche l'heure et la date locales réelles. Remplace la rangée de cartes
// statistiques du haut du dashboard.

import { useEffect, useState } from "react";

const TIME_FONT = "'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif";

const ORDINAL_SUFFIX: Record<number, string> = {
  1: "st",
  2: "nd",
  3: "rd",
  21: "st",
  22: "nd",
  23: "rd",
  31: "st",
};

function ordinal(day: number): string {
  return ORDINAL_SUFFIX[day] ?? "th";
}

// null tant que non montée : le serveur ne peut pas connaître "l'heure exacte
// au moment de l'hydratation côté client" (elle a forcément dérivé d'au moins
// quelques centaines de ms), donc calculer new Date() pendant le rendu SSR
// produit un texte différent de celui du premier rendu client -> hydration
// mismatch React. En ne remplissant l'heure réelle que dans useEffect (donc
// après l'hydratation), le HTML serveur et le premier rendu client sont tous
// les deux vides/identiques, et seule une mise à jour purement client suit.
function useNow(): Date | null {
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

export default function TimeCard() {
  const now = useNow();

  // now === null le temps du tout premier rendu client (avant que useEffect ne
  // tourne) : mêmes valeurs de repli que le HTML serveur, pour que ce premier
  // rendu client corresponde exactement (cf. commentaire de useNow ci-dessus).
  const [hours, minutes, period] = now
    ? new Intl.DateTimeFormat("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
        .format(now)
        .split(/[:\s]+/)
    : ["--", "--", ""];

  const weekday = now ? new Intl.DateTimeFormat("en-US", { weekday: "long" }).format(now) : "";
  const month = now ? new Intl.DateTimeFormat("en-US", { month: "long" }).format(now) : "";
  const day = now ? now.getDate() : null;

  return (
    <div
      className="group relative flex h-[150px] w-full max-w-[300px] cursor-pointer flex-col justify-center overflow-hidden rounded-[15px] text-white transition-[box-shadow] duration-300 ease-in-out hover:shadow-[0_0px_50px_rgba(0,0,0,1)]"
      style={{
        background: "linear-gradient(to right, rgb(20,30,48), rgb(36,59,85))",
        boxShadow: "rgba(0,0,0,0.7) 5px 10px 50px, rgba(0,0,0,0.7) -5px 0px 250px",
      }}
      aria-label={`Current time ${hours}:${minutes} ${period}, ${weekday}, ${month} ${day ?? ""}${day ? ordinal(day) : ""}`}
    >
      <p
        className="ml-4 text-[50px] font-semibold leading-[1.05]"
        style={{ fontFamily: TIME_FONT }}
      >
        <span className="tabular-nums">{hours}:{minutes}</span>
        <span className="ml-1.5 text-[15px]">{period}</span>
      </p>
      <p
        className="ml-4 mt-1 text-[18px] font-medium"
        style={{ fontFamily: TIME_FONT }}
      >
        {weekday}, {month} {day}
        <sup className="text-[11px]">{day ? ordinal(day) : ""}</sup>
      </p>
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width="1em"
        height="1em"
        viewBox="0 0 16 16"
        strokeWidth={0}
        fill="currentColor"
        stroke="currentColor"
        className="absolute right-[15px] top-[15px] text-[20px] transition-all duration-300 ease-in-out group-hover:scale-110 group-hover:text-[23px]"
        aria-hidden="true"
      >
        <path d="M6 .278a.768.768 0 0 1 .08.858 7.208 7.208 0 0 0-.878 3.46c0 4.021 3.278 7.277 7.318 7.277.527 0 1.04-.055 1.533-.16a.787.787 0 0 1 .81.316.733.733 0 0 1-.031.893A8.349 8.349 0 0 1 8.344 16C3.734 16 0 12.286 0 7.71 0 4.266 2.114 1.312 5.124.06A.752.752 0 0 1 6 .278z" />
        <path d="M10.794 3.148a.217.217 0 0 1 .412 0l.387 1.162c.173.518.579.924 1.097 1.097l1.162.387a.217.217 0 0 1 0 .412l-1.162.387a1.734 1.734 0 0 0-1.097 1.097l-.387 1.162a.217.217 0 0 1-.412 0l-.387-1.162A1.734 1.734 0 0 0 9.31 6.593l-1.162-.387a.217.217 0 0 1 0-.412l1.162-.387a1.734 1.734 0 0 0 1.097-1.097l.387-1.162zM13.863.099a.145.145 0 0 1 .274 0l.258.774c.115.346.386.617.732.732l.774.258a.145.145 0 0 1 0 .274l-.774.258a1.156 1.156 0 0 0-.732.732l-.258.774a.145.145 0 0 1-.274 0l-.258-.774a1.156 1.156 0 0 0-.732-.732l-.774-.258a.145.145 0 0 1 0-.274l.774-.258c.346-.115.617-.386.732-.732L13.863.1z" />
      </svg>
    </div>
  );
}