// 공통 등록 화면(EntityPage)에 넘기는 화면별 설정.

import { navigate } from '../app/router';
import { formatDate, formatMoney } from '../core/format';
import { josa } from '../core/josa';
import { ATTR_TYPES, EQUIPMENT_STATUSES, ITEM_TYPES, PARTNER_TYPES, PROCUREMENTS, labelOf, type Option } from '../core/labels';
import type { Lookups } from '../core/lookups';
import type { AttrDef, AttrEntity, AttrValues, Code, CodeGroup, ID } from '../core/types';
import { ActiveBadge, Badge, ItemTypeBadge } from '../ui/Badge';
import type { EntityConfig, Values } from '../ui/EntityPage';

const ACTIVE_OPTIONS: Option[] = [
  { value: 'Y', label: '사용' },
  { value: 'N', label: '중지' },
];

function codeOptions(lk: Lookups, group: CodeGroup, current?: unknown): Option[] {
  // 중지된 코드는 새로 고를 수 없지만, 이미 그 값을 쓰는 건은 그대로 보여 준다.
  return lk
    .codes(group)
    .filter((c) => c.active || c.id === current)
    .map((c) => ({ value: c.id, label: `${c.name} (${c.code})` }));
}

function attrCsv(lk: Lookups, entity: AttrEntity) {
  const defs = lk.attrDefs(entity);
  return {
    headers: defs.map((d) => (d.unit ? `${d.label}(${d.unit})` : d.label)),
    values: (attrs: AttrValues) => defs.map((d) => attrs?.[d.id] ?? ''),
  };
}

function LinkCount({ count, label, onOpen }: { count: number; label: string; onOpen: () => void }) {
  if (count === 0) return <span className="dim">–</span>;
  return (
    <button
      type="button"
      className="link-count"
      aria-label={`${label} ${count}건 보기`}
      onClick={(e) => {
        e.stopPropagation();
        onOpen();
      }}
    >
      {count}
    </button>
  );
}

export const itemsConfig: EntityConfig<'items'> = {
  key: 'items',
  noun: '품목',
  title: '품목',
  description: '만들고, 사고, 쓰는 모든 것을 품목으로 등록합니다. BOM·라우팅·생산·검사가 모두 이 품목을 기준으로 연결됩니다.',
  sortKey: 'code',
  describe: (i) => `${i.code} ${i.name}`,
  emptyHint: '아직 등록된 품목이 없습니다. 완제품부터 등록하고 BOM으로 구성품을 연결하세요.',
  attrEntity: 'items',
  search: (i, lk) => `${i.code} ${i.name} ${i.spec} ${lk.codeName(i.groupId)}`,
  filters: (lk) => [
    { key: 'type', label: '유형', options: ITEM_TYPES, match: (i, v) => i.type === v },
    { key: 'procurement', label: '조달', options: PROCUREMENTS, match: (i, v) => i.procurement === v },
    {
      key: 'group',
      label: '그룹',
      options: lk.codes('ITEM_GROUP').map((c) => ({ value: c.id, label: c.name })),
      match: (i, v) => i.groupId === v,
    },
    { key: 'active', label: '상태', options: ACTIVE_OPTIONS, match: (i, v) => i.active === (v === 'Y') },
  ],
  columns: (lk) => [
    { key: 'code', header: '품목 코드', sort: (i) => i.code, cell: (i) => <span className="mono">{i.code}</span> },
    {
      key: 'name',
      header: '품목명',
      sort: (i) => i.name,
      cell: (i) => (
        <div className="cell-main">
          <span>{i.name}</span>
          {i.spec && <span className="cell-sub">{i.spec}</span>}
        </div>
      ),
    },
    { key: 'type', header: '유형', sort: (i) => ITEM_TYPES.findIndex((t) => t.value === i.type), cell: (i) => <ItemTypeBadge type={i.type} /> },
    { key: 'group', header: '그룹', sort: (i) => lk.codeName(i.groupId), cell: (i) => lk.codeName(i.groupId) },
    { key: 'unit', header: '단위', cell: (i) => <span className="mono">{lk.unitOf(i)}</span> },
    { key: 'procurement', header: '조달', sort: (i) => i.procurement, cell: (i) => labelOf(PROCUREMENTS, i.procurement) },
    { key: 'cost', header: '표준단가', align: 'right', sort: (i) => i.stdCost, cell: (i) => formatMoney(i.stdCost) },
    {
      key: 'bom',
      header: 'BOM',
      align: 'right',
      sort: (i) => lk.bom.byParent.get(i.id)?.length ?? 0,
      cell: (i) =>
        i.procurement === 'BUY' ? null : (
          <LinkCount count={lk.bom.byParent.get(i.id)?.length ?? 0} label={`${i.code} BOM`} onOpen={() => navigate('bom', { item: i.id })} />
        ),
    },
    {
      key: 'routing',
      header: '라우팅',
      align: 'right',
      sort: (i) => lk.routingCount.get(i.id) ?? 0,
      cell: (i) =>
        i.procurement === 'BUY' ? null : (
          <LinkCount count={lk.routingCount.get(i.id) ?? 0} label={`${i.code} 라우팅`} onOpen={() => navigate('routing', { item: i.id })} />
        ),
    },
    { key: 'active', header: '상태', sort: (i) => (i.active ? 0 : 1), cell: (i) => <ActiveBadge active={i.active} /> },
  ],
  csv: (lk) => {
    const attrs = attrCsv(lk, 'items');
    return {
      headers: ['품목코드', '품목명', '유형', '그룹', '단위', '규격', '조달', '공급사', '표준단가', '리드타임(일)', '안전재고', 'LOT관리', '사용', '비고', ...attrs.headers],
      row: (i) => [
        i.code,
        i.name,
        labelOf(ITEM_TYPES, i.type),
        lk.codeName(i.groupId),
        lk.unitOf(i),
        i.spec,
        labelOf(PROCUREMENTS, i.procurement),
        lk.partner(i.supplierId)?.name ?? '',
        i.stdCost,
        i.leadTimeDays,
        i.safetyStock,
        i.lotTracked ? 'Y' : 'N',
        i.active ? 'Y' : 'N',
        i.remark,
        ...attrs.values(i.attrs),
      ],
    };
  },
  blank: (lk) => ({
    code: '',
    name: '',
    type: 'FG',
    groupId: null,
    unitId: lk.codes('UNIT').find((c) => c.active)?.id ?? null,
    spec: '',
    procurement: 'MAKE',
    supplierId: null,
    stdCost: null,
    leadTimeDays: null,
    safetyStock: null,
    lotTracked: false,
    active: true,
    remark: '',
    attrs: {},
  }),
  fromValues: (v) => (v.procurement === 'MAKE' ? { ...v, supplierId: null } : v),
  form: (lk, v) => {
    const buying = v.procurement !== 'MAKE';
    return [
      {
        fields: [
          { name: 'code', label: '품목 코드', kind: 'text', required: true, mono: true, placeholder: '예: CH-A100' },
          { name: 'name', label: '품목명', kind: 'text', required: true },
          { name: 'type', label: '유형', kind: 'select', required: true, options: ITEM_TYPES },
          { name: 'groupId', label: '품목 그룹', kind: 'select', options: codeOptions(lk, 'ITEM_GROUP', v.groupId) },
          { name: 'unitId', label: '단위', kind: 'select', required: true, options: codeOptions(lk, 'UNIT', v.unitId), hint: 'BOM 소요량의 기준 단위' },
          { name: 'spec', label: '규격', kind: 'text', placeholder: '치수, 중량, 등급 등' },
        ],
      },
      {
        title: '조달',
        fields: [
          {
            name: 'procurement',
            label: '조달 구분',
            kind: 'select',
            required: true,
            options: PROCUREMENTS,
            hint: v.procurement === 'BUY' ? '구매 품목에는 BOM과 라우팅을 둘 수 없습니다.' : undefined,
          },
          ...(buying
            ? [
                {
                  name: 'supplierId',
                  label: v.procurement === 'SUBCON' ? '외주처' : '공급사',
                  kind: 'select' as const,
                  options: lk.state.partners
                    .filter((p) => (p.active && p.type !== 'CUSTOMER') || p.id === v.supplierId)
                    .map((p) => ({ value: p.id, label: `${p.name} (${p.code})` })),
                },
                { name: 'stdCost', label: '표준단가', kind: 'number' as const, unit: '원', hint: '상위 제품의 재료비 계산에 쓰입니다.' },
              ]
            : []),
          { name: 'leadTimeDays', label: '리드타임', kind: 'number', unit: '일' },
          { name: 'safetyStock', label: '안전재고', kind: 'number', unit: lk.code(v.unitId as ID)?.code },
        ],
      },
      {
        title: '관리',
        fields: [
          { name: 'lotTracked', label: 'LOT 관리', kind: 'switch', hint: '입고·생산 단위로 이력을 추적합니다.' },
          { name: 'active', label: '사용', kind: 'switch', hint: '끄면 새 BOM과 작업지시에서 선택할 수 없습니다.' },
          { name: 'remark', label: '비고', kind: 'textarea' },
        ],
      },
    ];
  },
};

export const equipmentConfig: EntityConfig<'equipment'> = {
  key: 'equipment',
  noun: '설비',
  title: '설비',
  description: '공정에 쓰는 기계와 측정 장비입니다. 라우팅에서 공정별 설비를 지정하고, 이후 가동·비가동 실적이 설비별로 쌓입니다.',
  sortKey: 'code',
  describe: (q) => `${q.code} ${q.name}`,
  emptyHint: '아직 등록된 설비가 없습니다.',
  attrEntity: 'equipment',
  search: (q, lk) => `${q.code} ${q.name} ${q.maker} ${q.model} ${lk.codeName(q.typeId)} ${lk.workCenter(q.workCenterId)?.name ?? ''}`,
  filters: (lk) => [
    { key: 'type', label: '유형', options: lk.codes('EQUIP_TYPE').map((c) => ({ value: c.id, label: c.name })), match: (q, v) => q.typeId === v },
    { key: 'wc', label: '작업장', options: lk.state.workCenters.map((w) => ({ value: w.id, label: w.name })), match: (q, v) => q.workCenterId === v },
    { key: 'status', label: '상태', options: EQUIPMENT_STATUSES, match: (q, v) => q.status === v },
  ],
  columns: (lk) => [
    { key: 'code', header: '설비 코드', sort: (q) => q.code, cell: (q) => <span className="mono">{q.code}</span> },
    { key: 'name', header: '설비명', sort: (q) => q.name, cell: (q) => q.name },
    { key: 'type', header: '유형', sort: (q) => lk.codeName(q.typeId), cell: (q) => lk.codeName(q.typeId) },
    { key: 'wc', header: '작업장', sort: (q) => lk.workCenter(q.workCenterId)?.name ?? null, cell: (q) => lk.workCenter(q.workCenterId)?.name ?? <span className="dim">미지정</span> },
    { key: 'maker', header: '제조사 · 모델', cell: (q) => [q.maker, q.model].filter(Boolean).join(' · ') },
    { key: 'install', header: '설치일', sort: (q) => q.installDate || null, cell: (q) => <span className="mono">{formatDate(q.installDate)}</span> },
    {
      key: 'status',
      header: '상태',
      sort: (q) => EQUIPMENT_STATUSES.findIndex((s) => s.value === q.status),
      cell: (q) => <Badge tone={q.status === 'ACTIVE' ? 'ok' : q.status === 'IDLE' ? 'warn' : 'neutral'}>{labelOf(EQUIPMENT_STATUSES, q.status)}</Badge>,
    },
  ],
  csv: (lk) => {
    const attrs = attrCsv(lk, 'equipment');
    return {
      headers: ['설비코드', '설비명', '유형', '작업장', '제조사', '모델', '설치일', '상태', '비고', ...attrs.headers],
      row: (q) => [q.code, q.name, lk.codeName(q.typeId), lk.workCenter(q.workCenterId)?.name ?? '', q.maker, q.model, q.installDate, labelOf(EQUIPMENT_STATUSES, q.status), q.remark, ...attrs.values(q.attrs)],
    };
  },
  blank: () => ({ code: '', name: '', typeId: null, workCenterId: null, maker: '', model: '', installDate: '', status: 'ACTIVE', remark: '', attrs: {} }),
  form: (lk, v) => [
    {
      fields: [
        { name: 'code', label: '설비 코드', kind: 'text', required: true, mono: true },
        { name: 'name', label: '설비명', kind: 'text', required: true },
        { name: 'typeId', label: '설비 유형', kind: 'select', options: codeOptions(lk, 'EQUIP_TYPE', v.typeId) },
        {
          name: 'workCenterId',
          label: '작업장',
          kind: 'select',
          options: lk.state.workCenters.filter((w) => w.active || w.id === v.workCenterId).map((w) => ({ value: w.id, label: `${w.name} (${w.code})` })),
        },
        { name: 'maker', label: '제조사', kind: 'text' },
        { name: 'model', label: '모델', kind: 'text' },
        { name: 'installDate', label: '설치일', kind: 'date' },
        { name: 'status', label: '상태', kind: 'select', required: true, options: EQUIPMENT_STATUSES },
        { name: 'remark', label: '비고', kind: 'textarea' },
      ],
    },
  ],
};

export const processesConfig: EntityConfig<'processes'> = {
  key: 'processes',
  noun: '공정',
  title: '공정',
  description: '공장에서 하는 작업의 종류입니다. 여기서 정의한 공정을 품목별 라우팅에서 순서대로 배열합니다.',
  sortKey: 'code',
  describe: (p) => `${p.code} ${p.name}`,
  emptyHint: '아직 등록된 공정이 없습니다. 절단, 가공, 조립, 검사처럼 반복해서 쓰는 작업을 등록하세요.',
  attrEntity: 'processes',
  search: (p, lk) => `${p.code} ${p.name} ${p.description} ${lk.codeName(p.typeId)}`,
  filters: (lk) => [
    { key: 'type', label: '유형', options: lk.codes('PROCESS_TYPE').map((c) => ({ value: c.id, label: c.name })), match: (p, v) => p.typeId === v },
    { key: 'active', label: '상태', options: ACTIVE_OPTIONS, match: (p, v) => p.active === (v === 'Y') },
  ],
  columns: (lk) => {
    const usage = new Map<ID, Set<ID>>();
    for (const s of lk.state.routingSteps) {
      if (!usage.has(s.processId)) usage.set(s.processId, new Set());
      usage.get(s.processId)!.add(s.itemId);
    }
    return [
      { key: 'code', header: '공정 코드', sort: (p) => p.code, cell: (p) => <span className="mono">{p.code}</span> },
      { key: 'name', header: '공정명', sort: (p) => p.name, cell: (p) => p.name },
      { key: 'type', header: '유형', sort: (p) => lk.codeName(p.typeId), cell: (p) => lk.codeName(p.typeId) },
      { key: 'desc', header: '설명', cell: (p) => <span className="cell-sub">{p.description}</span> },
      { key: 'used', header: '사용 품목', align: 'right', sort: (p) => usage.get(p.id)?.size ?? 0, cell: (p) => usage.get(p.id)?.size ?? <span className="dim">–</span> },
      { key: 'active', header: '상태', sort: (p) => (p.active ? 0 : 1), cell: (p) => <ActiveBadge active={p.active} /> },
    ];
  },
  csv: (lk) => {
    const attrs = attrCsv(lk, 'processes');
    return {
      headers: ['공정코드', '공정명', '유형', '설명', '사용', ...attrs.headers],
      row: (p) => [p.code, p.name, lk.codeName(p.typeId), p.description, p.active ? 'Y' : 'N', ...attrs.values(p.attrs)],
    };
  },
  blank: () => ({ code: '', name: '', typeId: null, description: '', active: true, attrs: {} }),
  form: (lk, v) => [
    {
      fields: [
        { name: 'code', label: '공정 코드', kind: 'text', required: true, mono: true },
        { name: 'name', label: '공정명', kind: 'text', required: true },
        { name: 'typeId', label: '공정 유형', kind: 'select', options: codeOptions(lk, 'PROCESS_TYPE', v.typeId) },
        { name: 'active', label: '사용', kind: 'switch' },
        { name: 'description', label: '설명', kind: 'textarea' },
      ],
    },
  ],
};

export const workCentersConfig: EntityConfig<'workCenters'> = {
  key: 'workCenters',
  noun: '작업장',
  title: '작업장',
  description: '라인, 셀, 작업 구역처럼 설비와 사람이 모여 일하는 단위입니다.',
  sortKey: 'code',
  describe: (w) => `${w.code} ${w.name}`,
  emptyHint: '아직 등록된 작업장이 없습니다.',
  search: (w) => `${w.code} ${w.name} ${w.location}`,
  columns: (lk) => {
    const counts = new Map<ID, number>();
    for (const q of lk.state.equipment) if (q.workCenterId) counts.set(q.workCenterId, (counts.get(q.workCenterId) ?? 0) + 1);
    return [
      { key: 'code', header: '작업장 코드', sort: (w) => w.code, cell: (w) => <span className="mono">{w.code}</span> },
      { key: 'name', header: '작업장명', sort: (w) => w.name, cell: (w) => w.name },
      { key: 'location', header: '위치', sort: (w) => w.location, cell: (w) => w.location },
      { key: 'equipment', header: '설비', align: 'right', sort: (w) => counts.get(w.id) ?? 0, cell: (w) => counts.get(w.id) ?? <span className="dim">–</span> },
      { key: 'active', header: '상태', sort: (w) => (w.active ? 0 : 1), cell: (w) => <ActiveBadge active={w.active} /> },
    ];
  },
  csv: () => ({ headers: ['작업장코드', '작업장명', '위치', '사용'], row: (w) => [w.code, w.name, w.location, w.active ? 'Y' : 'N'] }),
  blank: () => ({ code: '', name: '', location: '', active: true }),
  form: () => [
    {
      fields: [
        { name: 'code', label: '작업장 코드', kind: 'text', required: true, mono: true },
        { name: 'name', label: '작업장명', kind: 'text', required: true },
        { name: 'location', label: '위치', kind: 'text', placeholder: '예: A동 1층' },
        { name: 'active', label: '사용', kind: 'switch' },
      ],
    },
  ],
};

export const partnersConfig: EntityConfig<'partners'> = {
  key: 'partners',
  noun: '거래처',
  title: '거래처',
  description: '자재를 사 오는 공급사, 공정을 맡기는 외주처, 제품을 받는 고객사입니다.',
  sortKey: 'code',
  describe: (p) => `${p.code} ${p.name}`,
  emptyHint: '아직 등록된 거래처가 없습니다.',
  search: (p) => `${p.code} ${p.name} ${p.contact} ${p.remark}`,
  filters: () => [
    { key: 'type', label: '구분', options: PARTNER_TYPES, match: (p, v) => p.type === v },
    { key: 'active', label: '상태', options: ACTIVE_OPTIONS, match: (p, v) => p.active === (v === 'Y') },
  ],
  columns: () => [
    { key: 'code', header: '거래처 코드', sort: (p) => p.code, cell: (p) => <span className="mono">{p.code}</span> },
    { key: 'name', header: '거래처명', sort: (p) => p.name, cell: (p) => p.name },
    {
      key: 'type',
      header: '구분',
      sort: (p) => p.type,
      cell: (p) => <Badge tone={p.type === 'CUSTOMER' ? 'accent' : p.type === 'SUBCON' ? 'sfg' : 'neutral'}>{labelOf(PARTNER_TYPES, p.type)}</Badge>,
    },
    { key: 'contact', header: '담당자', cell: (p) => p.contact },
    { key: 'phone', header: '연락처', cell: (p) => <span className="mono">{p.phone}</span> },
    { key: 'remark', header: '비고', cell: (p) => <span className="cell-sub">{p.remark}</span> },
    { key: 'active', header: '상태', sort: (p) => (p.active ? 0 : 1), cell: (p) => <ActiveBadge active={p.active} /> },
  ],
  csv: () => ({
    headers: ['거래처코드', '거래처명', '구분', '사업자번호', '담당자', '연락처', '이메일', '주소', '사용', '비고'],
    row: (p) => [p.code, p.name, labelOf(PARTNER_TYPES, p.type), p.bizNo, p.contact, p.phone, p.email, p.address, p.active ? 'Y' : 'N', p.remark],
  }),
  blank: () => ({ code: '', name: '', type: 'SUPPLIER', bizNo: '', contact: '', phone: '', email: '', address: '', active: true, remark: '' }),
  form: () => [
    {
      fields: [
        { name: 'code', label: '거래처 코드', kind: 'text', required: true, mono: true },
        { name: 'name', label: '거래처명', kind: 'text', required: true },
        { name: 'type', label: '구분', kind: 'select', required: true, options: PARTNER_TYPES },
        { name: 'bizNo', label: '사업자등록번호', kind: 'text', mono: true },
        { name: 'contact', label: '담당자', kind: 'text' },
        { name: 'phone', label: '연락처', kind: 'text' },
        { name: 'email', label: '이메일', kind: 'text' },
        { name: 'active', label: '사용', kind: 'switch' },
        { name: 'address', label: '주소', kind: 'text', full: true },
        { name: 'remark', label: '비고', kind: 'textarea' },
      ],
    },
  ],
};

export function codesConfig(group: CodeGroup, groupLabel: string): EntityConfig<'codes'> {
  return {
    key: 'codes',
    noun: groupLabel,
    title: groupLabel,
    description: '',
    hideHeader: true,
    sortKey: 'sort',
    scope: (c: Code) => c.group === group,
    describe: (c) => `${c.code} ${c.name}`,
    emptyHint: `아직 등록된 ${josa(groupLabel, '이/가')} 없습니다.`,
    search: (c) => `${c.code} ${c.name} ${c.description}`,
    columns: () => [
      { key: 'sort', header: '순서', align: 'right', narrow: true, sort: (c) => c.sortOrder, cell: (c) => c.sortOrder },
      { key: 'code', header: '코드', sort: (c) => c.code, cell: (c) => <span className="mono">{c.code}</span> },
      { key: 'name', header: '이름', sort: (c) => c.name, cell: (c) => c.name },
      { key: 'desc', header: '설명', cell: (c) => <span className="cell-sub">{c.description}</span> },
      { key: 'active', header: '상태', sort: (c) => (c.active ? 0 : 1), cell: (c) => <ActiveBadge active={c.active} /> },
    ],
    csv: () => ({ headers: ['순서', '코드', '이름', '설명', '사용'], row: (c) => [c.sortOrder, c.code, c.name, c.description, c.active ? 'Y' : 'N'] }),
    blank: (lk) => ({
      group,
      code: '',
      name: '',
      sortOrder: lk.codes(group).reduce((m, c) => Math.max(m, c.sortOrder), 0) + 10,
      active: true,
      description: '',
    }),
    form: () => [
      {
        fields: [
          { name: 'code', label: '코드', kind: 'text', required: true, mono: true },
          { name: 'name', label: '이름', kind: 'text', required: true },
          { name: 'sortOrder', label: '표시 순서', kind: 'number', hint: '작은 숫자가 먼저 나옵니다.' },
          { name: 'active', label: '사용', kind: 'switch', hint: '끄면 새로 선택할 수 없습니다.' },
          { name: 'description', label: '설명', kind: 'textarea' },
        ],
      },
    ],
  };
}

export function attrDefsConfig(entity: AttrEntity, entityLabel: string): EntityConfig<'attrDefs'> {
  return {
    key: 'attrDefs',
    noun: '속성',
    title: `${entityLabel} 속성`,
    description: '',
    hideHeader: true,
    sortKey: 'sort',
    scope: (d: AttrDef) => d.entity === entity,
    describe: (d) => d.label,
    emptyHint: `${entityLabel}에 추가로 관리할 항목이 있으면 속성으로 등록하세요. 등록하면 ${entityLabel} 입력 화면에 바로 나타납니다.`,
    search: (d) => `${d.label} ${d.options.join(' ')}`,
    columns: () => [
      { key: 'sort', header: '순서', align: 'right', narrow: true, sort: (d) => d.sortOrder, cell: (d) => d.sortOrder },
      { key: 'label', header: '속성 이름', sort: (d) => d.label, cell: (d) => d.label },
      { key: 'type', header: '형식', sort: (d) => d.type, cell: (d) => labelOf(ATTR_TYPES, d.type) },
      { key: 'unit', header: '단위', cell: (d) => <span className="mono">{d.unit}</span> },
      { key: 'options', header: '선택 목록', cell: (d) => <span className="cell-sub">{d.options.join(', ')}</span> },
    ],
    csv: () => ({ headers: ['순서', '속성', '형식', '단위', '선택목록'], row: (d) => [d.sortOrder, d.label, labelOf(ATTR_TYPES, d.type), d.unit, d.options.join('|')] }),
    blank: (lk) => ({
      entity,
      label: '',
      type: 'text',
      options: '',
      unit: '',
      sortOrder: lk.attrDefs(entity).reduce((m, d) => Math.max(m, d.sortOrder), 0) + 10,
    }),
    // 선택 목록은 화면에서는 쉼표로 이은 글자, 저장할 때는 배열이다.
    toValues: (d) => ({ ...d, options: d.options.join(', ') }),
    fromValues: (v: Values) => {
      const options =
        v.type === 'select'
          ? [...new Set(String(v.options ?? '').split(',').map((s) => s.trim()).filter(Boolean))]
          : [];
      return { ...v, options, sortOrder: Number(v.sortOrder ?? 0) };
    },
    form: (_lk, v) => [
      {
        fields: [
          { name: 'label', label: '속성 이름', kind: 'text', required: true, placeholder: '예: 재질, 도면 번호' },
          { name: 'type', label: '형식', kind: 'select', required: true, options: ATTR_TYPES },
          ...(v.type === 'select'
            ? [{ name: 'options', label: '선택 목록', kind: 'text' as const, full: true, placeholder: '쉼표로 구분. 예: 없음, 흑착색, 아연 도금' }]
            : [{ name: 'unit', label: '단위', kind: 'text' as const, placeholder: '예: mm, 톤' }]),
          { name: 'sortOrder', label: '표시 순서', kind: 'number' as const },
        ],
      },
    ],
  };
}
