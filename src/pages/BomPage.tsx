import { ChevronDown, ChevronRight, Copy, FileDown, Pencil, Plus, Trash2, TriangleAlert } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRoute } from '../app/router';
import { depth, explode, flatten, materialCost, requirements, whereUsed, wouldCreateCycle, type BomNode } from '../core/bom';
import { toCsv } from '../core/csv';
import { formatMoney, formatPercent, formatQty } from '../core/format';
import { josa, particle } from '../core/josa';
import { ITEM_TYPES, PROCUREMENTS, labelOf } from '../core/labels';
import { buildLookups, type Lookups } from '../core/lookups';
import { stepsOf } from '../core/routing';
import { copyBomFrom, remove, save, useAppState } from '../core/store';
import type { BomLine, ID, Item } from '../core/types';
import type { FieldErrors } from '../core/validate';
import { ItemTypeBadge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { ExportDialog, type ExportPayload } from '../ui/ExportDialog';
import { useConfirm, useToast } from '../ui/feedback';
import { NumberField, SelectField, TextField } from '../ui/fields';
import { ItemPicker } from '../ui/ItemPicker';
import { PageHeader, Stat, Tabs } from '../ui/layout';
import { SearchSelect, type SearchOption } from '../ui/SearchSelect';

type Tab = 'tree' | 'req' | 'where';

interface LineDraft {
  id?: ID;
  componentId: ID | null;
  qty: number | null;
  lossRate: number | null;
  processId: ID | null;
  seq: number;
  remark: string;
}

/** 전통적인 들여쓰기 BOM 표기. 1, ·2, ··3 */
function levelMark(level: number): string {
  return `${'·'.repeat(level - 1)}${level}`;
}

export function BomPage() {
  const state = useAppState();
  const lk = useMemo(() => buildLookups(state), [state]);
  const route = useRoute();

  const defaultId = useMemo(() => {
    const withBom = state.items.filter((i) => lk.bom.byParent.has(i.id)).sort((a, b) => a.code.localeCompare(b.code));
    return (withBom.find((i) => i.type === 'FG') ?? withBom[0] ?? state.items.find((i) => i.procurement !== 'BUY'))?.id ?? null;
    // 처음 한 번만 고른다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const [selectedId, setSelectedId] = useState<ID | null>(route.params.item ?? defaultId);
  const [tab, setTab] = useState<Tab>('tree');
  const [baseQty, setBaseQty] = useState<number | null>(1);

  const select = (id: ID) => {
    setSelectedId(id);
    const item = lk.item(id);
    if (item?.procurement === 'BUY') setTab('where');
    else if (tab === 'where' && !lk.bom.byComponent.has(id)) setTab('tree');
  };

  useEffect(() => {
    if (route.params.item) select(route.params.item);
    // 다른 화면에서 품목을 지정해 넘어올 때만 반응한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.nonce]);

  const item = lk.item(selectedId);

  return (
    <>
      <PageHeader
        title="BOM"
        description="품목 하나를 만드는 데 들어가는 구성품과 소요량입니다. 여러 단계로 전개해 자재 소요량과 재료비를 계산합니다."
      />
      <div className="split">
        <ItemPicker
          id="bom-picker"
          label="BOM을 볼 품목"
          items={state.items}
          selectedId={selectedId}
          onSelect={select}
          scopes={[
            { value: 'make', label: '생산 품목', match: (i) => i.procurement !== 'BUY' },
            { value: 'all', label: '전체', match: () => true },
          ]}
          meta={(i) => {
            if (i.procurement === 'BUY') return <span className="dim">구매</span>;
            const n = lk.bom.byParent.get(i.id)?.length ?? 0;
            return n > 0 ? <span>구성 {n}</span> : <span className="warn-text">BOM 없음</span>;
          }}
        />
        <section className="split__main">
          {item ? (
            <BomDetail key={item.id} item={item} lk={lk} tab={tab} onTab={setTab} baseQty={baseQty} onBaseQty={setBaseQty} onSelect={select} />
          ) : (
            <div className="panel empty">
              <p>왼쪽에서 품목을 고르면 BOM이 여기에 나타납니다.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

interface DetailProps {
  item: Item;
  lk: Lookups;
  tab: Tab;
  onTab: (tab: Tab) => void;
  baseQty: number | null;
  onBaseQty: (qty: number | null) => void;
  onSelect: (id: ID) => void;
}

function BomDetail({ item, lk, tab, onTab, baseQty, onBaseQty, onSelect }: DetailProps) {
  const toast = useToast();
  const confirm = useConfirm();
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const [draft, setDraft] = useState<LineDraft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [copying, setCopying] = useState(false);
  const [copyFrom, setCopyFrom] = useState<ID | null>(null);
  const [exporting, setExporting] = useState<ExportPayload | null>(null);

  const qty = baseQty != null && baseQty > 0 ? baseQty : 1;
  const canHaveBom = item.procurement !== 'BUY';
  const root = useMemo(() => explode(lk.bom, item.id, qty), [lk, item.id, qty]);
  const rows = useMemo(() => (root ? flatten(root, collapsed) : []), [root, collapsed]);
  const reqs = useMemo(() => requirements(lk.bom, item.id, qty), [lk, item.id, qty]);
  const cost = useMemo(() => materialCost(lk.bom, item.id), [lk, item.id]);
  const used = useMemo(() => whereUsed(lk.bom, item.id), [lk, item.id]);
  const directLines = lk.bom.byParent.get(item.id) ?? [];
  const levels = root ? depth(root) : 0;
  const unit = lk.unitOf(item);

  const routingProcesses = useMemo(() => {
    const seen = new Set<ID>();
    return stepsOf(lk.state, item.id)
      .filter((s) => !seen.has(s.processId) && seen.add(s.processId))
      .map((s) => ({ value: s.processId, label: `${s.seq} ${lk.process(s.processId)?.name ?? ''}` }));
  }, [lk, item.id]);

  const toggle = (key: string) =>
    setCollapsed((set) => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });

  const openNew = () => {
    setErrors({});
    setDraft({
      componentId: null,
      qty: 1,
      lossRate: 0,
      processId: null,
      seq: directLines.reduce((m, l) => Math.max(m, l.seq), 0) + 10,
      remark: '',
    });
  };
  const openEdit = (line: BomLine) => {
    setErrors({});
    setDraft({ id: line.id, componentId: line.componentId, qty: line.qty, lossRate: line.lossRate, processId: line.processId, seq: line.seq, remark: line.remark });
  };

  const submit = () => {
    if (!draft) return;
    const result = save('bomLines', {
      id: draft.id,
      parentId: item.id,
      componentId: draft.componentId ?? '',
      qty: draft.qty ?? Number.NaN,
      lossRate: draft.lossRate ?? 0,
      processId: draft.processId,
      seq: draft.seq,
      remark: draft.remark,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    const code = lk.item(result.value.componentId)?.code ?? '구성품';
    toast(draft.id ? `${code} 구성 정보를 저장했습니다.` : `${josa(code, '을/를')} 구성품으로 추가했습니다.`);
    setDraft(null);
  };

  const removeLine = async (line: BomLine) => {
    const component = lk.item(line.componentId);
    const ok = await confirm({
      title: '구성품 빼기',
      body: (
        <>
          <strong>{item.code}</strong>의 BOM에서 <strong>{component ? `${component.code} ${component.name}` : '구성품'}</strong>
          {particle(component?.name ?? '구성품', '을/를')} 뺍니다. 품목 자체는 지워지지 않습니다.
        </>
      ),
      confirmLabel: '빼기',
      tone: 'danger',
    });
    if (!ok) return;
    remove('bomLines', line.id);
    toast('구성품을 뺐습니다.');
  };

  const componentOptions: SearchOption[] = useMemo(() => {
    const existing = new Set(directLines.map((l) => l.componentId));
    return lk.state.items
      .filter((i) => i.active || i.id === draft?.componentId)
      .map((i) => ({
        value: i.id,
        code: i.code,
        name: i.name,
        meta: `${labelOf(ITEM_TYPES, i.type)} · ${lk.unitOf(i)}`,
        blocked:
          i.id === item.id
            ? '자기 자신'
            : existing.has(i.id) && i.id !== draft?.componentId
              ? '이미 포함됨'
              : wouldCreateCycle(lk.bom, item.id, i.id)
                ? '상위 품목이라 순환됨'
                : undefined,
      }))
      .sort((a, b) => a.code.localeCompare(b.code));
  }, [lk, item.id, directLines, draft?.componentId]);

  const copySources: SearchOption[] = useMemo(
    () =>
      lk.state.items
        .filter((i) => i.id !== item.id && lk.bom.byParent.has(i.id))
        .map((i) => ({ value: i.id, code: i.code, name: i.name, meta: `구성 ${lk.bom.byParent.get(i.id)!.length}` }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [lk, item.id],
  );

  const runCopy = () => {
    if (!copyFrom) return;
    const result = copyBomFrom(copyFrom, item.id);
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    toast(`구성품 ${result.copied}건을 복사했습니다.${result.skipped ? ` 이미 있거나 넣을 수 없는 ${result.skipped}건은 건너뛰었습니다.` : ''}`);
    setCopying(false);
    setCopyFrom(null);
  };

  const exportTree = () => {
    if (!root) return;
    const all = flatten(root);
    setExporting({
      title: 'BOM 내보내기',
      filename: `BOM_${item.code}.csv`,
      mime: 'text/csv;charset=utf-8',
      content: toCsv(
        ['레벨', '품목코드', '품목명', '유형', '소요량', '단위', '로스율(%)', `총소요량(기준 ${formatQty(qty)}${unit})`, '투입공정', '비고'],
        all.map((n) => [
          levelMark(n.level),
          n.item.code,
          n.item.name,
          labelOf(ITEM_TYPES, n.item.type),
          n.line?.qty,
          lk.unitOf(n.item),
          n.line?.lossRate,
          Number(n.totalQty.toPrecision(10)),
          lk.process(n.line?.processId)?.name ?? '',
          n.line?.remark ?? '',
        ]),
      ),
    });
  };

  const draftComponent = lk.item(draft?.componentId);
  const tabs = [
    ...(canHaveBom
      ? [
          { value: 'tree' as const, label: '구성', count: directLines.length },
          { value: 'req' as const, label: '자재 소요량', count: reqs.length },
        ]
      : []),
    { value: 'where' as const, label: '사용처', count: used.direct.length },
  ];
  const activeTab: Tab = canHaveBom ? tab : 'where';

  return (
    <>
      <div className="detail-head">
        <div className="detail-head__title">
          <span className="mono detail-head__code">{item.code}</span>
          <h2>{item.name}</h2>
          <ItemTypeBadge type={item.type} />
          {!item.active && <span className="badge badge--neutral">중지</span>}
        </div>
        <p className="detail-head__sub">
          {[labelOf(PROCUREMENTS, item.procurement), `단위 ${unit}`, item.spec].filter(Boolean).join(' · ')}
        </p>
      </div>

      {canHaveBom && (
        <div className="stats">
          <Stat label="직접 구성품" value={`${directLines.length}종`} />
          <Stat label="전개 단계" value={levels > 0 ? `${levels}단계` : '–'} sub={levels > 0 ? `말단 자재 ${reqs.length}종` : undefined} />
          <Stat
            label={`재료비 (1${unit}당)`}
            value={directLines.length > 0 ? formatMoney(cost.cost) : '–'}
            tone={cost.missing.length > 0 && directLines.length > 0 ? 'warn' : undefined}
            sub={
              cost.missing.length > 0 && directLines.length > 0 ? (
                <>
                  <TriangleAlert size={12} /> 단가 없는 품목 {cost.missing.length}종 제외
                </>
              ) : undefined
            }
          />
        </div>
      )}

      <div className="tabbar">
        <Tabs tabs={tabs} value={activeTab} onChange={onTab} label="BOM 보기 방식" />
        {canHaveBom && activeTab !== 'where' && (
          <div className="base-qty">
            <label htmlFor="bom-base-qty">생산 수량</label>
            <div className="input-group">
              <input
                id="bom-base-qty"
                className="input num"
                type="number"
                inputMode="decimal"
                min="0"
                step="any"
                value={baseQty ?? ''}
                onChange={(e) => onBaseQty(e.target.value === '' ? null : Number(e.target.value))}
              />
              <span className="input-group__unit">{unit}</span>
            </div>
          </div>
        )}
      </div>

      {activeTab === 'tree' && (
        <>
          <div className="toolbar">
            <Button variant="primary" onClick={openNew} icon={<Plus size={16} />}>
              구성품 추가
            </Button>
            <Button onClick={() => setCopying(true)} icon={<Copy size={16} />} disabled={copySources.length === 0}>
              다른 품목에서 복사
            </Button>
            <Button onClick={exportTree} icon={<FileDown size={16} />} disabled={rows.length === 0}>
              CSV
            </Button>
            {levels > 1 && (
              <Button
                variant="ghost"
                onClick={() => setCollapsed(collapsed.size > 0 ? new Set() : new Set(root?.children.filter((c) => c.children.length > 0).map((c) => c.key)))}
              >
                {collapsed.size > 0 ? '모두 펼치기' : '1단계만 보기'}
              </Button>
            )}
          </div>
          {rows.length === 0 ? (
            <div className="panel empty">
              <p>
                아직 구성품이 없습니다. <strong>{item.name}</strong> 하나를 만들 때 들어가는 반제품과 자재를 추가하세요.
              </p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="grid grid--bom">
                <thead>
                  <tr>
                    <th>레벨</th>
                    <th>품목 코드</th>
                    <th>품목명</th>
                    <th>유형</th>
                    <th className="num">소요량</th>
                    <th>단위</th>
                    <th className="num">로스율</th>
                    <th className="num">총소요량</th>
                    <th>투입 공정</th>
                    <th aria-label="작업" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((n) => (
                    <BomRow
                      key={n.key}
                      node={n}
                      lk={lk}
                      collapsed={collapsed.has(n.key)}
                      onToggle={() => toggle(n.key)}
                      onEdit={openEdit}
                      onRemove={removeLine}
                      onOpen={onSelect}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {rows.length > 0 && (
            <p className="note">
              총소요량 = 생산 수량 × 소요량 × (1 + 로스율). 2단계 이하는 해당 반제품의 BOM에서 고칩니다. 품목 코드를 누르면 그 품목의 BOM으로 이동합니다.
            </p>
          )}
        </>
      )}

      {activeTab === 'req' && (
        <>
          {reqs.length === 0 ? (
            <div className="panel empty">
              <p>구성품을 등록하면 말단 자재별 소요량 합계가 여기에 나옵니다.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="grid">
                <thead>
                  <tr>
                    <th>품목 코드</th>
                    <th>품목명</th>
                    <th>유형</th>
                    <th className="num">총소요량</th>
                    <th>단위</th>
                    <th className="num">표준단가</th>
                    <th className="num">금액</th>
                  </tr>
                </thead>
                <tbody>
                  {reqs.map((r) => (
                    <tr key={r.item.id}>
                      <td className="mono">{r.item.code}</td>
                      <td>
                        {r.item.name}
                        {r.missingBom && <span className="warn-text cell-flag">하위 BOM 없음</span>}
                      </td>
                      <td>
                        <ItemTypeBadge type={r.item.type} />
                      </td>
                      <td className="num">{formatQty(r.totalQty)}</td>
                      <td className="mono">{lk.unitOf(r.item)}</td>
                      <td className="num">{r.unitCost == null ? <span className="warn-text">미등록</span> : formatMoney(r.unitCost)}</td>
                      <td className="num">{formatMoney(r.amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr>
                    <td colSpan={6}>
                      재료비 합계 ({formatQty(qty)} {unit} 생산)
                    </td>
                    <td className="num">{formatMoney(reqs.reduce((sum, r) => sum + (r.amount ?? 0), 0))}</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          )}
          <p className="note">같은 자재가 여러 반제품에 들어가면 하나로 합쳐 보여 줍니다. 로스율이 반영된 수량입니다.</p>
        </>
      )}

      {activeTab === 'where' && (
        <>
          {used.direct.length === 0 ? (
            <div className="panel empty">
              <p>
                <strong>{item.name}</strong>
                {particle(item.name, '을/를')} 구성품으로 쓰는 BOM이 없습니다.
                {item.type === 'FG' && ' 완제품이라면 정상입니다.'}
              </p>
            </div>
          ) : (
            <>
              <div className="table-wrap">
                <table className="grid">
                  <thead>
                    <tr>
                      <th>상위 품목 코드</th>
                      <th>상위 품목명</th>
                      <th>유형</th>
                      <th className="num">소요량</th>
                      <th>단위</th>
                      <th className="num">로스율</th>
                      <th>투입 공정</th>
                    </tr>
                  </thead>
                  <tbody>
                    {used.direct.map(({ line, parent }) => (
                      <tr key={line.id}>
                        <td>
                          <button type="button" className="link mono" onClick={() => onSelect(parent.id)}>
                            {parent.code}
                          </button>
                        </td>
                        <td>{parent.name}</td>
                        <td>
                          <ItemTypeBadge type={parent.type} />
                        </td>
                        <td className="num">{formatQty(line.qty)}</td>
                        <td className="mono">{unit}</td>
                        <td className="num">{formatPercent(line.lossRate)}</td>
                        <td>{lk.process(line.processId)?.name ?? ''}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="chips-row">
                <span className="chips-row__label">이 품목이 들어가는 최종 제품</span>
                {used.topLevel.map((top) => (
                  <button key={top.id} type="button" className="chip" onClick={() => onSelect(top.id)}>
                    <span className="mono">{top.code}</span> {top.name}
                  </button>
                ))}
              </div>
              <p className="note">이 품목의 사양이나 단가가 바뀌면 위 품목들이 영향을 받습니다.</p>
            </>
          )}
        </>
      )}

      <Dialog
        open={draft != null}
        onClose={() => setDraft(null)}
        title={draft?.id ? '구성품 수정' : '구성품 추가'}
        subtitle={`상위 품목: ${item.code} ${item.name}`}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>취소</Button>
            <Button variant="primary" type="submit" form="bom-line-form">
              {draft?.id ? '저장' : '추가'}
            </Button>
          </>
        }
      >
        {draft && (
          <form
            id="bom-line-form"
            className="form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {(errors._ || errors.parentId) && <p className="form__error">{errors._ ?? errors.parentId}</p>}
            <div className="form-grid">
              <SearchSelect
                id="bom-line-component"
                label="구성 품목"
                required
                error={errors.componentId}
                options={componentOptions}
                value={draft.componentId}
                onChange={(v) => setDraft({ ...draft, componentId: v })}
              />
              <NumberField
                id="bom-line-qty"
                label="소요량"
                required
                error={errors.qty}
                unit={draftComponent ? lk.unitOf(draftComponent) : undefined}
                hint={`${item.name} 1${unit}당 들어가는 양`}
                value={draft.qty}
                onChange={(v) => setDraft({ ...draft, qty: v })}
              />
              <NumberField
                id="bom-line-loss"
                label="로스율"
                error={errors.lossRate}
                unit="%"
                hint="불량·잔량으로 더 필요한 비율"
                value={draft.lossRate}
                onChange={(v) => setDraft({ ...draft, lossRate: v })}
              />
              <SelectField
                id="bom-line-process"
                label="투입 공정"
                error={errors.processId}
                options={routingProcesses}
                disabled={routingProcesses.length === 0}
                hint={routingProcesses.length === 0 ? '이 품목의 라우팅을 등록하면 고를 수 있습니다.' : '자재를 투입하는 공정'}
                value={draft.processId}
                onChange={(v) => setDraft({ ...draft, processId: v })}
              />
              <NumberField id="bom-line-seq" label="표시 순서" value={draft.seq} onChange={(v) => setDraft({ ...draft, seq: v ?? 0 })} />
              <TextField id="bom-line-remark" label="비고" full value={draft.remark} onChange={(v) => setDraft({ ...draft, remark: v })} />
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={copying}
        onClose={() => setCopying(false)}
        title="다른 품목의 BOM 복사"
        subtitle={`복사해 넣을 품목: ${item.code} ${item.name}`}
        variant="modal"
        width={520}
        footer={
          <>
            <Button onClick={() => setCopying(false)}>취소</Button>
            <Button variant="primary" disabled={!copyFrom} onClick={runCopy}>
              복사
            </Button>
          </>
        }
      >
        <SearchSelect
          id="bom-copy-from"
          label="가져올 품목"
          options={copySources}
          value={copyFrom}
          onChange={setCopyFrom}
          hint="비슷한 제품의 BOM을 가져와 다른 부분만 고칩니다. 이미 있는 구성품은 건너뛰고, 투입 공정은 비워 둡니다."
        />
      </Dialog>

      <ExportDialog payload={exporting} onClose={() => setExporting(null)} />
    </>
  );
}

interface RowProps {
  node: BomNode;
  lk: Lookups;
  collapsed: boolean;
  onToggle: () => void;
  onEdit: (line: BomLine) => void;
  onRemove: (line: BomLine) => void;
  onOpen: (id: ID) => void;
}

function BomRow({ node, lk, collapsed, onToggle, onEdit, onRemove, onOpen }: RowProps) {
  const { item, line } = node;
  const hasChildren = node.children.length > 0;
  const editable = node.level === 1 && line != null;
  return (
    <tr className={`bom-row bom-row--l${Math.min(node.level, 4)}${item.active ? '' : ' is-inactive'}`}>
      <td>
        <div className="bom-level" style={{ paddingLeft: (node.level - 1) * 16 }}>
          {hasChildren ? (
            <button type="button" className="bom-toggle" aria-expanded={!collapsed} aria-label={`${item.code} 하위 ${collapsed ? '펼치기' : '접기'}`} onClick={onToggle}>
              {collapsed ? <ChevronRight size={14} /> : <ChevronDown size={14} />}
            </button>
          ) : (
            <span className="bom-toggle bom-toggle--leaf" aria-hidden="true" />
          )}
          <span className="mono bom-level__mark">{levelMark(node.level)}</span>
        </div>
      </td>
      <td>
        <button type="button" className="link mono" onClick={() => onOpen(item.id)}>
          {item.code}
        </button>
      </td>
      <td>
        {item.name}
        {!item.active && <span className="danger-text cell-flag">사용 중지</span>}
        {node.cyclic && <span className="danger-text cell-flag">순환</span>}
        {!hasChildren && item.procurement !== 'BUY' && !node.cyclic && <span className="warn-text cell-flag">하위 BOM 없음</span>}
      </td>
      <td>
        <ItemTypeBadge type={item.type} />
      </td>
      <td className="num">{formatQty(line?.qty)}</td>
      <td className="mono">{lk.unitOf(item)}</td>
      <td className="num">{line && line.lossRate > 0 ? formatPercent(line.lossRate) : <span className="dim">–</span>}</td>
      <td className="num strong">{formatQty(node.totalQty)}</td>
      <td>{lk.process(line?.processId)?.name ?? ''}</td>
      <td className="actions">
        {editable && (
          <>
            <IconButton label={`${item.code} 수정`} onClick={() => onEdit(line)}>
              <Pencil size={15} />
            </IconButton>
            <IconButton label={`${item.code} 빼기`} tone="danger" onClick={() => onRemove(line)}>
              <Trash2 size={15} />
            </IconButton>
          </>
        )}
      </td>
    </tr>
  );
}
