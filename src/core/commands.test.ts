import { describe, expect, it } from 'vitest';
import { copyBom, copyRouting, moveRoutingStep, parseBackup, planRemoval, removeFrom, resequenceRouting, saveInto } from './commands';
import { stepsOf } from './routing';
import { buildTemplate } from './templates';
import { injection } from './templates/injection';
import { machining } from './templates/machining';
import { bomDraft, itemByCode, mustSave } from './testing';
import { emptyState, type Item } from './types';

const base = buildTemplate(injection, '2026-01-01T00:00:00.000Z');
const id = (code: string) => itemByCode(base, code).id;

function itemDraft(overrides: Partial<Item> = {}) {
  const unit = base.codes.find((c) => c.group === 'UNIT' && c.code === 'EA')!;
  return {
    code: 'NEW-001',
    name: '신규 품목',
    type: 'SFG' as const,
    groupId: null,
    unitId: unit.id,
    spec: '',
    procurement: 'MAKE' as const,
    supplierId: null,
    stdCost: null,
    leadTimeDays: null,
    safetyStock: null,
    lotTracked: false,
    active: true,
    remark: '',
    attrs: {},
    ...overrides,
  };
}

describe('품목 저장', () => {
  it('새 품목을 만들고 앞뒤 공백을 지운다', () => {
    const result = saveInto(base, 'items', itemDraft({ code: '  NEW-001 ', name: ' 신규 품목 ' }));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.code).toBe('NEW-001');
    expect(result.value.name).toBe('신규 품목');
    expect(result.state.items).toHaveLength(base.items.length + 1);
    expect(base.items.some((i) => i.code === 'NEW-001')).toBe(false);
  });

  it('필수 값과 중복 코드를 막는다', () => {
    const missing = saveInto(base, 'items', itemDraft({ code: '', name: '' }));
    expect(missing.ok).toBe(false);
    if (!missing.ok) expect(Object.keys(missing.errors).sort()).toEqual(['code', 'name']);

    const duplicate = saveInto(base, 'items', itemDraft({ code: 'ch-a100' }));
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.errors.code).toContain('이미 사용 중');
  });

  it('고칠 때는 자기 코드와 겹쳐도 된다', () => {
    const item = itemByCode(base, 'CH-A100');
    const result = saveInto(base, 'items', { ...item, name: '컵홀더 조립품' });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.createdAt).toBe(item.createdAt);
  });

  it('BOM이 있는 품목은 구매로 바꿀 수 없다', () => {
    const result = saveInto(base, 'items', { ...itemByCode(base, 'CH-H110'), procurement: 'BUY' });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.procurement).toContain('BOM 3건');
  });

  it('사용자 정의 속성의 형식을 확인한다', () => {
    const cavity = base.attrDefs.find((d) => d.label === '캐비티 수')!;
    const bad = saveInto(base, 'items', itemDraft({ attrs: { [cavity.id]: '두 개' } }));
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(bad.errors[`attrs.${cavity.id}`]).toBeTruthy();
    expect(saveInto(base, 'items', itemDraft({ attrs: { [cavity.id]: 2 } })).ok).toBe(true);
  });
});

describe('BOM 라인 저장', () => {
  it('순환, 중복, 자기 참조를 막는다', () => {
    const cycle = saveInto(base, 'bomLines', bomDraft(base, 'CH-H110', 'CH-A100'));
    expect(cycle.ok).toBe(false);
    if (!cycle.ok) expect(cycle.errors.componentId).toContain('순환');

    const duplicate = saveInto(base, 'bomLines', bomDraft(base, 'CH-A100', 'CH-H110'));
    expect(duplicate.ok).toBe(false);
    if (!duplicate.ok) expect(duplicate.errors.componentId).toContain('이미');

    const self = saveInto(base, 'bomLines', bomDraft(base, 'CH-A100', 'CH-A100'));
    expect(self.ok).toBe(false);
  });

  it('구매 품목 아래에는 구성품을 넣을 수 없다', () => {
    const result = saveInto(base, 'bomLines', bomDraft(base, 'RM-PP-TD20', 'MB-BK01'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.parentId).toContain('구매 품목');
  });

  it('소요량과 로스율의 범위를 확인한다', () => {
    const zero = saveInto(base, 'bomLines', bomDraft(base, 'CH-A150', 'CL-SP01', 0));
    expect(zero.ok).toBe(false);
    const loss = saveInto(base, 'bomLines', bomDraft(base, 'CH-A150', 'CL-SP01', 1, 100));
    expect(loss.ok).toBe(false);
    expect(saveInto(base, 'bomLines', bomDraft(base, 'CH-A150', 'CL-SP01', 3, 1)).ok).toBe(true);
  });

  it('기존 라인의 소요량 수정은 중복으로 보지 않는다', () => {
    const line = base.bomLines.find((l) => l.parentId === id('CH-A100') && l.componentId === id('CL-SP01'))!;
    const result = saveInto(base, 'bomLines', { ...line, qty: 3 });
    expect(result.ok).toBe(true);
  });
});

describe('라우팅 공정 저장', () => {
  const step = stepsOf(base, id('CH-H110'))[1];

  it('같은 품목 안에서 순번이 겹치면 막는다', () => {
    const { id: _id, ...rest } = step;
    const result = saveInto(base, 'routingSteps', { ...rest, seq: 10 });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.seq).toContain('이미 사용 중');
  });

  it('작업장과 맞지 않는 설비를 막는다', () => {
    const other = base.equipment.find((q) => q.code === 'IMM-350-01')!;
    const result = saveInto(base, 'routingSteps', { ...step, equipmentId: other.id });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.errors.equipmentId).toContain('작업장');
  });

  it('외주 공정에는 사내 설비를 지정할 수 없다', () => {
    const m = buildTemplate(machining);
    const heat = m.routingSteps.find((s) => s.outsourcePartnerId)!;
    const saw = m.equipment.find((q) => q.code === 'SAW-01')!;
    const result = saveInto(m, 'routingSteps', { ...heat, equipmentId: saw.id });
    expect(result.ok).toBe(false);
  });

  it('순서를 옮기면 두 공정의 순번이 바뀐다', () => {
    const moved = moveRoutingStep(base, step.id, -1);
    expect(stepsOf(moved, id('CH-H110')).map((s) => s.processId)[0]).toBe(step.processId);
    expect(moveRoutingStep(base, stepsOf(base, id('CH-H110'))[0].id, -1)).toBe(base);
  });

  it('순번을 10 단위로 다시 매긴다', () => {
    const { state } = mustSave(base, 'routingSteps', { ...step, id: undefined, seq: 15 });
    expect(stepsOf(state, id('CH-H110')).map((s) => s.seq)).toEqual([10, 15, 20, 30, 40]);
    expect(stepsOf(resequenceRouting(state, id('CH-H110')), id('CH-H110')).map((s) => s.seq)).toEqual([10, 20, 30, 40, 50]);
  });
});

describe('삭제 보호', () => {
  it('다른 BOM에서 쓰는 품목은 삭제를 막는다', () => {
    const result = removeFrom(base, 'items', id('MB-BK01'));
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.blockers[0]).toContain('BOM 3건');
  });

  it('최상위 품목을 지우면 그 품목의 BOM과 라우팅도 지운다', () => {
    const plan = planRemoval(base, 'items', id('CH-A100'));
    expect(plan.blockers).toHaveLength(0);
    expect(plan.cascades).toEqual(['이 품목의 BOM 라인 6건', '이 품목의 라우팅 공정 4건']);

    const result = removeFrom(base, 'items', id('CH-A100'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.bomLines.some((l) => l.parentId === id('CH-A100'))).toBe(false);
    expect(result.state.routingSteps.some((s) => s.itemId === id('CH-A100'))).toBe(false);
    expect(result.state.bomLines.some((l) => l.parentId === id('CH-H110'))).toBe(true);
  });

  it('쓰이고 있는 단위·공정·작업장·설비·거래처는 삭제를 막는다', () => {
    const kg = base.codes.find((c) => c.group === 'UNIT' && c.code === 'KG')!;
    expect(removeFrom(base, 'codes', kg.id).ok).toBe(false);
    expect(removeFrom(base, 'processes', base.processes.find((p) => p.code === 'P-INJ')!.id).ok).toBe(false);
    expect(removeFrom(base, 'workCenters', base.workCenters[0].id).ok).toBe(false);
    expect(removeFrom(base, 'equipment', base.equipment.find((q) => q.code === 'IMM-180-01')!.id).ok).toBe(false);
    expect(removeFrom(base, 'partners', base.partners.find((p) => p.code === 'S-001')!.id).ok).toBe(false);
  });

  it('쓰이지 않는 것은 삭제된다', () => {
    const liter = base.codes.find((c) => c.group === 'UNIT' && c.code === 'L')!;
    expect(removeFrom(base, 'codes', liter.id).ok).toBe(true);
    expect(removeFrom(base, 'equipment', base.equipment.find((q) => q.code === 'IMM-120-01')!.id).ok).toBe(true);
  });

  it('속성 정의를 지우면 입력된 값도 함께 지운다', () => {
    const def = base.attrDefs.find((d) => d.label === '금형 번호')!;
    expect(planRemoval(base, 'attrDefs', def.id).cascades).toEqual(['입력된 속성 값 3건']);
    const result = removeFrom(base, 'attrDefs', def.id);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.items.every((i) => !(def.id in i.attrs))).toBe(true);
  });
});

describe('복사', () => {
  it('BOM을 복사하되 투입 공정은 비운다', () => {
    const result = copyBom(base, id('CH-A100'), id('CH-A150'));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const lines = result.state.bomLines.filter((l) => l.parentId === id('CH-A150'));
    expect(lines).toHaveLength(6);
    expect(lines.every((l) => l.processId === null)).toBe(true);
    expect(result.skipped).toBe(0);
  });

  it('이미 있는 구성품은 건너뛴다', () => {
    const first = copyBom(base, id('CH-A100'), id('CH-A150'));
    if (!first.ok) throw new Error(first.error);
    const second = copyBom(first.state, id('CT-A200'), id('CH-A150'));
    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.copied).toBe(2);
      expect(second.skipped).toBe(4);
    }
  });

  it('라우팅은 비어 있는 품목에만 복사한다', () => {
    const ok = copyRouting(base, id('CH-A100'), id('CH-A150'));
    expect(ok.ok).toBe(true);
    if (ok.ok) expect(stepsOf(ok.state, id('CH-A150')).map((s) => s.seq)).toEqual([10, 20, 30, 40]);
    expect(copyRouting(base, id('CH-A100'), id('CT-A200')).ok).toBe(false);
  });
});

describe('백업', () => {
  it('내보낸 데이터를 그대로 되읽는다', () => {
    const parsed = parseBackup(JSON.stringify(base));
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.state.items).toEqual(base.items);
      expect(parsed.state.bomLines).toEqual(base.bomLines);
      expect(parsed.state.meta.templateKey).toBe('injection');
    }
  });

  it('잘못된 입력은 이유와 함께 거절한다', () => {
    expect(parseBackup('안녕').ok).toBe(false);
    expect(parseBackup('{"items":[]}').ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...emptyState(), items: [{ code: 'X' }] })).ok).toBe(false);
    expect(parseBackup(JSON.stringify({ ...emptyState(), schemaVersion: 999 })).ok).toBe(false);
  });
});
