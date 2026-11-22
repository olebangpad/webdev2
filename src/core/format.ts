const qtyFmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 4 });
const intFmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 0 });
const moneyFmt = new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 1 });

export function formatQty(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  // 아주 작은 소요량(예: 0.00064 kg)이 0으로 보이지 않게 유효숫자로 표시한다.
  if (n !== 0 && Math.abs(n) < 0.001) return n.toPrecision(2).replace(/\.?0+$/, '');
  return qtyFmt.format(n);
}

export function formatInt(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return intFmt.format(n);
}

export function formatMoney(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return `${moneyFmt.format(n)}원`;
}

export function formatPercent(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return '';
  return `${qtyFmt.format(n)}%`;
}

/** 초 단위 시간을 읽기 쉬운 형태로. 90 → "1분 30초" */
export function formatDuration(sec: number): string {
  if (!Number.isFinite(sec) || sec <= 0) return '0초';
  const total = Math.round(sec * 10) / 10;
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = Math.round((total % 60) * 10) / 10;
  const parts: string[] = [];
  if (h) parts.push(`${h}시간`);
  if (m) parts.push(`${m}분`);
  if (s || parts.length === 0) parts.push(`${s}초`);
  return parts.join(' ');
}

export function formatDate(iso: string | null | undefined): string {
  if (!iso) return '';
  return iso.slice(0, 10);
}

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`;
}
