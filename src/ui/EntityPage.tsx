// 코드·이름·속성을 가진 기준정보를 한 가지 방식으로 조회·등록·수정·삭제하는 공통 화면.
// 화면마다 다른 점(열, 입력 항목, 필터)은 설정으로 받는다.

import { FileDown, Plus, Search, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useRoute } from '../app/router';
import { planRemoval } from '../core/commands';
import { toCsv, type CsvCell } from '../core/csv';
import { josa, particle } from '../core/josa';
import type { Option } from '../core/labels';
import { buildLookups, type Lookups } from '../core/lookups';
import { remove, save, useAppState } from '../core/store';
import type { AttrEntity, CollectionKey, Draft, EntityOf } from '../core/types';
import type { FieldErrors } from '../core/validate';
import { Button } from './Button';
import { DataTable, type Column } from './DataTable';
import { Dialog } from './Dialog';
import { ExportDialog, type ExportPayload } from './ExportDialog';
import { useConfirm, useToast } from './feedback';
import { NumberField, SelectField, SwitchField, TextAreaField, TextField } from './fields';
import { PageHeader } from './layout';

export type Values = Record<string, unknown>;

export interface FieldSpec {
  name: string;
  label: string;
  kind: 'text' | 'number' | 'select' | 'switch' | 'date' | 'textarea';
  required?: boolean;
  options?: Option[];
  emptyLabel?: string;
  hint?: string;
  unit?: string;
  full?: boolean;
  placeholder?: string;
  mono?: boolean;
}

export interface FormSection {
  title?: string;
  fields: FieldSpec[];
}

export interface FilterSpec<T> {
  key: string;
  label: string;
  options: Option[];
  match: (row: T, value: string) => boolean;
}

export interface EntityConfig<K extends CollectionKey> {
  key: K;
  /** "품목", "설비"처럼 문장에 넣을 이름 */
  noun: string;
  title: string;
  description: string;
  columns: (lk: Lookups) => Column<EntityOf<K>>[];
  csv: (lk: Lookups) => { headers: string[]; row: (entity: EntityOf<K>) => CsvCell[] };
  search: (row: EntityOf<K>, lk: Lookups) => string;
  filters?: (lk: Lookups) => FilterSpec<EntityOf<K>>[];
  /** 전체 가운데 이 화면이 다루는 범위 (예: 한 코드 그룹) */
  scope?: (row: EntityOf<K>) => boolean;
  blank: (lk: Lookups) => Values;
  toValues?: (entity: EntityOf<K>) => Values;
  fromValues?: (values: Values) => Values;
  form: (lk: Lookups, values: Values) => FormSection[];
  attrEntity?: AttrEntity;
  sortKey: string;
  describe: (row: EntityOf<K>) => string;
  emptyHint: string;
  /** 화면 제목을 다른 곳에서 이미 보여 줄 때 머리글을 숨긴다. */
  hideHeader?: boolean;
  headerExtra?: ReactNode;
}

function getValue(values: Values, name: string): unknown {
  if (name.startsWith('attrs.')) return (values.attrs as Values | undefined)?.[name.slice(6)];
  return values[name];
}

function setValue(values: Values, name: string, value: unknown): Values {
  if (name.startsWith('attrs.')) {
    return { ...values, attrs: { ...(values.attrs as Values | undefined), [name.slice(6)]: value } };
  }
  return { ...values, [name]: value };
}

function attrSection(lk: Lookups, entity: AttrEntity): FormSection | null {
  const defs = lk.attrDefs(entity);
  if (defs.length === 0) return null;
  return {
    title: '추가 속성',
    fields: defs.map((def) => ({
      name: `attrs.${def.id}`,
      label: def.label,
      kind: def.type === 'number' ? 'number' : def.type === 'select' ? 'select' : 'text',
      unit: def.unit || undefined,
      options: def.type === 'select' ? def.options.map((o) => ({ value: o, label: o })) : undefined,
      hint: def.type === 'text' && def.unit ? `단위: ${def.unit}` : undefined,
    })),
  };
}

export function FormFields({
  idPrefix,
  sections,
  values,
  errors,
  onChange,
}: {
  idPrefix: string;
  sections: FormSection[];
  values: Values;
  errors: FieldErrors;
  onChange: (name: string, value: unknown) => void;
}) {
  return (
    <>
      {sections.map((section, index) => (
        <fieldset className="form-section" key={section.title ?? index}>
          {section.title && <legend>{section.title}</legend>}
          <div className="form-grid">
            {section.fields.map((f, fieldIndex) => {
              const id = `${idPrefix}-${f.name.replace(/[^a-zA-Z0-9]/g, '-')}`;
              const value = getValue(values, f.name);
              const common = { id, label: f.label, required: f.required, error: errors[f.name], hint: f.hint, full: f.full };
              switch (f.kind) {
                case 'number':
                  return (
                    <NumberField
                      key={f.name}
                      {...common}
                      unit={f.unit}
                      placeholder={f.placeholder}
                      value={typeof value === 'number' ? value : value === '' || value == null ? null : Number(value)}
                      onChange={(v) => onChange(f.name, v)}
                    />
                  );
                case 'select':
                  return (
                    <SelectField
                      key={f.name}
                      {...common}
                      options={f.options ?? []}
                      emptyLabel={f.emptyLabel}
                      value={value == null ? null : String(value)}
                      onChange={(v) => onChange(f.name, v)}
                    />
                  );
                case 'switch':
                  return <SwitchField key={f.name} id={id} label={f.label} hint={f.hint} full={f.full} checked={value === true} onChange={(v) => onChange(f.name, v)} />;
                case 'textarea':
                  return <TextAreaField key={f.name} {...common} full placeholder={f.placeholder} value={String(value ?? '')} onChange={(v) => onChange(f.name, v)} />;
                default:
                  return (
                    <TextField
                      key={f.name}
                      {...common}
                      type={f.kind === 'date' ? 'date' : 'text'}
                      mono={f.mono}
                      placeholder={f.placeholder}
                      autoFocus={index === 0 && fieldIndex === 0}
                      value={String(value ?? '')}
                      onChange={(v) => onChange(f.name, v)}
                    />
                  );
              }
            })}
          </div>
        </fieldset>
      ))}
    </>
  );
}

export function EntityPage<K extends CollectionKey>({ config }: { config: EntityConfig<K> }) {
  const state = useAppState();
  const lk = useMemo(() => buildLookups(state), [state]);
  const route = useRoute();
  const toast = useToast();
  const confirm = useConfirm();

  const [query, setQuery] = useState('');
  const [filterValues, setFilterValues] = useState<Record<string, string>>({});
  const [editing, setEditing] = useState<{ values: Values; isNew: boolean } | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [exporting, setExporting] = useState<ExportPayload | null>(null);

  const all = useMemo(
    () => (state[config.key] as EntityOf<K>[]).filter((row) => config.scope?.(row) ?? true),
    [state, config],
  );
  const filters = useMemo(() => config.filters?.(lk) ?? [], [config, lk]);
  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all.filter((row) => {
      if (q && !config.search(row, lk).toLowerCase().includes(q)) return false;
      return filters.every((f) => !filterValues[f.key] || f.match(row, filterValues[f.key]));
    });
  }, [all, query, filters, filterValues, config, lk]);
  const columns = useMemo(() => config.columns(lk), [config, lk]);

  const open = (entity: EntityOf<K>) => {
    setErrors({});
    setEditing({ values: config.toValues ? config.toValues(entity) : ({ ...entity } as Values), isNew: false });
  };
  const openNew = () => {
    setErrors({});
    setEditing({ values: config.blank(lk), isNew: true });
  };

  // 점검 목록 등 다른 화면에서 특정 건을 지정해 넘어온 경우 바로 연다.
  useEffect(() => {
    const id = route.params.edit;
    if (!id) return;
    const target = (state[config.key] as EntityOf<K>[]).find((e) => e.id === id);
    if (target) open(target);
    // 이동할 때 한 번만 연다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.nonce]);

  const sections = useMemo(() => {
    if (!editing) return [];
    const base = config.form(lk, editing.values);
    const extra = config.attrEntity ? attrSection(lk, config.attrEntity) : null;
    return extra ? [...base, extra] : base;
  }, [editing, config, lk]);

  const submit = () => {
    if (!editing) return;
    const draft = (config.fromValues ? config.fromValues(editing.values) : editing.values) as Draft<EntityOf<K>>;
    const result = save(config.key, draft);
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast(`${josa(config.describe(result.value), '을/를')} ${editing.isNew ? '등록했습니다.' : '저장했습니다.'}`);
    setEditing(null);
  };

  const requestRemove = async () => {
    if (!editing || editing.isNew) return;
    const id = String(editing.values.id);
    const entity = (state[config.key] as EntityOf<K>[]).find((e) => e.id === id);
    if (!entity) return;
    const plan = planRemoval(state, config.key, id);
    if (plan.blockers.length > 0) {
      await confirm({
        title: `${josa(config.noun, '을/를')} 삭제할 수 없습니다`,
        body: (
          <>
            <strong>{config.describe(entity)}</strong>
            {particle(config.describe(entity), '은/는')} 아래에서 쓰고 있습니다. 먼저 연결을 끊거나, 더 쓰지 않는다면 사용 중지로 바꾸세요.
          </>
        ),
        details: plan.blockers,
        infoOnly: true,
      });
      return;
    }
    const ok = await confirm({
      title: `${config.noun} 삭제`,
      body: (
        <>
          <strong>{config.describe(entity)}</strong>
          {particle(config.describe(entity), '을/를')} 삭제합니다. {plan.cascades.length > 0 && '아래 데이터도 함께 삭제됩니다.'}
        </>
      ),
      details: plan.cascades,
      confirmLabel: '삭제',
      tone: 'danger',
    });
    if (!ok) return;
    const result = remove(config.key, id);
    if (result.ok) {
      toast(`${josa(config.describe(entity), '을/를')} 삭제했습니다.`);
      setEditing(null);
    } else {
      toast(result.blockers[0] ?? '삭제하지 못했습니다.', 'error');
    }
  };

  const exportCsv = () => {
    const { headers, row } = config.csv(lk);
    setExporting({
      title: `${config.title} 내보내기`,
      filename: `${config.key}.csv`,
      mime: 'text/csv;charset=utf-8',
      content: toCsv(headers, rows.map(row)),
    });
  };

  const filtered = query.trim() !== '' || Object.values(filterValues).some(Boolean);
  const actions = (
    <>
      <Button onClick={exportCsv} icon={<FileDown size={16} />} disabled={rows.length === 0}>
        CSV
      </Button>
      <Button variant="primary" onClick={openNew} icon={<Plus size={16} />}>
        {config.noun} 등록
      </Button>
    </>
  );

  return (
    <>
      {!config.hideHeader && <PageHeader title={config.title} description={config.description} actions={actions} />}
      {config.headerExtra}

      <div className="toolbar">
        <div className="search-input toolbar__search">
          <Search size={16} aria-hidden="true" />
          <input
            id={`${config.key}-search`}
            className="input"
            type="search"
            placeholder={`${config.noun} 찾기`}
            aria-label={`${config.noun} 찾기`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {filters.map((f) => (
          <select
            key={f.key}
            id={`${config.key}-filter-${f.key}`}
            className="input select toolbar__filter"
            aria-label={f.label}
            value={filterValues[f.key] ?? ''}
            onChange={(e) => setFilterValues((v) => ({ ...v, [f.key]: e.target.value }))}
          >
            <option value="">{f.label}: 전체</option>
            {f.options.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        ))}
        {config.hideHeader && <div className="toolbar__actions">{actions}</div>}
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        rowKey={(row) => row.id}
        rowLabel={config.describe}
        onRowClick={open}
        initialSort={config.sortKey}
        empty={
          filtered ? (
            <p>조건에 맞는 {josa(config.noun, '이/가')} 없습니다.</p>
          ) : (
            <>
              <p>{config.emptyHint}</p>
              <Button variant="primary" onClick={openNew} icon={<Plus size={16} />}>
                {config.noun} 등록
              </Button>
            </>
          )
        }
      />

      <Dialog
        open={editing != null}
        onClose={() => setEditing(null)}
        title={editing?.isNew ? `${config.noun} 등록` : `${config.noun} 수정`}
        footer={
          <>
            {editing && !editing.isNew && (
              <Button variant="ghost" className="btn--push-left btn--danger-text" onClick={requestRemove} icon={<Trash2 size={16} />}>
                삭제
              </Button>
            )}
            <Button onClick={() => setEditing(null)}>취소</Button>
            <Button variant="primary" type="submit" form={`${config.key}-form`}>
              {editing?.isNew ? '등록' : '저장'}
            </Button>
          </>
        }
      >
        {editing && (
          <form
            id={`${config.key}-form`}
            className="form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {errors._ && <p className="form__error">{errors._}</p>}
            <FormFields
              idPrefix={`${config.key}-f`}
              sections={sections}
              values={editing.values}
              errors={errors}
              onChange={(name, value) => setEditing((e) => (e ? { ...e, values: setValue(e.values, name, value) } : e))}
            />
          </form>
        )}
      </Dialog>

      <ExportDialog payload={exporting} onClose={() => setExporting(null)} />
    </>
  );
}
