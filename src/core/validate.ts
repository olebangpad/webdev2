// 저장 전 검증. 화면이 아니라 여기서 규칙을 지켜야 가져오기·예시 데이터도 같은 규칙을 따른다.

import { indexBom, wouldCreateCycle } from './bom';
import { CODE_GROUPS } from './labels';
import type {
  AppState,
  AttrDef,
  AttrEntity,
  AttrValues,
  BomLine,
  Code,
  CollectionKey,
  EntityOf,
  Equipment,
  Item,
  Partner,
  Process,
  RoutingStep,
  WorkCenter,
} from './types';

/** 필드 이름 → 오류 메시지. 특정 필드에 속하지 않는 오류는 '_' 키에 담는다. */
export type FieldErrors = Record<string, string>;

const REQUIRED = '필수 입력입니다.';

function blank(v: unknown): boolean {
  return v == null || (typeof v === 'string' && v.trim() === '');
}

function sameCode(a: string, b: string): boolean {
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

function requireText(errors: FieldErrors, entity: object, ...names: string[]) {
  const record = entity as Record<string, unknown>;
  for (const name of names) if (blank(record[name])) errors[name] = REQUIRED;
}

function uniqueCode<T extends { id: string; code: string }>(errors: FieldErrors, list: T[], entity: T) {
  if (blank(entity.code)) return;
  if (list.some((e) => e.id !== entity.id && sameCode(e.code, entity.code))) {
    errors.code = `이미 사용 중인 코드입니다: ${entity.code}`;
  }
}

function nonNegative(errors: FieldErrors, entity: object, ...names: string[]) {
  const record = entity as Record<string, unknown>;
  for (const name of names) {
    const v = record[name];
    if (v == null) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) errors[name] = '숫자를 입력하세요.';
    else if (v < 0) errors[name] = '0 이상이어야 합니다.';
  }
}

function validateAttrs(state: AppState, entity: AttrEntity, attrs: AttrValues | undefined, errors: FieldErrors) {
  for (const def of state.attrDefs) {
    if (def.entity !== entity) continue;
    const v = attrs?.[def.id];
    if (v == null || v === '') continue;
    if (def.type === 'number' && !Number.isFinite(Number(v))) {
      errors[`attrs.${def.id}`] = '숫자를 입력하세요.';
    }
    if (def.type === 'select' && !def.options.includes(String(v))) {
      errors[`attrs.${def.id}`] = '목록에 있는 값만 선택할 수 있습니다.';
    }
  }
}

function validateCode(state: AppState, e: Code): FieldErrors {
  const errors: FieldErrors = {};
  requireText(errors, e, 'code', 'name');
  if (!CODE_GROUPS.some((g) => g.value === e.group)) errors.group = '알 수 없는 코드 그룹입니다.';
  if (!errors.code && state.codes.some((c) => c.id !== e.id && c.group === e.group && sameCode(c.code, e.code))) {
    errors.code = `이 그룹에 이미 있는 코드입니다: ${e.code}`;
  }
  if (!Number.isFinite(e.sortOrder)) errors.sortOrder = '숫자를 입력하세요.';
  return errors;
}

function validateAttrDef(state: AppState, e: AttrDef): FieldErrors {
  const errors: FieldErrors = {};
  requireText(errors, e, 'label');
  if (!errors.label && state.attrDefs.some((d) => d.id !== e.id && d.entity === e.entity && sameCode(d.label, e.label))) {
    errors.label = '같은 이름의 속성이 이미 있습니다.';
  }
  if (e.type === 'select' && e.options.length === 0) errors.options = '선택 목록에 값을 하나 이상 넣으세요.';
  return errors;
}

function validatePartner(state: AppState, e: Partner): FieldErrors {
  const errors: FieldErrors = {};
  requireText(errors, e, 'code', 'name');
  uniqueCode(errors, state.partners, e);
  if (!blank(e.email) && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e.email)) errors.email = '이메일 형식이 아닙니다.';
  return errors;
}

function validateWorkCenter(state: AppState, e: WorkCenter): FieldErrors {
  const errors: FieldErrors = {};
  requireText(errors, e, 'code', 'name');
  uniqueCode(errors, state.workCenters, e);
  return errors;
}

function validateEquipment(state: AppState, e: Equipment): FieldErrors {
  const errors: FieldErrors = {};
  requireText(errors, e, 'code', 'name');
  uniqueCode(errors, state.equipment, e);
  if (e.typeId && !state.codes.some((c) => c.id === e.typeId && c.group === 'EQUIP_TYPE')) {
    errors.typeId = '등록되지 않은 설비 유형입니다.';
  }
  if (e.workCenterId && !state.workCenters.some((w) => w.id === e.workCenterId)) {
    errors.workCenterId = '등록되지 않은 작업장입니다.';
  }
  if (!blank(e.installDate) && Number.isNaN(Date.parse(e.installDate))) errors.installDate = '날짜 형식이 아닙니다.';
  validateAttrs(state, 'equipment', e.attrs, errors);
  return errors;
}

function validateProcess(state: AppState, e: Process): FieldErrors {
  const errors: FieldErrors = {};
  requireText(errors, e, 'code', 'name');
  uniqueCode(errors, state.processes, e);
  if (e.typeId && !state.codes.some((c) => c.id === e.typeId && c.group === 'PROCESS_TYPE')) {
    errors.typeId = '등록되지 않은 공정 유형입니다.';
  }
  validateAttrs(state, 'processes', e.attrs, errors);
  return errors;
}

function validateItem(state: AppState, e: Item): FieldErrors {
  const errors: FieldErrors = {};
  requireText(errors, e, 'code', 'name', 'unitId');
  uniqueCode(errors, state.items, e);
  if (!errors.unitId && !state.codes.some((c) => c.id === e.unitId && c.group === 'UNIT')) {
    errors.unitId = '등록되지 않은 단위입니다.';
  }
  if (e.groupId && !state.codes.some((c) => c.id === e.groupId && c.group === 'ITEM_GROUP')) {
    errors.groupId = '등록되지 않은 품목 그룹입니다.';
  }
  if (e.supplierId && !state.partners.some((p) => p.id === e.supplierId)) {
    errors.supplierId = '등록되지 않은 거래처입니다.';
  }
  nonNegative(errors, e, 'stdCost', 'leadTimeDays', 'safetyStock');
  if (e.procurement === 'BUY') {
    const bomCount = state.bomLines.filter((l) => l.parentId === e.id).length;
    const routingCount = state.routingSteps.filter((s) => s.itemId === e.id).length;
    if (bomCount || routingCount) {
      const what = [bomCount && `BOM ${bomCount}건`, routingCount && `라우팅 ${routingCount}건`].filter(Boolean).join(', ');
      errors.procurement = `${what}이 등록된 품목은 구매로 바꿀 수 없습니다. 먼저 삭제하세요.`;
    }
  }
  validateAttrs(state, 'items', e.attrs, errors);
  return errors;
}

function validateBomLine(state: AppState, e: BomLine): FieldErrors {
  const errors: FieldErrors = {};
  const parent = state.items.find((i) => i.id === e.parentId);
  const component = state.items.find((i) => i.id === e.componentId);
  if (!parent) errors.parentId = '상위 품목을 찾을 수 없습니다.';
  else if (parent.procurement === 'BUY') errors.parentId = '구매 품목에는 BOM을 등록할 수 없습니다.';
  if (!component) errors.componentId = blank(e.componentId) ? REQUIRED : '구성 품목을 찾을 수 없습니다.';

  if (parent && component) {
    const siblings = state.bomLines.filter((l) => l.id !== e.id);
    if (parent.id === component.id) {
      errors.componentId = '자기 자신을 구성 품목으로 넣을 수 없습니다.';
    } else if (siblings.some((l) => l.parentId === parent.id && l.componentId === component.id)) {
      errors.componentId = '이미 이 BOM에 들어 있는 품목입니다. 기존 라인의 소요량을 수정하세요.';
    } else if (wouldCreateCycle(indexBom({ items: state.items, bomLines: siblings }), parent.id, component.id)) {
      errors.componentId = `${component.code}의 하위에 ${parent.code}가 이미 있어 순환 구조가 됩니다.`;
    }
  }

  if (typeof e.qty !== 'number' || !Number.isFinite(e.qty)) errors.qty = REQUIRED;
  else if (e.qty <= 0) errors.qty = '0보다 커야 합니다.';
  if (typeof e.lossRate !== 'number' || !Number.isFinite(e.lossRate)) errors.lossRate = '숫자를 입력하세요.';
  else if (e.lossRate < 0 || e.lossRate >= 100) errors.lossRate = '0 이상 100 미만이어야 합니다.';
  if (e.processId && !state.processes.some((p) => p.id === e.processId)) errors.processId = '등록되지 않은 공정입니다.';
  return errors;
}

function validateRoutingStep(state: AppState, e: RoutingStep): FieldErrors {
  const errors: FieldErrors = {};
  const item = state.items.find((i) => i.id === e.itemId);
  if (!item) errors.itemId = '품목을 찾을 수 없습니다.';
  else if (item.procurement === 'BUY') errors.itemId = '구매 품목에는 라우팅을 등록할 수 없습니다.';

  if (!Number.isInteger(e.seq) || e.seq <= 0) errors.seq = '1 이상의 정수여야 합니다.';
  else if (state.routingSteps.some((s) => s.id !== e.id && s.itemId === e.itemId && s.seq === e.seq)) {
    errors.seq = `이미 사용 중인 순번입니다: ${e.seq}`;
  }

  if (blank(e.processId)) errors.processId = REQUIRED;
  else if (!state.processes.some((p) => p.id === e.processId)) errors.processId = '등록되지 않은 공정입니다.';

  if (e.workCenterId && !state.workCenters.some((w) => w.id === e.workCenterId)) {
    errors.workCenterId = '등록되지 않은 작업장입니다.';
  }
  const equipment = e.equipmentId ? state.equipment.find((q) => q.id === e.equipmentId) : null;
  if (e.equipmentId && !equipment) errors.equipmentId = '등록되지 않은 설비입니다.';
  if (equipment && e.workCenterId && equipment.workCenterId && equipment.workCenterId !== e.workCenterId) {
    errors.equipmentId = '선택한 작업장에 속한 설비가 아닙니다.';
  }
  if (e.outsourcePartnerId) {
    const partner = state.partners.find((p) => p.id === e.outsourcePartnerId);
    if (!partner) errors.outsourcePartnerId = '등록되지 않은 거래처입니다.';
    if (e.equipmentId) errors.equipmentId = '외주 공정에는 사내 설비를 지정할 수 없습니다.';
  }
  nonNegative(errors, e, 'setupMin', 'cycleSec');
  return errors;
}

export function validate<K extends CollectionKey>(state: AppState, key: K, entity: EntityOf<K>): FieldErrors {
  switch (key) {
    case 'codes':
      return validateCode(state, entity as Code);
    case 'attrDefs':
      return validateAttrDef(state, entity as AttrDef);
    case 'partners':
      return validatePartner(state, entity as Partner);
    case 'workCenters':
      return validateWorkCenter(state, entity as WorkCenter);
    case 'equipment':
      return validateEquipment(state, entity as Equipment);
    case 'processes':
      return validateProcess(state, entity as Process);
    case 'items':
      return validateItem(state, entity as Item);
    case 'bomLines':
      return validateBomLine(state, entity as BomLine);
    case 'routingSteps':
      return validateRoutingStep(state, entity as RoutingStep);
    default:
      return { _: '알 수 없는 데이터 종류입니다.' };
  }
}
