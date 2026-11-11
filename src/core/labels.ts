import type { AttrEntity, AttrType, CodeGroup, EquipmentStatus, ItemType, PartnerType, Procurement } from './types';

export interface Option<V extends string = string> {
  value: V;
  label: string;
}

export const ITEM_TYPES: Option<ItemType>[] = [
  { value: 'FG', label: '완제품' },
  { value: 'SFG', label: '반제품' },
  { value: 'RM', label: '원자재' },
  { value: 'SUB', label: '부자재' },
  { value: 'CON', label: '소모품' },
];

export const PROCUREMENTS: Option<Procurement>[] = [
  { value: 'MAKE', label: '자체 생산' },
  { value: 'BUY', label: '구매' },
  { value: 'SUBCON', label: '외주 생산' },
];

export const EQUIPMENT_STATUSES: Option<EquipmentStatus>[] = [
  { value: 'ACTIVE', label: '사용 중' },
  { value: 'IDLE', label: '유휴' },
  { value: 'RETIRED', label: '폐기' },
];

export const PARTNER_TYPES: Option<PartnerType>[] = [
  { value: 'CUSTOMER', label: '고객사' },
  { value: 'SUPPLIER', label: '공급사' },
  { value: 'SUBCON', label: '외주처' },
  { value: 'BOTH', label: '고객·공급 겸용' },
];

export const ATTR_ENTITIES: Option<AttrEntity>[] = [
  { value: 'items', label: '품목' },
  { value: 'equipment', label: '설비' },
  { value: 'processes', label: '공정' },
];

export const ATTR_TYPES: Option<AttrType>[] = [
  { value: 'text', label: '문자' },
  { value: 'number', label: '숫자' },
  { value: 'select', label: '선택 목록' },
];

export interface CodeGroupInfo extends Option<CodeGroup> {
  description: string;
}

export const CODE_GROUPS: CodeGroupInfo[] = [
  { value: 'UNIT', label: '단위', description: '품목의 수량 단위. BOM 소요량과 재고 수량의 기준이 됩니다.' },
  { value: 'ITEM_GROUP', label: '품목 그룹', description: '품목을 묶어 보는 분류. 업종에 맞게 자유롭게 정합니다.' },
  { value: 'PROCESS_TYPE', label: '공정 유형', description: '공정을 성격별로 묶는 분류입니다.' },
  { value: 'EQUIP_TYPE', label: '설비 유형', description: '설비를 종류별로 묶는 분류입니다.' },
  { value: 'DEFECT_TYPE', label: '불량 유형', description: '생산 실적과 검사에서 불량을 기록할 때 쓰는 분류입니다.' },
  { value: 'STOP_REASON', label: '비가동 사유', description: '설비가 멈춘 이유를 기록할 때 쓰는 분류입니다.' },
];

export function labelOf<V extends string>(options: Option<V>[], value: V | null | undefined): string {
  return options.find((o) => o.value === value)?.label ?? '';
}
