import { describe, expect, it } from 'vitest';
import { depth, explode, flatten, grossQty, indexBom, materialCost, requirements, whereUsed, wouldCreateCycle } from './bom';
import { buildTemplate } from './templates';
import { injection } from './templates/injection';
import { itemByCode } from './testing';

const state = buildTemplate(injection, '2026-01-01T00:00:00.000Z');
const index = indexBom(state);
const id = (code: string) => itemByCode(state, code).id;

describe('BOM 정전개', () => {
  it('로스율을 반영해 총소요량을 계산한다', () => {
    expect(grossQty({ qty: 2, lossRate: 1 })).toBeCloseTo(2.02);
    expect(grossQty({ qty: 0.086, lossRate: 3 })).toBeCloseTo(0.08858);
  });

  it('여러 단계를 내려가며 누적 소요량을 곱한다', () => {
    const root = explode(index, id('CH-A100'), 1000)!;
    expect(root.item.code).toBe('CH-A100');
    expect(depth(root)).toBe(2);

    const rows = flatten(root);
    const pp = rows.find((r) => r.item.code === 'RM-PP-TD20')!;
    expect(pp.level).toBe(2);
    // 1000개 × 하우징 1 × PP 0.086 kg × 1.03
    expect(pp.totalQty).toBeCloseTo(88.58);

    const box = rows.find((r) => r.item.code === 'PK-BOX-S')!;
    expect(box.level).toBe(1);
    expect(box.totalQty).toBeCloseTo(50);
  });

  it('접어 둔 노드의 하위는 목록에서 뺀다', () => {
    const root = explode(index, id('CH-A100'))!;
    const housing = root.children.find((c) => c.item.code === 'CH-H110')!;
    const all = flatten(root);
    const collapsed = flatten(root, new Set([housing.key]));
    expect(all.length - collapsed.length).toBe(housing.children.length);
    expect(collapsed.some((r) => r.item.code === 'RM-PP-TD20')).toBe(false);
  });

  it('없는 품목은 null을 돌려준다', () => {
    expect(explode(index, 'nope')).toBeNull();
  });
});

describe('소요량 합계와 재료비', () => {
  it('여러 경로로 들어가는 같은 자재를 하나로 합친다', () => {
    const reqs = requirements(index, id('CH-A100'), 1);
    const mb = reqs.find((r) => r.item.code === 'MB-BK01')!;
    // 하우징 0.0017 + 커버 0.00064, 각각 로스 3%
    expect(mb.totalQty).toBeCloseTo((0.0017 + 0.00064) * 1.03);
    expect(reqs.every((r) => r.item.procurement === 'BUY')).toBe(true);
    expect(reqs.some((r) => r.item.code === 'CH-H110')).toBe(false);
  });

  it('말단 품목의 단가를 합해 재료비를 낸다', () => {
    const { cost, missing } = materialCost(index, id('CH-H110'));
    const expected = 0.086 * 1.03 * 1850 + 0.0017 * 1.03 * 6500 + 2 * 1.01 * 28;
    expect(cost).toBeCloseTo(expected);
    expect(missing).toHaveLength(0);
  });

  it('BOM이 없는 생산 품목은 미등록으로 표시한다', () => {
    const custom = indexBom({
      items: state.items,
      bomLines: state.bomLines.filter((l) => l.parentId !== id('CH-H110')),
    });
    const housing = requirements(custom, id('CH-A100')).find((r) => r.item.code === 'CH-H110')!;
    expect(housing.missingBom).toBe(true);
    expect(materialCost(custom, id('CH-A100')).missing.map((i) => i.code)).toContain('CH-H110');
  });
});

describe('역전개', () => {
  it('직접 상위와 최상위 품목을 찾는다', () => {
    const used = whereUsed(index, id('MB-BK01'));
    expect(used.direct.map((d) => d.parent.code)).toEqual(['CH-C120', 'CH-H110', 'CT-B210']);
    expect(used.topLevel.map((i) => i.code).sort()).toEqual(['CH-A100', 'CT-A200']);
    const assy = used.ancestors.find((a) => a.item.code === 'CH-A100')!;
    expect(assy.distance).toBe(2);
  });

  it('쓰이지 않는 품목은 빈 결과를 돌려준다', () => {
    const used = whereUsed(index, id('MB-GY02'));
    expect(used.direct).toHaveLength(0);
    expect(used.topLevel).toHaveLength(0);
  });
});

describe('순환 검사', () => {
  it('자기 자신과 상위 품목을 구성품으로 넣는 것을 잡아낸다', () => {
    expect(wouldCreateCycle(index, id('CH-A100'), id('CH-A100'))).toBe(true);
    expect(wouldCreateCycle(index, id('CH-H110'), id('CH-A100'))).toBe(true);
  });

  it('관계없는 품목은 허용한다', () => {
    expect(wouldCreateCycle(index, id('CH-A100'), id('CT-B210'))).toBe(false);
    expect(wouldCreateCycle(index, id('CT-A200'), id('CH-H110'))).toBe(false);
  });

  it('순환 데이터가 들어와도 전개가 끝난다', () => {
    const a = id('CH-A100');
    const h = id('CH-H110');
    const loop = indexBom({
      items: state.items,
      bomLines: [...state.bomLines, { ...state.bomLines[0], id: 'loop', parentId: h, componentId: a }],
    });
    const root = explode(loop, a)!;
    const cyclic = flatten(root).filter((n) => n.cyclic);
    expect(cyclic.length).toBeGreaterThan(0);
    expect(cyclic.every((n) => n.children.length === 0)).toBe(true);
  });
});
