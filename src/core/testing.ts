// 테스트용 도우미. 코드로 품목·라인을 찾고 저장 결과를 바로 꺼낸다.

import { saveInto } from './commands';
import type { AppState, CollectionKey, Draft, EntityOf, Item } from './types';

export function itemByCode(state: AppState, code: string): Item {
  const item = state.items.find((i) => i.code === code);
  if (!item) throw new Error(`품목 없음: ${code}`);
  return item;
}

export function mustSave<K extends CollectionKey>(state: AppState, key: K, draft: Draft<EntityOf<K>>): { state: AppState; value: EntityOf<K> } {
  const result = saveInto(state, key, draft);
  if (!result.ok) throw new Error(JSON.stringify(result.errors));
  return { state: result.state, value: result.value };
}

export function bomDraft(state: AppState, parent: string, component: string, qty = 1, lossRate = 0) {
  return {
    parentId: itemByCode(state, parent).id,
    componentId: itemByCode(state, component).id,
    seq: 900,
    qty,
    lossRate,
    processId: null,
    remark: '',
  };
}
