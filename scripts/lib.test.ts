import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildMarketDocs, decideFill, extractItems, mergeHistory, recentDates } from './lib.js';

const fixture = JSON.parse(readFileSync(new URL('./fixtures/sample-api.json', import.meta.url), 'utf-8'));

test('응답에서 item을 꺼내고 KONEX는 제외한다', () => {
  const items = extractItems(fixture);
  assert.equal(items.length, 4);
  const docs = buildMarketDocs(items);
  assert.equal(docs.KOSPI.length, 2);
  assert.equal(docs.KOSDAQ.length, 1);
  assert.deepEqual(docs.KOSPI[0], { c: '005930', n: '삼성전자', m: 'KOSPI', p: 71200, g: -300, r: -0.42, o: 71500, h: 71800, l: 70900, q: 1200000, d: '20261027' });
});

test('결과가 0건이거나 item이 1개여도 안전하게 처리한다', () => {
  assert.deepEqual(extractItems({ response: { body: { items: '' } } }), []);
  assert.deepEqual(extractItems({}), []);
  const one = { response: { body: { items: { item: fixture.response.body.items.item[0] } } } };
  assert.equal(extractItems(one).length, 1);
});

test('일봉 기록은 같은 날짜를 덮어쓰고 90개까지만 유지한다', () => {
  let h = [{ d: '20261026', c: 100 }];
  h = mergeHistory(h, '20261027', 110);
  h = mergeHistory(h, '20261027', 120);
  assert.deepEqual(h, [{ d: '20261026', c: 100 }, { d: '20261027', c: 120 }]);
  let big: { d: string; c: number }[] = [];
  for (let i = 0; i < 100; i++) big = mergeHistory(big, String(20260000 + i).padStart(8, '0'), i);
  assert.equal(big.length, 90);
  assert.equal(big[89].c, 99);
});

test('대기 주문 체결 판단: 장 마감 후 낸 주문은 당일 시세로 체결되지 않는다', () => {
  const q = { c: 'x', n: 'x', m: 'KOSPI' as const, p: 100, g: 0, r: 0, o: 100, h: 110, l: 95, q: 1, d: '20261027' };
  const morning = Date.UTC(2026, 9, 27, 1, 0); // 10:00 KST
  const evening = Date.UTC(2026, 9, 27, 11, 0); // 20:00 KST
  assert.equal(decideFill({ side: 'buy', type: 'limit', limitPrice: 98, createdAt: morning }, q), 98);
  assert.equal(decideFill({ side: 'buy', type: 'limit', limitPrice: 98, createdAt: evening }, q), null);
  assert.equal(decideFill({ side: 'buy', type: 'limit', limitPrice: 90, createdAt: morning }, q), null);
  assert.equal(decideFill({ side: 'sell', type: 'limit', limitPrice: 105, createdAt: morning }, q), 105);
});

test('recentDates는 한국시간 기준 날짜를 거꾸로 나열한다', () => {
  // 2026-10-27 16:00 UTC = 2026-10-28 01:00 KST
  assert.deepEqual(recentDates(new Date(Date.UTC(2026, 9, 27, 16, 0)), 3), ['20261028', '20261027', '20261026']);
});
