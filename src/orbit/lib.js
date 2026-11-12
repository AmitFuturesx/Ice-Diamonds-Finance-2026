/* Hooks, chart math and formatting for the Orbit UI (ported from the template, money in ₪). */
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'

/* ---------------- motion ---------------- */
export const STAGGER = 60
export const reducedMotion = () =>
  typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const easeOut = (t) => 1 - Math.pow(1 - t, 3)
/** Delay (ms) for script-driven animations so they start once card `d` has landed. */
export const useEnter = (d = 0, extra = 0) => d * STAGGER + extra

/** Live pixel size of an element (charts draw in real pixels). */
export function useSize(ref) {
  const [size, setSize] = useState({ w: 0, h: 0 })
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize((s) => (Math.abs(s.w - width) < 0.5 && Math.abs(s.h - height) < 0.5 ? s : { w: width, h: height }))
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [ref])
  return size
}

/** Glides a number (or array) to a new target. Targets must be stable references. */
export function useTween(target, duration = 700, initial = target, delay = 0) {
  const [value, setValue] = useState(initial)
  const current = useRef(initial)
  const first = useRef(true)
  useEffect(() => {
    const from = current.current
    const lerp = (k) =>
      Array.isArray(target)
        ? target.map((b, i) => {
            const a = Array.isArray(from) && from[i] != null ? from[i] : b
            return a + (b - a) * k
          })
        : from + (target - from) * k
    const reduced = reducedMotion()
    const ms = reduced ? 1 : duration
    let raf = 0
    let start = 0
    const step = (now) => {
      if (!start) start = now - 1
      const t = Math.min(1, (now - start) / ms)
      const v = lerp(easeOut(t))
      current.current = v
      setValue(v)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    const wait = first.current && !reduced ? delay : 0
    const timer = window.setTimeout(() => {
      first.current = false
      raf = requestAnimationFrame(step)
    }, wait)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
    }
  }, [target, duration, delay])
  return value
}

/** Same array reference while its values don't change (safe to pass to useTween). */
export function useStable(values) {
  const sig = values.join('|')
  return useMemo(() => (sig ? sig.split('|').map(Number) : []), [sig])
}

/** Counts a number up from zero on mount, then glides between later values. */
export function useCountUp(value, duration = 1400, delay = 0) {
  const [v, setV] = useState(() => (reducedMotion() ? value : 0))
  const current = useRef(v)
  useEffect(() => {
    const reduced = reducedMotion()
    const ms = reduced ? 1 : duration
    const from = current.current
    let raf = 0
    let start = 0
    const step = (now) => {
      if (!start) start = now - 1
      const t = Math.min(1, (now - start) / ms)
      const x = from + (value - from) * easeOut(t)
      current.current = x
      setV(x)
      if (t < 1) raf = requestAnimationFrame(step)
    }
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(step)
    }, reduced ? 0 : delay)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(raf)
      current.current = value
    }
  }, [value, duration, delay])
  return v
}

/** Closes a popover on outside click or Escape. */
export function useDismiss(ref, onClose, open) {
  useEffect(() => {
    if (!open) return undefined
    const down = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose()
    }
    const key = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('pointerdown', down)
    document.addEventListener('keydown', key)
    return () => {
      document.removeEventListener('pointerdown', down)
      document.removeEventListener('keydown', key)
    }
  }, [ref, onClose, open])
}

/** FLIP: rows glide to their new spot when the order changes (children opt in with data-flip). */
export function useFlip(ref, key) {
  const spots = useRef(new Map())
  useLayoutEffect(() => {
    const list = ref.current
    if (!list) return
    const next = new Map()
    for (const node of list.querySelectorAll(':scope > [data-flip]')) {
      const id = node.dataset.flip
      const spot = { x: node.offsetLeft, y: node.offsetTop }
      next.set(id, spot)
      const prev = spots.current.get(id)
      if (!prev || reducedMotion()) continue
      const dx = prev.x - spot.x
      const dy = prev.y - spot.y
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        node.animate([{ transform: `translate(${dx}px, ${dy}px)` }, { transform: 'translate(0, 0)' }], {
          duration: 560,
          easing: 'cubic-bezier(0.22, 1, 0.36, 1)'
        })
      }
    }
    spots.current = next
  }, [ref, key])
}

export function useMedia(query) {
  const [match, setMatch] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mq = window.matchMedia(query)
    const on = () => setMatch(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [query])
  return match
}

/**
 * Moves an absolutely placed "pill" under the selected button.
 * Works in RTL too: the pill is anchored at inline-start, so we measure where it
 * naturally sits (offsetLeft ignores transforms) and shift by the difference.
 */
export function placePill(pill, btn) {
  if (!pill || !btn) return
  pill.style.width = `${btn.offsetWidth}px`
  pill.style.transform = `translateX(${btn.offsetLeft - pill.offsetLeft}px)`
}

/* ---------------- popovers ---------------- */
function placeAt(el, align) {
  const r = el.getBoundingClientRect()
  const roomBelow = window.innerHeight - r.bottom
  const below = roomBelow > 280 || roomBelow > r.top
  return {
    top: below ? r.bottom + 6 : undefined,
    bottom: below ? undefined : window.innerHeight - r.top + 6,
    left: align === 'right' ? undefined : Math.max(8, r.left),
    right: align === 'right' ? Math.max(8, window.innerWidth - r.right) : undefined,
    minWidth: r.width,
    origin: `${below ? 'top' : 'bottom'} ${align === 'right' ? 'right' : 'left'}`,
    anchor: el
  }
}
/** State for a floating menu anchored to the button that opened it. In RTL "start" is the right edge. */
export function usePopover(align = 'start') {
  const [pos, setPos] = useState(null)
  const close = useCallback(() => setPos(null), [])
  const toggle = useCallback(
    (e) => {
      const el = e.currentTarget
      const rtl = document.documentElement.dir === 'rtl' || getComputedStyle(el).direction === 'rtl'
      const phys = align === 'start' ? (rtl ? 'right' : 'left') : align === 'end' ? (rtl ? 'left' : 'right') : align
      setPos((p) => (p ? null : placeAt(el, phys)))
    },
    [align]
  )
  return { open: !!pos, pos, toggle, close }
}

/* ---------------- chart math ---------------- */
export function monotone(points) {
  const n = points.length
  if (n < 2) return ''
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  const dx = []
  const m = []
  for (let i = 0; i < n - 1; i++) {
    dx[i] = xs[i + 1] - xs[i] || 1e-6
    m[i] = (ys[i + 1] - ys[i]) / dx[i]
  }
  const t = new Array(n)
  t[0] = m[0]
  t[n - 1] = m[n - 2]
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2
  for (let i = 0; i < n - 1; i++) {
    if (m[i] === 0) {
      t[i] = 0
      t[i + 1] = 0
      continue
    }
    const a = t[i] / m[i]
    const b = t[i + 1] / m[i]
    const s = a * a + b * b
    if (s > 9) {
      const k = 3 / Math.sqrt(s)
      t[i] = k * a * m[i]
      t[i + 1] = k * b * m[i]
    }
  }
  const f = (v) => Math.round(v * 100) / 100
  let d = `M${f(xs[0])},${f(ys[0])}`
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3
    d += `C${f(xs[i] + h)},${f(ys[i] + t[i] * h)} ${f(xs[i + 1] - h)},${f(ys[i + 1] - t[i + 1] * h)} ${f(xs[i + 1])},${f(ys[i + 1])}`
  }
  return d
}
export const toArea = (line, points, base) =>
  line ? `${line}L${points[points.length - 1][0]},${base}L${points[0][0]},${base}Z` : ''

/* ---------------- formatting (₪) ---------------- */
export const num = (n, d = 0) =>
  (Number(n) || 0).toLocaleString('he-IL', { minimumFractionDigits: d, maximumFractionDigits: d })
/** ₪12,400 — digits stay left-to-right inside Hebrew text */
export const ils = (n, d = 0) => {
  const v = Number(n) || 0
  return `${v < 0 ? '-' : ''}₪${num(Math.abs(v), d)}`
}
/** 1.2K, 3.4M */
export function compact(n) {
  const a = Math.abs(n)
  if (a >= 1e6) return `${+(n / 1e6).toFixed(a >= 1e7 ? 1 : 2)}M`
  if (a >= 1e3) return `${+(n / 1e3).toFixed(a >= 1e5 ? 0 : 1)}K`
  return `${Math.round(n)}`
}
export const ilsK = (n) => `₪${compact(n)}`
export const pctChange = (now, prev) => (prev ? ((now - prev) / Math.abs(prev)) * 100 : null)
export const initials = (name = '') =>
  name
    .trim()
    .split(/\s+/)
    .map((s) => s[0])
    .join('')
    .slice(0, 2)

/** Re-renders once web fonts have loaded, so pills measured against text land in the right place. */
export function useFontsReady() {
  const [ready, setReady] = useState(() => typeof document === 'undefined' || document.fonts?.status === 'loaded')
  useEffect(() => {
    if (ready || !document.fonts) return undefined
    let alive = true
    document.fonts.ready.then(() => alive && setReady(true))
    return () => {
      alive = false
    }
  }, [ready])
  return ready
}
