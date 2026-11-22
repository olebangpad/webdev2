import { Search, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { FieldShell } from './fields';

export interface SearchOption {
  value: string;
  code: string;
  name: string;
  /** 오른쪽에 붙는 보조 표시 (유형, 단위 등) */
  meta?: string;
  /** 선택할 수 없는 이유. 값이 있으면 흐리게 보이고 선택되지 않는다. */
  blocked?: string;
}

interface SearchSelectProps {
  id: string;
  label: string;
  required?: boolean;
  error?: string;
  hint?: string;
  options: SearchOption[];
  value: string | null;
  onChange: (value: string | null) => void;
  placeholder?: string;
}

const LIMIT = 40;

/** 품목처럼 수가 많은 대상을 코드·이름으로 찾아 고르는 입력 */
export function SearchSelect({ id, label, required, error, hint, options, value, onChange, placeholder }: SearchSelectProps) {
  const [query, setQuery] = useState('');
  const selected = options.find((o) => o.value === value);

  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = q ? options.filter((o) => `${o.code} ${o.name}`.toLowerCase().includes(q)) : options;
    return list;
  }, [options, query]);

  return (
    <FieldShell id={id} label={label} required={required} error={error} hint={hint} full>
      {selected ? (
        <div className="picked">
          <span className="mono">{selected.code}</span>
          <span className="picked__name">{selected.name}</span>
          {selected.meta && <span className="picked__meta">{selected.meta}</span>}
          <button type="button" className="icon-btn" aria-label="다시 선택" title="다시 선택" onClick={() => onChange(null)}>
            <X size={16} />
          </button>
        </div>
      ) : (
        <div className="search-select">
          <div className="search-input">
            <Search size={16} aria-hidden="true" />
            <input
              id={id}
              className="input"
              value={query}
              placeholder={placeholder ?? '코드 또는 이름으로 찾기'}
              autoComplete="off"
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <ul className="search-select__list" role="listbox" aria-label={`${label} 후보`}>
            {matches.slice(0, LIMIT).map((o) => (
              <li key={o.value} role="option" aria-selected={false} aria-disabled={o.blocked ? true : undefined}>
                <button type="button" disabled={!!o.blocked} onClick={() => onChange(o.value)}>
                  <span className="mono">{o.code}</span>
                  <span className="search-select__name">{o.name}</span>
                  <span className="search-select__meta">{o.blocked ?? o.meta}</span>
                </button>
              </li>
            ))}
            {matches.length === 0 && <li className="search-select__none">찾는 품목이 없습니다.</li>}
            {matches.length > LIMIT && <li className="search-select__none">{matches.length - LIMIT}건 더 있습니다. 검색어를 더 입력하세요.</li>}
          </ul>
        </div>
      )}
    </FieldShell>
  );
}
