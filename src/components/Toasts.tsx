import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, AlertCircle, Undo2, X } from 'lucide-react';

export type ToastTone = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
  duration: number;
  action?: { label: string; run: () => void };
}

/** Small toast queue. push() returns the toast id. */
export function useToasts() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const push = useCallback(
    (message: string, opts: { tone?: ToastTone; duration?: number; action?: ToastItem['action'] } = {}) => {
      const id = ++seq.current;
      setToasts((t) => [...t.slice(-3), { id, message, tone: opts.tone || 'info', duration: opts.duration ?? 4000, action: opts.action }]);
      return id;
    },
    []
  );

  return { toasts, push, dismiss };
}

function ToastCard({ toast, onDismiss }: { toast: ToastItem; onDismiss: (id: number) => void }) {
  useEffect(() => {
    const t = setTimeout(() => onDismiss(toast.id), toast.duration);
    return () => clearTimeout(t);
  }, [toast.id, toast.duration, onDismiss]);

  const Icon = toast.tone === 'error' ? AlertCircle : toast.action ? Undo2 : CheckCircle2;
  const tone = toast.tone === 'error' ? 'toast-ic--red' : toast.action ? 'toast-ic--teal' : '';

  return (
    <div role="status" className="toast ice-toast">
      <span className={`toast-ic ${tone}`}>
        <Icon className="icon" />
      </span>
      <span className="toast-text">{toast.message}</span>
      {toast.action && (
        <button
          className="toast-act"
          onClick={() => {
            toast.action!.run();
            onDismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button className="toast-x" onClick={() => onDismiss(toast.id)} aria-label="סגירה">
        <X className="icon" />
      </button>
      {/* time-left bar */}
      <i className="ice-toast-bar" style={{ animation: `shrink ${toast.duration}ms linear forwards` }} />
    </div>
  );
}

export function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="contents"><ToastCard toast={t} onDismiss={onDismiss} /></div>
      ))}
    </div>
  );
}