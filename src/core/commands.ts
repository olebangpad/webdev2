// 상태를 바꾸는 모든 동작. 순수 함수로 두어 저장소(store)와 테스트가 같은 코드를 쓴다.

import { nextSeq, stepsOf } from './routing';
import {
  COLLECTION_KEYS,
  SCHEMA_VERSION,
  emptyState,
  type AppState,
  type AttrEntity,
  type BaseEntity,
  type CollectionKey,
  type Draft,
  type EntityOf,
  type ID,
} from './types';
import { validate, type FieldErrors } from './validate';

export function newId(): ID {
  const bytes = new Uint8Array(9);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(36).padStart(2, '0')).join('').slice(0, 14);
}

function trimStrings<T extends object>(entity: T): T {
  const out = { ...entity } as Record<string, unknown>;
  for (const [k, v] of Object.entries(out)) if (typeof v === 'string') out[k] = v.trim();
  return out as T;
}

export type SaveResult<K extends CollectionKey> =
  | { ok: true; state: AppState; value: EntityOf<K> }
  | { ok: false; errors: FieldErrors };

/** 새로 만들거나(id 없음) 고친다(id 있음). 검증을 통과해야만 상태가 바뀐다. */
export function saveInto<K extends CollectionKey>(
  state: AppState,
  key: K,
  draft: Draft<EntityOf<K>>,
  now: string = new Date().toISOString(),
): SaveResult<K> {
  const list = state[key] as BaseEntity[];
  const existing = draft.id ? list.find((e) => e.id === draft.id) : undefined;
  const candidate = trimStrings({
    ...existing,
    ...draft,
    id: existing?.id ?? draft.id ?? newId(),
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  }) as EntityOf<K>;

  const errors = validate(state, key, candidate);
  if (Object.keys(errors).length > 0) return { ok: false, errors };

  const nextList = existing ? list.map((e) => (e.id === candidate.id ? candidate : e)) : [...list, candidate];
  return { ok: true, state: { ...state, [key]: nextList }, value: candidate };
}

export interface RemovalPlan {
  /** 삭제를 막는 사용처. 하나라도 있으면 삭제할 수 없다. */
  blockers: string[];
  /** 함께 삭제되는 하위 데이터 */
  cascades: string[];
}

function count(n: number, label: string): string | null {
  return n > 0 ? `${label} ${n}건` : null;
}

export function planRemoval(state: AppState, key: CollectionKey, id: ID): RemovalPlan {
  const blockers: (string | null)[] = [];
  const cascades: (string | null)[] = [];

  switch (key) {
    case 'codes': {
      const code = state.codes.find((c) => c.id === id);
      if (!code) break;
      if (code.group === 'UNIT') blockers.push(count(state.items.filter((i) => i.unitId === id).length, '이 단위를 쓰는 품목'));
      if (code.group === 'ITEM_GROUP') blockers.push(count(state.items.filter((i) => i.groupId === id).length, '이 그룹에 속한 품목'));
      if (code.group === 'PROCESS_TYPE') blockers.push(count(state.processes.filter((p) => p.typeId === id).length, '이 유형의 공정'));
      if (code.group === 'EQUIP_TYPE') blockers.push(count(state.equipment.filter((q) => q.typeId === id).length, '이 유형의 설비'));
      break;
    }
    case 'attrDefs': {
      const def = state.attrDefs.find((d) => d.id === id);
      if (!def) break;
      const used = (state[def.entity] as { attrs?: Record<string, unknown> }[]).filter(
        (e) => e.attrs?.[id] != null && e.attrs[id] !== '',
      ).length;
      cascades.push(count(used, '입력된 속성 값'));
      break;
    }
    case 'partners':
      blockers.push(count(state.items.filter((i) => i.supplierId === id).length, '이 거래처에서 구매하는 품목'));
      blockers.push(count(state.routingSteps.filter((s) => s.outsourcePartnerId === id).length, '이 거래처에 맡긴 외주 공정'));
      break;
    case 'workCenters':
      blockers.push(count(state.equipment.filter((q) => q.workCenterId === id).length, '이 작업장의 설비'));
      blockers.push(count(state.routingSteps.filter((s) => s.workCenterId === id).length, '이 작업장을 쓰는 라우팅 공정'));
      break;
    case 'equipment':
      blockers.push(count(state.routingSteps.filter((s) => s.equipmentId === id).length, '이 설비를 쓰는 라우팅 공정'));
      break;
    case 'processes':
      blockers.push(count(state.routingSteps.filter((s) => s.processId === id).length, '이 공정을 쓰는 라우팅'));
      blockers.push(count(state.bomLines.filter((l) => l.processId === id).length, '이 공정에 투입되는 BOM 라인'));
      break;
    case 'items':
      blockers.push(count(state.bomLines.filter((l) => l.componentId === id).length, '이 품목을 구성품으로 쓰는 BOM'));
      cascades.push(count(state.bomLines.filter((l) => l.parentId === id).length, '이 품목의 BOM 라인'));
      cascades.push(count(state.routingSteps.filter((s) => s.itemId === id).length, '이 품목의 라우팅 공정'));
      break;
    case 'bomLines':
    case 'routingSteps':
      break;
  }

  return {
    blockers: blockers.filter((b): b is string => !!b),
    cascades: cascades.filter((c): c is string => !!c),
  };
}

export type RemoveResult = { ok: true; state: AppState } | { ok: false; blockers: string[] };

export function removeFrom(state: AppState, key: CollectionKey, id: ID): RemoveResult {
  const plan = planRemoval(state, key, id);
  if (plan.blockers.length > 0) return { ok: false, blockers: plan.blockers };

  let next: AppState = { ...state, [key]: (state[key] as BaseEntity[]).filter((e) => e.id !== id) };

  if (key === 'items') {
    next = {
      ...next,
      bomLines: next.bomLines.filter((l) => l.parentId !== id),
      routingSteps: next.routingSteps.filter((s) => s.itemId !== id),
    };
  }
  if (key === 'attrDefs') {
    const def = state.attrDefs.find((d) => d.id === id);
    if (def) next = stripAttr(next, def.entity, id);
  }
  return { ok: true, state: next };
}

function stripAttr(state: AppState, entity: AttrEntity, attrId: ID): AppState {
  const list = (state[entity] as (BaseEntity & { attrs: Record<string, unknown> })[]).map((e) => {
    if (!e.attrs || !(attrId in e.attrs)) return e;
    const { [attrId]: _removed, ...rest } = e.attrs;
    return { ...e, attrs: rest };
  });
  return { ...state, [entity]: list };
}

export type CopyResult = { ok: true; state: AppState; copied: number; skipped: number } | { ok: false; error: string };

/** 다른 품목의 BOM 라인을 복사한다. 이미 있는 구성품과 순환이 되는 라인은 건너뛴다. */
export function copyBom(state: AppState, fromItemId: ID, toItemId: ID, now?: string): CopyResult {
  if (fromItemId === toItemId) return { ok: false, error: '같은 품목으로는 복사할 수 없습니다.' };
  const source = state.bomLines.filter((l) => l.parentId === fromItemId).sort((a, b) => a.seq - b.seq);
  if (source.length === 0) return { ok: false, error: '복사할 BOM이 없습니다.' };

  let next = state;
  let copied = 0;
  let seq = next.bomLines.filter((l) => l.parentId === toItemId).reduce((m, l) => Math.max(m, l.seq), 0);
  for (const line of source) {
    seq += 10;
    const result = saveInto(
      next,
      'bomLines',
      {
        parentId: toItemId,
        componentId: line.componentId,
        seq,
        qty: line.qty,
        lossRate: line.lossRate,
        // 투입 공정은 품목마다 라우팅이 달라서 가져가지 않는다.
        processId: null,
        remark: line.remark,
      },
      now,
    );
    if (result.ok) {
      next = result.state;
      copied += 1;
    } else {
      seq -= 10;
    }
  }
  if (copied === 0) return { ok: false, error: '복사할 수 있는 라인이 없습니다. 이미 모두 들어 있거나 순환 구조가 됩니다.' };
  return { ok: true, state: next, copied, skipped: source.length - copied };
}

/** 라우팅이 비어 있는 품목에 다른 품목의 라우팅을 통째로 복사한다. */
export function copyRouting(state: AppState, fromItemId: ID, toItemId: ID, now?: string): CopyResult {
  if (fromItemId === toItemId) return { ok: false, error: '같은 품목으로는 복사할 수 없습니다.' };
  const source = stepsOf(state, fromItemId);
  if (source.length === 0) return { ok: false, error: '복사할 라우팅이 없습니다.' };
  if (stepsOf(state, toItemId).length > 0) return { ok: false, error: '이미 라우팅이 있는 품목에는 복사할 수 없습니다.' };

  let next = state;
  for (const step of source) {
    const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = step;
    const result = saveInto(next, 'routingSteps', { ...rest, itemId: toItemId }, now);
    if (!result.ok) return { ok: false, error: Object.values(result.errors)[0] ?? '복사하지 못했습니다.' };
    next = result.state;
  }
  return { ok: true, state: next, copied: source.length, skipped: 0 };
}

/** 공정 순서를 한 칸 옮긴다. 두 공정의 순번을 맞바꾼다. */
export function moveRoutingStep(state: AppState, stepId: ID, direction: -1 | 1, now: string = new Date().toISOString()): AppState {
  const step = state.routingSteps.find((s) => s.id === stepId);
  if (!step) return state;
  const steps = stepsOf(state, step.itemId);
  const index = steps.findIndex((s) => s.id === stepId);
  const other = steps[index + direction];
  if (!other) return state;
  return {
    ...state,
    routingSteps: state.routingSteps.map((s) => {
      if (s.id === step.id) return { ...s, seq: other.seq, updatedAt: now };
      if (s.id === other.id) return { ...s, seq: step.seq, updatedAt: now };
      return s;
    }),
  };
}

/** 순번을 10, 20, 30… 으로 다시 매긴다. */
export function resequenceRouting(state: AppState, itemId: ID, now: string = new Date().toISOString()): AppState {
  const order = new Map(stepsOf(state, itemId).map((s, i) => [s.id, (i + 1) * 10]));
  return {
    ...state,
    routingSteps: state.routingSteps.map((s) => {
      const seq = order.get(s.id);
      return seq != null && seq !== s.seq ? { ...s, seq, updatedAt: now } : s;
    }),
  };
}

export { nextSeq };

/** 백업 파일을 읽어 상태로 되돌린다. 모양이 맞지 않으면 오류 메시지를 돌려준다. */
export function parseBackup(json: string): { ok: true; state: AppState } | { ok: false; error: string } {
  let raw: unknown;
  try {
    raw = JSON.parse(json);
  } catch {
    return { ok: false, error: 'JSON 형식이 아닙니다. 내보내기로 받은 내용을 그대로 붙여 넣으세요.' };
  }
  if (!raw || typeof raw !== 'object') return { ok: false, error: '백업 데이터가 아닙니다.' };
  const data = raw as Record<string, unknown>;
  if (typeof data.schemaVersion !== 'number') return { ok: false, error: '이 플랫폼에서 내보낸 백업이 아닙니다.' };
  if (data.schemaVersion > SCHEMA_VERSION) {
    return { ok: false, error: '더 새로운 버전에서 만든 백업이라 읽을 수 없습니다.' };
  }
  const state = emptyState();
  for (const key of COLLECTION_KEYS) {
    const list = data[key];
    if (list == null) continue;
    if (!Array.isArray(list) || list.some((e) => !e || typeof e !== 'object' || typeof (e as BaseEntity).id !== 'string')) {
      return { ok: false, error: `백업의 ${key} 항목이 손상되었습니다.` };
    }
    (state[key] as unknown[]) = list;
  }
  const meta = data.meta as Partial<AppState['meta']> | undefined;
  state.meta = { templateKey: typeof meta?.templateKey === 'string' ? meta.templateKey : null, initialized: true };
  return { ok: true, state };
}
