"""대신증권 CYBOS Plus 연결 (윈도우 전용, 사전 준비 필요).

대신증권 CYBOS Plus 자료실의 파이썬 예제 패턴을 따른다.
  - 연결 확인        CpUtil.CpCybos           IsConnect == 0 이면 미연결
  - 주문 초기화      CpTrade.CpTdUtil         TradeInit(0) != 0 이면 실패, AccountNumber[0], GoodsList(acc, 1)
  - 종목명           CpUtil.CpCodeMgr         CodeToName(code)
  - 현재가(여러 종목) CpSysDib.MarketEye       요청 필드 [0,1,2,3,4,10,17] -> 응답 0=코드 3=대비 4=현재가 5=거래량 6=종목명
  - 잔고             CpTrade.CpTd6033         GetHeaderValue(7)=건수, GetDataValue 0=종목명 7=잔고수량 12=코드 17=장부단가
  - 주문             CpTrade.CpTd0311         SetInputValue 0=매수/매도 1=계좌 2=상품 3=코드 4=수량 5=단가 7=조건 8=호가구분
  - 에러 처리        BlockRequest() 반환값 != 0 (4 는 요청 제한 초과), 이어서 GetDibStatus()/GetDibMsg1() 확인

주의
  * 이 파일은 윈도우 + CYBOS Plus 로그인 환경이 아니면 실행할 수 없어, 개발 환경(리눅스)에서는 동작 확인을 하지 못했다.
  * 예제에서 확인되지 않은 것은 "미확인"으로 표시했다. 실제 주문 전에 모의 계좌나 소액으로 먼저 확인할 것.
  * 실제 주문은 allow_real_orders=True 일 때만 나가고, 화면에서 매번 확인창을 거친다.
"""
from __future__ import annotations

import ctypes
import sys
import time
from typing import Dict, List, Optional

from .base import AccountInfo, Broker, HoldingRow, OrderResult, Quote

SIDE_CODE = {"buy": "2", "sell": "1"}  # 예제에서 확인된 값은 매수("2"). 매도("1")는 미확인.


class CybosError(RuntimeError):
    pass


class CybosBroker(Broker):
    name = "대신증권 CYBOS Plus (실계좌)"
    is_real = True
    supports_alerts = False  # 알림은 모의 연결에서만 지원

    def __init__(self, allow_real_orders: bool = False, watch_codes: Optional[List[str]] = None):
        if sys.platform != "win32":
            raise CybosError("CYBOS Plus는 윈도우에서만 사용할 수 있습니다.")
        import win32com.client  # pywin32 필요

        self._com = win32com.client
        if not ctypes.windll.shell32.IsUserAnAdmin():
            raise CybosError("관리자 권한으로 실행해야 합니다.")
        self._cybos = self._com.Dispatch("CpUtil.CpCybos")
        if self._cybos.IsConnect == 0:
            raise CybosError("CYBOS Plus에 연결되어 있지 않습니다. 로그인 후 다시 실행하세요.")
        self._td = self._com.Dispatch("CpTrade.CpTdUtil")
        if self._td.TradeInit(0) != 0:
            raise CybosError("주문 초기화(TradeInit)에 실패했습니다.")
        self._acc = self._td.AccountNumber[0]
        self._flag = self._td.GoodsList(self._acc, 1)
        self._names = self._com.Dispatch("CpUtil.CpCodeMgr")
        self.allow_real_orders = allow_real_orders
        self.watch_codes: List[str] = list(watch_codes or ["A005930", "A000660", "A035420"])
        self._quotes: Dict[str, Quote] = {}
        self.refresh()

    # ---------- 공통: 요청 보내고 에러 확인 ----------
    def _request(self, obj) -> None:
        ret = obj.BlockRequest()
        if ret != 0:
            hint = " (요청 제한 초과: 잠시 후 다시 시도)" if ret == 4 else ""
            raise CybosError(f"BlockRequest 실패: {ret}{hint}")
        status = obj.GetDibStatus()
        if status != 0:
            raise CybosError(f"통신 오류 {status}: {obj.GetDibMsg1()}")

    # ---------- 시세 ----------
    def quotes(self) -> Dict[str, Quote]:
        return self._quotes

    def refresh(self) -> None:
        if not self.watch_codes:
            return
        obj = self._com.Dispatch("CpSysDib.MarketEye")
        obj.SetInputValue(0, [0, 1, 2, 3, 4, 10, 17])
        obj.SetInputValue(1, self.watch_codes)
        self._request(obj)
        for i in range(obj.GetHeaderValue(2)):
            code = obj.GetDataValue(0, i)
            change = obj.GetDataValue(3, i)
            close = obj.GetDataValue(4, i)
            prev = close - change
            self._quotes[code] = Quote(
                code=code,
                name=obj.GetDataValue(6, i) or self._names.CodeToName(code),
                close=close,
                change=change,
                rate=round(change / prev * 100, 2) if prev else 0,
                volume=int(obj.GetDataValue(5, i)),
            )

    def add_watch_code(self, code: str) -> None:
        if code not in self.watch_codes:
            self.watch_codes.append(code)
            self.refresh()

    # ---------- 잔고 ----------
    def account(self) -> AccountInfo:
        obj = self._com.Dispatch("CpTrade.CpTd6033")
        obj.SetInputValue(0, self._acc)
        obj.SetInputValue(1, self._flag[0])
        obj.SetInputValue(2, 50)
        self._request(obj)
        rows = []
        for i in range(obj.GetHeaderValue(7)):
            code = obj.GetDataValue(12, i)
            q = self._quotes.get(code)
            rows.append(
                HoldingRow(code, obj.GetDataValue(0, i), int(obj.GetDataValue(7, i)), float(obj.GetDataValue(17, i)), q.close if q else 0)
            )
        # 예수금 조회는 자료실 예제에서 확인하지 못했다(미확인) -> None
        return AccountInfo(cash=None, holdings=rows)

    # ---------- 주문 ----------
    def place_order(self, side: str, code: str, qty: int, price: Optional[float]) -> OrderResult:
        if not self.allow_real_orders:
            return OrderResult(False, "실거래 주문이 꺼져 있습니다. 실행 옵션 --allow-real-orders 를 켜야 합니다.")
        if price is None:
            return OrderResult(False, "실계좌에서는 지정가 주문만 지원합니다(시장가 호가구분 코드는 미확인).")
        obj = self._com.Dispatch("CpTrade.CpTd0311")
        obj.SetInputValue(0, SIDE_CODE[side])
        obj.SetInputValue(1, self._acc)
        obj.SetInputValue(2, self._flag[0])
        obj.SetInputValue(3, code)
        obj.SetInputValue(4, int(qty))
        obj.SetInputValue(5, int(price))
        obj.SetInputValue(7, "0")  # 주문 조건: 기본
        obj.SetInputValue(8, "01")  # 호가 구분: 보통
        try:
            self._request(obj)
        except CybosError as e:
            return OrderResult(False, str(e))
        time.sleep(0.3)  # 연속 요청 제한을 피하기 위한 짧은 대기
        return OrderResult(True, "주문이 접수되었습니다.")
