import { describe, expect, it } from 'vitest';
import { josa, particle } from './josa';

describe('조사 고르기', () => {
  it('한글 받침에 따라 고른다', () => {
    expect(josa('품목', '을/를')).toBe('품목을');
    expect(josa('설비', '을/를')).toBe('설비를');
    expect(josa('거래처', '이/가')).toBe('거래처가');
    expect(josa('작업장', '은/는')).toBe('작업장은');
    expect(josa('공정', '과/와')).toBe('공정과');
  });

  it('숫자와 영문자로 끝나는 코드도 읽는 소리에 맞춘다', () => {
    expect(josa('CH-A100', '을/를')).toBe('CH-A100을');
    expect(josa('IN-M4', '을/를')).toBe('IN-M4를');
    expect(josa('컵홀더 ASSY', '을/를')).toBe('컵홀더 ASSY를');
    expect(josa('P-PACK', '은/는')).toBe('P-PACK는');
    expect(josa('LABEL', '이/가')).toBe('LABEL이');
  });

  it('닫는 괄호는 건너뛰고 그 앞 글자를 본다', () => {
    expect(josa('컵홀더 ASSY (3구)', '을/를')).toBe('컵홀더 ASSY (3구)를');
    expect(josa('PP 수지 (탈크 20%)', '을/를')).toBe('PP 수지 (탈크 20%)을(를)');
  });

  it('판단할 수 없으면 둘 다 적는다', () => {
    expect(particle('', '을/를')).toBe('을(를)');
    expect(particle('100℃', '이/가')).toBe('이(가)');
  });
});
