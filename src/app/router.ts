// 아주 작은 해시 라우터. 화면 이름만 주소에 두고(#items), 선택한 품목 같은 값은 메모리로 넘긴다.

import { useSyncExternalStore } from 'react';
import { isRoute, type RouteName } from './routes';

export interface Route {
  name: RouteName;
  params: Record<string, string>;
  /** 같은 화면으로 다시 이동해도 값이 바뀌도록 하는 일련번호 */
  nonce: number;
}

function fromHash(): RouteName {
  try {
    const hash = globalThis.location?.hash.replace(/^#\/?/, '') ?? '';
    return isRoute(hash) ? hash : 'home';
  } catch {
    return 'home';
  }
}

let current: Route = { name: fromHash(), params: {}, nonce: 0 };
const listeners = new Set<() => void>();

function emit() {
  listeners.forEach((l) => l());
}

export function navigate(name: RouteName, params: Record<string, string> = {}) {
  current = { name, params, nonce: current.nonce + 1 };
  try {
    if (location.hash.replace(/^#\/?/, '') !== name) location.hash = name;
    window.scrollTo(0, 0);
  } catch {
    // 주소를 바꿀 수 없는 환경에서도 화면 전환은 계속 동작한다.
  }
  emit();
}

if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    const name = fromHash();
    if (name === current.name) return;
    current = { name, params: {}, nonce: current.nonce + 1 };
    window.scrollTo(0, 0);
    emit();
  });
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useRoute(): Route {
  return useSyncExternalStore(subscribe, () => current, () => current);
}
