import { describe, expect, it } from 'vitest';
import { explode, indexBom, materialCost } from '../bom';
import { checkHealth, completeness } from '../health';
import { stepsOf, summarizeRouting } from '../routing';
import { itemByCode } from '../testing';
import { validate } from '../validate';
import { COLLECTION_KEYS } from '../types';
import { TEMPLATES, buildTemplate } from './index';

describe.each(TEMPLATES.map((t) => [t.name, t] as const))('예시 데이터: %s', (_name, spec) => {
  const state = buildTemplate(spec);

  it('모든 데이터가 저장 규칙을 통과한다', () => {
    for (const key of COLLECTION_KEYS) {
      for (const entity of state[key]) {
        expect(validate(state, key, entity as never), `${key} ${JSON.stringify(entity)}`).toEqual({});
      }
    }
  });

  it('정의한 건수만큼 만들어진다', () => {
    expect(state.items).toHaveLength(spec.items.length);
    expect(state.equipment).toHaveLength(spec.equipment.length);
    expect(state.bomLines).toHaveLength(Object.values(spec.boms).reduce((n, lines) => n + lines.length, 0));
    expect(state.routingSteps).toHaveLength(Object.values(spec.routings).reduce((n, steps) => n + steps.length, 0));
    expect(state.meta).toEqual({ templateKey: spec.key, initialized: true });
  });

  it('점검 결과는 의도한 예시(개발 중 품목, 단가 미정 자재)만 나온다', () => {
    const groups = checkHealth(state);
    expect(groups.map((g) => g.rule).sort()).toEqual(['buy-without-cost', 'make-without-bom', 'make-without-routing', 'material-unused']);
    expect(groups.every((g) => g.issues.length === 1)).toBe(true);
    expect(groups.some((g) => g.severity === 'error')).toBe(false);

    const c = completeness(state);
    expect(c.makeItems - c.withBom).toBe(1);
    expect(c.inHouseItems - c.withRouting).toBe(1);
  });

  it('BOM이 있는 모든 품목의 재료비가 빠짐없이 계산된다', () => {
    const index = indexBom(state);
    for (const parent of Object.keys(spec.boms)) {
      const { cost, missing } = materialCost(index, itemByCode(state, parent).id);
      expect(missing, parent).toHaveLength(0);
      expect(cost, parent).toBeGreaterThan(0);
      expect(explode(index, itemByCode(state, parent).id)!.children.length).toBe(spec.boms[parent].length);
    }
  });

  it('라우팅마다 병목 공정과 시간당 생산량이 나온다', () => {
    for (const code of Object.keys(spec.routings)) {
      const summary = summarizeRouting(stepsOf(state, itemByCode(state, code).id));
      expect(summary.bottleneck, code).not.toBeNull();
      expect(summary.unitsPerHour, code).toBeGreaterThan(0);
      expect(summary.inspectionCount, code).toBeGreaterThan(0);
    }
  });
});

describe('업종별 차이', () => {
  it('기계 가공 예시에는 외주 공정이 있고 병목 계산에서 빠진다', () => {
    const state = buildTemplate(TEMPLATES.find((t) => t.key === 'machining')!);
    const summary = summarizeRouting(stepsOf(state, itemByCode(state, 'SH-200').id));
    expect(summary.outsourcedCount).toBe(1);
    expect(summary.count).toBe(7);
    // 사내 공정 가운데 연삭(240초)이 가장 길다
    expect(summary.bottleneck?.cycleSec).toBe(240);
    expect(summary.unitsPerHour).toBe(15);
    expect(summary.totalCycleSec).toBe(90 + 210 + 150 + 240 + 30 + 120);
  });

  it('업종마다 불량 유형과 사용자 정의 속성이 다르다', () => {
    const labels = TEMPLATES.map((t) => {
      const state = buildTemplate(t);
      return {
        defects: state.codes.filter((c) => c.group === 'DEFECT_TYPE').map((c) => c.name),
        attrs: state.attrDefs.map((d) => d.label),
      };
    });
    expect(labels[0].defects).toContain('미성형');
    expect(labels[1].defects).toContain('진원도 불량');
    expect(labels[2].defects).toContain('냉납');
    expect(labels[0].attrs).toContain('캐비티 수');
    expect(labels[1].attrs).toContain('도면 번호');
    expect(labels[2].attrs).toContain('MSL 등급');
  });
});
