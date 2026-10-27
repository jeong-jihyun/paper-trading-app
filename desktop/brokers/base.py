"""증권사(또는 모의) 연결 공통 규격. 화면(ui.py)은 이 규격만 보고 동작한다."""
from __future__ import annotations

from dataclasses import dataclass, field
from typing import Dict, List, Optional


@dataclass
class Quote:
    code: str
    name: str
    close: float
    change: float = 0
    rate: float = 0.0
    open: float = 0
    high: float = 0
    low: float = 0
    volume: int = 0


@dataclass
class HoldingRow:
    code: str
    name: str
    qty: int
    avg_price: float
    close: float = 0


@dataclass
class AccountInfo:
    cash: Optional[float]  # None 이면 이 연결에서는 조회 미지원
    holdings: List[HoldingRow] = field(default_factory=list)


@dataclass
class OrderResult:
    ok: bool
    message: str = ""
    order_id: str = ""


@dataclass
class OrderRow:
    id: str
    code: str
    name: str
    side: str
    type: str
    qty: int
    price: Optional[float]
    status: str
    created_at: int
    fill_price: Optional[float] = None
    realized_pnl: Optional[int] = None


class Broker:
    """모든 연결이 지켜야 할 기능 목록."""

    name = "base"
    is_real = False
    supports_alerts = True

    def quotes(self) -> Dict[str, Quote]:
        raise NotImplementedError

    def quote(self, code: str) -> Optional[Quote]:
        return self.quotes().get(code)

    def refresh(self) -> None:
        """시세를 새로 가져온다(실제 연결) 또는 가상 변동을 적용한다(모의)."""

    def account(self) -> AccountInfo:
        raise NotImplementedError

    def place_order(self, side: str, code: str, qty: int, price: Optional[float]) -> OrderResult:
        raise NotImplementedError

    def cancel_order(self, order_id: str) -> bool:
        return False

    def pending_orders(self) -> List[OrderRow]:
        return []

    def order_history(self) -> List[OrderRow]:
        return []
