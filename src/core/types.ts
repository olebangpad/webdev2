// 도메인 모델. 모든 참조는 내부 id로 연결하고, 사람이 보는 코드는 언제든 바꿀 수 있게 둔다.

export type ID = string;

export interface BaseEntity {
  id: ID;
  createdAt: string;
  updatedAt: string;
}

/** 사용자 정의 속성 값. 키는 AttrDef.id */
export type AttrValues = Record<ID, string | number>;

export type ItemType = 'FG' | 'SFG' | 'RM' | 'SUB' | 'CON';
export type Procurement = 'MAKE' | 'BUY' | 'SUBCON';

export interface Item extends BaseEntity {
  code: string;
  name: string;
  type: ItemType;
  groupId: ID | null;
  unitId: ID;
  spec: string;
  procurement: Procurement;
  supplierId: ID | null;
  /** 구매 품목의 표준단가(원/단위). 재료비 적상에 쓴다. */
  stdCost: number | null;
  leadTimeDays: number | null;
  safetyStock: number | null;
  lotTracked: boolean;
  active: boolean;
  remark: string;
  attrs: AttrValues;
}

export interface BomLine extends BaseEntity {
  parentId: ID;
  componentId: ID;
  seq: number;
  /** 상위 품목 1단위당 정미 소요량 (구성 품목 단위 기준) */
  qty: number;
  /** 로스율(%). 총소요량 = 정미 소요량 × (1 + 로스율/100) */
  lossRate: number;
  /** 투입 공정. 상위 품목의 라우팅에 있는 공정이어야 한다. */
  processId: ID | null;
  remark: string;
}

export interface Process extends BaseEntity {
  code: string;
  name: string;
  typeId: ID | null;
  description: string;
  active: boolean;
  attrs: AttrValues;
}

export interface WorkCenter extends BaseEntity {
  code: string;
  name: string;
  location: string;
  active: boolean;
}

export type EquipmentStatus = 'ACTIVE' | 'IDLE' | 'RETIRED';

export interface Equipment extends BaseEntity {
  code: string;
  name: string;
  typeId: ID | null;
  workCenterId: ID | null;
  maker: string;
  model: string;
  installDate: string;
  status: EquipmentStatus;
  remark: string;
  attrs: AttrValues;
}

export interface RoutingStep extends BaseEntity {
  itemId: ID;
  seq: number;
  processId: ID;
  workCenterId: ID | null;
  equipmentId: ID | null;
  /** 값이 있으면 외주 공정 */
  outsourcePartnerId: ID | null;
  /** 준비(셋업) 시간, 분 */
  setupMin: number;
  /** 사이클타임, 초/단위 */
  cycleSec: number;
  /** 검사 공정 여부. QMS 검사 기준과 연결된다. */
  inspection: boolean;
  remark: string;
}

export type PartnerType = 'CUSTOMER' | 'SUPPLIER' | 'SUBCON' | 'BOTH';

export interface Partner extends BaseEntity {
  code: string;
  name: string;
  type: PartnerType;
  bizNo: string;
  contact: string;
  phone: string;
  email: string;
  address: string;
  active: boolean;
  remark: string;
}

export type CodeGroup = 'UNIT' | 'ITEM_GROUP' | 'PROCESS_TYPE' | 'EQUIP_TYPE' | 'DEFECT_TYPE' | 'STOP_REASON';

export interface Code extends BaseEntity {
  group: CodeGroup;
  code: string;
  name: string;
  sortOrder: number;
  active: boolean;
  description: string;
}

export type AttrEntity = 'items' | 'equipment' | 'processes';
export type AttrType = 'text' | 'number' | 'select';

/** 업종마다 다른 관리 항목을 코드 수정 없이 추가하기 위한 속성 정의 */
export interface AttrDef extends BaseEntity {
  entity: AttrEntity;
  label: string;
  type: AttrType;
  options: string[];
  unit: string;
  sortOrder: number;
}

export interface AppMeta {
  /** 불러온 예시 데이터의 키. 직접 입력으로 시작했으면 null */
  templateKey: string | null;
  initialized: boolean;
}

export interface AppState {
  schemaVersion: number;
  meta: AppMeta;
  codes: Code[];
  attrDefs: AttrDef[];
  partners: Partner[];
  workCenters: WorkCenter[];
  equipment: Equipment[];
  processes: Process[];
  items: Item[];
  bomLines: BomLine[];
  routingSteps: RoutingStep[];
}

export type CollectionKey =
  | 'codes'
  | 'attrDefs'
  | 'partners'
  | 'workCenters'
  | 'equipment'
  | 'processes'
  | 'items'
  | 'bomLines'
  | 'routingSteps';

export const COLLECTION_KEYS: CollectionKey[] = [
  'codes',
  'attrDefs',
  'partners',
  'workCenters',
  'equipment',
  'processes',
  'items',
  'bomLines',
  'routingSteps',
];

export type EntityOf<K extends CollectionKey> = AppState[K][number];

export type Draft<T extends BaseEntity> = Omit<T, 'id' | 'createdAt' | 'updatedAt'> & { id?: ID };

export const SCHEMA_VERSION = 1;

export function emptyState(): AppState {
  return {
    schemaVersion: SCHEMA_VERSION,
    meta: { templateKey: null, initialized: false },
    codes: [],
    attrDefs: [],
    partners: [],
    workCenters: [],
    equipment: [],
    processes: [],
    items: [],
    bomLines: [],
    routingSteps: [],
  };
}
