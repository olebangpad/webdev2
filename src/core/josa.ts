// 앞 낱말의 받침에 맞춰 조사를 고른다. "품목을", "설비를", "CH-A100을", "ASSY를"

export type JosaPair = '을/를' | '이/가' | '은/는' | '과/와';

/** 낱자로 읽을 때 받침으로 끝나는 영문자 (엘, 엠, 엔, 알) */
const LATIN_WITH_FINAL = new Set(['l', 'm', 'n', 'r']);
/** 받침으로 끝나는 숫자 (영, 일, 삼, 육, 칠, 팔) */
const DIGIT_WITH_FINAL = new Set(['0', '1', '3', '6', '7', '8']);

function endsWithFinalConsonant(word: string): boolean | null {
  const last = word.trim().replace(/[)\]"'”’]+$/, '').slice(-1);
  if (!last) return null;
  const code = last.charCodeAt(0);
  if (code >= 0xac00 && code <= 0xd7a3) return (code - 0xac00) % 28 !== 0;
  if (/[0-9]/.test(last)) return DIGIT_WITH_FINAL.has(last);
  if (/[a-z]/i.test(last)) return LATIN_WITH_FINAL.has(last.toLowerCase());
  return null;
}

/** 조사만 돌려준다. 판단할 수 없으면 "을(를)"처럼 둘 다 적는다. */
export function particle(word: string, pair: JosaPair): string {
  const [withFinal, withoutFinal] = pair.split('/');
  const final = endsWithFinalConsonant(word);
  if (final == null) return `${withFinal}(${withoutFinal})`;
  return final ? withFinal : withoutFinal;
}

/** 낱말에 조사를 붙여 돌려준다. */
export function josa(word: string, pair: JosaPair): string {
  return `${word}${particle(word, pair)}`;
}
