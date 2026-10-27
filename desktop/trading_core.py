"""모의 체결 계산 (순수 함수). 모바일 앱의 app/src/utils/trading.ts 와 같은 규칙이다."""
from __future__ import annotations

import math
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Optional

FEE_RATE = 0.00015  # 매수·매도 수수료율 (0.015%) - 가정값
SELL_TAX_RATE = 0.0018  # 매도 거래세율 (0.18%) - 가정값
INITIAL_CASH = 100_000_000


def round_half_up(x: float) -> int:
    return int(math.floor(x + 0.5))


def rate_amount(amount: int, rate: float) -> int:
    """금액 x 비율을 원 단위로 내림. 부동소수점 오차(14.999999...)를 먼저 걷어 낸다."""
    return int(math.floor(round(amount * rate * 1e6) / 1e6))


@dataclass
class Holding:
    qty: int
    avg_price: float


@dataclass
class FillResult:
    ok: bool
    reason: str = ""
    cash: float = 0
    holding: Optional[Holding] = None  # None 이면 보유 종목 삭제
    amount: int = 0
    fee: int = 0
    tax: int = 0
    realized_pnl: int = 0


def compute_fill(cash: float, holding: Optional[Holding], side: str, qty: int, price: float) -> FillResult:
    if not isinstance(qty, int) or qty <= 0:
        return FillResult(False, "수량은 1 이상의 정수여야 합니다.")
    if not price > 0:
        return FillResult(False, "가격이 올바르지 않습니다.")

    amount = round_half_up(price * qty)
    fee = rate_amount(amount, FEE_RATE)

    if side == "buy":
        total = amount + fee
        if cash < total:
            return FillResult(False, "예수금이 부족합니다.")
        old_qty = holding.qty if holding else 0
        old_avg = holding.avg_price if holding else 0
        new_qty = old_qty + qty
        new_avg = round_half_up(((old_qty * old_avg + amount) / new_qty) * 100) / 100
        return FillResult(True, cash=cash - total, holding=Holding(new_qty, new_avg), amount=amount, fee=fee)

    if holding is None or holding.qty < qty:
        return FillResult(False, "보유 수량이 부족합니다.")
    tax = rate_amount(amount, SELL_TAX_RATE)
    pnl = round_half_up((price - holding.avg_price) * qty) - fee - tax
    remain = holding.qty - qty
    return FillResult(
        True,
        cash=cash + amount - fee - tax,
        holding=None if remain == 0 else Holding(remain, holding.avg_price),
        amount=amount,
        fee=fee,
        tax=tax,
        realized_pnl=pnl,
    )


def limit_fill_price(side: str, limit: float, open_: float, high: float, low: float) -> Optional[float]:
    """지정가가 그날 시세로 체결되는지 판단. 체결 안 되면 None."""
    if side == "buy":
        if low > limit:
            return None
        return open_ if open_ <= limit else limit
    if high < limit:
        return None
    return open_ if open_ >= limit else limit


def check_alert(close: float, target: Optional[float], stop: Optional[float]) -> Optional[str]:
    if target is not None and close >= target:
        return "target"
    if stop is not None and close <= stop:
        return "stop"
    return None


def evaluate(qty: int, avg_price: float, close: float) -> dict:
    buy_amount = round_half_up(qty * avg_price)
    eval_amount = round_half_up(qty * close)
    pnl = eval_amount - buy_amount
    rate = 0.0 if buy_amount == 0 else round_half_up(pnl / buy_amount * 10000) / 100
    return {"buy_amount": buy_amount, "eval_amount": eval_amount, "pnl": pnl, "rate": rate}


def is_order_eligible(created_at_ms: int, bas_dt: str) -> bool:
    kst = datetime.fromtimestamp(created_at_ms / 1000, tz=timezone.utc) + timedelta(hours=9)
    day = kst.strftime("%Y%m%d")
    if day < bas_dt:
        return True
    if day > bas_dt:
        return False
    return kst.hour * 60 + kst.minute < 15 * 60 + 30
