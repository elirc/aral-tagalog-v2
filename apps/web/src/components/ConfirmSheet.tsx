"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

/**
 * Confirmation for an action that throws work away (quit a lesson, log out
 * with unsynced progress). A bottom sheet on phones, a centered card on wider
 * screens (globals.css `.sheet`).
 *
 * Built on a native modal <dialog>: the browser traps focus, makes the page
 * behind inert, closes on Escape / Android back, and returns focus to the
 * opener on close. The safe choice comes first in the DOM, so it is what
 * showModal() focuses — a stray Enter keeps the learner where they were.
 */
export function ConfirmSheet({
  open,
  title,
  children,
  cancelLabel,
  confirmLabel,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  children: ReactNode;
  /** the safe choice (primary button, focused on open) */
  cancelLabel: string;
  /** the destructive choice */
  confirmLabel: string;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      if (typeof el.showModal === "function") {
        el.showModal();
      } else {
        // pre-2022 browsers without modal <dialog>: still never act unconfirmed
        if (window.confirm(title)) onConfirm();
        else onCancel();
      }
    } else if (!open && el.open) {
      el.close();
    }
    // `open` is the only trigger: the callbacks are whatever they were when it flipped
  }, [open]);

  return (
    <dialog
      ref={ref}
      className="sheet"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape / back gesture close the dialog natively; mirror that into state.
      // (Closing because `open` went false arrives here too — nothing to do.)
      onClose={() => {
        if (open) onCancel();
      }}
      // the dialog box itself has no padding, so a click whose target is the
      // dialog can only have landed on the backdrop
      onClick={(e) => {
        if (e.target === e.currentTarget) onCancel();
      }}
    >
      <div className="sheet-body">
        <h2 id={titleId}>{title}</h2>
        <div id={bodyId} className="sheet-text">
          {children}
        </div>
        <div className="sheet-actions">
          <button type="button" className="btn btn-primary" onClick={onCancel}>
            {cancelLabel}
          </button>
          <button type="button" className="btn btn-ghost sheet-danger" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
