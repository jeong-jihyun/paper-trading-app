import { buildSteps, checkAlertInput, checkOrder, maxBuyQty, tickSize, type OrderCheckInput, type Progress } from './guide';

const base: OrderCheckInput = {
  side: 'buy',
  type: 'market',
  qtyText: '1',
  priceText: '',
  close: 70_000,
  rate: 0.5,
  volume: 1_000_000,
  cash: 100_000_000,
  holdingQty: 0,
  holdingAvg: 0,
  totalAsset: 100_000_000,
};
const errs = (i: Partial<OrderCheckInput>) => checkOrder({ ...base, ...i }).issues.filter((x) => x.level === 'error');
const warns = (i: Partial<OrderCheckInput>) => checkOrder({ ...base, ...i }).warnings;

describe('buildSteps', () => {
  const zero: Progress = { watchCount: 0, visitedDetail: false, buyCount: 0, alertCount: 0, visitedAccount: false, sellCount: 0 };
  it('처음에는 1단계가 지금 할 일이다', () => {
    const s = buildSteps(zero);
    expect(s.filter((x) => x.current).map((x) => x.key)).toEqual(['watch']);
    expect(s.every((x) => !x.done)).toBe(true);
  });
  it('끝난 단계는 건너뛰고 첫 미완료 단계를 가리킨다', () => {
    const s = buildSteps({ ...zero, watchCount: 2, visitedDetail: true, buyCount: 1 });
    expect(s.find((x) => x.current)?.key).toBe('alert');
  });
  it('모두 끝나면 지금 할 일이 없다', () => {
    const s = buildSteps({ watchCount: 1, visitedDetail: true, buyCount: 1, alertCount: 1, visitedAccount: true, sellCount: 1 });
    expect(s.every((x) => x.done)).toBe(true);
    expect(s.some((x) => x.current)).toBe(false);
  });
});

describe('checkOrder', () => {
  it('정상 시장가 매수는 통과한다', () => {
    const r = checkOrder(base);
    expect(r.canSubmit).toBe(true);
    expect(r.amount).toBe(70_000);
    expect(r.immediate).toBe(true);
  });
  it('수량이 비었거나 0·소수면 막는다', () => {
    expect(errs({ qtyText: '' })).toHaveLength(1);
    expect(errs({ qtyText: '0' })).toHaveLength(1);
    expect(errs({ qtyText: '1.5' })).toHaveLength(1);
  });
  it('예수금이 부족하면 막고 가능한 수량을 알려준다', () => {
    const e = errs({ cash: 100_000, qtyText: '2' });
    expect(e[0].msg).toContain('예수금이 부족');
    expect(e[0].how).toContain('1주');
  });
  it('보유하지 않은 종목 매도, 보유 초과 매도를 막는다', () => {
    expect(errs({ side: 'sell' })[0].msg).toContain('가지고 있지 않은');
    expect(errs({ side: 'sell', holdingQty: 3, holdingAvg: 60_000, qtyText: '5' })[0].msg).toContain('보유 수량보다');
  });
  it('지정가: 빈 값, 가격제한폭 밖, 호가 단위 위반을 막는다', () => {
    expect(errs({ type: 'limit', priceText: '' })[0].msg).toContain('지정가를 입력');
    expect(errs({ type: 'limit', priceText: '100000' })[0].msg).toContain('가격제한폭');
    const e = errs({ type: 'limit', priceText: '69,950' });
    expect(e[0].msg).toContain('100원 단위');
    expect(e[0].how).toContain('70,000');
  });
  it('지정가가 현재가보다 낮은 매수는 대기 주문이다', () => {
    const r = checkOrder({ ...base, type: 'limit', priceText: '68000' });
    expect(r.canSubmit).toBe(true);
    expect(r.immediate).toBe(false);
    expect(r.price).toBe(68_000);
  });
  it('지정가가 현재가보다 높은 매수는 현재가로 바로 체결된다', () => {
    const r = checkOrder({ ...base, type: 'limit', priceText: '71000' });
    expect(r.immediate).toBe(true);
    expect(r.price).toBe(70_000);
  });
  it('한 종목 30% 초과, 급등 종목은 경고한다', () => {
    expect(warns({ qtyText: '500' })[0].msg).toContain('전체 자산의 약 35%');
    expect(warns({ rate: 20 })[0].msg).toContain('급등');
    expect(warns({})).toHaveLength(0);
  });
  it('손해 보고 파는 매도는 경고한다', () => {
    const w = warns({ side: 'sell', holdingQty: 10, holdingAvg: 80_000, qtyText: '10' });
    expect(w[0].msg).toContain('손실이 확정');
  });
  it('거래량이 적으면 경고한다', () => {
    expect(warns({ volume: 500 })[0].msg).toContain('거래량이 적은');
  });
});

describe('tickSize / maxBuyQty', () => {
  it('가격대별 호가 단위', () => {
    expect([1_500, 3_000, 15_000, 30_000, 70_000, 300_000, 800_000].map(tickSize)).toEqual([1, 5, 10, 50, 100, 500, 1_000]);
  });
  it('수수료까지 포함해 살 수 있는 최대 수량', () => {
    expect(maxBuyQty(100_000, 50_000)).toBe(1); // 2주는 수수료 때문에 부족
    expect(maxBuyQty(0, 50_000)).toBe(0);
  });
});

describe('checkAlertInput', () => {
  it('목표가는 현재가보다 높아야 하고 손절가는 낮아야 한다', () => {
    expect(checkAlertInput(70_000, '60000', '')[0].level).toBe('error');
    expect(checkAlertInput(70_000, '', '80000')[0].level).toBe('error');
    expect(checkAlertInput(70_000, '77000', '65000')).toHaveLength(0);
  });
  it('손절가가 너무 멀면 경고한다', () => {
    expect(checkAlertInput(70_000, '77000', '40000')[0].level).toBe('warn');
  });
});

describe('modelAnswer', () => {
  const { modelAnswer, compareToModel } = require('./guide') as typeof import('./guide');
  it('자산 1억, 7만원 종목: 10% 비중·손절 -7%·목표 +14%', () => {
    const m = modelAnswer(70_000, 100_000_000, 100_000_000);
    expect(m.qty).toBe(142); // 1,000만원 / 7만원
    expect(m.firstQty).toBe(71);
    expect(m.stopPrice).toBe(65_100);
    expect(m.targetPrice).toBe(79_800);
    expect(m.maxLoss).toBe(695_800);
    expect(m.lossPctOfAsset).toBe(0.7);
    expect(m.expectedGain).toBeGreaterThan(m.maxLoss * 1.9);
  });
  it('예수금이 모자라면 살 수 있는 만큼만 권한다', () => {
    expect(modelAnswer(70_000, 100_000_000, 200_000).qty).toBe(2);
  });
  it('모범 수량을 넘으면 경고, 이하면 안내', () => {
    const m = modelAnswer(70_000, 100_000_000, 100_000_000);
    expect(compareToModel(500, 0, m).level).toBe('warn');
    expect(compareToModel(100, 100, m).level).toBe('warn'); // 보유분 포함
    expect(compareToModel(71, 0, m).level).toBe('info');
  });
});
