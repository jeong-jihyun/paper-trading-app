// 시세 수집 스크립트의 "순수 계산" 부분. DB·네트워크 없이 테스트할 수 있게 분리했다.
import { isOrderEligible, limitFillPrice } from '../app/src/utils/trading.js';
import type { HistoryPoint, MarketName, OrderDoc, StoredQuote } from '../app/src/types.js';

export const MAX_HISTORY = 90;

/** 공공데이터포털 금융위원회_주식시세정보(getStockPriceInfo) 응답의 item 한 줄 */
export interface ApiItem {
  basDt: string; // 기준일자 YYYYMMDD
  srtnCd: string; // 단축코드 (예: 005930)
  itmsNm: string; // 종목명
  mrktCtg: string; // 시장구분 KOSPI/KOSDAQ/KONEX
  clpr: string; // 종가
  vs: string; // 전일대비
  fltRt: string; // 등락률
  mkp: string; // 시가
  hipr: string; // 고가
  lopr: string; // 저가
  trqu: string; // 거래량
}

/** 응답 JSON에서 item 배열을 꺼낸다. 결과가 0건이면 items가 빈 문자열로 오기도 한다. */
export function extractItems(json: unknown): ApiItem[] {
  const body = (json as { response?: { body?: { items?: unknown } } })?.response?.body;
  const items = body?.items as { item?: ApiItem | ApiItem[] } | '' | undefined;
  if (!items || typeof items === 'string') return [];
  const item = items.item;
  if (!item) return [];
  return Array.isArray(item) ? item : [item];
}

export function toStored(i: ApiItem): StoredQuote | null {
  if (i.mrktCtg !== 'KOSPI' && i.mrktCtg !== 'KOSDAQ') return null; // KONEX 등은 제외
  const p = Number(i.clpr);
  if (!(p > 0)) return null;
  return {
    c: i.srtnCd,
    n: i.itmsNm,
    m: i.mrktCtg as MarketName,
    p,
    g: Number(i.vs) || 0,
    r: Number(i.fltRt) || 0,
    o: Number(i.mkp) || p,
    h: Number(i.hipr) || p,
    l: Number(i.lopr) || p,
    q: Number(i.trqu) || 0,
    d: i.basDt,
  };
}

export function buildMarketDocs(items: ApiItem[]): Record<MarketName, StoredQuote[]> {
  const out: Record<MarketName, StoredQuote[]> = { KOSPI: [], KOSDAQ: [] };
  for (const i of items) {
    const s = toStored(i);
    if (s) out[s.m].push(s);
  }
  return out;
}

/** 일봉 기록에 오늘 종가를 더한다(같은 날짜면 덮어쓰기, 최근 MAX_HISTORY개만 유지). */
export function mergeHistory(existing: HistoryPoint[], d: string, c: number): HistoryPoint[] {
  const next = existing.filter((p) => p.d !== d);
  next.push({ d, c });
  next.sort((a, b) => (a.d < b.d ? -1 : 1));
  return next.slice(-MAX_HISTORY);
}

/** 대기 중인 주문이 그날 시세로 체결되면 체결가를, 아니면 null. */
export function decideFill(order: Pick<OrderDoc, 'side' | 'type' | 'limitPrice' | 'createdAt'>, q: StoredQuote): number | null {
  if (!isOrderEligible(order.createdAt, q.d)) return null;
  if (order.type === 'market') return q.o; // 시장가 대기 주문은 다음 시세의 시가로 체결
  if (order.limitPrice == null) return null;
  return limitFillPrice(order.side, order.limitPrice, { open: q.o, high: q.h, low: q.l });
}

/** 오늘(한국시간)부터 거꾸로 n일의 YYYYMMDD 목록 */
export function recentDates(now: Date, n: number): string[] {
  const out: string[] = [];
  for (let k = 0; k < n; k++) {
    const kst = new Date(now.getTime() + 9 * 3600 * 1000 - k * 86400 * 1000);
    out.push(
      `${kst.getUTCFullYear()}${String(kst.getUTCMonth() + 1).padStart(2, '0')}${String(kst.getUTCDate()).padStart(2, '0')}`,
    );
  }
  return out;
}
