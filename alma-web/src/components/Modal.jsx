import { useEffect, useRef } from "react";
import { X } from "@phosphor-icons/react";

export default function Modal({ open, onClose, title, kicker, children, size = "md" }) {
  const ref = useRef(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`modal modal-${size}`}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      aria-label={title}
    >
      {open && (
        <div className="modal-inner">
          <header className="modal-head">
            <div>
              <h2 className="display">{title}</h2>
              {kicker && <p className="kicker">{kicker}</p>}
            </div>
            <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
              <X size={22} weight="bold" />
            </button>
          </header>
          <div className="modal-body">{children}</div>
        </div>
      )}
    </dialog>
  );
}
