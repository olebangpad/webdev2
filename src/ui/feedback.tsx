import { CircleAlert, CircleCheck } from 'lucide-react';
import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';

// ── 토스트: 저장·삭제 결과를 잠깐 알려 준다 ─────────────────────────

interface Toast {
  id: number;
  tone: 'ok' | 'error';
  text: string;
}

const ToastContext = createContext<(text: string, tone?: Toast['tone']) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

// ── 확인 창: 브라우저 기본 confirm 대신 화면 안에서 묻는다 ────────────

export interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  /** 함께 보여 줄 항목 (삭제되는 하위 데이터, 삭제를 막는 사용처 등) */
  details?: string[];
  confirmLabel?: string;
  tone?: 'primary' | 'danger';
  /** true면 확인 버튼 없이 알림만 한다. */
  infoOnly?: boolean;
}

const ConfirmContext = createContext<(options: ConfirmOptions) => Promise<boolean>>(async () => false);

export function useConfirm() {
  return useContext(ConfirmContext);
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(1);
  const toast = useCallback((text: string, tone: Toast['tone'] = 'ok') => {
    const id = nextId.current++;
    setToasts((list) => [...list.slice(-2), { id, tone, text }]);
    window.setTimeout(() => setToasts((list) => list.filter((t) => t.id !== id)), tone === 'error' ? 6000 : 3200);
  }, []);

  const [pending, setPending] = useState<ConfirmOptions | null>(null);
  const resolver = useRef<((ok: boolean) => void) | null>(null);
  const confirm = useCallback((options: ConfirmOptions) => {
    setPending(options);
    return new Promise<boolean>((resolve) => {
      resolver.current = resolve;
    });
  }, []);
  const settle = (ok: boolean) => {
    resolver.current?.(ok);
    resolver.current = null;
    setPending(null);
  };

  const toastValue = useMemo(() => toast, [toast]);

  return (
    <ToastContext.Provider value={toastValue}>
      <ConfirmContext.Provider value={confirm}>
        {children}
        <Dialog
          open={pending != null}
          onClose={() => settle(false)}
          title={pending?.title ?? ''}
          variant="modal"
          width={440}
          footer={
            pending?.infoOnly ? (
              <Button variant="primary" onClick={() => settle(false)}>
                확인
              </Button>
            ) : (
              <>
                <Button onClick={() => settle(false)}>취소</Button>
                <Button variant={pending?.tone === 'danger' ? 'danger' : 'primary'} onClick={() => settle(true)}>
                  {pending?.confirmLabel ?? '확인'}
                </Button>
              </>
            )
          }
        >
          {pending?.body && <div className="confirm__body">{pending.body}</div>}
          {pending?.details && pending.details.length > 0 && (
            <ul className="confirm__details">
              {pending.details.map((d) => (
                <li key={d}>{d}</li>
              ))}
            </ul>
          )}
        </Dialog>
        <div className="toasts" role="status" aria-live="polite">
          {toasts.map((t) => (
            <div key={t.id} className={`toast toast--${t.tone}`}>
              {t.tone === 'ok' ? <CircleCheck size={16} /> : <CircleAlert size={16} />}
              <span>{t.text}</span>
            </div>
          ))}
        </div>
      </ConfirmContext.Provider>
    </ToastContext.Provider>
  );
}
