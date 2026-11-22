import { Search } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { ID, Item } from '../core/types';
import { ItemTypeBadge } from './Badge';

interface ItemPickerProps {
  id: string;
  items: Item[];
  selectedId: ID | null;
  onSelect: (id: ID) => void;
  /** 품목 오른쪽에 붙일 표시 (구성품 수, 공정 수 등) */
  meta: (item: Item) => ReactNode;
  scopes?: { value: string; label: string; match: (item: Item) => boolean }[];
  label: string;
}

/** BOM·라우팅 화면 왼쪽의 품목 목록. 좁은 화면에서는 선택 상자로 바뀐다. */
export function ItemPicker({ id, items, selectedId, onSelect, meta, scopes, label }: ItemPickerProps) {
  const [query, setQuery] = useState('');
  const [scope, setScope] = useState(scopes?.[0]?.value ?? '');

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    const inScope = scopes?.find((s) => s.value === scope)?.match;
    return items
      .filter((i) => (inScope ? inScope(i) || i.id === selectedId : true))
      .filter((i) => !q || `${i.code} ${i.name}`.toLowerCase().includes(q))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [items, query, scope, scopes, selectedId]);

  return (
    <aside className="picker" aria-label={label}>
      <div className="picker__head">
        {scopes && scopes.length > 1 && (
          <div className="segmented" role="group" aria-label="목록 범위">
            {scopes.map((s) => (
              <button key={s.value} type="button" aria-pressed={s.value === scope} onClick={() => setScope(s.value)}>
                {s.label}
              </button>
            ))}
          </div>
        )}
        <div className="search-input picker__search">
          <Search size={16} aria-hidden="true" />
          <input
            id={`${id}-search`}
            className="input"
            type="search"
            placeholder="품목 찾기"
            aria-label="품목 찾기"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          id={`${id}-select`}
          className="input select picker__select"
          aria-label={label}
          value={selectedId ?? ''}
          onChange={(e) => e.target.value && onSelect(e.target.value)}
        >
          {!selectedId && <option value="">품목을 선택하세요</option>}
          {visible.map((i) => (
            <option key={i.id} value={i.id}>
              {i.code} · {i.name}
            </option>
          ))}
        </select>
      </div>
      <ul className="picker__list">
        {visible.map((i) => (
          <li key={i.id}>
            <button type="button" className="picker__item" aria-current={i.id === selectedId ? 'true' : undefined} onClick={() => onSelect(i.id)}>
              <span className="picker__code mono">{i.code}</span>
              <span className="picker__meta">{meta(i)}</span>
              <span className="picker__name">{i.name}</span>
              <ItemTypeBadge type={i.type} />
            </button>
          </li>
        ))}
        {visible.length === 0 && <li className="picker__none">해당하는 품목이 없습니다.</li>}
      </ul>
    </aside>
  );
}
