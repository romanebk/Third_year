import { useEffect, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function Modal({
  open,
  title,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[1200] flex items-end justify-center p-3 sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/55"
        aria-label="Fermer"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        className="relative z-[1201] max-h-[90vh] w-full max-w-[520px] overflow-auto rounded-block bg-paper p-6 shadow-card"
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <h2 id="modal-title" className="text-[22px]">
            {title}
          </h2>
          <button type="button" className="btn btn-outline px-4 py-2 text-[13px]" onClick={onClose}>
            Fermer
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}
