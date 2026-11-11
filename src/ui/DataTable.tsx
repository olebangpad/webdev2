import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { IconButton } from './Button';

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** 정렬 기준 값. 없으면 정렬할 수 없는 열 */
  sort?: (row: T) => string | number | null;
  align?: 'right' | 'center';
  /** 내용 너비만큼만 차지하는 좁은 열 (순서, 건수 등) */
  narrow?: boolean;
}

interface DataTableProps<T> {
  rows: T[];
  columns: Column<T>[];
  rowKey: (row: T) => string;
  onRowClick?: (row: T) => void;
  rowLabel?: (row: T) => string;
  empty: ReactNode;
  initialSort?: string;
  pageSize?: number;
  rowClassName?: (row: T) => string | undefined;
}

function compare(a: string | number | null, b: string | number | null): number {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), 'ko', { numeric: true });
}

export function DataTable<T>({ rows, columns, rowKey, onRowClick, rowLabel, empty, initialSort, pageSize = 50, rowClassName }: DataTableProps<T>) {
  const [sort, setSort] = useState<{ key: string; dir: 1 | -1 } | null>(initialSort ? { key: initialSort, dir: 1 } : null);
  const [page, setPage] = useState(0);

  const sorted = useMemo(() => {
    const column = sort && columns.find((c) => c.key === sort.key);
    if (!sort || !column?.sort) return rows;
    const by = column.sort;
    return [...rows].sort((a, b) => compare(by(a), by(b)) * sort.dir);
  }, [rows, columns, sort]);

  const pageCount = Math.max(1, Math.ceil(sorted.length / pageSize));
  useEffect(() => {
    if (page > pageCount - 1) setPage(pageCount - 1);
  }, [page, pageCount]);
  const visible = sorted.slice(page * pageSize, (page + 1) * pageSize);

  const toggleSort = (key: string) =>
    setSort((s) => (s?.key === key ? (s.dir === 1 ? { key, dir: -1 } : null) : { key, dir: 1 }));

  if (rows.length === 0) return <div className="panel empty">{empty}</div>;

  return (
    <div className="table-block">
      <div className="table-wrap">
        <table className="grid grid--pinned">
          <thead>
            <tr>
              {columns.map((c) => {
                const active = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    className={`${c.align === 'right' ? 'num' : ''}${c.align === 'center' ? ' center' : ''}${c.narrow ? ' col-narrow' : ''}`}
                    aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : undefined}
                  >
                    {c.sort ? (
                      <button type="button" className="th-sort" onClick={() => toggleSort(c.key)}>
                        <span>{c.header}</span>
                        {active && (sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} />)}
                      </button>
                    ) : (
                      c.header
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.map((row) => (
              <tr
                key={rowKey(row)}
                className={`${onRowClick ? 'is-clickable' : ''} ${rowClassName?.(row) ?? ''}`}
                tabIndex={onRowClick ? 0 : undefined}
                aria-label={onRowClick && rowLabel ? `${rowLabel(row)} 수정` : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={
                  onRowClick
                    ? (e) => {
                        if (e.key === 'Enter' && e.target === e.currentTarget) onRowClick(row);
                      }
                    : undefined
                }
              >
                {columns.map((c) => (
                  <td key={c.key} className={`${c.align === 'right' ? 'num' : ''}${c.align === 'center' ? ' center' : ''}${c.narrow ? ' col-narrow' : ''}`}>
                    {c.cell(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="table-foot">
        <span>총 {sorted.length.toLocaleString('ko-KR')}건</span>
        {pageCount > 1 && (
          <div className="pager">
            <IconButton label="이전 쪽" disabled={page === 0} onClick={() => setPage(page - 1)}>
              <ChevronLeft size={16} />
            </IconButton>
            <span>
              {page + 1} / {pageCount}
            </span>
            <IconButton label="다음 쪽" disabled={page >= pageCount - 1} onClick={() => setPage(page + 1)}>
              <ChevronRight size={16} />
            </IconButton>
          </div>
        )}
      </div>
    </div>
  );
}
