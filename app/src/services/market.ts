import { doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase';
import type { HistoryPoint, MarketName, Quote, StoredQuote } from '../types';

function fromStored(s: StoredQuote): Quote {
  return {
    code: s.c,
    name: s.n,
    market: s.m,
    close: s.p,
    change: s.g,
    rate: s.r,
    open: s.o,
    high: s.h,
    low: s.l,
    volume: s.q,
    date: s.d,
  };
}

/** 시세 수집 작업이 저장해 둔 market/KOSPI, market/KOSDAQ 문서를 읽는다 (읽기 2번). */
export async function loadMarket(): Promise<Quote[]> {
  const names: MarketName[] = ['KOSPI', 'KOSDAQ'];
  const snaps = await Promise.all(names.map((n) => getDoc(doc(db, 'market', n))));
  const out: Quote[] = [];
  for (const s of snaps) {
    if (s.exists()) out.push(...((s.data().items as StoredQuote[]) ?? []).map(fromStored));
  }
  return out;
}

export async function loadHistory(code: string): Promise<HistoryPoint[]> {
  const s = await getDoc(doc(db, 'history', code));
  return s.exists() ? ((s.data().points as HistoryPoint[]) ?? []) : [];
}
