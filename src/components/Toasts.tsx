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
  const iconCls = toast.tone === 'error' ? 'text-rose-500' : toast.action ? 'text-gold' : 'text-emerald-500';

  return (
    <div
      role="status"
      className="toast-in relative overflow-hidden flex items-center gap-3 min-w-[260px] max-w-[92vw] bg-navy text-white rounded-2xl ps-4 pe-2 py-2.5 shadow-pop"
    >
      <Icon className={`w-5 h-5 shrink-0 ${iconCls}`} />
      <span className="text-sm font-medium flex-1">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action!.run();
            onDismiss(toast.id);
          }}
          className="text-sm font-bold text-gold hover:text-white bg-white/10 hover:bg-white/20 px-3 py-1.5 rounded-xl cursor-pointer transition-colors"
        >
          {toast.action.label}
        </button>
      )}
      <button onClick={() => onDismiss(toast.id)} className="p-1 text-white/60 hover:text-white rounded-full cursor-pointer" aria-label="סגור">
        <X className="w-4 h-4" />
      </button>
      {/* time-left bar */}
      <i
        className="absolute bottom-0 inset-x-0 h-[3px] bg-gold/70 origin-right"
        style={{ animation: `shrink ${toast.duration}ms linear forwards` }}
      />
    </div>
  );
}

export function ToastViewport({ toasts, onDismiss }: { toasts: ToastItem[]; onDismiss: (id: number) => void }) {
  return (
    <div className="fixed z-[70] bottom-4 left-1/2 -translate-x-1/2 md:left-6 md:translate-x-0 flex flex-col gap-2 items-center md:items-start pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto">
          <ToastCard toast={t} onDismiss={onDismiss} />
        </div>
      ))}
    </div>
  );
}
