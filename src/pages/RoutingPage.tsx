import { ArrowDown, ArrowUp, Copy, ListOrdered, Pencil, Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { useRoute } from '../app/router';
import { formatDuration, formatQty } from '../core/format';
import { josa, particle } from '../core/josa';
import { PROCUREMENTS, labelOf } from '../core/labels';
import { buildLookups, type Lookups } from '../core/lookups';
import { nextSeq, stepsOf, summarizeRouting } from '../core/routing';
import { copyRoutingFrom, moveStep, remove, resequence, save, useAppState } from '../core/store';
import type { ID, Item, RoutingStep } from '../core/types';
import type { FieldErrors } from '../core/validate';
import { Badge, ItemTypeBadge } from '../ui/Badge';
import { Button, IconButton } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { useConfirm, useToast } from '../ui/feedback';
import { NumberField, SelectField, SwitchField, TextField } from '../ui/fields';
import { ItemPicker } from '../ui/ItemPicker';
import { PageHeader, Stat } from '../ui/layout';
import { SearchSelect, type SearchOption } from '../ui/SearchSelect';

interface StepDraft {
  id?: ID;
  seq: number | null;
  processId: ID | null;
  outsourced: boolean;
  outsourcePartnerId: ID | null;
  workCenterId: ID | null;
  equipmentId: ID | null;
  setupMin: number | null;
  cycleSec: number | null;
  inspection: boolean;
  remark: string;
}

export function RoutingPage() {
  const state = useAppState();
  const lk = useMemo(() => buildLookups(state), [state]);
  const route = useRoute();

  const candidates = useMemo(() => state.items.filter((i) => i.procurement !== 'BUY'), [state.items]);
  const defaultId = useMemo(
    () => [...candidates].sort((a, b) => a.code.localeCompare(b.code)).find((i) => lk.routingCount.has(i.id))?.id ?? candidates[0]?.id ?? null,
    // 처음 한 번만 고른다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );
  const [selectedId, setSelectedId] = useState<ID | null>(route.params.item ?? defaultId);

  useEffect(() => {
    if (route.params.item) setSelectedId(route.params.item);
    // 다른 화면에서 품목을 지정해 넘어올 때만 반응한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.nonce]);

  const item = candidates.find((i) => i.id === selectedId);

  return (
    <>
      <PageHeader
        title="라우팅"
        description="품목을 만드는 공정 순서입니다. 공정마다 작업장·설비와 표준시간을 정해 두면 작업지시와 생산 능력 계산의 기준이 됩니다."
      />
      <div className="split">
        <ItemPicker
          id="routing-picker"
          label="라우팅을 볼 품목"
          items={candidates}
          selectedId={selectedId}
          onSelect={setSelectedId}
          meta={(i) => {
            const n = lk.routingCount.get(i.id) ?? 0;
            if (n > 0) return <span>공정 {n}</span>;
            return i.procurement === 'SUBCON' ? <span className="dim">외주</span> : <span className="warn-text">라우팅 없음</span>;
          }}
        />
        <section className="split__main">
          {item ? (
            <RoutingDetail key={item.id} item={item} lk={lk} />
          ) : (
            <div className="panel empty">
              <p>생산 품목을 먼저 등록하면 여기에서 공정 순서를 정할 수 있습니다.</p>
            </div>
          )}
        </section>
      </div>
    </>
  );
}

function RoutingDetail({ item, lk }: { item: Item; lk: Lookups }) {
  const toast = useToast();
  const confirm = useConfirm();
  const [draft, setDraft] = useState<StepDraft | null>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [copying, setCopying] = useState(false);
  const [copyFrom, setCopyFrom] = useState<ID | null>(null);

  const steps = useMemo(() => stepsOf(lk.state, item.id), [lk, item.id]);
  const summary = useMemo(() => summarizeRouting(steps), [steps]);
  const maxCycle = steps.reduce((m, s) => Math.max(m, s.cycleSec), 0);
  const unit = lk.unitOf(item);
  const tidy = steps.every((s, i) => s.seq === (i + 1) * 10);

  const openNew = () => {
    setErrors({});
    setDraft({
      seq: nextSeq(steps),
      processId: null,
      outsourced: false,
      outsourcePartnerId: null,
      workCenterId: null,
      equipmentId: null,
      setupMin: 0,
      cycleSec: 0,
      inspection: false,
      remark: '',
    });
  };
  const openEdit = (s: RoutingStep) => {
    setErrors({});
    setDraft({ ...s, outsourced: s.outsourcePartnerId != null });
  };

  const submit = () => {
    if (!draft) return;
    if (draft.outsourced && !draft.outsourcePartnerId) {
      setErrors({ outsourcePartnerId: '외주처를 선택하세요.' });
      return;
    }
    const result = save('routingSteps', {
      id: draft.id,
      itemId: item.id,
      seq: draft.seq ?? 0,
      processId: draft.processId ?? '',
      outsourcePartnerId: draft.outsourced ? draft.outsourcePartnerId : null,
      workCenterId: draft.outsourced ? null : draft.workCenterId,
      equipmentId: draft.outsourced ? null : draft.equipmentId,
      setupMin: draft.outsourced ? 0 : (draft.setupMin ?? 0),
      cycleSec: draft.outsourced ? 0 : (draft.cycleSec ?? 0),
      inspection: draft.inspection,
      remark: draft.remark,
    });
    if (!result.ok) {
      setErrors(result.errors);
      return;
    }
    toast(`${josa(lk.process(result.value.processId)?.name ?? '공정', '을/를')} ${draft.id ? '저장했습니다.' : '추가했습니다.'}`);
    setDraft(null);
  };

  const removeStep = async (s: RoutingStep) => {
    const usedByBom = lk.state.bomLines.filter((l) => l.parentId === item.id && l.processId === s.processId).length;
    const lastOfProcess = steps.filter((x) => x.processId === s.processId).length === 1;
    const ok = await confirm({
      title: '공정 빼기',
      body: (
        <>
          <strong>{item.code}</strong>의 라우팅에서 <strong>{`${s.seq} ${lk.process(s.processId)?.name ?? '공정'}`}</strong>
          {particle(lk.process(s.processId)?.name ?? '공정', '을/를')} 뺍니다.
        </>
      ),
      details: usedByBom > 0 && lastOfProcess ? [`이 공정에 투입하도록 지정된 BOM 구성품 ${usedByBom}건은 투입 공정을 다시 정해야 합니다.`] : undefined,
      confirmLabel: '빼기',
      tone: 'danger',
    });
    if (!ok) return;
    remove('routingSteps', s.id);
    toast('공정을 뺐습니다.');
  };

  const copySources: SearchOption[] = useMemo(
    () =>
      lk.state.items
        .filter((i) => i.id !== item.id && lk.routingCount.has(i.id))
        .map((i) => ({ value: i.id, code: i.code, name: i.name, meta: `공정 ${lk.routingCount.get(i.id)}` }))
        .sort((a, b) => a.code.localeCompare(b.code)),
    [lk, item.id],
  );

  const runCopy = () => {
    if (!copyFrom) return;
    const result = copyRoutingFrom(copyFrom, item.id);
    if (!result.ok) {
      toast(result.error, 'error');
      return;
    }
    toast(`공정 ${result.copied}건을 복사했습니다. 표준시간을 이 품목에 맞게 고치세요.`);
    setCopying(false);
    setCopyFrom(null);
  };

  const processOptions = lk.state.processes
    .filter((p) => p.active || p.id === draft?.processId)
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }));
  const workCenterOptions = lk.state.workCenters
    .filter((w) => w.active || w.id === draft?.workCenterId)
    .map((w) => ({ value: w.id, label: `${w.name} (${w.code})` }));
  const equipmentOptions = lk.state.equipment
    .filter((q) => (q.status !== 'RETIRED' || q.id === draft?.equipmentId) && (!draft?.workCenterId || q.workCenterId === draft.workCenterId))
    .sort((a, b) => a.code.localeCompare(b.code))
    .map((q) => ({ value: q.id, label: `${q.name} (${q.code})` }));
  const partnerOptions = lk.state.partners
    .filter((p) => (p.active && (p.type === 'SUBCON' || p.type === 'BOTH' || p.type === 'SUPPLIER')) || p.id === draft?.outsourcePartnerId)
    .map((p) => ({ value: p.id, label: `${p.name} (${p.code})` }));

  return (
    <>
      <div className="detail-head">
        <div className="detail-head__title">
          <span className="mono detail-head__code">{item.code}</span>
          <h2>{item.name}</h2>
          <ItemTypeBadge type={item.type} />
        </div>
        <p className="detail-head__sub">{[labelOf(PROCUREMENTS, item.procurement), `단위 ${unit}`, item.spec].filter(Boolean).join(' · ')}</p>
      </div>

      <div className="stats">
        <Stat
          label="공정 수"
          value={`${summary.count}개`}
          sub={[summary.inspectionCount > 0 && `검사 ${summary.inspectionCount}`, summary.outsourcedCount > 0 && `외주 ${summary.outsourcedCount}`].filter(Boolean).join(' · ') || undefined}
        />
        <Stat label={`사내 작업시간 (1${unit}당)`} value={summary.count > 0 ? formatDuration(summary.totalCycleSec) : '–'} sub={summary.totalSetupMin > 0 ? `준비시간 합계 ${formatQty(summary.totalSetupMin)}분` : undefined} />
        <Stat
          label="병목 공정"
          value={summary.bottleneck ? (lk.process(summary.bottleneck.processId)?.name ?? '–') : '–'}
          sub={summary.unitsPerHour ? `시간당 ${formatQty(Math.floor(summary.unitsPerHour * 10) / 10)}${unit} 생산` : undefined}
        />
      </div>

      <div className="toolbar">
        <Button variant="primary" onClick={openNew} icon={<Plus size={16} />}>
          공정 추가
        </Button>
        {steps.length === 0 && (
          <Button onClick={() => setCopying(true)} icon={<Copy size={16} />} disabled={copySources.length === 0}>
            다른 품목에서 복사
          </Button>
        )}
        {steps.length > 0 && !tidy && (
          <Button variant="ghost" onClick={() => resequence(item.id)} icon={<ListOrdered size={16} />}>
            순번 10 단위로 정리
          </Button>
        )}
      </div>

      {steps.length === 0 ? (
        <div className="panel empty">
          <p>
            아직 공정이 없습니다. <strong>{item.name}</strong>
            {particle(item.name, '을/를')} 만드는 순서대로 공정을 추가하세요.
          </p>
        </div>
      ) : (
        <div className="table-wrap">
          <table className="grid">
            <thead>
              <tr>
                <th className="num">순번</th>
                <th>공정</th>
                <th>설비 · 작업장</th>
                <th className="num">준비 (분)</th>
                <th className="th-cycle">사이클타임 (초/{unit})</th>
                <th>비고</th>
                <th aria-label="작업" />
              </tr>
            </thead>
            <tbody>
              {steps.map((s, index) => {
                const process = lk.process(s.processId);
                const outsourced = s.outsourcePartnerId != null;
                const isBottleneck = summary.bottleneck?.id === s.id;
                return (
                  <tr key={s.id}>
                    <td className="num mono">{s.seq}</td>
                    <td>
                      <div className="cell-main">
                        <span>
                          {process?.name ?? '삭제된 공정'}
                          {s.inspection && (
                            <span className="cell-flag">
                              <Badge tone="accent">검사</Badge>
                            </span>
                          )}
                          {outsourced && (
                            <span className="cell-flag">
                              <Badge tone="sfg">외주</Badge>
                            </span>
                          )}
                        </span>
                        <span className="cell-sub mono">{process?.code}</span>
                      </div>
                    </td>
                    <td>
                      <div className="cell-main">
                        <span>{outsourced ? (lk.partner(s.outsourcePartnerId)?.name ?? '외주처 미지정') : (lk.equipment(s.equipmentId)?.name ?? '수작업')}</span>
                        <span className="cell-sub">{outsourced ? '외주' : (lk.workCenter(s.workCenterId)?.name ?? '작업장 미지정')}</span>
                      </div>
                    </td>
                    <td className="num">{outsourced || s.setupMin === 0 ? <span className="dim">–</span> : formatQty(s.setupMin)}</td>
                    <td>
                      {outsourced || s.cycleSec === 0 ? (
                        <span className="dim">–</span>
                      ) : (
                        <div className={`cycle${isBottleneck ? ' cycle--max' : ''}`}>
                          <span className="cycle__value">{formatQty(s.cycleSec)}</span>
                          <span className="cycle__track">
                            <span className="cycle__bar" style={{ width: `${Math.max(4, (s.cycleSec / maxCycle) * 100)}%` }} />
                          </span>
                          {isBottleneck && <span className="cycle__tag">병목</span>}
                        </div>
                      )}
                    </td>
                    <td className="cell-sub">{s.remark}</td>
                    <td className="actions">
                      <IconButton label={`${s.seq} 위로`} disabled={index === 0} onClick={() => moveStep(s.id, -1)}>
                        <ArrowUp size={15} />
                      </IconButton>
                      <IconButton label={`${s.seq} 아래로`} disabled={index === steps.length - 1} onClick={() => moveStep(s.id, 1)}>
                        <ArrowDown size={15} />
                      </IconButton>
                      <IconButton label={`${s.seq} 수정`} onClick={() => openEdit(s)}>
                        <Pencil size={15} />
                      </IconButton>
                      <IconButton label={`${s.seq} 빼기`} tone="danger" onClick={() => removeStep(s)}>
                        <Trash2 size={15} />
                      </IconButton>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {steps.length > 0 && (
        <p className="note">사이클타임은 제품 1{unit}당 처리 시간입니다. 가장 긴 사내 공정이 병목이 되어 시간당 생산량을 결정합니다. 외주 공정은 계산에서 빠집니다.</p>
      )}

      <Dialog
        open={draft != null}
        onClose={() => setDraft(null)}
        title={draft?.id ? '공정 수정' : '공정 추가'}
        subtitle={`${item.code} ${item.name}`}
        footer={
          <>
            <Button onClick={() => setDraft(null)}>취소</Button>
            <Button variant="primary" type="submit" form="routing-step-form">
              {draft?.id ? '저장' : '추가'}
            </Button>
          </>
        }
      >
        {draft && (
          <form
            id="routing-step-form"
            className="form"
            noValidate
            onSubmit={(e) => {
              e.preventDefault();
              submit();
            }}
          >
            {(errors._ || errors.itemId) && <p className="form__error">{errors._ ?? errors.itemId}</p>}
            <div className="form-grid">
              <SelectField
                id="routing-step-process"
                label="공정"
                required
                error={errors.processId}
                options={processOptions}
                value={draft.processId}
                onChange={(v) => setDraft({ ...draft, processId: v })}
              />
              <NumberField id="routing-step-seq" label="순번" required error={errors.seq} hint="작은 숫자부터 진행합니다." value={draft.seq} onChange={(v) => setDraft({ ...draft, seq: v })} />
              <SwitchField
                id="routing-step-outsourced"
                label="외주 공정"
                hint="외부 업체에 맡기는 공정"
                full
                checked={draft.outsourced}
                onChange={(v) => setDraft({ ...draft, outsourced: v })}
              />
              {draft.outsourced ? (
                <SelectField
                  id="routing-step-partner"
                  label="외주처"
                  required
                  full
                  error={errors.outsourcePartnerId}
                  options={partnerOptions}
                  value={draft.outsourcePartnerId}
                  onChange={(v) => setDraft({ ...draft, outsourcePartnerId: v })}
                />
              ) : (
                <>
                  <SelectField
                    id="routing-step-wc"
                    label="작업장"
                    error={errors.workCenterId}
                    options={workCenterOptions}
                    value={draft.workCenterId}
                    onChange={(v) => {
                      const keep = v == null || lk.equipment(draft.equipmentId)?.workCenterId === v;
                      setDraft({ ...draft, workCenterId: v, equipmentId: keep ? draft.equipmentId : null });
                    }}
                  />
                  <SelectField
                    id="routing-step-equipment"
                    label="설비"
                    error={errors.equipmentId}
                    options={equipmentOptions}
                    emptyLabel="수작업 (설비 없음)"
                    value={draft.equipmentId}
                    onChange={(v) => setDraft({ ...draft, equipmentId: v, workCenterId: draft.workCenterId ?? lk.equipment(v)?.workCenterId ?? null })}
                  />
                  <NumberField id="routing-step-setup" label="준비시간" unit="분" error={errors.setupMin} hint="작업을 시작하기 전 한 번 드는 시간" value={draft.setupMin} onChange={(v) => setDraft({ ...draft, setupMin: v })} />
                  <NumberField id="routing-step-cycle" label="사이클타임" unit={`초/${unit}`} error={errors.cycleSec} hint={`제품 1${unit}당 처리 시간`} value={draft.cycleSec} onChange={(v) => setDraft({ ...draft, cycleSec: v })} />
                </>
              )}
              <SwitchField
                id="routing-step-inspection"
                label="검사 공정"
                hint="이후 품질 모듈에서 검사 기준을 연결합니다."
                full
                checked={draft.inspection}
                onChange={(v) => setDraft({ ...draft, inspection: v })}
              />
              <TextField id="routing-step-remark" label="비고" full value={draft.remark} onChange={(v) => setDraft({ ...draft, remark: v })} />
            </div>
          </form>
        )}
      </Dialog>

      <Dialog
        open={copying}
        onClose={() => setCopying(false)}
        title="다른 품목의 라우팅 복사"
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
        <SearchSelect id="routing-copy-from" label="가져올 품목" options={copySources} value={copyFrom} onChange={setCopyFrom} hint="공정 순서와 작업장·설비, 표준시간을 그대로 가져옵니다." />
      </Dialog>
    </>
  );
}
