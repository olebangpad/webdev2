import { loadTemplate, startEmpty } from '../core/store';
import { TemplateCards } from './TemplateCards';

export function Onboarding() {
  return (
    <main className="onboarding">
      <div className="onboarding__inner">
        <p className="eyebrow">제조 통합 플랫폼 · 기준정보</p>
        <h1>어떤 공장으로 시작할까요?</h1>
        <p className="onboarding__lead">
          품목, BOM, 공정, 설비를 한곳에서 관리합니다. 공정 종류와 불량 유형, 관리 항목을 직접 정의하므로 업종이 달라도 같은 화면으로 씁니다. 예시 데이터를 고르면 바로 둘러볼 수 있고, 언제든 바꾸거나 지울 수 있습니다.
        </p>
        <TemplateCards onPick={(spec) => loadTemplate(spec.key)} actionLabel="이 예시로 시작" />
        <div className="onboarding__empty">
          <div>
            <strong>우리 공장 데이터로 바로 시작</strong>
            <p>예시 없이 빈 상태로 엽니다. 단위(EA, KG, M, L)만 미리 넣어 둡니다.</p>
          </div>
          <button type="button" className="btn btn--secondary btn--md" onClick={startEmpty}>
            <span>빈 상태로 시작</span>
          </button>
        </div>
        <p className="onboarding__note">입력한 내용은 지금 쓰는 브라우저에만 저장됩니다. 서버로 보내지 않습니다.</p>
      </div>
    </main>
  );
}
