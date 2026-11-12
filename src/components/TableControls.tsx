import { useMemo, useState, ReactNode } from 'react';
import { Search, X, ChevronUp, ChevronDown, ChevronsUpDown } from 'lucide-react';

type SortDir = 'asc' | 'desc';

/**
 * Search + click-to-sort for a table.
 * - getText: what the search box matches against (Hebrew, case-insensitive)
 * - sorters: column key -> value to sort by (number or string)
 */
export function useTable<T>(
  rows: T[],
  getText: (row: T) => string,
  sorters: Record<string, (row: T) => number | string>
) {
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<{ key: string; dir: SortDir } | null>(null);

  const view = useMemo(() => {
    const q = query.trim().toLowerCase();
    let out = q ? rows.filter((r) => getText(r).toLowerCase().includes(q)) : rows;
    if (sort && sorters[sort.key]) {
      const get = sorters[sort.key];
      out = [...out].sort((a, b) => {
        const va = get(a);
        const vb = get(b);
        const cmp = typeof va === 'number' && typeof vb === 'number' ? va - vb : String(va).localeCompare(String(vb), 'he');
        return sort.dir === 'asc' ? cmp : -cmp;
      });
    }
    return out;
    // sorters/getText are recreated each render by callers; rows/query/sort drive the result
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, query, sort]);

  // asc -> desc -> off
  const toggleSort = (key: string) =>
    setSort((s) => (!s || s.key !== key ? { key, dir: 'asc' } : s.dir === 'asc' ? { key, dir: 'desc' } : null));

  return { view, query, setQuery, sort, toggleSort };
}

export function TableSearch({
  value,
  onChange,
  placeholder = 'חיפוש...',
  count,
  total
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  count?: number;
  total?: number;
}) {
  return (
    <div className="flex items-center gap-2">
      <div className="relative">
        <Search className="w-4 h-4 text-muted absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
        <input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-44 sm:w-56 bg-white border border-line rounded-xl pr-9 pl-8 py-2 text-sm text-ink placeholder-slate-400 outline-none focus:border-navy focus:ring-2 focus:ring-navy/10 transition-all"
        />
        {value && (
          <button
            onClick={() => onChange('')}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-0.5 text-muted hover:text-ink rounded-full cursor-pointer"
            aria-label="נקה חיפוש"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {value && count !== undefined && total !== undefined && (
        <span className="text-xs text-muted whitespace-nowrap">
          {count} מתוך {total}
        </span>
      )}
    </div>
  );
}

export function SortTh({
  label,
  sortKey,
  sort,
  onSort,
  className = ''
}: {
  label: ReactNode;
  sortKey: string;
  sort: { key: string; dir: SortDir } | null;
  onSort: (key: string) => void;
  className?: string;
}) {
  const active = sort?.key === sortKey;
  const Icon = !active ? ChevronsUpDown : sort!.dir === 'asc' ? ChevronUp : ChevronDown;
  return (
    <th className={`p-4 font-semibold ${className}`} aria-sort={active ? (sort!.dir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(sortKey)}
        className={`inline-flex items-center gap-1 cursor-pointer select-none transition-colors ${active ? 'text-navy' : 'hover:text-ink'}`}
      >
        {label}
        <Icon className={`w-3.5 h-3.5 ${active ? 'text-gold-2' : 'opacity-40'}`} />
      </button>
    </th>
  );
}
