/* ------------------------------------------------------------------
   Ice Diamonds UI kit — shared building blocks for every page,
   modeled on the Orbit SaaS template (cards, KPI tiles with sparklines,
   segmented control with a sliding pill, side drawer, row menus).
   All colours come from the tokens in index.css (navy / gold / ink / line).
------------------------------------------------------------------- */
import {
  ButtonHTMLAttributes,
  ComponentType,
  CSSProperties,
  MouseEvent as RMouseEvent,
  ReactNode,
  useCallback,
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState
} from 'react';
import { createPortal } from 'react-dom';
import { MoreHorizontal, X, TrendingUp, TrendingDown, Inbox } from 'lucide-react';
import { useCountUp, useSize, monotonePath, ils, ilsCompact } from '../lib/hooks';
import type { PaymentStatus } from '../types';

type IconT = ComponentType<{ className?: string }>;

export const TONES = {
  navy: '#24316e',
  gold: '#c9a13f',
  green: '#10b981',
  red: '#f43f5e',
  amber: '#f59e0b',
  sky: '#0ea5e9',
  violet: '#8b5cf6'
} as const;
export type Tone = keyof typeof TONES;

const TONE_SOFT: Record<Tone, string> = {
  navy: 'bg-[#eef0f8] text-navy',
  gold: 'bg-gold-soft text-gold-2',
  green: 'bg-emerald-50 text-emerald-600',
  red: 'bg-rose-50 text-rose-600',
  amber: 'bg-amber-50 text-amber-700',
  sky: 'bg-sky-50 text-sky-700',
  violet: 'bg-violet-50 text-violet-700'
};

/* ---------- card ---------- */
export function Card({
  children,
  className = '',
  style,
  onClick
}: {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  onClick?: () => void;
}) {
  const cls = `bg-white rounded-[1.6rem] shadow-card ${onClick ? 'cursor-pointer transition-transform hover:-translate-y-0.5 text-right w-full' : ''} ${className}`;
  return onClick ? (
    <button type="button" className={cls} style={style} onClick={onClick}>
      {children}
    </button>
  ) : (
    <div className={cls} style={style}>
      {children}
    </div>
  );
}

export function CardHead({
  icon: Icon,
  title,
  sub,
  children,
  className = ''
}: {
  icon?: IconT;
  title: ReactNode;
  sub?: ReactNode;
  children?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-start justify-between gap-x-3 gap-y-3 ${className}`}>
      <div className="min-w-0 flex-1 basis-[12rem]">
        <h3 className="flex items-center gap-2 text-[15px] font-bold text-ink">
          {Icon && <Icon className="w-[18px] h-[18px] text-gold-2 shrink-0" />}
          <span className="truncate">{title}</span>
        </h3>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
      {children && <div className="flex items-center gap-2 shrink-0">{children}</div>}
    </div>
  );
}

/* ---------- delta chip ---------- */
export function Delta({ value, goodWhenUp = true }: { value: number | null; goodWhenUp?: boolean }) {
  if (value === null || !isFinite(value)) return null;
  const up = value >= 0;
  const good = up === goodWhenUp;
  const Icon = up ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
        good ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
      }`}
      dir="ltr"
      title="לעומת החודש הקודם"
    >
      <Icon className="w-3 h-3" />
      {Math.abs(value).toFixed(1)}%
    </span>
  );
}

/* ---------- sparkline (oldest → newest drawn right → left for RTL) ---------- */
export function Sparkline({ data, color = TONES.navy, height = 44 }: { data: number[]; color?: string; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const { w } = useSize(ref);
  const gid = useId().replace(/[^a-zA-Z0-9]/g, '');
  const h = height;
  const series = data.length > 1 ? data : [data[0] || 0, data[0] || 0];
  const min = Math.min(...series);
  const max = Math.max(...series);
  // RTL: index 0 (oldest) on the right
  const pts: [number, number][] = series.map((v, i) => [
    w - (i * w) / (series.length - 1),
    h - 4 - ((v - min) / (max - min || 1)) * (h - 10)
  ]);
  const line = w ? monotonePath(pts) : '';
  return (
    <div ref={ref} style={{ height: h }} className="w-full">
      {w > 0 && (
        <svg width={w} height={h} aria-hidden="true" className="overflow-visible">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.22" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`} fill={`url(#${gid})`} />
          <path d={line} fill="none" stroke={color} strokeWidth="2.2" strokeLinecap="round" className="draw-line" pathLength={1} />
          <circle cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3.5" fill="#fff" stroke={color} strokeWidth="2" />
        </svg>
      )}
    </div>
  );
}

/* ---------- KPI tile ---------- */
export function Kpi({
  icon: Icon,
  label,
  value,
  format = 'money',
  tone = 'navy',
  spark,
  delta,
  goodWhenUp = true,
  foot,
  onClick,
  i = 0
}: {
  icon: IconT;
  label: string;
  value: number;
  format?: 'money' | 'num' | 'pct';
  tone?: Tone;
  spark?: number[];
  delta?: number | null;
  goodWhenUp?: boolean;
  foot?: ReactNode;
  onClick?: () => void;
  i?: number;
}) {
  const v = useCountUp(value, 1000, 120 + i * 70);
  const text = format === 'money' ? ils(v) : format === 'pct' ? `${v.toFixed(0)}%` : Math.round(v).toLocaleString('he-IL');
  return (
    <Card onClick={onClick} className="p-4 sm:p-5 flex flex-col gap-2 min-w-0">
      <div className="flex items-center gap-2.5">
        <span className={`w-9 h-9 rounded-xl grid place-items-center shrink-0 ${TONE_SOFT[tone]}`}>
          <Icon className="w-[18px] h-[18px]" />
        </span>
        <span className="text-[13px] font-semibold text-ink-2 truncate flex-1">{label}</span>
        <Delta value={delta ?? null} goodWhenUp={goodWhenUp} />
      </div>
      <b className="text-[22px] sm:text-[26px] font-extrabold text-ink tracking-tight leading-tight num truncate">{text}</b>
      {spark && spark.length > 1 && <Sparkline data={spark} color={TONES[tone]} height={40} />}
      {foot && <div className="text-[11.5px] text-muted">{foot}</div>}
    </Card>
  );
}

/* ---------- compact stat tile that doubles as a filter ---------- */
export function StatTile({
  icon: Icon,
  label,
  value,
  sub,
  tone = 'navy',
  active,
  onClick,
  i = 0
}: {
  icon: IconT;
  label: string;
  value: number;
  sub?: ReactNode;
  tone?: Tone;
  active?: boolean;
  onClick?: () => void;
  i?: number;
}) {
  const v = useCountUp(value, 900, 80 + i * 60);
  const Tag = onClick ? 'button' : 'div';
  return (
    <Tag
      {...(onClick ? { type: 'button', onClick, 'aria-pressed': !!active } : {})}
      className={`text-right bg-white rounded-[1.4rem] p-4 sm:p-5 flex flex-col gap-2 min-w-0 transition-all ${
        active ? 'ring-2 ring-navy shadow-pop' : 'shadow-card'
      } ${onClick ? 'cursor-pointer hover:-translate-y-0.5' : ''}`}
    >
      <div className="flex items-center gap-2">
        <span className={`w-8 h-8 rounded-xl grid place-items-center shrink-0 ${TONE_SOFT[tone]}`}>
          <Icon className="w-4 h-4" />
        </span>
        <span className="text-[12.5px] font-semibold text-ink-2 truncate">{label}</span>
      </div>
      <b className="text-[19px] sm:text-[23px] font-extrabold text-ink tracking-tight num truncate">{ils(v)}</b>
      {sub && <div className="text-[11.5px] text-muted truncate">{sub}</div>}
    </Tag>
  );
}

/* ---------- billing-day chip (10 / 15 / 19 / unknown) ---------- */
export type BillingDay = 10 | 15 | 19 | 'unknown';
export const BILLING_OPTIONS: BillingDay[] = [10, 15, 19, 'unknown'];
export const nextBillingDay = (d: BillingDay) => BILLING_OPTIONS[(BILLING_OPTIONS.indexOf(d) + 1) % BILLING_OPTIONS.length];
/** Snap any stored day-of-month to 10 / 15 / 19; empty → unknown */
export const snapDay = (n: number): BillingDay =>
  n == null || isNaN(n) ? 'unknown' : ([10, 15, 19] as const).reduce((p, c) => (Math.abs(c - n) < Math.abs(p - n) ? c : p));

export function DayChip({ day, onClick }: { day: BillingDay; onClick?: () => void }) {
  const unknown = day === 'unknown';
  return (
    <button
      type="button"
      disabled={!onClick}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      title={onClick ? 'לחיצה מחליפה את יום החיוב' : undefined}
      className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-lg text-xs font-bold whitespace-nowrap transition-all ${
        unknown ? 'bg-panel text-muted' : 'bg-[#eef0f8] text-navy'
      } ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-navy/15 active:scale-95' : ''}`}
    >
      {unknown ? 'לא ידוע' : (
        <>
          <span className="num">{day}</span>
          <span className="font-medium opacity-70">לחודש</span>
        </>
      )}
    </button>
  );
}

/* ---------- segmented control with a sliding pill ---------- */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  size = 'md',
  label,
  full
}: {
  options: { id: T; label: string; count?: number }[];
  value: T;
  onChange: (id: T) => void;
  size?: 'sm' | 'md';
  label?: string;
  full?: boolean; // stretch to the row on phones
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [pill, setPill] = useState<{ left: number; width: number } | null>(null);
  const { w } = useSize(ref);
  useLayoutEffect(() => {
    const b = ref.current?.querySelector<HTMLElement>('[aria-selected="true"]');
    if (b) setPill({ left: b.offsetLeft, width: b.offsetWidth });
  }, [value, w, options.length]);
  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={label}
      className={`no-scrollbar relative items-center bg-panel rounded-xl p-1 max-w-full overflow-x-auto ${full ? 'flex w-full sm:inline-flex sm:w-auto' : 'inline-flex'}`}
    >
      {pill && (
        <span
          aria-hidden="true"
          className="absolute top-1 bottom-1 rounded-lg bg-white shadow-[0_2px_8px_-2px_rgb(22_32_79_/_0.25)] transition-all duration-300"
          style={{ left: pill.left, width: pill.width, transitionTimingFunction: 'var(--spring)' }}
        />
      )}
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={o.id}
            type="button"
            role="tab"
            aria-selected={on}
            onClick={() => onChange(o.id)}
            className={`relative z-[1] whitespace-nowrap rounded-lg font-semibold transition-colors cursor-pointer flex items-center justify-center gap-1.5 ${
              size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-1.5 sm:px-3.5 py-1.5 text-[12.5px] sm:text-[13px]'
            } ${full ? 'flex-1 sm:flex-none' : ''} ${on ? 'text-navy' : 'text-muted hover:text-ink'}`}
          >
            {o.label}
            {o.count !== undefined && (
              <em className={`not-italic text-[10.5px] font-bold px-1.5 rounded-full ${on ? 'bg-gold-soft text-gold-2' : 'bg-white/70 text-muted'}`}>
                {o.count}
              </em>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- status pill (dot + text, never colour alone) ---------- */
export const STATUS_STYLE: Record<PaymentStatus, { cls: string; dot: string }> = {
  'שולם': { cls: 'bg-emerald-50 text-emerald-700', dot: 'bg-emerald-500' },
  'שולם חלקית': { cls: 'bg-amber-50 text-amber-700', dot: 'bg-amber-500' },
  'לא שולם': { cls: 'bg-rose-50 text-rose-600', dot: 'bg-rose-500' }
};
export const nextStatus = (s: PaymentStatus): PaymentStatus =>
  s === 'לא שולם' ? 'שולם חלקית' : s === 'שולם חלקית' ? 'שולם' : 'לא שולם';

export function StatusPill({ status, onClick }: { status: PaymentStatus; onClick?: () => void }) {
  const st = STATUS_STYLE[status] || STATUS_STYLE['לא שולם'];
  const cls = `inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${st.cls}`;
  const inner = (
    <>
      <i className={`w-1.5 h-1.5 rounded-full ${st.dot}`} />
      {status}
    </>
  );
  return onClick ? (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      title="לחיצה משנה את הסטטוס"
      className={`${cls} cursor-pointer hover:ring-2 hover:ring-current/15 transition-all active:scale-95`}
    >
      {inner}
    </button>
  ) : (
    <span className={cls}>{inner}</span>
  );
}

/* ---------- vendor patience (mood) ---------- */
export const MOODS: Record<string, { emoji: string; label: string; cls: string }> = {
  happy: { emoji: '😊', label: 'רגוע', cls: 'bg-emerald-50 text-emerald-700' },
  neutral: { emoji: '😐', label: 'העיר על זה', cls: 'bg-amber-50 text-amber-700' },
  angry: { emoji: '😠', label: 'דורש את הכסף', cls: 'bg-rose-50 text-rose-600' }
};
export const nextMood = (m: string) => (m === 'happy' ? 'neutral' : m === 'neutral' ? 'angry' : 'happy');

export function MoodChip({ mood, onClick, compact }: { mood?: string; onClick?: () => void; compact?: boolean }) {
  const m = MOODS[mood || 'happy'] || MOODS.happy;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
      disabled={!onClick}
      title={onClick ? `${m.label} · לחיצה משנה` : m.label}
      className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${m.cls} ${
        onClick ? 'cursor-pointer hover:scale-105 active:scale-95 transition-transform' : ''
      }`}
    >
      <span className="text-sm leading-none">{m.emoji}</span>
      {!compact && <span>{m.label}</span>}
    </button>
  );
}

/* ---------- buttons ---------- */
export function Button({
  children,
  icon: Icon,
  variant = 'primary',
  size = 'md',
  className = '',
  ...rest
}: {
  children?: ReactNode;
  icon?: IconT;
  variant?: 'primary' | 'ghost' | 'soft' | 'danger' | 'gold';
  size?: 'sm' | 'md';
  className?: string;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  const v = {
    primary: 'bg-navy text-white hover:bg-navy-2 shadow-lg shadow-navy/20',
    gold: 'bg-gradient-to-b from-[#e7c873] to-gold text-navy hover:brightness-105 shadow-lg shadow-gold/30',
    ghost: 'bg-white text-ink border border-line hover:border-navy/30',
    soft: 'bg-panel text-ink hover:bg-[#e9edf5]',
    danger: 'bg-rose-50 text-rose-600 hover:bg-rose-100'
  }[variant];
  const s = size === 'sm' ? 'h-8 px-3 text-xs rounded-lg' : 'h-10 px-4 text-sm rounded-xl';
  return (
    <button
      type="button"
      {...rest}
      className={`inline-flex items-center justify-center gap-2 font-semibold whitespace-nowrap transition-all cursor-pointer active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed ${v} ${s} ${className}`}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0" />}
      {children}
    </button>
  );
}

export function IconBtn({
  icon: Icon,
  label,
  onClick,
  tone = 'default',
  className = ''
}: {
  icon: IconT;
  label: string;
  onClick?: (e: RMouseEvent) => void;
  tone?: 'default' | 'danger';
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`w-8 h-8 grid place-items-center rounded-lg transition-colors cursor-pointer ${
        tone === 'danger' ? 'text-muted hover:text-rose-600 hover:bg-rose-50' : 'text-muted hover:text-navy hover:bg-panel'
      } ${className}`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}

/* ---------- ⋯ row menu (portal, so tables never clip it) ---------- */
export interface MenuItem {
  id: string;
  label: string;
  icon?: IconT;
  danger?: boolean;
  onClick: () => void;
}
export function RowMenu({ items, label = 'פעולות' }: { items: MenuItem[]; label?: string }) {
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const close = useCallback(() => setPos(null), []);
  useEffect(() => {
    if (!pos) return;
    const down = (e: PointerEvent) => {
      if (pop.current?.contains(e.target as Node) || btn.current?.contains(e.target as Node)) return;
      close();
    };
    const key = (e: KeyboardEvent) => e.key === 'Escape' && close();
    document.addEventListener('pointerdown', down);
    document.addEventListener('keydown', key);
    window.addEventListener('resize', close);
    window.addEventListener('scroll', close, true);
    return () => {
      document.removeEventListener('pointerdown', down);
      document.removeEventListener('keydown', key);
      window.removeEventListener('resize', close);
      window.removeEventListener('scroll', close, true);
    };
  }, [pos, close]);
  return (
    <>
      <button
        ref={btn}
        type="button"
        aria-label={label}
        aria-expanded={!!pos}
        onClick={(e) => {
          e.stopPropagation();
          if (pos) return close();
          const r = btn.current!.getBoundingClientRect();
          const below = r.bottom + 8 + items.length * 40 < window.innerHeight;
          setPos({ top: below ? r.bottom + 6 : r.top - 6 - items.length * 40 - 12, left: Math.max(8, r.left) });
        }}
        className={`w-8 h-8 grid place-items-center rounded-lg cursor-pointer transition-colors ${pos ? 'bg-panel text-navy' : 'text-muted hover:bg-panel hover:text-navy'}`}
      >
        <MoreHorizontal className="w-4 h-4" />
      </button>
      {pos &&
        createPortal(
          <div
            ref={pop}
            role="menu"
            className="pop-in fixed z-[90] min-w-[170px] bg-white rounded-2xl shadow-pop border border-line p-1.5"
            style={{ top: pos.top, left: pos.left }}
            dir="rtl"
          >
            {items.map((it) => {
              const Icon = it.icon;
              return (
                <button
                  key={it.id}
                  type="button"
                  role="menuitem"
                  onClick={(e) => {
                    e.stopPropagation();
                    close();
                    it.onClick();
                  }}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-sm text-right cursor-pointer transition-colors ${
                    it.danger ? 'text-rose-600 hover:bg-rose-50' : 'text-ink hover:bg-panel'
                  }`}
                >
                  {Icon && <Icon className="w-4 h-4 shrink-0" />}
                  {it.label}
                </button>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}

/* ---------- side drawer (bottom sheet on phones) ---------- */
export function Drawer({
  open,
  onClose,
  title,
  sub,
  icon: Icon,
  children,
  footer,
  width = 30
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  sub?: ReactNode;
  icon?: IconT;
  children: ReactNode;
  footer?: ReactNode;
  width?: number; // rem, desktop
}) {
  const [leaving, setLeaving] = useState(false);
  const shut = useCallback(() => {
    setLeaving(true);
    window.setTimeout(() => {
      setLeaving(false);
      onClose();
    }, 220);
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const key = (e: KeyboardEvent) => e.key === 'Escape' && shut();
    window.addEventListener('keydown', key);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', key);
      document.body.style.overflow = prev;
    };
  }, [open, shut]);
  if (!open) return null;
  return createPortal(
    <div
      className={`fixed inset-0 z-[75] ${leaving ? 'drawer-leave' : 'drawer-enter'}`}
      onPointerDown={(e) => e.target === e.currentTarget && shut()}
      dir="rtl"
    >
      <div className="drawer-veil absolute inset-0 bg-navy/35 backdrop-blur-[3px]" onPointerDown={shut} />
      <aside
        role="dialog"
        aria-modal="true"
        className="drawer-panel absolute bg-white shadow-pop flex flex-col inset-x-0 bottom-0 max-h-[92vh] rounded-t-[1.8rem] md:inset-x-auto md:bottom-auto md:top-3 md:left-3 md:h-[calc(100vh-1.5rem)] md:max-h-none md:rounded-[1.8rem]"
        style={{ ['--dw' as string]: `${width}rem` }}
      >
        <div className="md:hidden mx-auto mt-2.5 h-1.5 w-11 rounded-full bg-line" />
        <header className="flex items-start gap-3 px-5 sm:px-6 pt-4 md:pt-6 pb-4 border-b border-line">
          {Icon && (
            <span className="w-10 h-10 rounded-2xl bg-gold-soft text-gold-2 grid place-items-center shrink-0">
              <Icon className="w-5 h-5" />
            </span>
          )}
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-bold text-ink leading-tight">{title}</h3>
            {sub && <p className="text-xs text-muted mt-1">{sub}</p>}
          </div>
          <IconBtn icon={X} label="סגירה" onClick={shut} />
        </header>
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">{children}</div>
        {footer && <footer className="px-5 sm:px-6 py-4 border-t border-line flex gap-2 bg-white rounded-b-[1.8rem]">{footer}</footer>}
      </aside>
    </div>,
    document.body
  );
}

/* ---------- form fields ---------- */
export const inputCls =
  'w-full h-11 bg-white border border-line rounded-xl px-3.5 text-sm text-ink placeholder-slate-400 outline-none focus:border-navy focus:ring-4 focus:ring-navy/10 transition-all';

export function Field({ label, hint, children, full }: { label: string; hint?: ReactNode; children: ReactNode; full?: boolean }) {
  return (
    <label className={`flex flex-col gap-1.5 ${full ? 'sm:col-span-2' : ''}`}>
      <span className="text-[12.5px] font-semibold text-ink-2">{label}</span>
      {children}
      {hint && <span className="text-[11.5px] text-muted leading-snug">{hint}</span>}
    </label>
  );
}

/* Pick one of a few options as chips (billing day, status, VAT …) */
export function ChoiceChips<T extends string | number>({
  options,
  value,
  onChange
}: {
  options: { id: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = o.id === value;
        return (
          <button
            key={String(o.id)}
            type="button"
            onClick={() => onChange(o.id)}
            className={`h-10 px-3.5 rounded-xl text-sm font-semibold border transition-all cursor-pointer ${
              on ? 'bg-navy text-white border-navy shadow-md shadow-navy/20' : 'bg-white text-ink-2 border-line hover:border-navy/30'
            }`}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

/* ---------- empty state ---------- */
export function Empty({ title, text, children, icon: Icon = Inbox }: { title: string; text?: string; children?: ReactNode; icon?: IconT }) {
  return (
    <div className="flex flex-col items-center text-center gap-2 py-12 px-6">
      <span className="w-14 h-14 rounded-2xl bg-panel text-muted grid place-items-center mb-1">
        <Icon className="w-6 h-6" />
      </span>
      <b className="text-ink text-[15px]">{title}</b>
      {text && <p className="text-sm text-muted max-w-xs">{text}</p>}
      {children && <div className="mt-2">{children}</div>}
    </div>
  );
}

/* ---------- progress ring ---------- */
export function Ring({
  value,
  size = 112,
  stroke = 10,
  color = TONES.green,
  track = '#eef1f6',
  children
}: {
  value: number; // 0-100
  size?: number;
  stroke?: number;
  color?: string;
  track?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const v = Math.max(0, Math.min(100, value));
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke} />
        {v > 0 && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            className="ring-fill"
            style={{ strokeDasharray: c, ['--ring-to' as string]: c * (1 - v / 100), ['--ring-from' as string]: c }}
          />
        )}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{children}</div>
    </div>
  );
}

/* ---------- donut with legend ---------- */
export function Donut({
  segments,
  size = 168,
  stroke = 22,
  center
}: {
  segments: { label: string; value: number; color: string }[];
  size?: number;
  stroke?: number;
  center?: ReactNode;
}) {
  const total = segments.reduce((a, s) => a + Math.max(0, s.value), 0);
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const gap = total > 0 && segments.filter((s) => s.value > 0).length > 1 ? 4 : 0;
  let acc = 0;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#eef1f6" strokeWidth={stroke} />
        {total > 0 &&
          segments.map((s) => {
            if (s.value <= 0) return null;
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.label}
                cx={size / 2}
                cy={size / 2}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={stroke}
                strokeDasharray={`${Math.max(0, len - gap)} ${c}`}
                strokeDashoffset={-acc}
                transform={`rotate(-90 ${size / 2} ${size / 2})`}
                className="donut-seg"
              />
            );
            acc += len;
            return el;
          })}
      </svg>
      <div className="absolute inset-0 grid place-items-center text-center">{center}</div>
    </div>
  );
}

/* ---------- grouped rounded bar chart (time runs right → left) ---------- */
export function BarChart({
  labels,
  series,
  height = 220,
  highlight
}: {
  labels: string[];
  series: { name: string; color: string; values: number[] }[];
  height?: number;
  highlight?: number; // index to emphasise (current month)
}) {
  const ref = useRef<HTMLDivElement>(null);
  const { w } = useSize(ref);
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...series.flatMap((s) => s.values));
  const nice = (() => {
    const p = Math.pow(10, Math.floor(Math.log10(max)));
    const steps = [1, 2, 2.5, 5, 10];
    for (const s of steps) if (s * p >= max) return s * p;
    return 10 * p;
  })();
  const padTop = 18;
  const padBottom = 28;
  const axisW = 46;
  const plotH = height - padTop - padBottom;
  const plotW = Math.max(0, w - axisW);
  const groupW = labels.length ? plotW / labels.length : 0;
  const barW = Math.min(18, Math.max(6, (groupW * 0.62) / series.length));
  const ticks = [0, 0.5, 1];

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      {w > 0 && (
        <svg width={w} height={height} role="img" aria-label="גרף עמודות">
          {ticks.map((t) => {
            const y = padTop + plotH - t * plotH;
            return (
              <g key={t}>
                <line x1={0} x2={plotW} y1={y} y2={y} stroke="#e9ecf3" strokeDasharray={t === 0 ? '' : '4 5'} />
                <text x={plotW + 8} y={y} dominantBaseline="central" className="fill-[#9aa3b8]" style={{ fontSize: 10.5 }}>
                  {ilsCompact(nice * t)}
                </text>
              </g>
            );
          })}
          {labels.map((lab, gi) => {
            // RTL: first label (oldest) on the right of the plot
            const gx = plotW - (gi + 1) * groupW;
            const isHi = gi === highlight;
            const isHover = hover === gi;
            return (
              <g key={lab} onMouseEnter={() => setHover(gi)} onMouseLeave={() => setHover(null)}>
                <rect x={gx} y={padTop} width={groupW} height={plotH} fill={isHover ? '#f4f6fa' : 'transparent'} rx={12} />
                {series.map((s, si) => {
                  const val = s.values[gi] || 0;
                  const bh = Math.max(val > 0 ? 4 : 0, (val / nice) * plotH);
                  const totalW = barW * series.length + 4 * (series.length - 1);
                  const bx = gx + (groupW - totalW) / 2 + (series.length - 1 - si) * (barW + 4);
                  return (
                    <rect
                      key={s.name}
                      x={bx}
                      y={padTop + plotH - bh}
                      width={barW}
                      height={bh}
                      rx={Math.min(barW / 2, 7)}
                      fill={s.color}
                      opacity={highlight === undefined || isHi || isHover ? 1 : 0.55}
                      className="bar-grow"
                      style={{ transformOrigin: `0 ${padTop + plotH}px`, animationDelay: `${gi * 60 + si * 30}ms` }}
                    />
                  );
                })}
                <text
                  x={gx + groupW / 2}
                  y={height - 8}
                  textAnchor="middle"
                  className={isHi ? 'fill-ink font-bold' : 'fill-[#9aa3b8]'}
                  style={{ fontSize: 11 }}
                >
                  {lab}
                </text>
              </g>
            );
          })}
        </svg>
      )}
      {hover !== null && w > 0 && (
        <div
          className="pointer-events-none absolute z-10 -translate-x-1/2 bg-navy text-white rounded-xl px-3 py-2 text-xs shadow-pop whitespace-nowrap"
          style={{ left: Math.min(Math.max(70, plotW - (hover + 0.5) * groupW), w - 70), top: 0 }}
        >
          <div className="font-bold mb-1">{labels[hover]}</div>
          {series.map((s) => (
            <div key={s.name} className="flex items-center gap-2">
              <i className="w-2 h-2 rounded-full" style={{ background: s.color }} />
              <span className="opacity-75">{s.name}</span>
              <b className="ms-auto num">{ils(s.values[hover] || 0)}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ---------- thin progress bar ---------- */
export function Progress({ value, color = TONES.green, className = '' }: { value: number; color?: string; className?: string }) {
  return (
    <div className={`h-2 w-full rounded-full bg-[#eef1f6] overflow-hidden ${className}`}>
      <div className="h-full rounded-full grow-x" style={{ width: `${Math.max(0, Math.min(100, value))}%`, background: color }} />
    </div>
  );
}
