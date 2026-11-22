import { Copy, Download } from 'lucide-react';
import { useState } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { useToast } from './feedback';

export interface ExportPayload {
  title: string;
  filename: string;
  mime: string;
  content: string;
}

/** 내보낼 내용을 보여 주고 파일 저장 또는 복사를 고르게 한다. 파일 저장이 막힌 환경에서도 복사는 된다. */
export function ExportDialog({ payload, onClose }: { payload: ExportPayload | null; onClose: () => void }) {
  const toast = useToast();
  const [copied, setCopied] = useState(false);

  const download = () => {
    if (!payload) return;
    try {
      const url = URL.createObjectURL(new Blob([payload.content], { type: payload.mime }));
      const link = document.createElement('a');
      link.href = url;
      link.download = payload.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch {
      toast('파일로 저장하지 못했습니다. 복사해서 붙여 넣으세요.', 'error');
    }
  };

  const copy = async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.content);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      const area = document.getElementById('export-content') as HTMLTextAreaElement | null;
      area?.focus();
      area?.select();
      toast('자동 복사가 막혀 있습니다. 선택된 내용을 직접 복사하세요.', 'error');
    }
  };

  return (
    <Dialog
      open={payload != null}
      onClose={onClose}
      title={payload?.title ?? ''}
      subtitle={payload?.filename}
      variant="modal"
      width={640}
      footer={
        <>
          <Button onClick={copy} icon={<Copy size={16} />}>
            {copied ? '복사했습니다' : '복사'}
          </Button>
          <Button variant="primary" onClick={download} icon={<Download size={16} />}>
            파일로 저장
          </Button>
        </>
      }
    >
      <textarea id="export-content" className="input textarea mono export__content" readOnly rows={12} value={payload?.content ?? ''} />
      <p className="field__hint">파일 저장이 되지 않는 환경이라면 복사해서 메모장이나 엑셀에 붙여 넣으세요.</p>
    </Dialog>
  );
}
