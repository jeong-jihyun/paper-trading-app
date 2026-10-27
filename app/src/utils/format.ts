export function won(n: number): string {
  return Math.round(n).toLocaleString('ko-KR');
}

export function signed(n: number): string {
  return `${n > 0 ? '+' : ''}${won(n)}`;
}

export function pct(n: number): string {
  const v = Math.round(n * 100) / 100;
  return `${v > 0 ? '+' : ''}${v.toFixed(2)}%`;
}

/** 한국 증권 앱 관례: 상승 빨강, 하락 파랑 */
export const colors = {
  up: '#E5383B',
  down: '#2F6FEB',
  flat: '#6B7280',
  bg: '#F3F4F6',
  card: '#FFFFFF',
  text: '#111827',
  sub: '#6B7280',
  line: '#E5E7EB',
  brand: '#0F4C81',
};

export function changeColor(n: number): string {
  if (n > 0) return colors.up;
  if (n < 0) return colors.down;
  return colors.flat;
}

export function dateLabel(yyyymmdd: string): string {
  if (yyyymmdd.length !== 8) return yyyymmdd;
  return `${yyyymmdd.slice(0, 4)}.${yyyymmdd.slice(4, 6)}.${yyyymmdd.slice(6, 8)}`;
}
