import { saveInto } from '../commands';
import { emptyState, type AppState, type AttrEntity, type AttrValues, type CodeGroup, type CollectionKey, type Draft, type EntityOf, type ID } from '../types';
import type { AttrInput, TemplateSpec } from './spec';

/** 예시 데이터 정의를 실제 상태로 만든다. 정의가 규칙에 어긋나면 바로 오류를 낸다. */
export function buildTemplate(spec: TemplateSpec, now: string = new Date().toISOString()): AppState {
  let state: AppState = { ...emptyState(), meta: { templateKey: spec.key, initialized: true } };

  const add = <K extends CollectionKey>(key: K, draft: Draft<EntityOf<K>>): EntityOf<K> => {
    const result = saveInto(state, key, draft, now);
    if (!result.ok) {
      throw new Error(`[${spec.key}] ${key} ${JSON.stringify(draft)} → ${JSON.stringify(result.errors)}`);
    }
    state = result.state;
    return result.value;
  };

  const ids = new Map<string, ID>();
  const ref = (kind: string, code: string): ID => {
    const id = ids.get(`${kind}:${code}`);
    if (!id) throw new Error(`[${spec.key}] ${kind} 코드를 찾을 수 없습니다: ${code}`);
    return id;
  };
  const remember = (kind: string, code: string, id: ID) => ids.set(`${kind}:${code}`, id);
  const optional = (kind: string, code: string | null | undefined): ID | null => (code ? ref(kind, code) : null);

  for (const group of Object.keys(spec.codes) as CodeGroup[]) {
    spec.codes[group].forEach(([code, name], i) => {
      const saved = add('codes', { group, code, name, sortOrder: (i + 1) * 10, active: true, description: '' });
      remember(group, code, saved.id);
    });
  }

  spec.attrDefs.forEach((def, i) => {
    const saved = add('attrDefs', {
      entity: def.entity,
      label: def.label,
      type: def.type,
      options: def.options ?? [],
      unit: def.unit ?? '',
      sortOrder: (i + 1) * 10,
    });
    remember(`attr:${def.entity}`, def.label, saved.id);
  });
  const attrs = (entity: AttrEntity, input: AttrInput | undefined): AttrValues => {
    const out: AttrValues = {};
    for (const [label, value] of Object.entries(input ?? {})) out[ref(`attr:${entity}`, label)] = value;
    return out;
  };

  for (const p of spec.partners) {
    const saved = add('partners', {
      code: p.code,
      name: p.name,
      type: p.type,
      bizNo: '',
      contact: p.contact ?? '',
      phone: '',
      email: '',
      address: '',
      active: true,
      remark: p.remark ?? '',
    });
    remember('partner', p.code, saved.id);
  }

  for (const [code, name, location] of spec.workCenters) {
    remember('wc', code, add('workCenters', { code, name, location, active: true }).id);
  }

  for (const q of spec.equipment) {
    const saved = add('equipment', {
      code: q.code,
      name: q.name,
      typeId: ref('EQUIP_TYPE', q.type),
      workCenterId: optional('wc', q.wc),
      maker: q.maker ?? '',
      model: q.model ?? '',
      installDate: q.installDate ?? '',
      status: q.status ?? 'ACTIVE',
      remark: '',
      attrs: attrs('equipment', q.attrs),
    });
    remember('eq', q.code, saved.id);
  }

  for (const p of spec.processes) {
    const saved = add('processes', {
      code: p.code,
      name: p.name,
      typeId: ref('PROCESS_TYPE', p.type),
      description: p.description ?? '',
      active: true,
      attrs: {},
    });
    remember('proc', p.code, saved.id);
  }

  for (const i of spec.items) {
    const saved = add('items', {
      code: i.code,
      name: i.name,
      type: i.type,
      groupId: optional('ITEM_GROUP', i.group),
      unitId: ref('UNIT', i.unit),
      spec: i.spec ?? '',
      procurement: i.proc,
      supplierId: optional('partner', i.supplier),
      stdCost: i.cost ?? null,
      leadTimeDays: i.lt ?? null,
      safetyStock: i.ss ?? null,
      lotTracked: i.lot ?? false,
      active: i.active ?? true,
      remark: i.remark ?? '',
      attrs: attrs('items', i.attrs),
    });
    remember('item', i.code, saved.id);
  }

  for (const [parent, lines] of Object.entries(spec.boms)) {
    lines.forEach((line, index) => {
      add('bomLines', {
        parentId: ref('item', parent),
        componentId: ref('item', line.c),
        seq: (index + 1) * 10,
        qty: line.qty,
        lossRate: line.loss ?? 0,
        processId: optional('proc', line.proc),
        remark: line.remark ?? '',
      });
    });
  }

  for (const [item, steps] of Object.entries(spec.routings)) {
    steps.forEach((step, index) => {
      add('routingSteps', {
        itemId: ref('item', item),
        seq: (index + 1) * 10,
        processId: ref('proc', step.proc),
        workCenterId: optional('wc', step.wc),
        equipmentId: optional('eq', step.eq),
        outsourcePartnerId: optional('partner', step.partner),
        setupMin: step.setup ?? 0,
        cycleSec: step.ct ?? 0,
        inspection: step.insp ?? false,
        remark: step.remark ?? '',
      });
    });
  }

  return state;
}
