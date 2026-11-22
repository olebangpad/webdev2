import { X } from 'lucide-react';
import { useEffect, useRef, type ReactNode } from 'react';
import { IconButton } from './Button';

interface DialogProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** drawer: 오른쪽에서 나오는 입력 패널, modal: 가운데 뜨는 작은 창 */
  variant?: 'drawer' | 'modal';
  width?: number;
}

export function Dialog({ open, onClose, title, subtitle, children, footer, variant = 'drawer', width }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      className={`dialog dialog--${variant}`}
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onMouseDown={(e) => {
        if (e.target === ref.current) onClose();
      }}
    >
      {open && (
        <div className="dialog__panel" style={width ? { ['--dialog-w' as string]: `${width}px` } : undefined}>
          <header className="dialog__head">
            <div className="dialog__titles">
              <h2>{title}</h2>
              {subtitle && <p>{subtitle}</p>}
            </div>
            <IconButton label="닫기" onClick={onClose}>
              <X size={18} />
            </IconButton>
          </header>
          <div className="dialog__body">{children}</div>
          {footer && <footer className="dialog__foot">{footer}</footer>}
        </div>
      )}
    </dialog>
  );
}
