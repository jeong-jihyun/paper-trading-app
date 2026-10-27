// 데모 전용 샘플 데이터. 실제 시세가 아니며 코드·종목명만 실제 종목이고 가격은 임의값이다.
/* eslint-disable @typescript-eslint/no-explicit-any */
const ROWS: Array<[string, string, 'KOSPI' | 'KOSDAQ', number, number, number[], number]> = [
  ['005930', '삼성전자', 'KOSPI', 71200, -300, [71500, 71800, 70900], 12000000],
  ['000660', 'SK하이닉스', 'KOSPI', 182000, 2500, [179500, 183000, 178800], 3100000],
  ['035420', 'NAVER', 'KOSPI', 212500, -1500, [214000, 215500, 211000], 540000],
  ['035720', '카카오', 'KOSPI', 41850, 350, [41500, 42100, 41300], 1900000],
  ['005380', '현대차', 'KOSPI', 245000, 1000, [244000, 246500, 243000], 420000],
  ['051910', 'LG화학', 'KOSPI', 318000, -4000, [322000, 324000, 316500], 260000],
  ['006400', '삼성SDI', 'KOSPI', 298500, 3500, [295000, 300000, 294000], 310000],
  ['105560', 'KB금융', 'KOSPI', 84300, 600, [83700, 84800, 83500], 720000],
  ['247540', '에코프로비엠', 'KOSDAQ', 118400, -2100, [120500, 121000, 117800], 890000],
  ['086520', '에코프로', 'KOSDAQ', 72300, 1300, [71000, 73000, 70500], 1500000],
  ['196170', '알테오젠', 'KOSDAQ', 291000, 9000, [282000, 293000, 281000], 520000],
  ['028300', 'HLB', 'KOSDAQ', 64800, -1200, [66000, 66500, 64200], 1100000],
  ['263750', '펄어비스', 'KOSDAQ', 34150, 450, [33700, 34500, 33500], 260000],
];

export function seed(): Record<string, any> {
  const out: Record<string, any> = {};
  const items: Record<string, any[]> = { KOSPI: [], KOSDAQ: [] };
  let rnd = 7;
  const rand = () => ((rnd = (rnd * 9301 + 49297) % 233280) / 233280);
  for (const [c, n, m, p, g, [o, h, l], q] of ROWS) {
    items[m].push({ c, n, m, p, g, r: Math.round((g / (p - g)) * 10000) / 100, o, h, l, q, d: '20261027' });
    // 일봉 60일 (임의 흐름)
    let v = p * 0.9;
    const points = [];
    for (let i = 0; i < 60; i++) {
      v = Math.max(1000, v * (1 + (rand() - 0.46) * 0.03));
      points.push({ d: `2026${String(8 + Math.floor(i / 30)).padStart(2, '0')}${String((i % 30) + 1).padStart(2, '0')}`, c: Math.round(v) });
    }
    const k = p / points[59].c; // 마지막 값이 현재가에 맞도록 전체를 같은 비율로 조정
    for (const pt of points) pt.c = Math.round(pt.c * k);
    points[59] = { d: '20261027', c: p };
    out[`history/${c}`] = { points };
  }
  out['market/KOSPI'] = { items: items.KOSPI };
  out['market/KOSDAQ'] = { items: items.KOSDAQ };

  const u = 'users/demo-user';
  const now = Date.now();
  out[u] = { cash: 84_250_000, initialCash: 100_000_000, createdAt: now };
  out[`${u}/holdings/005930`] = { code: '005930', name: '삼성전자', qty: 100, avgPrice: 69800 };
  out[`${u}/holdings/000660`] = { code: '000660', name: 'SK하이닉스', qty: 30, avgPrice: 175000 };
  out[`${u}/holdings/196170`] = { code: '196170', name: '알테오젠', qty: 10, avgPrice: 305000 };
  out[`${u}/watchlist/005930`] = { code: '005930', name: '삼성전자', addedAt: now - 5 };
  out[`${u}/watchlist/035720`] = { code: '035720', name: '카카오', addedAt: now - 4 };
  out[`${u}/watchlist/247540`] = { code: '247540', name: '에코프로비엠', addedAt: now - 3 };
  out[`${u}/watchlist/263750`] = { code: '263750', name: '펄어비스', addedAt: now - 2 };
  out[`${u}/orders/o1`] = { code: '005930', name: '삼성전자', side: 'buy', type: 'market', qty: 100, limitPrice: null, status: 'filled', createdAt: now - 86400000 * 3, fillPrice: 69800, realizedPnl: 0 };
  out[`${u}/orders/o2`] = { code: '000660', name: 'SK하이닉스', side: 'buy', type: 'limit', qty: 30, limitPrice: 175000, status: 'filled', createdAt: now - 86400000 * 2, fillPrice: 175000, realizedPnl: 0 };
  out[`${u}/orders/o3`] = { code: '035720', name: '카카오', side: 'buy', type: 'limit', qty: 50, limitPrice: 40000, status: 'pending', createdAt: now - 3600000 };
  out[`${u}/alerts/a1`] = { code: '005930', name: '삼성전자', targetPrice: 75000, stopPrice: 68000, active: true };
  out[`${u}/notifications/n1`] = { title: '알테오젠 목표가 도달', body: '기준일 종가 291,000원', createdAt: now - 7200000 };
  return out;
}
