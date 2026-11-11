import type { AppState, ID, RoutingStep } from './types';

export function stepsOf(state: Pick<AppState, 'routingSteps'>, itemId: ID): RoutingStep[] {
  return state.routingSteps.filter((s) => s.itemId === itemId).sort((a, b) => a.seq - b.seq);
}

export interface RoutingSummary {
  count: number;
  /** 사내 공정 사이클타임 합계(초/단위) */
  totalCycleSec: number;
  totalSetupMin: number;
  /** 사이클타임이 가장 긴 사내 공정 */
  bottleneck: RoutingStep | null;
  /** 병목 공정 기준 시간당 생산량 */
  unitsPerHour: number | null;
  inspectionCount: number;
  outsourcedCount: number;
}

export function summarizeRouting(steps: RoutingStep[]): RoutingSummary {
  const inHouse = steps.filter((s) => !s.outsourcePartnerId);
  const bottleneck = inHouse.reduce<RoutingStep | null>(
    (max, s) => (s.cycleSec > 0 && (!max || s.cycleSec > max.cycleSec) ? s : max),
    null,
  );
  return {
    count: steps.length,
    totalCycleSec: inHouse.reduce((sum, s) => sum + s.cycleSec, 0),
    totalSetupMin: inHouse.reduce((sum, s) => sum + s.setupMin, 0),
    bottleneck,
    unitsPerHour: bottleneck ? 3600 / bottleneck.cycleSec : null,
    inspectionCount: steps.filter((s) => s.inspection).length,
    outsourcedCount: steps.length - inHouse.length,
  };
}

/** 다음 공정 순번. 10 단위로 띄워 중간 삽입 여지를 둔다. */
export function nextSeq(steps: Pick<RoutingStep, 'seq'>[]): number {
  const max = steps.reduce((m, s) => Math.max(m, s.seq), 0);
  return (Math.floor(max / 10) + 1) * 10;
}
