"""모의투자 연결. 실제 증권사에 연결하지 않고, 계좌·주문은 내 PC의 JSON 파일에 저장한다."""
from __future__ import annotations

import json
import os
import random
import time
import uuid
from typing import Dict, List, Optional

from trading_core import (
    INITIAL_CASH,
    Holding,
    check_alert,
    compute_fill,
    limit_fill_price,
)

from .base import AccountInfo, Broker, HoldingRow, OrderResult, OrderRow, Quote

DEFAULT_STATE = os.path.join(os.path.expanduser("~"), ".mock_trading", "state.json")
SAMPLE_PATH = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data", "sample_quotes.json")


class MockBroker(Broker):
    name = "모의투자 (샘플 시세)"
    is_real = False

    def __init__(self, state_path: str = DEFAULT_STATE, quotes_path: str = SAMPLE_PATH, seed: Optional[int] = None):
        self.state_path = state_path
        self._rng = random.Random(seed)
        with open(quotes_path, encoding="utf-8") as f:
            data = json.load(f)
        self.notice = data.get("notice", "")
        self._quotes: Dict[str, Quote] = {q["code"]: Quote(**q) for q in data["quotes"]}
        self.state = self._load()

    # ---------- 저장/불러오기 ----------
    def _load(self) -> dict:
        if os.path.exists(self.state_path):
            try:
                with open(self.state_path, encoding="utf-8") as f:
                    return json.load(f)
            except (OSError, json.JSONDecodeError):
                pass
        return {"cash": INITIAL_CASH, "holdings": {}, "orders": [], "watchlist": [], "alerts": [], "notifications": []}

    def save(self) -> None:
        os.makedirs(os.path.dirname(self.state_path), exist_ok=True)
        with open(self.state_path, "w", encoding="utf-8") as f:
            json.dump(self.state, f, ensure_ascii=False, indent=1)

    # ---------- 시세 ----------
    def quotes(self) -> Dict[str, Quote]:
        return self._quotes

    def set_close(self, code: str, close: float) -> None:
        """테스트·시뮬레이션용: 종가를 바꾸고 대비/등락률/고저가를 맞춘다."""
        q = self._quotes[code]
        prev = q.close - q.change
        q.close = close
        q.change = close - prev
        q.rate = round(q.change / prev * 100, 2) if prev else 0
        q.high = max(q.high, close)
        q.low = min(q.low, close)

    def refresh(self) -> None:
        """가상 시세 변동(±0.5% 이내). 대기 주문 체결과 알림 검사까지 함께 한다."""
        for code, q in self._quotes.items():
            self.set_close(code, max(1, round(q.close * (1 + self._rng.uniform(-0.005, 0.005)) / 10) * 10))
        self.process_pending()

    # ---------- 계좌 ----------
    def account(self) -> AccountInfo:
        rows = []
        for code, h in self.state["holdings"].items():
            q = self._quotes.get(code)
            rows.append(HoldingRow(code, h["name"], h["qty"], h["avg_price"], q.close if q else 0))
        return AccountInfo(cash=self.state["cash"], holdings=rows)

    # ---------- 주문 ----------
    def _holding(self, code: str) -> Optional[Holding]:
        h = self.state["holdings"].get(code)
        return Holding(h["qty"], h["avg_price"]) if h else None

    def _apply(self, order: dict, price: float) -> OrderResult:
        res = compute_fill(self.state["cash"], self._holding(order["code"]), order["side"], order["qty"], price)
        if not res.ok:
            order.update(status="rejected", reason=res.reason)
            return OrderResult(False, res.reason, order["id"])
        self.state["cash"] = res.cash
        if res.holding is None:
            self.state["holdings"].pop(order["code"], None)
        else:
            self.state["holdings"][order["code"]] = {
                "name": order["name"],
                "qty": res.holding.qty,
                "avg_price": res.holding.avg_price,
            }
        order.update(status="filled", fill_price=price, filled_at=int(time.time() * 1000), realized_pnl=res.realized_pnl)
        return OrderResult(True, "체결되었습니다.", order["id"])

    def place_order(self, side: str, code: str, qty: int, price: Optional[float]) -> OrderResult:
        q = self._quotes.get(code)
        if q is None:
            return OrderResult(False, "종목을 찾을 수 없습니다.")
        order = {
            "id": uuid.uuid4().hex[:10],
            "code": code,
            "name": q.name,
            "side": side,
            "type": "market" if price is None else "limit",
            "qty": qty,
            "price": price,
            "status": "pending",
            "created_at": int(time.time() * 1000),
        }
        self.state["orders"].append(order)
        if price is None:
            result = self._apply(order, q.close)  # 시장가: 현재(최근 종가)로 즉시 체결
        else:
            # 바로 체결 가능한 가격이면 즉시, 아니면 대기
            fill = limit_fill_price(side, price, q.close, q.close, q.close)
            if fill is None:
                # 예수금·수량은 미리 검사해서 안 되는 주문은 대기시키지 않는다
                check = compute_fill(self.state["cash"], self._holding(code), side, qty, price)
                if not check.ok:
                    order.update(status="rejected", reason=check.reason)
                    result = OrderResult(False, check.reason, order["id"])
                else:
                    result = OrderResult(True, "지정가 주문이 접수되었습니다(대기).", order["id"])
            else:
                result = self._apply(order, fill)
        self.save()
        return result

    def process_pending(self) -> int:
        n = 0
        for order in self.state["orders"]:
            if order["status"] != "pending":
                continue
            q = self._quotes.get(order["code"])
            if q is None:
                continue
            fill = limit_fill_price(order["side"], order["price"], q.close, q.close, q.close)
            if fill is not None:
                self._apply(order, fill)
                n += 1
        if n:
            self.save()
        return n

    def cancel_order(self, order_id: str) -> bool:
        for order in self.state["orders"]:
            if order["id"] == order_id and order["status"] == "pending":
                order["status"] = "canceled"
                self.save()
                return True
        return False

    def _row(self, o: dict) -> OrderRow:
        return OrderRow(
            o["id"], o["code"], o["name"], o["side"], o["type"], o["qty"], o.get("price"),
            o["status"], o["created_at"], o.get("fill_price"), o.get("realized_pnl"),
        )

    def pending_orders(self) -> List[OrderRow]:
        return [self._row(o) for o in self.state["orders"] if o["status"] == "pending"]

    def order_history(self) -> List[OrderRow]:
        return [self._row(o) for o in reversed(self.state["orders"]) if o["status"] != "pending"]

    # ---------- 관심종목 ----------
    def watchlist(self) -> List[str]:
        return list(self.state["watchlist"])

    def toggle_watch(self, code: str) -> bool:
        wl = self.state["watchlist"]
        if code in wl:
            wl.remove(code)
            on = False
        else:
            wl.append(code)
            on = True
        self.save()
        return on

    # ---------- 알림 ----------
    def alerts(self) -> List[dict]:
        return [a for a in self.state["alerts"]]

    def add_alert(self, code: str, target: Optional[float], stop: Optional[float]) -> None:
        q = self._quotes[code]
        self.state["alerts"].append(
            {"id": uuid.uuid4().hex[:8], "code": code, "name": q.name, "target": target, "stop": stop, "active": True}
        )
        self.save()

    def remove_alert(self, alert_id: str) -> None:
        self.state["alerts"] = [a for a in self.state["alerts"] if a["id"] != alert_id]
        self.save()

    def check_alerts(self) -> List[str]:
        """조건에 닿은 알림을 한 번만 알려 주고 비활성화한다."""
        out = []
        for a in self.state["alerts"]:
            if not a["active"]:
                continue
            q = self._quotes.get(a["code"])
            hit = check_alert(q.close, a["target"], a["stop"]) if q else None
            if hit:
                a["active"] = False
                label = "목표가 도달" if hit == "target" else "손절가 이탈"
                msg = f"[{label}] {a['name']} 현재가 {q.close:,.0f}원"
                self.state["notifications"].append({"at": int(time.time() * 1000), "text": msg})
                out.append(msg)
        if out:
            self.save()
        return out

    def notifications(self) -> List[dict]:
        return list(reversed(self.state["notifications"]))
