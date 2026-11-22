// 앱 전체 상태와 브라우저 저장. 지금은 localStorage에 두지만,
// 화면은 이 파일의 함수만 쓰므로 나중에 서버 API로 바꿔도 화면 코드는 그대로다.

import { useSyncExternalStore } from 'react';
import {
  copyBom,
  copyRouting,
  moveRoutingStep,
  parseBackup,
  removeFrom,
  resequenceRouting,
  saveInto,
  type CopyResult,
  type RemoveResult,
} from './commands';
import { buildTemplate, findTemplate } from './templates';
import { SCHEMA_VERSION, emptyState, type AppState, type CollectionKey, type Draft, type EntityOf, type ID } from './types';
import type { FieldErrors } from './validate';

const STORAGE_KEY = 'mfg-platform/state/v1';

function load(): AppState {
  try {
    const raw = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = parseBackup(raw);
    if (!parsed.ok) return emptyState();
    const saved = JSON.parse(raw) as AppState;
    return { ...parsed.state, meta: { ...parsed.state.meta, initialized: saved.meta?.initialized === true } };
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 창 등)에서는 메모리로만 동작한다.
    return emptyState();
  }
}

let state: AppState = load();
let persisted = true;
const listeners = new Set<() => void>();

function commit(next: AppState) {
  state = next;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, JSON.stringify(next));
    persisted = true;
  } catch {
    persisted = false;
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getState(): AppState {
  return state;
}

/** 상태가 바뀔 때마다 다시 그린다. */
export function useAppState(): AppState {
  return useSyncExternalStore(subscribe, getState, getState);
}

/** 마지막 변경이 브라우저에 저장됐는지 */
export function isPersisted(): boolean {
  return persisted;
}

export type SaveOutcome<K extends CollectionKey> = { ok: true; value: EntityOf<K> } | { ok: false; errors: FieldErrors };

export function save<K extends CollectionKey>(key: K, draft: Draft<EntityOf<K>>): SaveOutcome<K> {
  const result = saveInto(state, key, draft);
  if (!result.ok) return result;
  commit(result.state);
  return { ok: true, value: result.value };
}

export function remove(key: CollectionKey, id: ID): RemoveResult {
  const result = removeFrom(state, key, id);
  if (result.ok) commit(result.state);
  return result;
}

export function copyBomFrom(fromItemId: ID, toItemId: ID): CopyResult {
  const result = copyBom(state, fromItemId, toItemId);
  if (result.ok) commit(result.state);
  return result;
}

export function copyRoutingFrom(fromItemId: ID, toItemId: ID): CopyResult {
  const result = copyRouting(state, fromItemId, toItemId);
  if (result.ok) commit(result.state);
  return result;
}

export function moveStep(stepId: ID, direction: -1 | 1) {
  commit(moveRoutingStep(state, stepId, direction));
}

export function resequence(itemId: ID) {
  commit(resequenceRouting(state, itemId));
}

/** 예시 데이터로 전체를 교체한다. */
export function loadTemplate(key: string): boolean {
  const spec = findTemplate(key);
  if (!spec) return false;
  commit(buildTemplate(spec));
  return true;
}

/** 예시 데이터 없이 빈 상태로 시작한다. 단위만 기본으로 넣어 바로 품목을 등록할 수 있게 한다. */
export function startEmpty() {
  let next: AppState = { ...emptyState(), meta: { templateKey: null, initialized: true } };
  const units: [string, string][] = [
    ['EA', '개'],
    ['KG', '킬로그램'],
    ['M', '미터'],
    ['L', '리터'],
  ];
  units.forEach(([code, name], i) => {
    const result = saveInto(next, 'codes', { group: 'UNIT', code, name, sortOrder: (i + 1) * 10, active: true, description: '' });
    if (result.ok) next = result.state;
  });
  commit(next);
}

/** 모든 데이터를 지우고 처음 화면으로 돌아간다. */
export function resetAll() {
  commit(emptyState());
}

export function exportBackup(): string {
  return JSON.stringify({ ...state, schemaVersion: SCHEMA_VERSION }, null, 2);
}

export function importBackup(json: string): { ok: true } | { ok: false; error: string } {
  const parsed = parseBackup(json);
  if (!parsed.ok) return parsed;
  commit(parsed.state);
  return { ok: true };
}
