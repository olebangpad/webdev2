import { describe, expect, it } from 'vitest';
import { checkHealth } from './health';
import { buildTemplate } from './templates';
import { injection } from './templates/injection';
import { itemByCode, mustSave } from './testing';

const base = buildTemplate(injection);
const rules = (state: typeof base) => checkHealth(state).map((g) => g.rule);

describe('기준정보 점검', () => {
  it('사용 중지된 자재가 BOM에 남아 있으면 오류로 잡는다', () => {
    const { state } = mustSave(base, 'items', { ...itemByCode(base, 'CL-SP01'), active: false });
    const group = checkHealth(state).find((g) => g.rule === 'bom-inactive-component')!;
    expect(group.severity).toBe('error');
    expect(group.issues).toHaveLength(2);
    expect(group.issues[0].route).toBe('bom');
  });

  it('폐기된 설비가 라우팅에 남아 있으면 오류로 잡는다', () => {
    const equipment = base.equipment.find((q) => q.code === 'USW-01')!;
    const { state } = mustSave(base, 'equipment', { ...equipment, status: 'RETIRED' });
    expect(rules(state)).toContain('routing-retired-equipment');
  });

  it('라우팅에서 공정을 빼면 그 공정에 투입하던 BOM 라인을 알려 준다', () => {
    const assy = itemByCode(base, 'CH-A100');
    const pack = base.processes.find((p) => p.code === 'P-PACK')!;
    const state = { ...base, routingSteps: base.routingSteps.filter((s) => !(s.itemId === assy.id && s.processId === pack.id)) };
    const group = checkHealth(state).find((g) => g.rule === 'bom-process-not-in-routing')!;
    expect(group.issues).toHaveLength(3);
  });

  it('작업장이 없는 설비를 알려 준다', () => {
    const equipment = base.equipment.find((q) => q.code === 'IMM-120-01')!;
    const { state } = mustSave(base, 'equipment', { ...equipment, workCenterId: null });
    expect(rules(state)).toContain('equipment-without-workcenter');
  });

  it('문제를 고치면 목록에서 사라진다', () => {
    const { state } = mustSave(base, 'items', { ...itemByCode(base, 'MB-GY02'), stdCost: 7000, active: false });
    expect(rules(state)).not.toContain('buy-without-cost');
    expect(rules(state)).not.toContain('material-unused');
  });
});
