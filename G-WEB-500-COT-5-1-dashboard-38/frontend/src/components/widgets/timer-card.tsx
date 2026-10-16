"use client";

// Minuteur à cartes basculantes, placé à côté de la TimeCard en haut du dashboard.
// Remplace une ancienne carte de démonstration musicale, codée en dur
// (trois morceaux factices) affichée sur tous les dashboards sans lire aucune
// donnée — donc un widget qui "ne savait rien".
//
// Comportement : marche / pause / réinit, durée réglable (crayon : heures,
// minutes, secondes ou préréglages), 25 min par défaut. Durée et état sont
// conservés en localStorage pour survivre à un rechargement.
//
// Le décompte est calculé depuis une échéance (deadline) et non décrémenté d'une
// seconde par tick : un onglet en arrière-plan voit ses timers ralentis, et une
// simple décrémentation dériverait de plusieurs secondes par heure. Le tick est
// à 250 ms et l'état n'est écrit que si la seconde affichée change réellement.

import { useCallback, useEffect, useRef, useState } from "react";

import {
  CheckIcon,
  CloseIcon,
  PauseIcon,
  PenIcon,
  PlayIcon,
  RefreshIcon,
} from "@/components/icons";
import { FlipCountdown } from "@/components/ui/flip-countdown";

const DEFAULT_SECONDS = 25 * 60;
// Deux chiffres par groupe dans l'affichage : 23:59:59 au maximum.
const MAX_SECONDS = 23 * 3600 + 59 * 60 + 59;
const PRESET_MINUTES = [5, 15, 25, 45];
const STORAGE_KEY = "hubly:timer";
const TICK_MS = 250;

const TIMER_FONT = "'Gill Sans', 'Gill Sans MT', Calibri, 'Trebuchet MS', sans-serif";

type Persisted = { remaining: number; deadline: number | null; duration?: number };

function isValidDuration(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value > 0 && value <= MAX_SECONDS;
}

function clampPart(raw: string, max: number): number {
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? Math.min(Math.max(value, 0), max) : 0;
}

// Réglage de la durée, à la place des chiffres : HH:MM:SS + préréglages.
// Entrée valide, Échap annule.
function DurationEditor({
  initial,
  onSave,
  onCancel,
}: {
  initial: number;
  onSave: (seconds: number) => void;
  onCancel: () => void;
}) {
  const start = format(initial);
  const [parts, setParts] = useState({
    hours: String(start.hours).padStart(2, "0"),
    minutes: String(start.minutes).padStart(2, "0"),
    seconds: String(start.seconds).padStart(2, "0"),
  });
  const firstInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    firstInput.current?.focus();
    firstInput.current?.select();
  }, []);

  const total =
    clampPart(parts.hours, 23) * 3600 +
    clampPart(parts.minutes, 59) * 60 +
    clampPart(parts.seconds, 59);

  const fields = [
    { key: "hours", label: "Heures", max: 23 },
    { key: "minutes", label: "Minutes", max: 59 },
    { key: "seconds", label: "Secondes", max: 59 },
  ] as const;

  const inputClass =
    "h-10 w-12 rounded-lg bg-[#0f1724] text-center text-xl font-semibold tabular-nums text-white ring-1 ring-white/15 outline-none transition-shadow [appearance:textfield] focus:ring-2 focus:ring-white/60 [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none";
  const smallButton =
    "flex h-9 items-center justify-center whitespace-nowrap rounded-lg text-xs font-medium ring-1 transition-colors duration-150 focus-visible:outline focus-visible:outline-2";

  return (
    <form
      className="flex flex-col gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (total > 0) onSave(total);
      }}
      onKeyDown={(event) => {
        if (event.key === "Escape") onCancel();
      }}
    >
      <div className="flex items-center gap-1">
        {fields.map((field, index) => (
          <div key={field.key} className="flex items-center gap-1">
            {index > 0 ? (
              <span className="text-lg text-white/45" aria-hidden="true">
                :
              </span>
            ) : null}
            <input
              ref={index === 0 ? firstInput : undefined}
              type="number"
              inputMode="numeric"
              min={0}
              max={field.max}
              aria-label={field.label}
              value={parts[field.key]}
              onChange={(event) =>
                setParts((current) => ({ ...current, [field.key]: event.target.value }))
              }
              onFocus={(event) => event.target.select()}
              className={inputClass}
            />
          </div>
        ))}
      </div>
      <div className="flex items-center gap-1.5">
        {PRESET_MINUTES.map((minutes) => (
          <button
            key={minutes}
            type="button"
            onClick={() => onSave(minutes * 60)}
            aria-label={`${minutes} minutes`}
            className={`${smallButton} min-w-10 px-2.5 text-white/80 ring-white/15 hover:bg-white/15 hover:text-white ${
              total === minutes * 60 ? "bg-white/20 text-white" : "bg-white/5"
            }`}
          >
            {minutes}m
          </button>
        ))}
        <span className="flex-1" />
        <button
          type="button"
          onClick={onCancel}
          aria-label="Annuler"
          title="Annuler"
          className={`${smallButton} w-9 bg-white/5 text-white/70 ring-white/15 hover:bg-white/15 hover:text-white`}
        >
          <CloseIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          type="submit"
          disabled={total <= 0}
          aria-label="Valider la durée"
          title="Valider"
          className={`${smallButton} w-9 bg-white text-[#141e30] ring-white hover:bg-white/90 disabled:cursor-not-allowed disabled:opacity-40`}
        >
          <CheckIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    </form>
  );
}

function format(totalSeconds: number): { hours: number; minutes: number; seconds: number } {
  const safe = Math.max(0, Math.floor(totalSeconds));
  return {
    hours: Math.floor(safe / 3600),
    minutes: Math.floor((safe % 3600) / 60),
    seconds: safe % 60,
  };
}

function spokenLabel(seconds: number, running: boolean): string {
  const { minutes, seconds: secs } = format(seconds);
  const state = running ? "en cours" : seconds === 0 ? "terminé" : "en pause";
  const parts = [`Minuteur ${state}`];
  if (minutes > 0) parts.push(`${minutes} minute${minutes > 1 ? "s" : ""}`);
  if (minutes > 0 || secs > 0) parts.push(`${secs} seconde${secs > 1 ? "s" : ""}`);
  return parts.join(", ");
}

export default function TimerCard() {
  // Valeurs neutres au premier rendu : le serveur ne peut pas connaître le
  // localStorage du navigateur, et le HTML SSR doit être identique au premier
  // rendu client (même raison que useNow() dans time-card.tsx). L'état réel
  // n'est restauré qu'après l'hydratation.
  const [duration, setDuration] = useState(DEFAULT_SECONDS);
  const [remaining, setRemaining] = useState(DEFAULT_SECONDS);
  const [deadline, setDeadline] = useState<number | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [editing, setEditing] = useState(false);

  const running = deadline !== null;

  // Restauration après hydratation.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Persisted;
        const savedDuration = isValidDuration(saved.duration) ? saved.duration : DEFAULT_SECONDS;
        setDuration(savedDuration);
        setRemaining(savedDuration);
        if (typeof saved.remaining === "number" && saved.remaining >= 0) {
          setRemaining(Math.min(saved.remaining, savedDuration));
          if (typeof saved.deadline === "number") {
            // Un minuteur laissé ouvert avant la fermeture doit reprendre au
            // bon endroit : on recalcule depuis l'échéance, pas depuis un
            // reste figé.
            const left = Math.ceil((saved.deadline - Date.now()) / 1000);
            if (left > 0) {
              setRemaining(Math.min(left, savedDuration));
              setDeadline(saved.deadline);
            }
          }
        }
      }
    } catch {
      // localStorage indisponible (mode privé, quota) : on garde la durée par défaut
    }
    setHydrated(true);
  }, []);

  // Persistance. Écrit aussi juste après l'hydratation pour ne pas effacer un
  // état restauré avant que le premier tick n'ait eu lieu.
  useEffect(() => {
    if (!hydrated) return;
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ remaining, deadline, duration }));
    } catch {
      // stockage indisponible : le minuteur fonctionne quand même, sans reprise
    }
  }, [remaining, deadline, duration, hydrated]);

  // Décompte. Intervalle court, mais on n'écrit l'état que si la seconde visible
  // change — sinon 4 re-render par seconde pour rien.
  useEffect(() => {
    if (deadline === null) return;

    const tick = () => {
      const left = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setRemaining((prev) => (prev === left ? prev : left));
      if (left <= 0) setDeadline(null);
    };

    tick();
    const timer = window.setInterval(tick, TICK_MS);
    return () => window.clearInterval(timer);
  }, [deadline]);

  const start = useCallback(() => {
    if (remaining <= 0) return;
    setDeadline(Date.now() + remaining * 1000);
  }, [remaining]);

  const pause = useCallback(() => {
    setDeadline(null);
  }, []);

  const reset = useCallback(() => {
    setDeadline(null);
    setRemaining(duration);
  }, [duration]);

  const saveDuration = useCallback((seconds: number) => {
    setDeadline(null);
    setDuration(seconds);
    setRemaining(seconds);
    setEditing(false);
  }, []);

  const { hours, minutes, seconds } = format(remaining);
  const finished = remaining <= 0;

  const digitStyle = {
    // Les cartes sont plus sombres que le fond de la TimeCard pour garder le
    // contraste des chiffres, et la ligne médiane doit trancher.
    "--flip-card-bg": finished ? "#3a2020" : "#0f1724",
    "--flip-card-text": "#ffffff",
    "--flip-separator-color": "rgba(255,255,255,0.45)",
  } as React.CSSProperties;

  const controls = [
    {
      key: "start",
      label: running ? "En cours" : finished ? "Terminé" : "Démarrer",
      icon: <PlayIcon className="h-3.5 w-3.5" aria-hidden="true" />,
      onClick: start,
      disabled: running || finished,
    },
    {
      key: "pause",
      label: "Pause",
      icon: <PauseIcon className="h-3.5 w-3.5" aria-hidden="true" />,
      onClick: pause,
      disabled: !running,
    },
    {
      key: "reset",
      label: "Réinitialiser",
      icon: <RefreshIcon className="h-3.5 w-3.5" aria-hidden="true" />,
      onClick: reset,
      disabled: running && remaining === duration,
    },
    {
      key: "edit",
      label: "Modifier la durée",
      icon: <PenIcon className="h-3.5 w-3.5" aria-hidden="true" />,
      onClick: () => setEditing(true),
      disabled: running,
    },
  ];

  return (
    <div
      className="group relative flex h-[150px] w-full max-w-[300px] flex-col justify-center gap-2 overflow-hidden rounded-[15px] p-4 text-white transition-[box-shadow] duration-300 ease-in-out hover:shadow-[0_0px_50px_rgba(0,0,0,1)]"
      style={{
        background: "linear-gradient(to right, rgb(20,30,48), rgb(36,59,85))",
        boxShadow: "rgba(0,0,0,0.7) 5px 10px 50px, rgba(0,0,0,0.7) -5px 0px 250px",
        fontFamily: TIMER_FONT,
      }}
      role="timer"
      aria-live="off"
      aria-label={spokenLabel(remaining, running)}
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-medium uppercase tracking-[0.18em] text-white/55">
          Minuteur
        </span>
        <span
          className={
            running
              ? "text-[10px] font-medium uppercase tracking-wide text-emerald-300/90"
              : "text-[10px] font-medium uppercase tracking-wide text-white/40"
          }
        >
          {editing ? "Durée" : running ? "En cours" : finished ? "Terminé" : "En pause"}
        </span>
      </div>

      {editing ? (
        <DurationEditor
          initial={duration}
          onSave={saveDuration}
          onCancel={() => setEditing(false)}
        />
      ) : (
        <>
          {/* controlled : c'est cette carte qui détient l'échéance, les groupes ne
          font que refléter la valeur qu'elle leur passe (sinon ils comptent de
          leur côté et divergent du libellé). digits=2 : la largeur ne saute pas
          au passage de 09 à 10. Couleurs héritées des variables CSS du parent. */}
          <div className="flex items-center text-[30px]" style={digitStyle}>
            <FlipCountdown countFrom={hours} countTo={0} digits={2} duration="0.5s" controlled />
            <span className="flip-countdown-separator" aria-hidden="true">
              :
            </span>
            <FlipCountdown countFrom={minutes} countTo={0} digits={2} duration="0.5s" controlled />
            <span className="flip-countdown-separator" aria-hidden="true">
              :
            </span>
            <FlipCountdown countFrom={seconds} countTo={0} digits={2} duration="0.5s" controlled />
          </div>

          <div className="flex items-center gap-2">
            {controls.map((control) => (
              <button
                key={control.key}
                type="button"
                onClick={control.onClick}
                disabled={control.disabled}
                aria-label={control.label}
                title={control.label}
                // États pressés par couleur/opacité uniquement : un transform
                // bomberait les boutons et ferait jitter la rangée.
                className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 text-white/85 ring-1 ring-white/15 transition-colors duration-150 hover:bg-white/20 hover:text-white focus-visible:outline focus-visible:outline-2 disabled:cursor-not-allowed disabled:bg-white/5 disabled:text-white/25 disabled:ring-white/5"
              >
                {control.icon}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
