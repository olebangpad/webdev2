import { ArrowRight, CircleAlert, CircleCheck, Info, TriangleAlert } from 'lucide-react';
import { useMemo } from 'react';
import { navigate } from '../app/router';
import type { RouteName } from '../app/routes';
import { checkHealth, completeness, type HealthGroup, type Severity } from '../core/health';
import { EQUIPMENT_STATUSES, ITEM_TYPES } from '../core/labels';
import { useAppState } from '../core/store';
import { findTemplate } from '../core/templates';
import { PageHeader } from '../ui/layout';

const SEVERITY: Record<Severity, { label: string; icon: typeof Info }> = {
  error: { label: '오류', icon: CircleAlert },
  warn: { label: '주의', icon: TriangleAlert },
  info: { label: '참고', icon: Info },
};

const MODULES = [
  { name: '기준정보', code: 'MDM', text: '품목, BOM, 공정, 라우팅, 설비', status: 'now' },
  { name: '생산 실행', code: 'MES', text: '작업지시, 생산 실적, 불량·비가동 기록', status: 'next' },
  { name: '품질·공정 관리', code: 'QMS · SPC', text: '검사 기준과 기록, 관리도, 공정 능력', status: 'later' },
  { name: '설계 변경', code: 'PLM', text: '변경 요청과 승인, BOM 개정 이력', status: 'later' },
] as const;

function Ratio({ label, done, total, route, hint }: { label: string; done: number; total: number; route: RouteName; hint: string }) {
  const pct = total === 0 ? 0 : Math.round((done / total) * 100);
  return (
    <button type="button" className="tile tile--link" onClick={() => navigate(route)}>
      <span className="tile__label">{label}</span>
      <span className="tile__value">
        {done}
        <span className="tile__total"> / {total}</span>
      </span>
      <span className="meter" role="img" aria-label={`${label} ${pct}%`}>
        <span className="meter__fill" style={{ width: `${pct}%` }} data-full={pct === 100 ? 'true' : undefined} />
      </span>
      <span className="tile__sub">{total === 0 ? '대상 품목 없음' : done === total ? '모두 등록됨' : hint}</span>
    </button>
  );
}

export function HomePage() {
  const state = useAppState();
  const health = useMemo(() => checkHealth(state), [state]);
  const done = useMemo(() => completeness(state), [state]);
  const template = findTemplate(state.meta.templateKey);

  const byType = ITEM_TYPES.map((t) => ({ ...t, count: state.items.filter((i) => i.type === t.value).length }));
  const byStatus = EQUIPMENT_STATUSES.map((s) => ({ ...s, count: state.equipment.filter((q) => q.status === s.value).length }));
  const issueCount = health.reduce((n, g) => n + g.issues.length, 0);
  const worst: Severity | null = health.some((g) => g.severity === 'error') ? 'error' : health.some((g) => g.severity === 'warn') ? 'warn' : health.length ? 'info' : null;

  return (
    <>
      <PageHeader
        title="기준정보 현황"
        description={template ? `${template.name} 예시 데이터입니다. 생산 제품: ${template.products}` : '등록된 기준정보와 손봐야 할 곳을 한눈에 봅니다.'}
      />

      <section className="tiles" aria-label="등록 현황">
        <button type="button" className="tile tile--link tile--wide" onClick={() => navigate('items')}>
          <span className="tile__label">품목</span>
          <span className="tile__value">{state.items.length}</span>
          {state.items.length > 0 && (
            <span className="stack" role="img" aria-label={byType.map((t) => `${t.label} ${t.count}`).join(', ')}>
              {byType
                .filter((t) => t.count > 0)
                .map((t) => (
                  <span key={t.value} className={`stack__seg stack__seg--${t.value.toLowerCase()}`} style={{ flexGrow: t.count }} />
                ))}
            </span>
          )}
          <span className="legend">
            {byType
              .filter((t) => t.count > 0)
              .map((t) => (
                <span key={t.value} className="legend__item">
                  <span className={`legend__dot stack__seg--${t.value.toLowerCase()}`} />
                  {t.label} {t.count}
                </span>
              ))}
          </span>
        </button>
        <Ratio label="BOM 등록" done={done.withBom} total={done.makeItems} route="bom" hint={`생산 품목 ${done.makeItems - done.withBom}개에 BOM 없음`} />
        <Ratio label="라우팅 등록" done={done.withRouting} total={done.inHouseItems} route="routing" hint={`자체 생산 품목 ${done.inHouseItems - done.withRouting}개에 라우팅 없음`} />
        <button type="button" className="tile tile--link" onClick={() => navigate('equipment')}>
          <span className="tile__label">설비</span>
          <span className="tile__value">{state.equipment.length}</span>
          <span className="tile__sub">
            {byStatus
              .filter((s) => s.count > 0)
              .map((s) => `${s.label} ${s.count}`)
              .join(' · ') || '등록된 설비 없음'}
          </span>
          <span className="tile__sub">
            공정 {state.processes.length} · 작업장 {state.workCenters.length}
          </span>
        </button>
      </section>

      <section className="panel health" aria-labelledby="health-title">
        <header className="panel__head">
          <div>
            <h2 id="health-title">기준정보 점검</h2>
            <p>생산과 품질 기록을 시작하기 전에 고쳐 두면 좋은 곳입니다. 항목을 누르면 해당 화면으로 이동합니다.</p>
          </div>
          {worst ? (
            <span className={`health__total health__total--${worst}`}>{issueCount}건</span>
          ) : (
            <span className="health__total health__total--ok">
              <CircleCheck size={16} /> 이상 없음
            </span>
          )}
        </header>
        {health.length === 0 ? (
          <p className="health__clear">모든 생산 품목에 BOM과 라우팅이 있고, 끊어진 연결이 없습니다.</p>
        ) : (
          <ul className="health__groups">
            {health.map((group) => (
              <HealthItem key={group.rule} group={group} />
            ))}
          </ul>
        )}
      </section>

      <section className="roadmap" aria-labelledby="roadmap-title">
        <h2 id="roadmap-title">모듈 구성</h2>
        <ol className="roadmap__list">
          {MODULES.map((m) => (
            <li key={m.code} className={`roadmap__item roadmap__item--${m.status}`}>
              <span className="roadmap__state">{m.status === 'now' ? '사용 중' : m.status === 'next' ? '다음 단계' : '예정'}</span>
              <strong>{m.name}</strong>
              <span className="mono roadmap__code">{m.code}</span>
              <span className="roadmap__text">{m.text}</span>
            </li>
          ))}
        </ol>
        <p className="note">모든 모듈이 여기서 등록한 품목·공정·설비를 그대로 씁니다. 그래서 기준정보를 먼저 만듭니다.</p>
      </section>
    </>
  );
}

function HealthItem({ group }: { group: HealthGroup }) {
  const { label, icon: Icon } = SEVERITY[group.severity];
  return (
    <li className={`health__group health__group--${group.severity}`}>
      <div className="health__group-head">
        <span className={`sev sev--${group.severity}`}>
          <Icon size={14} />
          {label}
        </span>
        <div className="health__group-text">
          <strong>
            {group.title} <span className="health__count">{group.issues.length}건</span>
          </strong>
          <span>{group.why}</span>
        </div>
      </div>
      <ul className="health__issues">
        {group.issues.slice(0, 6).map((issue) => (
          <li key={issue.id}>
            <button type="button" className="health__issue" onClick={() => navigate(issue.route, issue.params)}>
              <span>{issue.label}</span>
              <ArrowRight size={14} aria-hidden="true" />
            </button>
          </li>
        ))}
        {group.issues.length > 6 && <li className="health__more">외 {group.issues.length - 6}건</li>}
      </ul>
    </li>
  );
}
