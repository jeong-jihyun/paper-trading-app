import { FEE_RATE, SELL_TAX_RATE } from '../config';
import type { Holding, Side } from '../types';

/**
 * 모의 체결 계산 (순수 함수).
 * 앱(클라이언트 SDK)과 시세 수집 스크립트(Admin SDK)가 같은 규칙을 쓰도록 DB 접근 없이 계산만 한다.
 */

export interface FillInput {
  cash: number;
  holding: Holding | null;
  side: Side;
  qty: number;
  price: number;
}

export type FillResult =
  | {
      ok: true;
      cash: number;
      holding: Holding | null; // null이면 보유 종목 삭제
      amount: number;
      fee: number;
      tax: number;
      realizedPnl: number;
    }
  | { ok: false; reason: string };

/** 금액 x 비율을 원 단위로 내림. 부동소수점 오차(14.999999...)를 먼저 걷어 낸다. */
export function rateAmount(amount: number, rate: number): number {
  return Math.floor(Math.round(amount * rate * 1e6) / 1e6);
}

export function validateQty(qty: number): string | null {
  if (!Number.isInteger(qty) || qty <= 0) return '수량은 1 이상의 정수여야 합니다.';
  return null;
}

export function computeFill({ cash, holding, side, qty, price }: FillInput): FillResult {
  const qtyError = validateQty(qty);
  if (qtyError) return { ok: false, reason: qtyError };
  if (!(price > 0)) return { ok: false, reason: '가격이 올바르지 않습니다.' };

  const amount = Math.round(price * qty);
  const fee = rateAmount(amount, FEE_RATE);

  if (side === 'buy') {
    const total = amount + fee;
    if (cash < total) return { ok: false, reason: '예수금이 부족합니다.' };
    const oldQty = holding?.qty ?? 0;
    const oldAvg = holding?.avgPrice ?? 0;
    const newQty = oldQty + qty;
    const newAvg = Math.round(((oldQty * oldAvg + amount) / newQty) * 100) / 100;
    return {
      ok: true,
      cash: cash - total,
      holding: { qty: newQty, avgPrice: newAvg },
      amount,
      fee,
      tax: 0,
      realizedPnl: 0,
    };
  }

  // 매도
  if (!holding || holding.qty < qty) return { ok: false, reason: '보유 수량이 부족합니다.' };
  const tax = rateAmount(amount, SELL_TAX_RATE);
  const realizedPnl = Math.round((price - holding.avgPrice) * qty) - fee - tax;
  const remain = holding.qty - qty;
  return {
    ok: true,
    cash: cash + amount - fee - tax,
    holding: remain === 0 ? null : { qty: remain, avgPrice: holding.avgPrice },
    amount,
    fee,
    tax,
    realizedPnl,
  };
}

/** 지정가 주문이 그날 시세(시가·고가·저가)로 체결되는지 판단하고, 체결가를 돌려준다. 체결 안 되면 null. */
export function limitFillPrice(
  side: Side,
  limit: number,
  bar: { open: number; high: number; low: number },
): number | null {
  if (side === 'buy') {
    if (bar.low > limit) return null;
    return bar.open <= limit ? bar.open : limit;
  }
  if (bar.high < limit) return null;
  return bar.open >= limit ? bar.open : limit;
}

/**
 * 그날 시세(basDt, YYYYMMDD)로 체결해도 되는 주문인가?
 * - 주문한 날(한국시간)이 시세 날짜보다 이전이면 가능
 * - 같은 날이면 장 마감(15:30) 전에 낸 주문만 가능
 */
export function isOrderEligible(createdAtMs: number, basDt: string): boolean {
  const kst = new Date(createdAtMs + 9 * 60 * 60 * 1000);
  const y = kst.getUTCFullYear();
  const m = String(kst.getUTCMonth() + 1).padStart(2, '0');
  const d = String(kst.getUTCDate()).padStart(2, '0');
  const day = `${y}${m}${d}`;
  if (day < basDt) return true;
  if (day > basDt) return false;
  const minutes = kst.getUTCHours() * 60 + kst.getUTCMinutes();
  return minutes < 15 * 60 + 30;
}

export interface Evaluation {
  buyAmount: number; // 매입금액
  evalAmount: number; // 평가금액
  pnl: number; // 평가손익
  rate: number; // 수익률(%)
}

export function evaluate(qty: number, avgPrice: number, close: number): Evaluation {
  const buyAmount = Math.round(qty * avgPrice);
  const evalAmount = Math.round(qty * close);
  const pnl = evalAmount - buyAmount;
  const rate = buyAmount === 0 ? 0 : Math.round((pnl / buyAmount) * 10000) / 100;
  return { buyAmount, evalAmount, pnl, rate };
}

/** 목표가 도달·손절가 이탈 검사 */
export function checkAlert(
  close: number,
  targetPrice: number | null,
  stopPrice: number | null,
): 'target' | 'stop' | null {
  if (targetPrice != null && close >= targetPrice) return 'target';
  if (stopPrice != null && close <= stopPrice) return 'stop';
  return null;
}
