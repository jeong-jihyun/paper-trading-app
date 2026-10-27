import { checkAlert, computeFill, evaluate, isOrderEligible, limitFillPrice } from './trading';

describe('computeFill 매수', () => {
  it('수수료를 포함해 예수금을 차감하고 평균단가를 계산한다', () => {
    const r = computeFill({ cash: 1_000_000, holding: null, side: 'buy', qty: 10, price: 10_000 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.amount).toBe(100_000);
    expect(r.fee).toBe(15); // 0.015%
    expect(r.cash).toBe(1_000_000 - 100_000 - 15);
    expect(r.holding).toEqual({ qty: 10, avgPrice: 10_000 });
  });

  it('추가 매수하면 평균단가가 이동평균으로 바뀐다', () => {
    const r = computeFill({
      cash: 1_000_000,
      holding: { qty: 10, avgPrice: 10_000 },
      side: 'buy',
      qty: 10,
      price: 12_000,
    });
    expect(r.ok && r.holding).toEqual({ qty: 20, avgPrice: 11_000 });
  });

  it('예수금이 부족하면 거부한다', () => {
    const r = computeFill({ cash: 50_000, holding: null, side: 'buy', qty: 10, price: 10_000 });
    expect(r).toEqual({ ok: false, reason: '예수금이 부족합니다.' });
  });

  it('수량이 0이거나 소수면 거부한다', () => {
    expect(computeFill({ cash: 1e9, holding: null, side: 'buy', qty: 0, price: 1000 }).ok).toBe(false);
    expect(computeFill({ cash: 1e9, holding: null, side: 'buy', qty: 1.5, price: 1000 }).ok).toBe(false);
  });
});

describe('computeFill 매도', () => {
  it('수수료·거래세를 빼고 실현손익을 계산한다', () => {
    const r = computeFill({
      cash: 0,
      holding: { qty: 10, avgPrice: 10_000 },
      side: 'sell',
      qty: 10,
      price: 11_000,
    });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.amount).toBe(110_000);
    expect(r.fee).toBe(16); // floor(16.5)
    expect(r.tax).toBe(198); // floor(198)
    expect(r.cash).toBe(110_000 - 16 - 198);
    expect(r.realizedPnl).toBe(10_000 - 16 - 198);
    expect(r.holding).toBeNull(); // 전량 매도하면 보유 종목 삭제
  });

  it('일부만 팔면 평균단가는 그대로 유지된다', () => {
    const r = computeFill({
      cash: 0,
      holding: { qty: 10, avgPrice: 10_000 },
      side: 'sell',
      qty: 4,
      price: 9_000,
    });
    expect(r.ok && r.holding).toEqual({ qty: 6, avgPrice: 10_000 });
  });

  it('보유 수량보다 많이 팔 수 없다', () => {
    const r = computeFill({ cash: 0, holding: { qty: 3, avgPrice: 1000 }, side: 'sell', qty: 4, price: 1000 });
    expect(r).toEqual({ ok: false, reason: '보유 수량이 부족합니다.' });
    expect(computeFill({ cash: 0, holding: null, side: 'sell', qty: 1, price: 1000 }).ok).toBe(false);
  });
});

describe('limitFillPrice', () => {
  const bar = { open: 100, high: 110, low: 95 };
  it('매수: 저가가 지정가보다 높으면 체결 안 됨', () => {
    expect(limitFillPrice('buy', 90, bar)).toBeNull();
  });
  it('매수: 시가가 지정가 이하이면 시가로, 아니면 지정가로 체결', () => {
    expect(limitFillPrice('buy', 105, bar)).toBe(100);
    expect(limitFillPrice('buy', 98, bar)).toBe(98);
  });
  it('매도: 고가가 지정가보다 낮으면 체결 안 됨', () => {
    expect(limitFillPrice('sell', 120, bar)).toBeNull();
  });
  it('매도: 시가가 지정가 이상이면 시가로, 아니면 지정가로 체결', () => {
    expect(limitFillPrice('sell', 98, bar)).toBe(100);
    expect(limitFillPrice('sell', 108, bar)).toBe(108);
  });
});

describe('isOrderEligible', () => {
  // 2026-10-27 10:00 KST = 2026-10-27 01:00 UTC
  const morning = Date.UTC(2026, 9, 27, 1, 0);
  // 2026-10-27 20:00 KST = 2026-10-27 11:00 UTC
  const evening = Date.UTC(2026, 9, 27, 11, 0);
  it('시세 날짜보다 전날 낸 주문은 체결 가능', () => {
    expect(isOrderEligible(morning, '20261028')).toBe(true);
  });
  it('시세 당일 장중에 낸 주문은 체결 가능, 장 마감 후 주문은 불가', () => {
    expect(isOrderEligible(morning, '20261027')).toBe(true);
    expect(isOrderEligible(evening, '20261027')).toBe(false);
  });
  it('시세 날짜보다 나중에 낸 주문은 불가', () => {
    expect(isOrderEligible(evening, '20261026')).toBe(false);
  });
});

describe('evaluate / checkAlert', () => {
  it('평가손익과 수익률을 계산한다', () => {
    expect(evaluate(10, 10_000, 11_000)).toEqual({
      buyAmount: 100_000,
      evalAmount: 110_000,
      pnl: 10_000,
      rate: 10,
    });
  });
  it('목표가 도달과 손절가 이탈을 구분한다', () => {
    expect(checkAlert(120, 100, 80)).toBe('target');
    expect(checkAlert(70, 100, 80)).toBe('stop');
    expect(checkAlert(90, 100, 80)).toBeNull();
    expect(checkAlert(90, null, null)).toBeNull();
  });
});
