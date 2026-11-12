import { useEffect, useLayoutEffect, useRef, useState, RefObject } from 'react';

/** Element size via ResizeObserver (charts draw to the real pixel width). */
export function useSize<T extends HTMLElement>(ref: RefObject<T | null>) {
  const [size, setSize] = useState({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref]);
  return size;
}

const reduceMotion = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/**
 * Counts from the previous value to `target` (ease-out). Cleanup always lands on
 * the final value, so StrictMode / fast re-renders never leave it stuck mid-way.
 */
export function useCountUp(target: number, duration = 900, delay = 0) {
  const [v, setV] = useState(reduceMotion() ? target : 0);
  const from = useRef(0);
  useEffect(() => {
    if (reduceMotion()) {
      setV(target);
      return;
    }
    let raf = 0;
    const start = from.current;
    const t0 = performance.now() + delay;
    const tick = (now: number) => {
      const p = Math.min(1, Math.max(0, (now - t0) / duration));
      const e = 1 - Math.pow(1 - p, 3);
      setV(start + (target - start) * e);
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      from.current = target;
    };
  }, [target, duration, delay]);
  return v;
}

/** Smooth monotone curve through points (no overshoot) → SVG path. */
export function monotonePath(pts: [number, number][]) {
  if (pts.length < 2) return '';
  const n = pts.length;
  const dx: number[] = [];
  const m: number[] = [];
  for (let i = 0; i < n - 1; i++) {
    dx[i] = pts[i + 1][0] - pts[i][0];
    m[i] = (pts[i + 1][1] - pts[i][1]) / (dx[i] || 1);
  }
  const t: number[] = [m[0]];
  for (let i = 1; i < n - 1; i++) t[i] = m[i - 1] * m[i] <= 0 ? 0 : (m[i - 1] + m[i]) / 2;
  t[n - 1] = m[n - 2];
  let d = `M${pts[0][0]},${pts[0][1]}`;
  for (let i = 0; i < n - 1; i++) {
    const h = dx[i] / 3;
    d += ` C${pts[i][0] + h},${pts[i][1] + t[i] * h} ${pts[i + 1][0] - h},${pts[i + 1][1] - t[i + 1] * h} ${pts[i + 1][0]},${pts[i + 1][1]}`;
  }
  return d;
}

export const ils = (n: number, digits = 0) =>
  (Number(n) || 0).toLocaleString('he-IL', { style: 'currency', currency: 'ILS', maximumFractionDigits: digits, minimumFractionDigits: 0 });

/** Compact money for chart axes: ₪12.4K / ₪1.2M */
export const ilsCompact = (n: number) => {
  const a = Math.abs(n);
  const s = n < 0 ? '-' : '';
  if (a >= 1_000_000) return `${s}₪${(a / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (a >= 1000) return `${s}₪${(a / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  return `${s}₪${Math.round(a)}`;
};

/** % change, null when there is no base to compare with. */
export const pctChange = (now: number, prev: number) => (prev ? ((now - prev) / Math.abs(prev)) * 100 : null);
