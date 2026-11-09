import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import { IconButton } from "./ui.jsx";

export default function Drawer({ title, description, onClose, children }) {
  const dialog = useRef(null);
  const id = useId();
  useEffect(() => {
    const previousFocus = document.activeElement;
    const node = dialog.current;
    const previousOverflow = document.body.style.overflow;
    node.showModal();
    document.body.style.overflow = "hidden";
    function trapFocus(event) {
      if (event.key !== "Tab") return;
      const focusable = [
        ...node.querySelectorAll(
          'button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]',
        ),
      ].filter((element) => element.getClientRects().length > 0);
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (
        !node.contains(document.activeElement) ||
        (!event.shiftKey && document.activeElement === last)
      ) {
        event.preventDefault();
        first?.focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      }
    }
    document.addEventListener("keydown", trapFocus);
    return () => {
      document.removeEventListener("keydown", trapFocus);
      node.close();
      document.body.style.overflow = previousOverflow;
      previousFocus?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="slide-over"
      aria-labelledby={id}
      aria-describedby={description ? `${id}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        if (event.target === dialog.current) onClose();
      }}
    >
      <div className="slide-over-content">
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">A little detail goes a long way</span>
            <h2 id={id}>{title}</h2>
            {description && <p id={`${id}-description`}>{description}</p>}
          </div>
          <IconButton label="Close drawer" onClick={onClose}>
            <X size={20} />
          </IconButton>
        </div>
        {children}
      </div>
    </dialog>
  );
}
