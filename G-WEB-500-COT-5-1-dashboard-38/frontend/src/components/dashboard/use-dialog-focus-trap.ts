import { useEffect, useRef } from "react";
import type { RefObject } from "react";

// Focus trap partagé par les modales du dashboard (ajout / édition de widget) :
// à l'ouverture, mémorise l'élément focusé, déplace le focus dans la modale,
// piège Tab/Shift+Tab dans le dialogue, ferme sur Escape et restaure le focus
// d'origine à la fermeture.
export function useDialogFocusTrap(
  open: boolean,
  dialogRef: RefObject<HTMLDivElement | null>,
  closeRef: RefObject<HTMLButtonElement | null>,
  onClose: () => void,
): void {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    if (!open) return;
    const lastFocused = document.activeElement as HTMLElement | null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== "Tab" || !dialogRef.current) return;
      const focusables = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || !dialogRef.current.contains(active))) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && active === last) {
        event.preventDefault();
        first.focus();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      lastFocused?.focus();
    };
  }, [open, dialogRef, closeRef]);
}
