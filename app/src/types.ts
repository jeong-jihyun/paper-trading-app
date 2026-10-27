export type MarketName = 'KOSPI' | 'KOSDAQ';
export type Side = 'buy' | 'sell';
export type OrderType = 'market' | 'limit';
export type OrderStatus = 'pending' | 'filled' | 'canceled' | 'rejected';

/** 앱에서 쓰는 시세 한 줄 */
export interface Quote {
  code: string;
  name: string;
  market: MarketName;
  close: number; // 종가
  change: number; // 전일대비
  rate: number; // 등락률(%)
  open: number;
  high: number;
  low: number;
  volume: number;
  date: string; // YYYYMMDD
}

/** Firestore에 저장하는 짧은 키 버전 (문서 1개에 시장 전체를 담기 위해 용량을 줄임) */
export interface StoredQuote {
  c: string;
  n: string;
  m: MarketName;
  p: number;
  g: number;
  r: number;
  o: number;
  h: number;
  l: number;
  q: number;
  d: string;
}

export interface Holding {
  qty: number;
  avgPrice: number;
}

export interface HoldingDoc extends Holding {
  code: string;
  name: string;
}

export interface OrderDoc {
  id: string;
  code: string;
  name: string;
  side: Side;
  type: OrderType;
  qty: number;
  limitPrice: number | null;
  status: OrderStatus;
  createdAt: number; // ms
  filledAt?: number;
  fillPrice?: number;
  fee?: number;
  tax?: number;
  realizedPnl?: number;
  reason?: string;
}

export interface AlertDoc {
  id: string;
  code: string;
  name: string;
  targetPrice: number | null;
  stopPrice: number | null;
  active: boolean;
}

export interface NotificationDoc {
  id: string;
  title: string;
  body: string;
  createdAt: number;
}

export interface WatchItem {
  code: string;
  name: string;
  addedAt: number;
}

export interface HistoryPoint {
  d: string; // YYYYMMDD
  c: number; // 종가
}
