import { useEffect, useMemo, useRef, useState, ComponentType, KeyboardEvent } from 'react';
import { Search, CornerDownLeft } from 'lucide-react';

export interface PaletteItem {
  id: string;
  label: string;
  sub?: string;
  group: string; // section heading, e.g. "מעבר לעמוד"
  icon?: ComponentType<{ className?: string }>;
  run: () => void;
}

/** Ctrl+K / ⌘K command palette: jump to a page, a month, or a record; run quick actions. */
export default function CommandPalette({
  open,
  onClose,
  items
}: {
  open: boolean;
  onClose: () => void;
  items: PaletteItem[];
}) {
  const [query, setQuery] = useState('');
  const [index, setIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setIndex(0);
      // focus after the modal is painted
      requestAnimationFrame(() => inputRef.current?.focus());
    }
  }, [open]);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? items.filter((i) => `${i.label} ${i.sub || ''} ${i.group}`.toLowerCase().includes(q)) : items;
    return list.slice(0, 40);
  }, [items, query]);

  useEffect(() => setIndex(0), [query]);

  // keep the highlighted row visible
  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${index}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [index]);

  if (!open) return null;

  const choose = (item?: PaletteItem) => {
    if (!item) return;
    onClose();
    item.run();
  };

  const onKey = (e: KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setIndex((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      choose(results[index]);
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  // group headings in order of first appearance
  let lastGroup = '';

  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center pt-[12vh] px-4" onKeyDown={onKey}>
      <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm" onClick={onClose}></div>
      <div className="pop-in relative w-full max-w-xl bg-white rounded-3xl shadow-pop border border-line overflow-hidden">
        <div className="flex items-center gap-3 px-5 border-b border-line">
          <Search className="w-5 h-5 text-muted shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="חיפוש עמוד, חודש, ספק, חוב או עובד..."
            className="flex-1 py-4 text-base text-ink placeholder-slate-400 outline-none bg-transparent"
          />
          <kbd className="hidden sm:inline text-[11px] font-semibold text-muted bg-panel border border-line rounded-md px-1.5 py-0.5">Esc</kbd>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
          {results.length === 0 ? (
            <div className="py-10 text-center text-sm text-muted">לא נמצאו תוצאות עבור "{query}"</div>
          ) : (
            results.map((item, i) => {
              const showGroup = item.group !== lastGroup;
              lastGroup = item.group;
              const Icon = item.icon;
              const active = i === index;
              return (
                <div key={item.id}>
                  {showGroup && <div className="px-3 pt-3 pb-1 text-[11px] font-bold text-muted tracking-wide">{item.group}</div>}
                  <button
                    data-idx={i}
                    onMouseMove={() => setIndex(i)}
                    onClick={() => choose(item)}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-right cursor-pointer transition-colors ${
                      active ? 'bg-panel' : ''
                    }`}
                  >
                    {Icon && (
                      <span className={`w-8 h-8 rounded-lg grid place-items-center shrink-0 ${active ? 'bg-navy text-gold' : 'bg-panel text-ink-2'}`}>
                        <Icon className="w-4 h-4" />
                      </span>
                    )}
                    <span className="flex-1 min-w-0">
                      <span className="block text-sm font-semibold text-ink truncate">{item.label}</span>
                      {item.sub && <span className="block text-xs text-muted truncate">{item.sub}</span>}
                    </span>
                    {active && <CornerDownLeft className="w-4 h-4 text-muted shrink-0" />}
                  </button>
                </div>
              );
            })
          )}
        </div>

        <div className="hidden sm:flex items-center gap-4 px-5 py-2.5 border-t border-line text-[11px] text-muted">
          <span><kbd className="font-sans">↑↓</kbd> ניווט</span>
          <span><kbd className="font-sans">Enter</kbd> בחירה</span>
          <span><kbd className="font-sans">Ctrl+K</kbd> פתיחה מכל מקום</span>
        </div>
      </div>
    </div>
  );
}
