import { indexBom, type BomIndex } from './bom';
import type { AppState, AttrDef, AttrEntity, Code, CodeGroup, Equipment, ID, Item, Partner, Process, WorkCenter } from './types';

/** 화면에서 id를 이름으로 바꾸거나 선택 목록을 만들 때 쓰는 조회 묶음 */
export interface Lookups {
  state: AppState;
  code(id: ID | null | undefined): Code | undefined;
  codeName(id: ID | null | undefined): string;
  codes(group: CodeGroup): Code[];
  partner(id: ID | null | undefined): Partner | undefined;
  workCenter(id: ID | null | undefined): WorkCenter | undefined;
  equipment(id: ID | null | undefined): Equipment | undefined;
  process(id: ID | null | undefined): Process | undefined;
  item(id: ID | null | undefined): Item | undefined;
  unitOf(item: Item | undefined): string;
  attrDefs(entity: AttrEntity): AttrDef[];
  bom: BomIndex;
  /** 품목 id → 라우팅 공정 수 */
  routingCount: Map<ID, number>;
}

function byId<T extends { id: ID }>(list: T[]): Map<ID, T> {
  return new Map(list.map((e) => [e.id, e]));
}

export function buildLookups(state: AppState): Lookups {
  const codes = byId(state.codes);
  const partners = byId(state.partners);
  const workCenters = byId(state.workCenters);
  const equipment = byId(state.equipment);
  const processes = byId(state.processes);
  const bom = indexBom(state);
  const routingCount = new Map<ID, number>();
  for (const s of state.routingSteps) routingCount.set(s.itemId, (routingCount.get(s.itemId) ?? 0) + 1);
  const get = <T>(map: Map<ID, T>, id: ID | null | undefined) => (id ? map.get(id) : undefined);

  return {
    state,
    code: (id) => get(codes, id),
    codeName: (id) => get(codes, id)?.name ?? '',
    codes: (group) => state.codes.filter((c) => c.group === group).sort((a, b) => a.sortOrder - b.sortOrder || a.code.localeCompare(b.code)),
    partner: (id) => get(partners, id),
    workCenter: (id) => get(workCenters, id),
    equipment: (id) => get(equipment, id),
    process: (id) => get(processes, id),
    item: (id) => get(bom.items, id),
    unitOf: (item) => (item ? (get(codes, item.unitId)?.code ?? '') : ''),
    attrDefs: (entity) => state.attrDefs.filter((d) => d.entity === entity).sort((a, b) => a.sortOrder - b.sortOrder),
    bom,
    routingCount,
  };
}
