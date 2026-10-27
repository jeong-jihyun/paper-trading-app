import os
import sys
import tempfile
import unittest

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from brokers.mock import MockBroker  # noqa: E402
from trading_core import (  # noqa: E402
    Holding,
    check_alert,
    compute_fill,
    evaluate,
    is_order_eligible,
    limit_fill_price,
)
import calendar  # noqa: E402


def ms(y, mo, d, h, mi):  # UTC -> ms
    return calendar.timegm((y, mo, d, h, mi, 0)) * 1000


class CoreTest(unittest.TestCase):
    def test_buy(self):
        r = compute_fill(1_000_000, None, "buy", 10, 10_000)
        self.assertTrue(r.ok)
        self.assertEqual((r.amount, r.fee, r.cash), (100_000, 15, 1_000_000 - 100_015))
        self.assertEqual((r.holding.qty, r.holding.avg_price), (10, 10_000))

    def test_buy_more_moving_average(self):
        r = compute_fill(1_000_000, Holding(10, 10_000), "buy", 10, 12_000)
        self.assertEqual((r.holding.qty, r.holding.avg_price), (20, 11_000))

    def test_buy_rejected(self):
        self.assertEqual(compute_fill(50_000, None, "buy", 10, 10_000).reason, "예수금이 부족합니다.")
        self.assertFalse(compute_fill(1e9, None, "buy", 0, 1000).ok)
        self.assertFalse(compute_fill(1e9, None, "buy", 1.5, 1000).ok)

    def test_sell(self):
        r = compute_fill(0, Holding(10, 10_000), "sell", 10, 11_000)
        self.assertEqual((r.fee, r.tax), (16, 198))
        self.assertEqual(r.cash, 110_000 - 16 - 198)
        self.assertEqual(r.realized_pnl, 10_000 - 16 - 198)
        self.assertIsNone(r.holding)

    def test_sell_partial_and_over(self):
        r = compute_fill(0, Holding(10, 10_000), "sell", 4, 9_000)
        self.assertEqual((r.holding.qty, r.holding.avg_price), (6, 10_000))
        self.assertEqual(compute_fill(0, Holding(3, 1000), "sell", 4, 1000).reason, "보유 수량이 부족합니다.")
        self.assertFalse(compute_fill(0, None, "sell", 1, 1000).ok)

    def test_limit_fill_price(self):
        self.assertIsNone(limit_fill_price("buy", 90, 100, 110, 95))
        self.assertEqual(limit_fill_price("buy", 105, 100, 110, 95), 100)
        self.assertEqual(limit_fill_price("buy", 98, 100, 110, 95), 98)
        self.assertIsNone(limit_fill_price("sell", 120, 100, 110, 95))
        self.assertEqual(limit_fill_price("sell", 98, 100, 110, 95), 100)
        self.assertEqual(limit_fill_price("sell", 108, 100, 110, 95), 108)

    def test_order_eligible(self):
        morning = ms(2026, 10, 27, 1, 0)  # 10:00 KST
        evening = ms(2026, 10, 27, 11, 0)  # 20:00 KST
        self.assertTrue(is_order_eligible(morning, "20261028"))
        self.assertTrue(is_order_eligible(morning, "20261027"))
        self.assertFalse(is_order_eligible(evening, "20261027"))
        self.assertFalse(is_order_eligible(evening, "20261026"))

    def test_evaluate_alert(self):
        self.assertEqual(evaluate(10, 10_000, 11_000), {"buy_amount": 100_000, "eval_amount": 110_000, "pnl": 10_000, "rate": 10.0})
        self.assertEqual(check_alert(120, 100, 80), "target")
        self.assertEqual(check_alert(70, 100, 80), "stop")
        self.assertIsNone(check_alert(90, 100, 80))


class MockBrokerTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.b = MockBroker(state_path=os.path.join(self.tmp.name, "state.json"))

    def tearDown(self):
        self.tmp.cleanup()

    def test_market_buy_then_sell_updates_account(self):
        code = next(iter(self.b.quotes()))
        price = self.b.quote(code).close
        r = self.b.place_order("buy", code, 5, None)
        self.assertTrue(r.ok, r.message)
        acc = self.b.account()
        self.assertEqual(acc.holdings[0].qty, 5)
        self.assertLess(acc.cash, 100_000_000)
        r2 = self.b.place_order("sell", code, 5, None)
        self.assertTrue(r2.ok, r2.message)
        self.assertEqual(self.b.account().holdings, [])
        self.assertEqual(price, self.b.quote(code).close)

    def test_limit_order_pending_then_filled_on_price_move(self):
        code = next(iter(self.b.quotes()))
        q = self.b.quote(code)
        limit = q.close - 1000  # 현재가보다 낮은 매수 지정가 -> 대기
        r = self.b.place_order("buy", code, 1, limit)
        self.assertTrue(r.ok)
        self.assertEqual(len(self.b.pending_orders()), 1)
        self.b.set_close(code, limit - 10)  # 가격이 내려오면 체결
        self.b.process_pending()
        self.assertEqual(len(self.b.pending_orders()), 0)
        self.assertEqual(self.b.account().holdings[0].qty, 1)

    def test_cancel_and_reject(self):
        code = next(iter(self.b.quotes()))
        q = self.b.quote(code)
        r = self.b.place_order("buy", code, 1, q.close - 1000)
        self.assertTrue(self.b.cancel_order(r.order_id))
        self.assertEqual(len(self.b.pending_orders()), 0)
        self.assertFalse(self.b.place_order("sell", code, 1, None).ok)  # 보유 없음
        self.assertFalse(self.b.place_order("buy", code, 10**9, None).ok)  # 예수금 부족

    def test_alert_triggers_once(self):
        code = next(iter(self.b.quotes()))
        q = self.b.quote(code)
        self.b.add_alert(code, q.close + 100, None)
        self.b.set_close(code, q.close + 200)
        notes = self.b.check_alerts()
        self.assertEqual(len(notes), 1)
        self.assertEqual(self.b.check_alerts(), [])


if __name__ == "__main__":
    unittest.main()
