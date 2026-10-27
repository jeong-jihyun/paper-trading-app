import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  onSnapshot,
  orderBy,
  limit,
  query,
  runTransaction,
  setDoc,
  updateDoc,
  addDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '../firebase';
import { INITIAL_CASH } from '../config';
import { computeFill, limitFillPrice, validateQty } from '../utils/trading';
import type { AlertDoc, HoldingDoc, NotificationDoc, OrderDoc, OrderType, Side, WatchItem } from '../types';

/** 첫 로그인 시 가상 계좌를 만든다. */
export async function ensureAccount(uid: string): Promise<void> {
  const ref = doc(db, 'users', uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, { cash: INITIAL_CASH, initialCash: INITIAL_CASH, createdAt: Date.now() });
  }
}

export interface NewOrder {
  code: string;
  name: string;
  side: Side;
  type: OrderType;
  qty: number;
  limitPrice: number | null;
  bar: { close: number; open: number; high: number; low: number }; // 주문 시점의 최근 시세
}

export interface PlaceResult {
  status: 'filled' | 'pending';
  message: string;
}

/** 모의 주문. 시장가는 최근 종가로 즉시 체결, 지정가는 체결 가능하면 즉시·아니면 대기. */
export async function placeOrder(uid: string, o: NewOrder): Promise<PlaceResult> {
  const qtyError = validateQty(o.qty);
  if (qtyError) throw new Error(qtyError);
  if (o.type === 'limit' && !(o.limitPrice && o.limitPrice > 0)) throw new Error('지정가를 입력하세요.');

  const userRef = doc(db, 'users', uid);
  const holdRef = doc(db, 'users', uid, 'holdings', o.code);
  const orderRef = doc(collection(db, 'users', uid, 'orders'));

  // 지정가는 현재가 기준으로 바로 체결 가능한지 본다 (종가=시가=고가=저가로 취급)
  let fillAt: number | null = null;
  if (o.type === 'market') fillAt = o.bar.close;
  else fillAt = limitFillPrice(o.side, o.limitPrice as number, { open: o.bar.close, high: o.bar.close, low: o.bar.close });

  return runTransaction(db, async (tx) => {
    const userSnap = await tx.get(userRef);
    if (!userSnap.exists()) throw new Error('계좌가 없습니다. 다시 로그인해 주세요.');
    const holdSnap = await tx.get(holdRef);
    const cash = userSnap.data().cash as number;
    const holding = holdSnap.exists()
      ? { qty: holdSnap.data().qty as number, avgPrice: holdSnap.data().avgPrice as number }
      : null;

    const base = {
      code: o.code,
      name: o.name,
      side: o.side,
      type: o.type,
      qty: o.qty,
      limitPrice: o.limitPrice,
      createdAt: Date.now(),
    };

    if (fillAt == null) {
      // 대기 주문: 지금 상태에서 불가능한 주문(예수금·수량 부족)은 접수하지 않는다
      const check = computeFill({ cash, holding, side: o.side, qty: o.qty, price: o.limitPrice as number });
      if (!check.ok) throw new Error(check.reason);
      tx.set(orderRef, { ...base, status: 'pending' });
      return { status: 'pending' as const, message: '지정가 주문이 접수되었습니다(대기).' };
    }

    const res = computeFill({ cash, holding, side: o.side, qty: o.qty, price: fillAt });
    if (!res.ok) throw new Error(res.reason);
    tx.update(userRef, { cash: res.cash });
    if (res.holding) tx.set(holdRef, { code: o.code, name: o.name, ...res.holding });
    else tx.delete(holdRef);
    tx.set(orderRef, {
      ...base,
      status: 'filled',
      filledAt: Date.now(),
      fillPrice: fillAt,
      fee: res.fee,
      tax: res.tax,
      realizedPnl: res.realizedPnl,
    });
    return { status: 'filled' as const, message: '체결되었습니다.' };
  });
}

export async function cancelOrder(uid: string, orderId: string): Promise<void> {
  await updateDoc(doc(db, 'users', uid, 'orders', orderId), { status: 'canceled' });
}

export async function setWatch(uid: string, code: string, name: string, on: boolean): Promise<void> {
  const ref = doc(db, 'users', uid, 'watchlist', code);
  if (on) await setDoc(ref, { code, name, addedAt: Date.now() });
  else await deleteDoc(ref);
}

export async function addAlert(
  uid: string,
  a: { code: string; name: string; targetPrice: number | null; stopPrice: number | null },
): Promise<void> {
  await addDoc(collection(db, 'users', uid, 'alerts'), { ...a, active: true });
}

export async function removeAlert(uid: string, id: string): Promise<void> {
  await deleteDoc(doc(db, 'users', uid, 'alerts', id));
}

// ---------- 실시간 구독 ----------
function sub<T>(path: string[], cb: (rows: T[]) => void, order?: [string, 'asc' | 'desc'], max?: number): Unsubscribe {
  const base = collection(db, path[0], ...path.slice(1));
  const q = order ? query(base, orderBy(order[0], order[1]), ...(max ? [limit(max)] : [])) : base;
  return onSnapshot(q, (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as T)));
}

export const subscribeHoldings = (uid: string, cb: (r: HoldingDoc[]) => void) => sub<HoldingDoc>(['users', uid, 'holdings'], cb);
export const subscribeOrders = (uid: string, cb: (r: OrderDoc[]) => void) =>
  sub<OrderDoc>(['users', uid, 'orders'], cb, ['createdAt', 'desc'], 100);
export const subscribeWatchlist = (uid: string, cb: (r: WatchItem[]) => void) => sub<WatchItem>(['users', uid, 'watchlist'], cb);
export const subscribeAlerts = (uid: string, cb: (r: AlertDoc[]) => void) => sub<AlertDoc>(['users', uid, 'alerts'], cb);
export const subscribeNotifications = (uid: string, cb: (r: NotificationDoc[]) => void) =>
  sub<NotificationDoc>(['users', uid, 'notifications'], cb, ['createdAt', 'desc'], 30);

export function subscribeCash(uid: string, cb: (cash: number) => void): Unsubscribe {
  return onSnapshot(doc(db, 'users', uid), (s) => cb((s.data()?.cash as number) ?? 0));
}
