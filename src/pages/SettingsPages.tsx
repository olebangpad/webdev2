import { Download, RotateCcw, Upload } from 'lucide-react';
import { useMemo, useState } from 'react';
import { formatDateTime } from '../core/format';
import { ATTR_ENTITIES, CODE_GROUPS } from '../core/labels';
import { exportBackup, importBackup, isPersisted, loadTemplate, resetAll, useAppState } from '../core/store';
import { findTemplate } from '../core/templates';
import { COLLECTION_KEYS, type AttrEntity, type BaseEntity, type CodeGroup } from '../core/types';
import { Button } from '../ui/Button';
import { Dialog } from '../ui/Dialog';
import { EntityPage } from '../ui/EntityPage';
import { ExportDialog, type ExportPayload } from '../ui/ExportDialog';
import { useConfirm, useToast } from '../ui/feedback';
import { TextAreaField } from '../ui/fields';
import { PageHeader, Tabs } from '../ui/layout';
import { attrDefsConfig, codesConfig } from './configs';
import { TemplateCards } from './TemplateCards';

export function CodesPage() {
  const state = useAppState();
  const [group, setGroup] = useState<CodeGroup>('UNIT');
  const info = CODE_GROUPS.find((g) => g.value === group)!;
  const config = useMemo(() => codesConfig(group, info.label), [group, info.label]);
  return (
    <>
      <PageHeader
        title="공통코드"
        description="단위, 분류, 불량 유형처럼 여러 화면에서 고르는 값을 직접 정의합니다. 업종에 맞게 바꾸면 코드 수정 없이 모든 화면에 반영됩니다."
      />
      <Tabs
        label="코드 그룹"
        value={group}
        onChange={setGroup}
        tabs={CODE_GROUPS.map((g) => ({ value: g.value, label: g.label, count: state.codes.filter((c) => c.group === g.value).length }))}
      />
      <p className="note note--lead">{info.description}</p>
      <EntityPage key={group} config={config} />
    </>
  );
}

export function AttributesPage() {
  const state = useAppState();
  const [entity, setEntity] = useState<AttrEntity>('items');
  const label = ATTR_ENTITIES.find((e) => e.value === entity)!.label;
  const config = useMemo(() => attrDefsConfig(entity, label), [entity, label]);
  return (
    <>
      <PageHeader
        title="사용자 정의 속성"
        description="업종마다 다른 관리 항목을 직접 추가합니다. 사출 공장은 캐비티 수와 금형 번호를, 가공 공장은 재질과 도면 번호를 두는 식입니다."
      />
      <Tabs
        label="속성을 붙일 대상"
        value={entity}
        onChange={setEntity}
        tabs={ATTR_ENTITIES.map((e) => ({ value: e.value, label: e.label, count: state.attrDefs.filter((d) => d.entity === e.value).length }))}
      />
      <p className="note note--lead">
        여기서 만든 속성은 {label} 등록 화면의 "추가 속성"에 나타나고 CSV에도 함께 나갑니다.
      </p>
      <EntityPage key={entity} config={config} />
    </>
  );
}

const COUNT_LABELS: Record<(typeof COLLECTION_KEYS)[number], string> = {
  items: '품목',
  bomLines: 'BOM 라인',
  processes: '공정',
  routingSteps: '라우팅 공정',
  equipment: '설비',
  workCenters: '작업장',
  partners: '거래처',
  codes: '공통코드',
  attrDefs: '사용자 정의 속성',
};

export function DataPage() {
  const state = useAppState();
  const toast = useToast();
  const confirm = useConfirm();
  const [exporting, setExporting] = useState<ExportPayload | null>(null);
  const [importing, setImporting] = useState(false);
  const [importText, setImportText] = useState('');
  const [importError, setImportError] = useState('');

  const template = findTemplate(state.meta.templateKey);
  const lastChange = useMemo(
    () => COLLECTION_KEYS.flatMap((k) => (state[k] as BaseEntity[]).map((e) => e.updatedAt)).sort().at(-1),
    [state],
  );
  const total = COLLECTION_KEYS.reduce((n, k) => n + state[k].length, 0);

  const pickTemplate = async (key: string, name: string) => {
    const ok = await confirm({
      title: `${name} 예시 데이터 불러오기`,
      body: '지금 있는 데이터를 모두 지우고 예시 데이터로 바꿉니다. 직접 입력한 내용이 있다면 먼저 백업하세요.',
      confirmLabel: '바꾸기',
      tone: 'danger',
    });
    if (!ok) return;
    loadTemplate(key);
    toast(`${name} 예시 데이터를 불러왔습니다.`);
  };

  const runImport = () => {
    const result = importBackup(importText);
    if (!result.ok) {
      setImportError(result.error);
      return;
    }
    toast('백업을 불러왔습니다.');
    setImporting(false);
    setImportText('');
    setImportError('');
  };

  const readFile = (file: File | undefined) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setImportText(String(reader.result ?? ''));
      setImportError('');
    };
    reader.onerror = () => setImportError('파일을 읽지 못했습니다.');
    reader.readAsText(file);
  };

  const reset = async () => {
    const ok = await confirm({
      title: '모든 데이터 지우기',
      body: `등록된 ${total.toLocaleString('ko-KR')}건을 모두 지우고 처음 화면으로 돌아갑니다. 되돌릴 수 없습니다.`,
      confirmLabel: '모두 지우기',
      tone: 'danger',
    });
    if (ok) resetAll();
  };

  return (
    <>
      <PageHeader title="데이터 관리" description="예시 데이터를 바꾸거나, 지금 데이터를 백업하고 되돌립니다." />

      <section className="panel section">
        <header className="panel__head">
          <div>
            <h2>지금 데이터</h2>
            <p>
              {template ? `${template.name} 예시에서 시작` : '빈 상태에서 시작'}
              {lastChange && ` · 마지막 변경 ${formatDateTime(lastChange)}`}
            </p>
          </div>
        </header>
        <dl className="counts">
          {(['items', 'bomLines', 'processes', 'routingSteps', 'equipment', 'workCenters', 'partners', 'codes', 'attrDefs'] as const).map((k) => (
            <div key={k}>
              <dt>{COUNT_LABELS[k]}</dt>
              <dd>{state[k].length.toLocaleString('ko-KR')}</dd>
            </div>
          ))}
        </dl>
        <p className={`note${isPersisted() ? '' : ' note--warn'}`}>
          {isPersisted()
            ? '이 브라우저에만 저장됩니다. 다른 기기나 다른 브라우저에서는 보이지 않으니, 옮기려면 백업을 내보내세요.'
            : '이 브라우저에 저장하지 못하고 있습니다. 창을 닫으면 사라지니 백업을 내보내 두세요.'}
        </p>
        <div className="toolbar">
          <Button
            icon={<Download size={16} />}
            onClick={() =>
              setExporting({ title: '백업 내보내기', filename: `mfg-backup-${new Date().toISOString().slice(0, 10)}.json`, mime: 'application/json', content: exportBackup() })
            }
          >
            백업 내보내기
          </Button>
          <Button icon={<Upload size={16} />} onClick={() => setImporting(true)}>
            백업 불러오기
          </Button>
          <Button variant="ghost" className="btn--danger-text" icon={<RotateCcw size={16} />} onClick={reset}>
            모든 데이터 지우기
          </Button>
        </div>
      </section>

      <section className="section">
        <h2 className="section__title">예시 데이터 바꾸기</h2>
        <p className="note note--lead">같은 화면이 업종에 따라 어떻게 달라지는지 바꿔 가며 볼 수 있습니다.</p>
        <TemplateCards current={state.meta.templateKey} onPick={(spec) => pickTemplate(spec.key, spec.name)} actionLabel="이 예시로 바꾸기" />
      </section>

      <ExportDialog payload={exporting} onClose={() => setExporting(null)} />

      <Dialog
        open={importing}
        onClose={() => setImporting(false)}
        title="백업 불러오기"
        variant="modal"
        width={640}
        footer={
          <>
            <Button onClick={() => setImporting(false)}>취소</Button>
            <Button variant="primary" disabled={importText.trim() === ''} onClick={runImport}>
              불러오기
            </Button>
          </>
        }
      >
        <p className="confirm__body">내보낸 백업 파일을 고르거나 내용을 붙여 넣으세요. 지금 있는 데이터는 백업 내용으로 모두 바뀝니다.</p>
        <input id="import-file" className="file-input" type="file" accept="application/json,.json" aria-label="백업 파일" onChange={(e) => readFile(e.target.files?.[0])} />
        <TextAreaField
          id="import-text"
          label="백업 내용"
          mono
          rows={8}
          error={importError || undefined}
          placeholder='{ "schemaVersion": 1, ... }'
          value={importText}
          onChange={(v) => {
            setImportText(v);
            setImportError('');
          }}
        />
      </Dialog>
    </>
  );
}
