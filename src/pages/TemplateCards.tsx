import { useMemo } from 'react';
import { TEMPLATES, buildTemplate, type TemplateSpec } from '../core/templates';

/** 예시 데이터 선택 카드. 처음 화면과 데이터 관리 화면에서 같이 쓴다. */
export function TemplateCards({ current, onPick, actionLabel }: { current?: string | null; onPick: (spec: TemplateSpec) => void; actionLabel: string }) {
  const stats = useMemo(
    () =>
      TEMPLATES.map((spec) => {
        const state = buildTemplate(spec);
        const fg = state.items.filter((i) => i.type === 'FG').slice(0, 2);
        return {
          spec,
          counts: [
            ['품목', state.items.length],
            ['BOM 라인', state.bomLines.length],
            ['공정', state.processes.length],
            ['설비', state.equipment.length],
          ] as [string, number][],
          products: fg.map((i) => i.name),
          defects: state.codes.filter((c) => c.group === 'DEFECT_TYPE').slice(0, 4).map((c) => c.name),
          attrs: state.attrDefs.filter((d) => d.entity === 'items').map((d) => d.label),
        };
      }),
    [],
  );

  return (
    <ul className="template-cards">
      {stats.map(({ spec, counts, defects, attrs }) => (
        <li key={spec.key} className={`template-card${current === spec.key ? ' is-current' : ''}`}>
          <div className="template-card__head">
            <h3>{spec.name}</h3>
            {current === spec.key && <span className="badge badge--accent">사용 중</span>}
          </div>
          <p className="template-card__products">{spec.products}</p>
          <p className="template-card__summary">{spec.summary}</p>
          <dl className="template-card__counts">
            {counts.map(([label, n]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{n}</dd>
              </div>
            ))}
          </dl>
          <dl className="template-card__traits">
            <div>
              <dt>품목 속성</dt>
              <dd>{attrs.join(', ')}</dd>
            </div>
            <div>
              <dt>불량 유형</dt>
              <dd>{defects.join(', ')} 외</dd>
            </div>
          </dl>
          <button type="button" className="btn btn--primary btn--md template-card__action" onClick={() => onPick(spec)}>
            <span>{actionLabel}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
