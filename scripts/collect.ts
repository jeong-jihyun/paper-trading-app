/**
 * 하루 1회 실행: 공공데이터포털 시세 수집 -> Firestore 저장 -> 대기 주문 체결 -> 목표가·손절가 알림 검사
 *
 *   npx tsx collect.ts              실제 실행 (환경변수 필요)
 *   npx tsx collect.ts --sample --dry-run   내장 샘플 응답으로 계산만 해 보기 (키·DB 불필요)
 *
 * 환경변수
 *   DATA_GO_KR_KEY            공공데이터포털 인증키(일반 인증키)
 *   FIREBASE_SERVICE_ACCOUNT  Firebase 서비스 계정 JSON 전체 문자열
 */
import { readFileSync } from 'node:fs';
import { cert, initializeApp } from 'firebase-admin/app';
import { getFirestore, type Firestore } from 'firebase-admin/firestore';
import { checkAlert, computeFill } from '../app/src/utils/trading.js';
import type { HistoryPoint, StoredQuote } from '../app/src/types.js';
import { buildMarketDocs, decideFill, extractItems, mergeHistory, recentDates, type ApiItem } from './lib.js';

const args = new Set(process.argv.slice(2));
const DRY = args.has('--dry-run');
const SAMPLE = args.has('--sample');

// 공공데이터포털 마이페이지 > 활용신청 상세의 End Point (V2) + 오퍼레이션 이름
const ENDPOINT = 'https://apis.data.go.kr/1160100/GetStockSecuritiesInfoService_V2/getStockPriceInfo_V2';

/** 포털의 "일반 인증키"는 인코딩(%3D%3D로 끝남)·디코딩(==로 끝남) 두 가지가 있다. 어느 쪽을 넣어도 되게 맞춘다. */
function normalizeKey(raw: string): string {
  const k = raw.trim();
  try {
    return k.includes('%') ? decodeURIComponent(k) : k;
  } catch {
    return k;
  }
}

async function fetchDay(key: string, basDt: string): Promise<ApiItem[]> {
  const all: ApiItem[] = [];
  const rows = 1000;
  for (let page = 1; page <= 10; page++) {
    const url = `${ENDPOINT}?serviceKey=${encodeURIComponent(normalizeKey(key))}&resultType=json&numOfRows=${rows}&pageNo=${page}&basDt=${basDt}`;
    const res = await fetch(url);
    if (!res.ok) throw new Error(`시세 API 응답 오류 ${res.status}`);
    const json = await res.json();
    const items = extractItems(json);
    all.push(...items);
    if (items.length < rows) break;
  }
  return all;
}

/** 오늘부터 거꾸로 최대 7일, 데이터가 있는 가장 최근 영업일을 찾는다. */
async function fetchLatest(): Promise<ApiItem[]> {
  if (SAMPLE) return extractItems(JSON.parse(readFileSync(new URL('./fixtures/sample-api.json', import.meta.url), 'utf-8')));
  const key = process.env.DATA_GO_KR_KEY;
  if (!key) throw new Error('DATA_GO_KR_KEY 환경변수가 없습니다.');
  for (const d of recentDates(new Date(), 7)) {
    const items = await fetchDay(key, d);
    if (items.length > 0) {
      console.log(`시세 기준일 ${d}: ${items.length}건`);
      return items;
    }
  }
  throw new Error('최근 7일 안에 시세 데이터가 없습니다.');
}

function openDb(): Firestore {
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error('FIREBASE_SERVICE_ACCOUNT 환경변수가 없습니다.');
  initializeApp({ credential: cert(JSON.parse(raw)) });
  return getFirestore();
}

async function saveMarket(db: Firestore, docs: Record<string, StoredQuote[]>): Promise<void> {
  for (const [name, items] of Object.entries(docs)) {
    await db.collection('market').doc(name).set({ items, updatedAt: Date.now() });
  }
  // 종목별 일봉 기록
  const all = Object.values(docs).flat();
  for (let i = 0; i < all.length; i += 300) {
    const chunk = all.slice(i, i + 300);
    const refs = chunk.map((q) => db.collection('history').doc(q.c));
    const snaps = await db.getAll(...refs);
    const writer = db.bulkWriter();
    chunk.forEach((q, k) => {
      const prev = (snaps[k].data()?.points as HistoryPoint[] | undefined) ?? [];
      void writer.set(refs[k], { points: mergeHistory(prev, q.d, q.p) });
    });
    await writer.close();
  }
}

async function processOrders(db: Firestore, byCode: Map<string, StoredQuote>): Promise<number> {
  const snap = await db.collectionGroup('orders').where('status', '==', 'pending').get();
  let filled = 0;
  for (const d of snap.docs) {
    const o = d.data() as { code: string; name: string; side: 'buy' | 'sell'; type: 'market' | 'limit'; qty: number; limitPrice: number | null; createdAt: number };
    const q = byCode.get(o.code);
    if (!q) continue;
    const price = decideFill(o, q);
    if (price == null) continue;
    const userRef = d.ref.parent.parent!;
    const holdRef = userRef.collection('holdings').doc(o.code);
    await db.runTransaction(async (tx) => {
      const [orderNow, userSnap, holdSnap] = await Promise.all([tx.get(d.ref), tx.get(userRef), tx.get(holdRef)]);
      if (orderNow.data()?.status !== 'pending') return; // 그 사이 취소·체결됨
      const cash = userSnap.data()?.cash as number;
      const holding = holdSnap.exists ? { qty: holdSnap.data()!.qty as number, avgPrice: holdSnap.data()!.avgPrice as number } : null;
      const res = computeFill({ cash, holding, side: o.side, qty: o.qty, price });
      if (!res.ok) {
        tx.update(d.ref, { status: 'rejected', reason: res.reason });
        return;
      }
      tx.update(userRef, { cash: res.cash });
      if (res.holding) tx.set(holdRef, { code: o.code, name: o.name, ...res.holding });
      else tx.delete(holdRef);
      tx.update(d.ref, { status: 'filled', filledAt: Date.now(), fillPrice: price, fee: res.fee, tax: res.tax, realizedPnl: res.realizedPnl });
      filled++;
    });
  }
  return filled;
}

async function processAlerts(db: Firestore, byCode: Map<string, StoredQuote>): Promise<number> {
  const snap = await db.collectionGroup('alerts').where('active', '==', true).get();
  let n = 0;
  for (const d of snap.docs) {
    const a = d.data() as { code: string; name: string; targetPrice: number | null; stopPrice: number | null };
    const q = byCode.get(a.code);
    if (!q) continue;
    const hit = checkAlert(q.p, a.targetPrice, a.stopPrice);
    if (!hit) continue;
    const userRef = d.ref.parent.parent!;
    await d.ref.update({ active: false });
    await userRef.collection('notifications').add({
      title: hit === 'target' ? `${a.name} 목표가 도달` : `${a.name} 손절가 이탈`,
      body: `기준일 종가 ${q.p.toLocaleString('ko-KR')}원`,
      createdAt: Date.now(),
    });
    n++;
  }
  return n;
}

async function main(): Promise<void> {
  const items = await fetchLatest();
  const docs = buildMarketDocs(items);
  const byCode = new Map(Object.values(docs).flat().map((q) => [q.c, q]));
  console.log(`KOSPI ${docs.KOSPI.length}종목, KOSDAQ ${docs.KOSDAQ.length}종목`);
  if (DRY) {
    console.log('--dry-run: DB에는 쓰지 않았습니다.');
    return;
  }
  const db = openDb();
  await saveMarket(db, docs);
  const filled = await processOrders(db, byCode);
  const alerts = await processAlerts(db, byCode);
  console.log(`체결 ${filled}건, 알림 ${alerts}건`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
