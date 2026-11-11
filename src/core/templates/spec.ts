// 예시 데이터를 사람이 읽기 쉬운 "코드 기준" 표기로 적기 위한 형식.
// build.ts가 이것을 실제 상태(id 참조)로 바꾸면서 일반 입력과 똑같은 검증을 거친다.

import type { AttrEntity, AttrType, CodeGroup, EquipmentStatus, ItemType, PartnerType, Procurement } from '../types';

export type AttrInput = Record<string, string | number>;

export interface TemplateSpec {
  key: string;
  name: string;
  summary: string;
  /** 어떤 제품을 만드는 공장인지 한 줄 */
  products: string;
  codes: Record<CodeGroup, [code: string, name: string][]>;
  attrDefs: { entity: AttrEntity; label: string; type: AttrType; options?: string[]; unit?: string }[];
  partners: { code: string; name: string; type: PartnerType; contact?: string; remark?: string }[];
  workCenters: [code: string, name: string, location: string][];
  equipment: {
    code: string;
    name: string;
    type: string;
    wc: string | null;
    maker?: string;
    model?: string;
    installDate?: string;
    status?: EquipmentStatus;
    attrs?: AttrInput;
  }[];
  processes: { code: string; name: string; type: string; description?: string }[];
  items: {
    code: string;
    name: string;
    type: ItemType;
    group?: string;
    unit: string;
    spec?: string;
    proc: Procurement;
    supplier?: string;
    cost?: number;
    lt?: number;
    ss?: number;
    lot?: boolean;
    active?: boolean;
    remark?: string;
    attrs?: AttrInput;
  }[];
  boms: Record<string, { c: string; qty: number; loss?: number; proc?: string; remark?: string }[]>;
  routings: Record<
    string,
    {
      proc: string;
      wc?: string;
      eq?: string;
      partner?: string;
      setup?: number;
      ct?: number;
      insp?: boolean;
      remark?: string;
    }[]
  >;
}
