// BOM 계산: 정전개, 소요량 합계, 역전개, 순환 검사, 재료비 적상.
// 모두 순수 함수라서 화면 없이 테스트할 수 있다.

import type { AppState, BomLine, ID, Item } from './types';

export interface BomIndex {
  items: Map<ID, Item>;
  /** 상위 품목 id → 구성 라인 (순번 순) */
  byParent: Map<ID, BomLine[]>;
  /** 구성 품목 id → 그 품목을 쓰는 라인 */
  byComponent: Map<ID, BomLine[]>;
}

export function indexBom(state: Pick<AppState, 'items' | 'bomLines'>): BomIndex {
  const items = new Map(state.items.map((i) => [i.id, i]));
  const byParent = new Map<ID, BomLine[]>();
  const byComponent = new Map<ID, BomLine[]>();
  for (const line of state.bomLines) {
    push(byParent, line.parentId, line);
    push(byComponent, line.componentId, line);
  }
  for (const lines of byParent.values()) lines.sort((a, b) => a.seq - b.seq);
  return { items, byParent, byComponent };
}

function push<K, V>(map: Map<K, V[]>, key: K, value: V) {
  const list = map.get(key);
  if (list) list.push(value);
  else map.set(key, [value]);
}

/** 로스율을 반영한 1단위당 총소요량 */
export function grossQty(line: Pick<BomLine, 'qty' | 'lossRate'>): number {
  return line.qty * (1 + line.lossRate / 100);
}

export interface BomNode {
  /** 트리 안에서 유일한 경로 키 */
  key: string;
  line: BomLine | null;
  item: Item;
  /** 최상위 품목이 0 */
  level: number;
  /** 바로 위 품목 1단위당 총소요량 */
  grossPer: number;
  /** 최상위 품목을 요청 수량만큼 만들 때 필요한 누적 소요량 */
  totalQty: number;
  children: BomNode[];
  /** 데이터가 순환해서 전개를 멈춘 지점 */
  cyclic: boolean;
}

export function explode(index: BomIndex, rootId: ID, qty = 1): BomNode | null {
  const root = index.items.get(rootId);
  if (!root) return null;

  const build = (item: Item, line: BomLine | null, level: number, totalQty: number, path: ID[], key: string): BomNode => {
    const node: BomNode = {
      key,
      line,
      item,
      level,
      grossPer: line ? grossQty(line) : 1,
      totalQty,
      children: [],
      cyclic: false,
    };
    for (const child of index.byParent.get(item.id) ?? []) {
      const childItem = index.items.get(child.componentId);
      if (!childItem) continue;
      const childKey = `${key}/${child.id}`;
      const childTotal = totalQty * grossQty(child);
      if (path.includes(childItem.id)) {
        node.children.push({
          key: childKey,
          line: child,
          item: childItem,
          level: level + 1,
          grossPer: grossQty(child),
          totalQty: childTotal,
          children: [],
          cyclic: true,
        });
        continue;
      }
      node.children.push(build(childItem, child, level + 1, childTotal, [...path, childItem.id], childKey));
    }
    return node;
  };

  return build(root, null, 0, qty, [root.id], root.id);
}

/** 트리를 화면 표시 순서(전위 순회)로 편다. collapsed에 든 노드의 하위는 건너뛴다. */
export function flatten(root: BomNode, collapsed?: ReadonlySet<string>): BomNode[] {
  const out: BomNode[] = [];
  const visit = (node: BomNode) => {
    out.push(node);
    if (collapsed?.has(node.key)) return;
    node.children.forEach(visit);
  };
  root.children.forEach(visit);
  return out;
}

export function depth(root: BomNode): number {
  return root.children.reduce((max, child) => Math.max(max, 1 + depth(child)), 0);
}

export interface Requirement {
  item: Item;
  totalQty: number;
  unitCost: number | null;
  amount: number | null;
  /** 생산 품목인데 하위 BOM이 없어 더 전개하지 못한 경우 */
  missingBom: boolean;
}

/** 말단 품목(더 전개되지 않는 품목)별 소요량 합계 */
export function requirements(index: BomIndex, rootId: ID, qty = 1): Requirement[] {
  const root = explode(index, rootId, qty);
  if (!root) return [];
  const totals = new Map<ID, Requirement>();
  const visit = (node: BomNode) => {
    if (node.children.length === 0) {
      const found = totals.get(node.item.id);
      if (found) {
        found.totalQty += node.totalQty;
      } else {
        totals.set(node.item.id, {
          item: node.item,
          totalQty: node.totalQty,
          unitCost: node.item.stdCost,
          amount: null,
          missingBom: node.item.procurement !== 'BUY',
        });
      }
      return;
    }
    node.children.forEach(visit);
  };
  root.children.forEach(visit);
  const list = [...totals.values()];
  for (const r of list) r.amount = r.unitCost == null ? null : r.totalQty * r.unitCost;
  return list.sort((a, b) => a.item.code.localeCompare(b.item.code));
}

export interface MaterialCost {
  /** 단가가 등록된 말단 품목만 합산한 1단위당 재료비 */
  cost: number;
  /** 단가가 없어 합계에서 빠진 품목 */
  missing: Item[];
}

export function materialCost(index: BomIndex, rootId: ID): MaterialCost {
  const reqs = requirements(index, rootId, 1);
  return {
    cost: reqs.reduce((sum, r) => sum + (r.amount ?? 0), 0),
    missing: reqs.filter((r) => r.amount == null).map((r) => r.item),
  };
}

/** componentId를 parentId 아래에 넣으면 순환이 생기는지 */
export function wouldCreateCycle(index: BomIndex, parentId: ID, componentId: ID): boolean {
  if (parentId === componentId) return true;
  const seen = new Set<ID>();
  const stack = [componentId];
  while (stack.length) {
    const current = stack.pop()!;
    if (current === parentId) return true;
    if (seen.has(current)) continue;
    seen.add(current);
    for (const line of index.byParent.get(current) ?? []) stack.push(line.componentId);
  }
  return false;
}

export interface WhereUsed {
  direct: { line: BomLine; parent: Item }[];
  /** 직·간접으로 이 품목을 쓰는 모든 상위 품목과 가장 가까운 거리 */
  ancestors: { item: Item; distance: number }[];
  /** 어디에도 들어가지 않는 최상위 품목 */
  topLevel: Item[];
}

export function whereUsed(index: BomIndex, componentId: ID): WhereUsed {
  const direct = (index.byComponent.get(componentId) ?? [])
    .map((line) => ({ line, parent: index.items.get(line.parentId) }))
    .filter((d): d is { line: BomLine; parent: Item } => !!d.parent)
    .sort((a, b) => a.parent.code.localeCompare(b.parent.code));

  const distance = new Map<ID, number>();
  let frontier = [componentId];
  let d = 0;
  while (frontier.length) {
    d += 1;
    const next: ID[] = [];
    for (const id of frontier) {
      for (const line of index.byComponent.get(id) ?? []) {
        if (line.parentId === componentId || distance.has(line.parentId)) continue;
        distance.set(line.parentId, d);
        next.push(line.parentId);
      }
    }
    frontier = next;
  }

  const ancestors = [...distance.entries()]
    .map(([id, dist]) => ({ item: index.items.get(id), distance: dist }))
    .filter((a): a is { item: Item; distance: number } => !!a.item)
    .sort((a, b) => a.distance - b.distance || a.item.code.localeCompare(b.item.code));

  const topLevel = ancestors.filter((a) => !index.byComponent.has(a.item.id)).map((a) => a.item);
  return { direct, ancestors, topLevel };
}
