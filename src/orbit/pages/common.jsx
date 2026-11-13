/* Shared pieces for the inner pages (Orbit look, Hebrew). */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import Icon from '../Icon'
import { Select } from '../kit'
import { dbService } from '../../lib/supabase'

/** Centered dialog; children is a render function that receives close(). */
export function Modal({ label, onClose, children, className = '' }) {
  const [leaving, setLeaving] = useState(false)
  const close = useCallback(() => {
    setLeaving(true)
    window.setTimeout(onClose, 200)
  }, [onClose])
  useEffect(() => {
    const key = (e) => e.key === 'Escape' && close()
    window.addEventListener('keydown', key)
    return () => window.removeEventListener('keydown', key)
  }, [close])
  return createPortal(
    <div
      dir="rtl"
      className={`modal ${leaving ? 'is-leaving' : ''}`}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close()
      }}
    >
      <div className={`modal-card ${className}`} role="dialog" aria-modal="true" aria-label={label}>
        {children(close)}
      </div>
    </div>,
    document.body
  )
}

/** Sortable column header button. */
export function SortBtn({ k, sort, setSort, children }) {
  const on = sort.key === k
  return (
    <button type="button" className={on ? 'is-on' : ''} onClick={() => setSort((s) => ({ key: k, dir: s.key === k && s.dir === 'desc' ? 'asc' : 'desc' }))}>
      {children}
      <Icon name="chevronDown" className={`chev ${on && sort.dir === 'asc' ? 'is-up' : ''}`} style={{ opacity: on ? 1 : 0.35 }} />
    </button>
  )
}
export function useSorted(list, sort, sorters) {
  return useMemo(() => {
    const fn = sorters[sort.key]
    if (!fn) return list
    return [...list].sort((a, b) => (sort.dir === 'asc' ? fn(a, b) : fn(b, a)))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [list, sort.key, sort.dir])
}

/** Month picker + add month (lives in every page header). */
export function MonthBar({ months = [], value, onChange, onAdd }) {
  const options = [...months]
    .sort((a, b) => b.year - a.year || b.month_number - a.month_number)
    .map((m) => ({ id: m.id, label: m.name.includes(String(m.year)) ? m.name : `${m.name} ${m.year}` }))
  return (
    <>
      <Select value={value} options={options} onChange={onChange} icon="calendar" label="חודש" align="end" />
      <button type="button" className="icon-btn icon-btn--soft" onClick={onAdd} aria-label="הוספת חודש חדש" title="הוספת חודש חדש">
        <Icon name="plus" />
      </button>
    </>
  )
}

/** Six-month history of the monthly totals (for KPI sparklines and deltas). */
export function useHistory(months, activeMonthId) {
  const sorted = useMemo(() => [...months].sort((a, b) => a.year - b.year || a.month_number - b.month_number), [months])
  const idx = sorted.findIndex((m) => m.id === activeMonthId)
  const win = idx >= 0 ? sorted.slice(Math.max(0, idx - 5), idx + 1) : []
  const key = win.map((m) => m.id).join(',')
  const [hist, setHist] = useState({})
  useEffect(() => {
    if (!key) return undefined
    let alive = true
    dbService
      .getMonthTotals(key.split(','))
      .then((r) => alive && setHist(r))
      .catch(() => alive && setHist({}))
    return () => {
      alive = false
    }
  }, [key])
  return { win, hist }
}

/** Series for one field over the window, with the open month taken from live numbers. */
export function seriesOf(win, hist, activeMonthId, field, liveValue) {
  return win.map((m) => (m.id === activeMonthId ? liveValue : Number(hist[m.id]?.[field]) || 0))
}

/* ---------- billing day helpers (10 / 15 / 19 / unknown) ---------- */
export const DAY_KEYS = ['10', '15', '19', 'unknown']
export const DAY_LABEL = { 10: '10 לחודש', 15: '15 לחודש', 19: '19 לחודש', unknown: 'לא ידוע' }
export const snapDay = (n) => (n == null || isNaN(n) ? 'unknown' : String([10, 15, 19].reduce((p, c) => (Math.abs(c - n) < Math.abs(p - n) ? c : p))))
export const nextDay = (d) => DAY_KEYS[(DAY_KEYS.indexOf(d) + 1) % DAY_KEYS.length]

export function DayPill({ day, onClick }) {
  const unknown = day === 'unknown'
  return (
    <button
      type="button"
      className={`pill ${unknown ? 'pill--grey' : 'pill--teal'} is-click`}
      title="לחיצה מחליפה את יום החיוב"
      onClick={(e) => {
        e.stopPropagation()
        onClick?.()
      }}
    >
      <Icon name="calendar" className="pill-ic" />
      {DAY_LABEL[day]}
    </button>
  )
}

/** Download helper for a CSV of the current list. */
export function downloadCsv(filename, rows) {
  const esc = (v) => {
    const s = String(v ?? '')
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  const csv = '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}
