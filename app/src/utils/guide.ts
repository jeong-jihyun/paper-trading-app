import { FEE_RATE, SELL_TAX_RATE } from '../config';
import { rateAmount } from './trading';
import type { OrderType, Side } from '../types';
import type { TabParamList } from '../navigation';

/**
 * 안내(가이드) 계산 — 순수 함수.
 * "지금 무엇을 해야 하는지"와 "이 주문이 올바른지"를 화면과 분리해 계산한다.
 */

// ───────── 1. 연습 순서(워크플로) ─────────

export type StepKey = 'watch' | 'detail' | 'buy' | 'alert' | 'account' | 'sell';

export interface Progress {
  watchCount: number; // 관심종목 수
  visitedDetail: boolean; // 종목 상세(현재가) 화면을 본 적 있음
  buyCount: number; // 매수 주문 수(대기 포함)
  alertCount: number; // 등록한 알림 수
  visitedAccount: boolean; // 계좌 화면을 본 적 있음
  sellCount: number; // 체결된 매도 수
}

export interface Step {
  key: StepKey;
  no: number;
  title: string;
  desc: string; // 무엇을 누르면 되는지
  tab: keyof TabParamList; // 어느 탭에서 하는지
  tabLabel: string;
  done: boolean;
  current: boolean; // 지금 할 차례
}

const STEP_DEFS: Array<Omit<Step, 'no' | 'done' | 'current'> & { isDone: (p: Progress) => boolean }> = [
  {
    key: 'watch',
    title: '관심종목 담기',
    desc: '관심종목 탭 위쪽 검색창에 종목 이름(예: 삼성전자)을 입력하고, 나온 종목을 누르면 담깁니다.',
    tab: 'Watchlist',
    tabLabel: '관심종목',
    isDone: (p) => p.watchCount > 0,
  },
  {
    key: 'detail',
    title: '종목 살펴보기',
    desc: '관심종목 목록에서 종목을 누르면 현재가·차트가 나옵니다. 최근 흐름과 거래량을 먼저 봅니다.',
    tab: 'Watchlist',
    tabLabel: '관심종목',
    isDone: (p) => p.visitedDetail,
  },
  {
    key: 'buy',
    title: '첫 매수 주문',
    desc: '주문 탭에서 종목을 고르고 매수 → 시장가 → 수량 1주부터 시작합니다. 경고가 뜨면 내용을 읽고 고칩니다.',
    tab: 'Order',
    tabLabel: '주문',
    isDone: (p) => p.buyCount > 0,
  },
  {
    key: 'alert',
    title: '목표가·손절가 정하기',
    desc: '종목 상세 화면 아래 "목표가·손절가 알림"에 팔 가격을 미리 적습니다. 사기 전에 정해 두는 것이 원칙입니다.',
    tab: 'Watchlist',
    tabLabel: '관심종목',
    isDone: (p) => p.alertCount > 0,
  },
  {
    key: 'account',
    title: '계좌에서 손익 확인',
    desc: '계좌정보 탭에서 총평가금액, 종목별 평가손익, 거래내역을 확인합니다.',
    tab: 'Account',
    tabLabel: '계좌정보',
    isDone: (p) => p.visitedAccount && p.buyCount > 0,
  },
  {
    key: 'sell',
    title: '매도해서 결과 확정',
    desc: '주문 탭에서 보유 종목을 고르고 매도를 선택합니다. 팔아야 손익이 확정됩니다(실현손익).',
    tab: 'Order',
    tabLabel: '주문',
    isDone: (p) => p.sellCount > 0,
  },
];

export function buildSteps(p: Progress): Step[] {
  let currentFound = false;
  return STEP_DEFS.map(({ isDone, ...def }, i) => {
    const done = isDone(p);
    const current = !done && !currentFound;
    if (current) currentFound = true;
    return { ...def, no: i + 1, done, current };
  });
}

/** 주문 한 번의 흐름 (가이드 화면의 한눈에 보기) */
export const ORDER_FLOW = ['종목 고르기', '매수/매도', '시장가/지정가', '수량 입력', '경고 확인', '주문', '계좌 확인'];

// ───────── 2. 주문 점검 ─────────

export type Level = 'error' | 'warn' | 'info';

export interface Issue {
  level: Level;
  msg: string; // 무엇이 문제인지
  how?: string; // 어떻게 하면 되는지
}

export interface OrderCheckInput {
  side: Side;
  type: OrderType;
  qtyText: string;
  priceText: string; // 지정가 입력값
  close: number; // 현재가(기준일 종가)
  rate: number; // 등락률(%)
  volume: number; // 거래량
  cash: number; // 예수금
  holdingQty: number; // 이 종목 보유 수량
  holdingAvg: number; // 이 종목 평균단가
  totalAsset: number; // 총평가금액(예수금+주식)
}

export interface OrderCheck {
  issues: Issue[];
  canSubmit: boolean; // error가 없으면 true
  warnings: Issue[];
  price: number; // 계산에 쓴 가격
  amount: number; // 주문금액
  fee: number;
  tax: number;
  immediate: boolean; // 바로 체결되는 주문인가
  maxQty: number; // 지금 넣을 수 있는 최대 수량
}

/** 한국거래소 호가 단위 (2023년 개편 기준, 코스피·코스닥 공통) */
export function tickSize(price: number): number {
  if (price < 2_000) return 1;
  if (price < 5_000) return 5;
  if (price < 20_000) return 10;
  if (price < 50_000) return 50;
  if (price < 200_000) return 100;
  if (price < 500_000) return 500;
  return 1_000;
}

const n = (v: number) => Math.round(v).toLocaleString('ko-KR');
const toNum = (t: string) => Number(t.replace(/[,\s]/g, ''));

export function maxBuyQty(cash: number, price: number): number {
  if (!(price > 0) || cash <= 0) return 0;
  let q = Math.floor(cash / (price * (1 + FEE_RATE)));
  while (q > 0 && Math.round(price * q) + rateAmount(Math.round(price * q), FEE_RATE) > cash) q -= 1;
  return q;
}

export function checkOrder(i: OrderCheckInput): OrderCheck {
  const issues: Issue[] = [];
  const qty = toNum(i.qtyText);
  const limit = toNum(i.priceText);
  const isBuy = i.side === 'buy';

  // 가격: 시장가는 현재가, 지정가는 조건에 맞으면 현재가로 바로 체결
  let price = i.close;
  let immediate = true;
  let priceOk = true;
  if (i.type === 'limit') {
    if (!i.priceText.trim() || !Number.isFinite(limit) || limit <= 0) {
      priceOk = false;
      issues.push({ level: 'error', msg: '지정가를 입력하지 않았습니다.', how: `사고팔고 싶은 가격을 숫자로 적으세요. 현재가는 ${n(i.close)}원입니다.` });
    } else {
      const upper = i.close * 1.3;
      const lower = i.close * 0.7;
      const tick = tickSize(limit);
      if (limit > upper || limit < lower) {
        priceOk = false;
        issues.push({
          level: 'error',
          msg: '지정가가 하루 가격제한폭(±30%)을 벗어났습니다.',
          how: `${n(Math.ceil(lower))}원 ~ ${n(Math.floor(upper))}원 사이로 적으세요.`,
        });
      } else if (limit % tick !== 0) {
        priceOk = false;
        const near = Math.round(limit / tick) * tick;
        issues.push({
          level: 'error',
          msg: `이 가격대는 ${n(tick)}원 단위로만 주문할 수 있습니다.`,
          how: `가까운 가격 ${n(near)}원으로 바꾸세요.`,
        });
      } else {
        immediate = isBuy ? limit >= i.close : limit <= i.close;
        price = immediate ? i.close : limit;
        if (immediate && limit !== i.close) {
          issues.push({
            level: 'info',
            msg: isBuy ? '지정가가 현재가보다 높아 현재가로 바로 체결됩니다.' : '지정가가 현재가보다 낮아 현재가로 바로 체결됩니다.',
            how: isBuy ? '더 싸게 사려면 현재가보다 낮은 가격을 적으세요.' : '더 비싸게 팔려면 현재가보다 높은 가격을 적으세요.',
          });
        } else if (!immediate) {
          issues.push({
            level: 'info',
            msg: `대기 주문이 됩니다. 가격이 ${n(limit)}원${isBuy ? ' 이하로 내려오면' : ' 이상으로 오르면'} 체결됩니다.`,
            how: '시세는 하루 1회 갱신되므로 다음 갱신 때 체결 여부가 정해집니다. 주문 탭 "미체결 주문"에서 취소할 수 있습니다.',
          });
        }
      }
    }
  }

  // 수량
  let qtyOk = true;
  if (!i.qtyText.trim() || !Number.isInteger(qty) || qty <= 0) {
    qtyOk = false;
    issues.push({ level: 'error', msg: '수량이 올바르지 않습니다.', how: '1 이상의 숫자(소수점 없이)로 적으세요. 처음이라면 1주부터 해 보세요.' });
  }

  const maxQty = isBuy ? maxBuyQty(i.cash, price) : i.holdingQty;
  const amount = qtyOk && priceOk ? Math.round(price * qty) : 0;
  const fee = rateAmount(amount, FEE_RATE);
  const tax = isBuy ? 0 : rateAmount(amount, SELL_TAX_RATE);

  if (qtyOk && priceOk) {
    if (isBuy) {
      if (amount + fee > i.cash) {
        issues.push({
          level: 'error',
          msg: `예수금이 부족합니다. 필요한 돈 ${n(amount + fee)}원, 가진 돈 ${n(i.cash)}원.`,
          how: maxQty > 0 ? `수량을 ${n(maxQty)}주 이하로 줄이세요.` : '보유 종목을 먼저 팔아 예수금을 만드세요.',
        });
      } else {
        const share = i.totalAsset > 0 ? ((i.holdingQty * i.close + amount) / i.totalAsset) * 100 : 0;
        if (share > 30) {
          issues.push({
            level: 'warn',
            msg: `이 주문을 하면 한 종목이 전체 자산의 약 ${Math.round(share)}%가 됩니다.`,
            how: '한 종목에 몰리면 그 종목이 떨어질 때 손실이 큽니다. 보통 한 종목은 10~20% 이내로 나눠 담습니다.',
          });
        }
        if (i.rate >= 15) {
          issues.push({
            level: 'warn',
            msg: `오늘 ${i.rate.toFixed(1)}% 급등한 종목입니다.`,
            how: '급등 직후에 따라 사면 바로 떨어지는 경우가 많습니다. 수량을 줄이거나 지정가로 낮은 가격에 걸어 두세요.',
          });
        } else if (i.rate <= -15) {
          issues.push({
            level: 'warn',
            msg: `오늘 ${i.rate.toFixed(1)}% 급락한 종목입니다.`,
            how: '떨어진 이유를 모르고 사면 더 떨어질 수 있습니다. 조금만 사고 손절가를 먼저 정하세요.',
          });
        }
      }
    } else {
      if (i.holdingQty <= 0) {
        issues.push({ level: 'error', msg: '가지고 있지 않은 종목은 팔 수 없습니다.', how: '위에서 "매수"를 선택해 먼저 사거나, 계좌정보 탭에서 보유 종목을 확인하세요.' });
      } else if (qty > i.holdingQty) {
        issues.push({ level: 'error', msg: `보유 수량보다 많습니다. 보유 ${n(i.holdingQty)}주.`, how: `수량을 ${n(i.holdingQty)}주 이하로 줄이세요.` });
      } else {
        const pnl = Math.round((price - i.holdingAvg) * qty) - fee - tax;
        if (pnl < 0) {
          issues.push({
            level: 'warn',
            msg: `손실이 확정됩니다. 약 ${n(pnl)}원 (평균단가 ${n(i.holdingAvg)}원보다 낮게 팝니다).`,
            how: '미리 정한 손절 기준에 닿았다면 파는 것이 맞습니다. 기준 없이 불안해서 파는 것이라면 한 번 더 생각하세요.',
          });
        } else {
          issues.push({ level: 'info', msg: `팔면 약 +${n(pnl)}원이 확정됩니다(수수료·세금 뺀 금액).` });
        }
      }
    }
    if (i.volume > 0 && i.volume < 10_000) {
      issues.push({
        level: 'warn',
        msg: `거래량이 적은 종목입니다(${n(i.volume)}주).`,
        how: '실제 시장에서는 원하는 가격에 사고팔기 어려울 수 있습니다. 연습은 거래가 활발한 종목이 좋습니다.',
      });
    }
  }

  const errors = issues.filter((x) => x.level === 'error');
  return { issues, canSubmit: errors.length === 0, warnings: issues.filter((x) => x.level === 'warn'), price, amount, fee, tax, immediate, maxQty };
}

// ───────── 3. 알림(목표가·손절가) 점검 ─────────

export function checkAlertInput(close: number, targetText: string, stopText: string): Issue[] {
  const issues: Issue[] = [];
  const t = targetText.trim() ? toNum(targetText) : null;
  const s = stopText.trim() ? toNum(stopText) : null;
  if (t == null && s == null) return issues;
  if (t != null && (!Number.isFinite(t) || t <= 0)) issues.push({ level: 'error', msg: '목표가는 숫자로 적으세요.' });
  else if (t != null && t <= close) {
    issues.push({ level: 'error', msg: `목표가가 현재가(${n(close)}원)보다 낮거나 같습니다.`, how: '목표가는 "여기까지 오르면 판다"는 가격이라 현재가보다 높아야 합니다.' });
  }
  if (s != null && (!Number.isFinite(s) || s <= 0)) issues.push({ level: 'error', msg: '손절가는 숫자로 적으세요.' });
  else if (s != null && s >= close) {
    issues.push({ level: 'error', msg: `손절가가 현재가(${n(close)}원)보다 높거나 같습니다.`, how: '손절가는 "여기까지 떨어지면 판다"는 가격이라 현재가보다 낮아야 합니다.' });
  } else if (s != null && s < close * 0.8) {
    issues.push({ level: 'warn', msg: '손절가가 현재가보다 20% 넘게 낮습니다.', how: '너무 멀면 손실이 커진 뒤에야 알림이 옵니다. 보통 -5% ~ -10% 사이로 정합니다.' });
  }
  if (t != null && s == null) issues.push({ level: 'info', msg: '손절가도 같이 정해 두면 좋습니다.', how: `예: 현재가의 -7%인 ${n(Math.round((close * 0.93) / tickSize(close)) * tickSize(close))}원` });
  return issues;
}

// ───────── 4. 도움말 글 ─────────

export const HELP = {
  side: '매수 = 주식을 삽니다(예수금이 줄고 주식이 생김). 매도 = 가진 주식을 팝니다(주식이 줄고 예수금이 늘어남). 처음에는 매수부터 합니다.',
  type: '시장가 = 가격을 정하지 않고 지금 가격으로 바로 삽니다. 쉽고 확실합니다. 지정가 = 내가 정한 가격이 되어야만 체결됩니다. 더 싸게 사거나 더 비싸게 팔고 싶을 때 씁니다.',
  qty: '몇 주를 사고팔지입니다. "최대"를 누르면 지금 가능한 최대 수량이 들어갑니다. 처음에는 1주로 흐름을 익히세요.',
  limit: '이 가격 이하로 내려오면 삽니다(매도는 이 가격 이상이면 팝니다). 가격대마다 정해진 단위(호가 단위)로만 적을 수 있습니다.',
  est: `주문금액 = 가격 × 수량. 여기에 수수료 ${(FEE_RATE * 100).toFixed(3)}%가 붙고, 팔 때는 거래세 ${(SELL_TAX_RATE * 100).toFixed(2)}%가 더 빠집니다.`,
  target: '목표가 = 이 가격까지 오르면 팔겠다는 가격. 손절가 = 이 가격까지 떨어지면 더 잃기 전에 팔겠다는 가격. 사기 전에 둘 다 정하는 것이 기본입니다.',
  total: '총평가금액 = 예수금(현금) + 가진 주식을 지금 가격으로 계산한 금액. 처음 1억 원에서 얼마나 변했는지 보면 됩니다.',
  pnl: '평가손익 = 아직 팔지 않은 주식의 이익·손실. 팔기 전에는 확정이 아닙니다. 팔면 "실현손익"으로 확정됩니다.',
  avg: '평균단가 = 내가 이 종목을 산 가격의 평균. 현재가가 이보다 높으면 이익, 낮으면 손실입니다.',
  discover: '등락률 상위 = 오늘 많이 오른 종목, 하위 = 많이 떨어진 종목, 거래량 상위 = 가장 많이 거래된 종목. 많이 올랐다고 좋은 종목은 아닙니다. 눌러서 차트를 먼저 보세요.',
  watch: '관심종목 = 자주 볼 종목을 모아 두는 목록. 담아도 돈은 들지 않습니다. 아래로 당기면 시세를 새로 불러옵니다.',
  price: '빨강 = 전날보다 오름, 파랑 = 전날보다 내림. 시가 = 그날 처음 가격, 고가·저가 = 그날 가장 높고 낮은 가격, 거래량 = 그날 거래된 주식 수.',
  pending: '미체결 = 지정가로 걸어 두었지만 아직 가격이 맞지 않아 기다리는 주문. 마음이 바뀌면 취소할 수 있습니다.',
};

export const INVEST_TIPS: Array<{ title: string; body: string }> = [
  { title: '1. 조금씩, 나눠서 삽니다', body: '한 번에 다 사지 않고 2~3번에 나눠 삽니다. 한 종목은 전체 자산의 10~20% 이내로 합니다. 앱이 30%를 넘으면 경고합니다.' },
  { title: '2. 사기 전에 팔 가격을 정합니다', body: '목표가(예: +10%)와 손절가(예: -7%)를 먼저 정하고 알림에 등록합니다. 기준이 있어야 오를 때 욕심, 내릴 때 겁에 흔들리지 않습니다.' },
  { title: '3. 급등한 종목은 따라 사지 않습니다', body: '오늘 많이 오른 종목은 이미 늦었을 수 있습니다. 사고 싶다면 지정가로 낮은 가격에 걸어 두고 기다립니다.' },
  { title: '4. 처음에는 시장가 1주부터', body: '주문 → 체결 → 계좌 확인 → 매도까지 한 바퀴를 1주로 먼저 돌려 봅니다. 흐름을 알고 나서 수량과 지정가를 늘립니다.' },
  { title: '5. 결과를 돌아봅니다', body: '계좌정보의 거래내역에서 왜 샀고 왜 팔았는지 돌아봅니다. 수익보다 "기준을 지켰는가"를 봅니다.' },
];

export const GUIDE_DISCLAIMER = '이 안내는 연습을 돕는 일반적인 원칙이며, 특정 종목을 사라는 권유가 아닙니다. 실제 투자 결과를 보장하지 않습니다.';

// ───────── 5. 모범 답안 (손실을 작게 묶는 주문) ─────────

/** 모범 답안의 기준값. 손실을 없애는 방법은 없으므로 "한 번에 잃는 돈의 상한"을 정한다. */
export const MODEL_RULE = {
  maxWeight: 0.1, // 한 종목은 전체 자산의 10%까지
  stopRate: 0.07, // 산 가격에서 -7%면 판다(손절)
  targetRate: 0.14, // +14%면 판다(목표) → 잃을 때의 2배를 번다
  maxRisk: 0.01, // 한 번 틀려도 전체 자산의 1%까지만 잃는다
  splits: 2, // 2번에 나눠 산다
};

export interface ModelAnswer {
  qty: number; // 이 종목 총 권장 수량
  firstQty: number; // 오늘(1차) 살 수량
  amount: number; // 총 권장 금액
  stopPrice: number;
  targetPrice: number;
  maxLoss: number; // 손절가에 팔 때 잃는 돈(대략)
  expectedGain: number; // 목표가에 팔 때 버는 돈(대략)
  lossPctOfAsset: number; // 최대 손실이 전체 자산에서 차지하는 비율(%)
}

const roundTick = (p: number) => Math.round(p / tickSize(p)) * tickSize(p);

/** 현재가와 내 자산으로 "모범 주문"을 계산한다. 살 수 없으면 qty 0. */
export function modelAnswer(close: number, totalAsset: number, cash: number): ModelAnswer {
  const byWeight = Math.floor((totalAsset * MODEL_RULE.maxWeight) / close);
  const byRisk = Math.floor((totalAsset * MODEL_RULE.maxRisk) / (close * MODEL_RULE.stopRate));
  const qty = close > 0 ? Math.max(0, Math.min(byWeight, byRisk, maxBuyQty(cash, close))) : 0;
  const stopPrice = roundTick(close * (1 - MODEL_RULE.stopRate));
  const targetPrice = roundTick(close * (1 + MODEL_RULE.targetRate));
  const maxLoss = Math.round((close - stopPrice) * qty);
  return {
    qty,
    firstQty: qty <= 1 ? qty : Math.ceil(qty / MODEL_RULE.splits),
    amount: Math.round(close * qty),
    stopPrice,
    targetPrice,
    maxLoss,
    expectedGain: Math.round((targetPrice - close) * qty),
    lossPctOfAsset: totalAsset > 0 ? Math.round((maxLoss / totalAsset) * 1000) / 10 : 0,
  };
}

/** 내 매수 수량을 모범 답안과 비교한 한 줄 평가 */
export function compareToModel(qty: number, holdingQty: number, m: ModelAnswer): Issue {
  const total = qty + holdingQty;
  if (m.qty === 0) return { level: 'warn', msg: '지금 자산으로는 이 종목의 모범 수량이 0주입니다.', how: '가격이 더 낮은 종목으로 연습하거나, 사더라도 1주만 사세요.' };
  if (total > m.qty) {
    return {
      level: 'warn',
      msg: `모범 답안(${n(m.qty)}주)보다 ${(total / m.qty).toFixed(1)}배 많습니다.`,
      how: `손절가까지 떨어지면 약 ${n(Math.round((total / m.qty) * m.maxLoss))}원을 잃습니다. "모범 답안대로" 버튼으로 맞출 수 있습니다.`,
    };
  }
  return { level: 'info', msg: `모범 답안 범위 안입니다 (권장 ${n(m.qty)}주 이하).`, how: `손절가 ${n(m.stopPrice)}원을 지키면 손실은 전체 자산의 약 ${m.lossPctOfAsset}% 이내입니다.` };
}

export const MODEL_STEPS: Array<{ title: string; body: string }> = [
  { title: '① 수량: 한 종목은 자산의 10%까지', body: '1억 원이면 한 종목에 최대 1,000만 원. 종목 하나가 반 토막 나도 전체는 5%만 줄어듭니다.' },
  { title: '② 나눠 사기: 오늘은 절반만', body: '권장 수량의 절반만 먼저 사고, 며칠 뒤 흐름을 보고 나머지를 삽니다. 더 떨어졌을 때 싸게 살 기회가 남습니다.' },
  { title: '③ 손절가: 산 가격의 -7%', body: '사자마자 알림에 등록합니다. 닿으면 이유를 따지지 않고 팝니다. 이것이 손실을 작게 묶는 핵심입니다.' },
  { title: '④ 목표가: 산 가격의 +14%', body: '잃을 때(-7%)의 2배를 벌 때 팝니다. 이렇게 하면 3번 중 1번만 맞아도 본전 근처입니다.' },
  { title: '⑤ 한 번의 최대 손실: 자산의 1% 이내', body: '①과 ③을 지키면 한 번 틀려도 약 0.7%만 잃습니다. 10번 연속 틀려도 자산의 93%가 남습니다.' },
];

export const MODEL_HONEST = '손실이 전혀 없는 투자 방법은 없습니다. 모범 답안은 "틀렸을 때 조금만 잃고, 맞았을 때 더 많이 버는" 방법입니다.';
