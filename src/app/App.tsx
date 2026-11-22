import { useEffect } from 'react';
import { useAppState } from '../core/store';
import { Onboarding } from '../pages/Onboarding';
import { FeedbackProvider } from '../ui/feedback';
import { Shell } from './Shell';

export function App() {
  const state = useAppState();
  const initialized = state.meta.initialized;
  // 처음 화면과 본 화면을 오갈 때 스크롤 위치가 남지 않게 맨 위로 올린다.
  useEffect(() => {
    // 최신 브라우저의 scrollTo는 Promise를 돌려주므로 그대로 반환하면 정리 함수로 오해받는다.
    window.scrollTo(0, 0);
  }, [initialized]);
  return <FeedbackProvider>{initialized ? <Shell /> : <Onboarding />}</FeedbackProvider>;
}
