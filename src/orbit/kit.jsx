/* ------------------------------------------------------------------
   Orbit building blocks (ported from the template kit, Hebrew + ₪).
   Cards land with .card-in/.rise and --d; inner content rises with .rv and --i.
------------------------------------------------------------------- */
import { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from './Icon'
import { compact, ils, monotone, num, placePill, toArea, useCountUp, useEnter, usePopover, useSize, useStable, useTween } from './lib'

const cleanId = (id) => id.replace(/[^a-zA-Z0-9_-]/g, '')

/* ---------- people ---------- */
export function Avatar({ name = '', className = '', tone }) {
  const ini = name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)
  return (
    <span className={`avatar avatar--initials ${className}`} style={tone ? { background: tone } : undefined}>
      {ini}
    </span>
  )
}

export function Highlight({ text, q }) {
  if (!q) return text
  const i = text.toLowerCase().indexOf(q)
  if (i < 0) return text
  return (
    <>
      {text.slice(0, i)}
      <mark>{text.slice(i, i + q.length)}</mark>
      {text.slice(i + q.length)}
    </>
  )
}

/* ---------- page header: the title rises in word by word ---------- */
export function PageHead({ title, sub, children, className = '' }) {
  const words = title.split(' ')
  return (
    <header className={`page-head ${className}`}>
      <div className="page-head-text">
        <h1 aria-label={title}>
          {words.map((w, i) => (
            <span key={`${w}-${i}`} className="word" style={{ '--i': i }} aria-hidden="true">
              {w}
              {i < words.length - 1 ? ' ' : ''}
            </span>
          ))}
        </h1>
        {sub && (
          <p className="page-sub rv" style={{ '--i': words.length + 1 }}>
            {sub}
          </p>
        )}
      </div>
      {children && (
        <div className="page-actions rv" style={{ '--i': words.length + 2 }}>
          {children}
        </div>
      )}
    </header>
  )
}

export function CardHead({ title, sub, children, icon }) {
  return (
    <div className="card-head">
      <div className="card-head-text">
        <h3 className="card-title">
          {icon && <Icon name={icon} />}
          {title}
        </h3>
        {sub && <p className="card-sub">{sub}</p>}
      </div>
      {children && <div className="card-head-actions">{children}</div>}
    </div>
  )
}

/* ---------- small things ---------- */
export function Pill({ tone = 'grey', dot = true, children, onClick, title }) {
  const cls = `pill pill--${tone} ${onClick ? 'is-click' : ''}`
  const inner = (
    <>
      {dot && <i />}
      {children}
    </>
  )
  return onClick ? (
    <button
      type="button"
      className={cls}
      title={title}
      onClick={(e) => {
        e.stopPropagation()
        onClick()
      }}
    >
      {inner}
    </button>
  ) : (
    <span className={cls} title={title}>
      {inner}
    </span>
  )
}

export function Delta({ value, goodWhenUp = true }) {
  if (value == null || !isFinite(value)) return null
  const up = value >= 0
  const good = up === goodWhenUp
  return (
    <span className={`delta ${good ? 'is-up' : 'is-down'}`} dir="ltr" title="לעומת החודש הקודם">
      <Icon name={up ? 'trendUp' : 'trendDown'} />
      {Math.abs(value).toFixed(1)}%
    </span>
  )
}

export function Empty({ icon = 'search', title, text, children }) {
  return (
    <div className="empty-state">
      <span className="empty-ic">
        <Icon name={icon} />
      </span>
      <b>{title}</b>
      {text && <p>{text}</p>}
      {children}
    </div>
  )
}

export function Check({ on, onChange, label, mixed }) {
  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={mixed ? 'mixed' : on}
      aria-label={label}
      className={`cbox ${on ? 'is-on' : ''} ${mixed ? 'is-mixed' : ''}`}
      onClick={(e) => {
        e.stopPropagation()
        onChange(!on)
      }}
    >
      <Icon name={mixed ? 'minus' : 'check'} />
    </button>
  )
}

export function SearchInput({ value, onChange, placeholder = 'חיפוש', width }) {
  return (
    <label className="search-input" style={width ? { width } : undefined}>
      <Icon name="search" />
      <input value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
      {value && (
        <button type="button" onClick={() => onChange('')} aria-label="ניקוי">
          <Icon name="x" />
        </button>
      )}
    </label>
  )
}

export function Pager({ page, pages, onChange, total, label = 'תוצאות' }) {
  if (pages <= 1) return total != null ? <p className="pager-info">{total} {label}</p> : null
  return (
    <div className="pager">
      {total != null && (
        <p className="pager-info">
          {total} {label}
        </p>
      )}
      <div className="pager-btns">
        <button type="button" className="pager-btn" disabled={page <= 1} onClick={() => onChange(page - 1)} aria-label="העמוד הקודם">
          <Icon name="chevronRight" />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button key={p} type="button" className={`pager-btn ${p === page ? 'is-on' : ''}`} onClick={() => onChange(p)}>
            {p}
          </button>
        ))}
        <button type="button" className="pager-btn" disabled={page >= pages} onClick={() => onChange(page + 1)} aria-label="העמוד הבא">
          <Icon name="chevronLeft" />
        </button>
      </div>
    </div>
  )
}

/* ---------- segmented control with a sliding pill ---------- */
export function Segmented({ options, value, onChange, size, label }) {
  const ref = useRef(null)
  const pill = useRef(null)
  const { w } = useSize(ref)
  useLayoutEffect(() => {
    placePill(pill.current, ref.current?.querySelector('[aria-selected="true"]'))
  })
  return (
    <div className={`segmented ${size === 'sm' ? 'is-sm' : ''}`} ref={ref} role="tablist" aria-label={label} data-w={Math.round(w)}>
      <span className="segmented-pill" ref={pill} aria-hidden="true" />
      {options.map((o) => (
        <button key={o.id} type="button" role="tab" aria-selected={value === o.id} className={value === o.id ? 'is-on' : ''} onClick={() => onChange(o.id)}>
          {o.icon && <Icon name={o.icon} />}
          {o.label}
          {o.count != null && <em>{o.count}</em>}
        </button>
      ))}
    </div>
  )
}

/* ---------- floating popovers (portal, never clipped) ---------- */
export function Floating({ open, pos, close, className = '', children, label }) {
  const ref = useRef(null)
  const anchor = pos?.anchor
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => {
      if (ref.current?.contains(e.target) || anchor?.contains(e.target)) return
      close()
    }
    const key = (e) => e.key === 'Escape' && close()
    const away = (e) => {
      if (!ref.current?.contains(e.target)) close()
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    window.addEventListener('resize', close)
    window.addEventListener('scroll', away, true)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
      window.removeEventListener('resize', close)
      window.removeEventListener('scroll', away, true)
    }
  }, [open, close, anchor])
  if (!open || !pos) return null
  return createPortal(
    <div
      ref={ref}
      dir="rtl"
      className={`pop pop--floating ${className}`}
      role="menu"
      aria-label={label}
      style={{ top: pos.top, bottom: pos.bottom, left: pos.left, right: pos.right, minWidth: pos.minWidth, transformOrigin: pos.origin }}
    >
      {children}
    </div>,
    document.body
  )
}

/** Dropdown select. options: [{ id, label, dot? }] */
export function Select({ value, options, onChange, label, icon, align = 'start', placeholder = 'בחירה' }) {
  const pop = usePopover(align)
  const current = options.find((o) => o.id === value)
  return (
    <>
      <button type="button" className={`select-btn ${pop.open ? 'is-open' : ''}`} onClick={pop.toggle} aria-haspopup="listbox" aria-expanded={pop.open}>
        {icon && <Icon name={icon} />}
        {label && <span className="select-label">{label}</span>}
        {current?.dot && <i className="menu-dot" style={{ background: current.dot }} />}
        <b>{current?.label ?? placeholder}</b>
        <Icon name="chevronDown" className={`chev ${pop.open ? 'is-up' : ''}`} />
      </button>
      <Floating open={pop.open} pos={pop.pos} close={pop.close} label={label} className="pop--scroll">
        {options.map((o) => (
          <button
            key={o.id}
            type="button"
            role="menuitemradio"
            aria-checked={o.id === value}
            className={`menu-item ${o.id === value ? 'is-on' : ''}`}
            onClick={() => {
              onChange(o.id)
              pop.close()
            }}
          >
            {o.dot && <i className="menu-dot" style={{ background: o.dot }} />}
            {o.icon && <Icon name={o.icon} />}
            <span className="menu-label">{o.label}</span>
            {o.id === value && <Icon name="check" className="menu-check" />}
          </button>
        ))}
      </Floating>
    </>
  )
}

/** "⋯" row actions. items: [{ id, label, icon, danger, onClick, disabled }] */
export function Menu({ items, label = 'פעולות', icon = 'dotsH', align = 'end' }) {
  const pop = usePopover(align)
  return (
    <>
      <button
        type="button"
        className={`icon-btn icon-btn--sm ${pop.open ? 'is-pressed' : ''}`}
        onClick={(e) => {
          e.stopPropagation()
          pop.toggle(e)
        }}
        aria-label={label}
        aria-expanded={pop.open}
      >
        <Icon name={icon} />
      </button>
      <Floating open={pop.open} pos={pop.pos} close={pop.close} label={label}>
        {items.map((it) => (
          <button
            key={it.id}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            className={`menu-item ${it.danger ? 'is-danger' : ''}`}
            onClick={(e) => {
              e.stopPropagation()
              pop.close()
              it.onClick()
            }}
          >
            {it.icon && <Icon name={it.icon} />}
            <span className="menu-label">{it.label}</span>
          </button>
        ))}
      </Floating>
    </>
  )
}

/* ---------- side drawer: children is a render function that receives close() ---------- */
export function Drawer({ label, onClose, children, width = '31rem' }) {
  const [leaving, setLeaving] = useState(false)
  const close = useCallback(() => {
    setLeaving(true)
    window.setTimeout(onClose, 260)
  }, [onClose])
  useEffect(() => {
    const key = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [close])
  return createPortal(
    <div
      dir="rtl"
      className={`drawer ${leaving ? 'is-leaving' : ''}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <aside className="drawer-panel" style={{ width }} role="dialog" aria-modal="true" aria-label={label}>
        {children(close)}
      </aside>
    </div>,
    document.body
  )
}

/** Header row inside a drawer */
export function DrawerHead({ icon = 'file', title, sub, close, tone }) {
  return (
    <header className="fm-head">
      <span className="fm-ic" style={tone ? { background: tone } : undefined}>
        <Icon name={icon} />
      </span>
      <div>
        <h3>{title}</h3>
        {sub && <p>{sub}</p>}
      </div>
      <button type="button" className="icon-btn" onClick={close} aria-label="סגירה">
        <Icon name="x" />
      </button>
    </header>
  )
}

/* ---------- forms ---------- */
export function Field({ label, error, hint, children, full }) {
  return (
    <label className={`field ${error ? 'has-error' : ''} ${full ? 'is-full' : ''}`}>
      <span className="field-label">{label}</span>
      {children}
      {error ? <span className="field-error">{error}</span> : hint ? <span className="field-hint">{hint}</span> : null}
    </label>
  )
}

/** Choice chips (billing day, status, VAT …) */
export function Chips({ options, value, onChange }) {
  return (
    <div className="chips" role="radiogroup">
      {options.map((o) => (
        <button
          type="button"
          key={String(o.id)}
          role="radio"
          aria-checked={value === o.id}
          className={`chip ${value === o.id ? 'is-on' : ''}`}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}

/** Modal body with a title row, used by create/edit forms. */
export function FormModal({ title, sub, icon = 'plus', close, onSubmit, submitLabel = 'שמירה', children, danger, extra }) {
  return (
    <form
      className="form-modal"
      onSubmit={(e) => {
        e.preventDefault()
        onSubmit()
      }}
      noValidate
    >
      <header className="fm-head">
        <span className={`fm-ic ${danger ? 'is-danger' : ''}`}>
          <Icon name={icon} />
        </span>
        <div>
          <h3>{title}</h3>
          {sub && <p>{sub}</p>}
        </div>
        <button type="button" className="icon-btn" onClick={close} aria-label="סגירה">
          <Icon name="x" />
        </button>
      </header>
      {children && <div className="fm-body">{children}</div>}
      <footer className="fm-actions">
        {extra}
        <button type="button" className="btn btn--ghost" onClick={close}>
          ביטול
        </button>
        <button type="submit" className={`btn ${danger ? 'btn--danger' : 'btn--primary'}`}>
          {submitLabel}
        </button>
      </footer>
    </form>
  )
}

/* ---------- KPI tile ---------- */
const TONE = { green: 'var(--green)', teal: 'var(--teal-2)', purple: 'var(--purple)', orange: 'var(--orange)', red: 'var(--red)' }

export function Kpi({ icon, label, value, format = 'money', decimals = 0, delta, goodWhenUp = true, tone = 'green', spark, d = 0, foot, onClick, active }) {
  const delay = useEnter(d, 120)
  const v = useCountUp(value, 1300, delay)
  const text = format === 'money' ? ils(v, decimals) : format === 'pct' ? `${v.toFixed(decimals)}%` : num(v, decimals)
  const Tag = onClick ? 'button' : 'div'
  return (
    <Tag
      type={onClick ? 'button' : undefined}
      className={`card kpi card-in ${onClick ? 'is-link' : ''} ${active ? 'is-active' : ''}`}
      style={{ '--d': d, '--tone': TONE[tone] }}
      onClick={onClick}
      aria-pressed={onClick ? !!active : undefined}
    >
      <div className="kpi-top rv" style={{ '--i': 0 }}>
        <span className="kpi-ic">
          <Icon name={icon} />
        </span>
        <span className="kpi-label">{label}</span>
        {delta != null && <Delta value={delta} goodWhenUp={goodWhenUp} />}
      </div>
      <b className="kpi-value rv" style={{ '--i': 1 }}>
        {text}
      </b>
      {spark && spark.length > 1 && <Sparkline data={spark} color={TONE[tone]} d={d} />}
      {foot && (
        <p className="kpi-foot rv" style={{ '--i': 2 }}>
          {foot}
        </p>
      )}
    </Tag>
  )
}

export function Sparkline({ data, color = 'var(--green)', d = 0, height = '2.8rem' }) {
  const ref = useRef(null)
  const { w, h } = useSize(ref)
  const gid = cleanId(useId())
  const min = Math.min(...data)
  const max = Math.max(...data)
  const pts = data.map((v, i) => [(i * w) / (data.length - 1), h - 3 - ((v - min) / (max - min || 1)) * (h - 8)])
  const line = w ? monotone(pts) : ''
  return (
    <div className="spark" ref={ref} style={{ height, '--c': color, '--delay': `${useEnter(d, 150)}ms` }}>
      {w > 0 && (
        <svg width={w} height={h} aria-hidden="true">
          <defs>
            <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor={color} stopOpacity="0.22" />
              <stop offset="1" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path className="spark-area" d={toArea(line, pts, h)} fill={`url(#${gid})`} />
          <path className="spark-line" d={line} pathLength="1" />
          <circle className="spark-dot" cx={pts[pts.length - 1][0]} cy={pts[pts.length - 1][1]} r="3" />
        </svg>
      )}
    </div>
  )
}

/* ---------- rounded bar chart ---------- */
const STEPS = [1, 1.2, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]
function niceMax(v) {
  if (v <= 0) return 1
  const e = 10 ** Math.floor(Math.log10(v))
  const f = v / e
  return (STEPS.find((s) => s >= f) ?? 10) * e
}

export function BarChart({ labels, series, height = '12rem', format = (v) => `₪${compact(v)}`, d = 0, active: activeProp, yTicks = true, onSelect }) {
  const ref = useRef(null)
  const { w, h } = useSize(ref)
  const [hover, setHover] = useState(null)
  const delay = useEnter(d, 100)
  const flat = useStable(series.flatMap((s) => s.data))
  const [zeros] = useState(() => flat.map(() => 0))
  const vals = useTween(flat, 950, zeros, delay)

  const n = labels.length
  const m = series.length
  const padL = yTicks ? 40 : 6
  const padR = 6
  const top = yTicks ? 14 : 6
  const base = Math.max(top + 10, h - (yTicks ? 26 : 21))
  const peak = yTicks ? niceMax(Math.max(...flat, 1) * 1.08) : Math.max(...flat, 1) * 1.12
  const slot = n ? (w - padL - padR) / n : 0
  const gap = m > 1 ? 4 : 0
  const barW = Math.max(5, Math.min(m === 1 ? slot * 0.5 : (slot * 0.66 - gap * (m - 1)) / m, m === 1 ? 30 : 18))
  const groupW = barW * m + gap * (m - 1)
  const lastNonZero = (() => {
    for (let i = n - 1; i >= 0; i--) if (series.some((s) => s.data[i] > 0)) return i
    return n - 1
  })()
  const active = hover ?? activeProp ?? (m === 1 ? series[0].data.indexOf(Math.max(...series[0].data)) : lastNonZero)
  const y = (v) => base - (Math.max(0, v) / peak) * (base - top)
  const gx = (i) => padL + i * slot + (slot - groupW) / 2

  const pick = (clientX) => {
    const r = ref.current.getBoundingClientRect()
    const i = Math.floor((clientX - r.left - padL) / (slot || 1))
    return i >= 0 && i < n ? i : null
  }

  return (
    <div
      className={`barchart ${m === 1 ? 'is-single' : ''}`}
      ref={ref}
      style={{ height }}
      onPointerMove={(e) => setHover(pick(e.clientX))}
      onPointerLeave={() => setHover(null)}
      onClick={(e) => {
        const i = pick(e.clientX)
        if (i != null) onSelect?.(i)
      }}
    >
      {w > 0 && (
        <svg width={w} height={h} role="img" aria-label={labels.map((l, i) => `${l} ${series.map((s) => format(s.data[i])).join(' / ')}`).join(', ')}>
          {yTicks &&
            [0, 1 / 3, 2 / 3, 1].map((f) => (
              <g key={f}>
                <line className="bc-grid" x1={padL} x2={w - padR} y1={base - f * (base - top)} y2={base - f * (base - top)} />
                <text className="bc-y" x={padL - 8} y={base - f * (base - top) + 4} textAnchor="end">
                  {f === 0 ? '0' : compact(peak * f)}
                </text>
              </g>
            ))}
          {labels.map((l, i) => {
            const on = i === active
            return (
              <g key={`${l}-${i}`} className={`bc-col ${on ? 'is-on' : ''} ${hover != null && !on ? 'is-dim' : ''}`}>
                {series.map((s, j) => {
                  const x = gx(i) + j * (barW + gap)
                  const v = vals[j * n + i] ?? 0
                  return (
                    <g key={s.id}>
                      {m === 1 && <rect className="bc-track" x={x} y={top} width={barW} height={base - top} rx={barW / 2} />}
                      <rect className="bc-bar" x={x} y={y(v)} width={barW} height={Math.max(0, base - y(v))} rx={barW / 2} style={{ '--c': s.color }} />
                    </g>
                  )
                })}
                <text className="bc-x" x={gx(i) + groupW / 2} y={h - 6} textAnchor="middle">
                  {l}
                </text>
              </g>
            )
          })}
        </svg>
      )}
      {w > 0 && active != null && active >= 0 && (
        <div className="bc-tip" style={{ left: gx(active) + groupW / 2, top: y(Math.max(...series.map((s, j) => vals[j * n + active] ?? 0))) }}>
          <span>{labels[active]}</span>
          {series.map((s) => (
            <b key={s.id}>
              {m > 1 && <i style={{ background: s.color }} />}
              {format(s.data[active])}
            </b>
          ))}
        </div>
      )}
    </div>
  )
}

/** Horizontal rounded bars. items: [{ label, value, color?, sub? }] */
export function HBars({ items, format = (v) => ils(v), d = 0, color = 'var(--green)', max: maxProp }) {
  const delay = useEnter(d, 100)
  const max = maxProp ?? Math.max(...items.map((i) => i.value), 1)
  return (
    <ul className="hbars">
      {items.map((it, i) => (
        <li key={it.label} className="rv" style={{ '--i': i }}>
          <div className="hbar-top">
            <span>{it.label}</span>
            <b>{format(it.value, it)}</b>
          </div>
          <div className="hbar-track">
            <i style={{ width: `${Math.min(100, (it.value / max) * 100)}%`, background: it.color ?? color, animationDelay: `${delay + i * 90}ms` }} />
          </div>
        </li>
      ))}
    </ul>
  )
}

/* ---------- radial progress ring ---------- */
export function Ring({ value, size = '6.5rem', stroke = 10, color = 'var(--green)', d = 0, children, label }) {
  const delay = useEnter(d, 100)
  const v = useTween(value, 1300, 0, delay)
  const r = 50 - stroke / 2
  const C = 2 * Math.PI * r
  return (
    <div className="ring-x" style={{ width: size, height: size }} role="img" aria-label={label ?? `${Math.round(value)}%`}>
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <circle className="ring-x-trk" cx="50" cy="50" r={r} strokeWidth={stroke} />
        <circle className="ring-x-val" cx="50" cy="50" r={r} strokeWidth={stroke} stroke={color} strokeDasharray={`${(Math.min(100, Math.max(0, v)) / 100) * C} ${C}`} />
      </svg>
      <div className="ring-x-center">{children ?? <b>{Math.round(v)}%</b>}</div>
    </div>
  )
}

/* ---------- multi-segment donut with rounded ends ---------- */
export function DonutMulti({ items, size = '11rem', thickness = 15, d = 0, format = (v) => ils(v), title = 'סה״כ' }) {
  const [hot, setHot] = useState(null)
  const delay = useEnter(d, 100)
  const p = useTween(1, 1300, 0, delay)
  const total = items.reduce((s, it) => s + it.value, 0) || 1
  const r = 50 - thickness / 2
  const C = 2 * Math.PI * r
  const live = items.filter((it) => it.value > 0).length
  const gap = live > 1 ? 3 : 0
  const lens = items.map((it) => (it.value / total) * C * p)
  const segs = items.map((it, i) => {
    const start = lens.slice(0, i).reduce((a, b) => a + b, 0)
    const raw = lens[i] - gap - (live > 1 ? thickness : 0)
    return { ...it, dash: Math.max(0.01, raw), fade: it.value > 0 ? Math.max(0, Math.min(1, raw / thickness)) : 0, off: -(start + (gap + (live > 1 ? thickness : 0)) / 2) }
  })
  const focus = hot != null ? items[hot] : null
  return (
    <div className="donut-multi">
      <div className="dm-chart" style={{ width: size, height: size }}>
        <svg viewBox="0 0 100 100" role="img" aria-label={items.map((it) => `${it.label} ${format(it.value)}`).join(', ')}>
          <g transform="rotate(-90 50 50)">
            {segs.map((s, i) => (
              <circle
                key={s.label}
                cx="50"
                cy="50"
                r={r}
                className={`dm-seg ${hot === i ? 'is-hot' : ''} ${hot != null && hot !== i ? 'is-dim' : ''}`}
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${s.dash} ${C}`}
                strokeDashoffset={s.off}
                strokeOpacity={s.fade}
                onPointerEnter={() => setHot(i)}
                onPointerLeave={() => setHot(null)}
              />
            ))}
          </g>
        </svg>
        <div className="dm-center">
          <b>{focus ? `${Math.round((focus.value / total) * 100)}%` : format(total)}</b>
          <span>{focus ? focus.label : title}</span>
        </div>
      </div>
      <ul className="dm-legend">
        {items.map((it, i) => (
          <li key={it.label} className={`rv ${hot === i ? 'is-hot' : ''}`} style={{ '--i': i }} onPointerEnter={() => setHot(i)} onPointerLeave={() => setHot(null)}>
            <i style={{ background: it.color }} />
            <span>{it.label}</span>
            <b>{format(it.value)}</b>
          </li>
        ))}
      </ul>
    </div>
  )
}

/* ---------- payment status / vendor mood as Orbit pills ---------- */
export const STATUS_TONE = { 'שולם': 'green', 'שולם חלקית': 'orange', 'לא שולם': 'red' }
export const nextStatus = (s) => (s === 'לא שולם' ? 'שולם חלקית' : s === 'שולם חלקית' ? 'שולם' : 'לא שולם')
export function StatusPill({ status = 'לא שולם', onClick }) {
  return (
    <Pill tone={STATUS_TONE[status] || 'red'} onClick={onClick} title={onClick ? 'לחיצה מחליפה סטטוס' : undefined}>
      {status}
    </Pill>
  )
}
export const MOODS = {
  happy: { emoji: '😊', label: 'רגוע', tone: 'green' },
  neutral: { emoji: '😐', label: 'העיר על זה', tone: 'orange' },
  angry: { emoji: '😠', label: 'דורש את הכסף', tone: 'red' }
}
export const nextMood = (m) => (m === 'happy' ? 'neutral' : m === 'neutral' ? 'angry' : 'happy')
export function MoodPill({ mood = 'happy', onClick, compact: small }) {
  const m = MOODS[mood] || MOODS.happy
  return (
    <Pill tone={m.tone} dot={false} onClick={onClick} title={onClick ? `${m.label} · לחיצה משנה` : m.label}>
      <span className="mood-emoji">{m.emoji}</span>
      {!small && m.label}
    </Pill>
  )
}
