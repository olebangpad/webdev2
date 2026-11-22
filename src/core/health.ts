// 기준정보 점검. 등록은 됐지만 생산·품질 모듈에서 문제를 일으킬 데이터를 미리 찾아낸다.

import { indexBom } from './bom';
import type { RouteName } from '../app/routes';
import type { AppState, ID } from './types';

export type Severity = 'error' | 'warn' | 'info';

export interface HealthIssue {
  id: ID;
  label: string;
  route: RouteName;
  /** 이동할 때 넘길 값 (예: 선택할 품목) */
  params: Record<string, string>;
}

export interface HealthGroup {
  rule: string;
  severity: Severity;
  title: string;
  why: string;
  issues: HealthIssue[];
}

export function checkHealth(state: AppState): HealthGroup[] {
  const bom = indexBom(state);
  const itemLabel = (id: ID) => {
    const item = bom.items.get(id);
    return item ? `${item.code} ${item.name}` : id;
  };
  const routingItems = new Set(state.routingSteps.map((s) => s.itemId));
  const groups: HealthGroup[] = [];
  const add = (group: HealthGroup) => {
    if (group.issues.length > 0) groups.push(group);
  };

  const active = state.items.filter((i) => i.active);

  add({
    rule: 'bom-inactive-component',
    severity: 'error',
    title: '사용 중지된 품목이 BOM에 들어 있음',
    why: '작업지시를 내리면 투입할 수 없는 자재가 소요량에 잡힙니다.',
    issues: state.bomLines
      .filter((l) => bom.items.get(l.componentId)?.active === false && bom.items.get(l.parentId)?.active)
      .map((l) => ({
        id: l.id,
        label: `${itemLabel(l.parentId)} ← ${itemLabel(l.componentId)}`,
        route: 'bom' as const,
        params: { item: l.parentId },
      })),
  });

  add({
    rule: 'routing-retired-equipment',
    severity: 'error',
    title: '폐기된 설비가 라우팅에 지정됨',
    why: '해당 공정에 작업을 배정할 수 없습니다.',
    issues: state.routingSteps
      .filter((s) => state.equipment.find((q) => q.id === s.equipmentId)?.status === 'RETIRED')
      .map((s) => ({ id: s.id, label: `${itemLabel(s.itemId)} · 순번 ${s.seq}`, route: 'routing' as const, params: { item: s.itemId } })),
  });

  add({
    rule: 'make-without-bom',
    severity: 'warn',
    title: '생산 품목인데 BOM이 없음',
    why: '자재 소요량과 재료비를 계산할 수 없습니다.',
    issues: active
      .filter((i) => i.procurement !== 'BUY' && !bom.byParent.has(i.id))
      .map((i) => ({ id: i.id, label: `${i.code} ${i.name}`, route: 'bom' as const, params: { item: i.id } })),
  });

  add({
    rule: 'make-without-routing',
    severity: 'warn',
    title: '자체 생산 품목인데 라우팅이 없음',
    why: '작업지시를 공정별로 나눌 수 없고 표준시간도 알 수 없습니다.',
    issues: active
      .filter((i) => i.procurement === 'MAKE' && !routingItems.has(i.id))
      .map((i) => ({ id: i.id, label: `${i.code} ${i.name}`, route: 'routing' as const, params: { item: i.id } })),
  });

  add({
    rule: 'bom-process-not-in-routing',
    severity: 'warn',
    title: '투입 공정이 상위 품목의 라우팅에 없음',
    why: '자재를 어느 공정에서 투입할지 현장에서 알 수 없습니다.',
    issues: state.bomLines
      .filter(
        (l) => l.processId && !state.routingSteps.some((s) => s.itemId === l.parentId && s.processId === l.processId),
      )
      .map((l) => ({
        id: l.id,
        label: `${itemLabel(l.parentId)} ← ${itemLabel(l.componentId)}`,
        route: 'bom' as const,
        params: { item: l.parentId },
      })),
  });

  add({
    rule: 'equipment-without-workcenter',
    severity: 'warn',
    title: '작업장이 지정되지 않은 설비',
    why: '라인별 가동 현황에 집계되지 않습니다.',
    issues: state.equipment
      .filter((q) => q.status !== 'RETIRED' && !q.workCenterId)
      .map((q) => ({ id: q.id, label: `${q.code} ${q.name}`, route: 'equipment' as const, params: { edit: q.id } })),
  });

  add({
    rule: 'buy-without-cost',
    severity: 'info',
    title: '표준단가가 없는 구매 품목',
    why: '이 품목이 들어간 제품의 재료비가 실제보다 낮게 계산됩니다.',
    issues: active
      .filter((i) => i.procurement === 'BUY' && i.stdCost == null)
      .map((i) => ({ id: i.id, label: `${i.code} ${i.name}`, route: 'items' as const, params: { edit: i.id } })),
  });

  add({
    rule: 'material-unused',
    severity: 'info',
    title: '어느 BOM에도 쓰이지 않는 자재',
    why: '더 쓰지 않는 자재라면 사용 중지로 바꿔 선택 목록에서 빼는 편이 좋습니다.',
    issues: active
      .filter((i) => (i.type === 'RM' || i.type === 'SUB') && i.procurement === 'BUY' && !bom.byComponent.has(i.id))
      .map((i) => ({ id: i.id, label: `${i.code} ${i.name}`, route: 'items' as const, params: { edit: i.id } })),
  });

  return groups;
}

export interface Completeness {
  /** 사용 중인 생산(자체·외주) 품목 수 */
  makeItems: number;
  withBom: number;
  /** 자체 생산 품목 수 (라우팅 대상) */
  inHouseItems: number;
  withRouting: number;
}

export function completeness(state: AppState): Completeness {
  const active = state.items.filter((i) => i.active);
  const bomParents = new Set(state.bomLines.map((l) => l.parentId));
  const routingItems = new Set(state.routingSteps.map((s) => s.itemId));
  const make = active.filter((i) => i.procurement !== 'BUY');
  const inHouse = active.filter((i) => i.procurement === 'MAKE');
  return {
    makeItems: make.length,
    withBom: make.filter((i) => bomParents.has(i.id)).length,
    inHouseItems: inHouse.length,
    withRouting: inHouse.filter((i) => routingItems.has(i.id)).length,
  };
}
