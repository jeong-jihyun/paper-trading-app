# 모의투자 트레이더 - 데스크톱 프로그램 (파이썬 · 윈폼 스타일)

tkinter로 만든 윈도우 형태의 모의투자 프로그램입니다. 화면은 `ui.py`, 증권사 연결은 `brokers/`로 나뉘어 있어 연결 방식을 바꿔도 화면은 그대로 씁니다.

```
desktop/
├─ main.py            실행 파일
├─ ui.py              화면 (관심종목·현재가 / 주문 / 계좌정보 / 종목발굴·알림)
├─ trading_core.py    체결·수수료·손익 계산 (모바일 앱과 같은 규칙)
├─ brokers/
│  ├─ base.py         연결 공통 규격
│  ├─ mock.py         모의투자 (기본, JSON 파일 저장)
│  └─ cybos.py        대신증권 CYBOS Plus (윈도우 전용)
├─ data/sample_quotes.json   샘플 시세 20종목 (실제 시세 아님)
└─ tests/test_core.py
```

## 실행
- 모의투자: `python main.py`
- 시험: `python -m unittest discover -s tests`

## 대신증권 CYBOS Plus 연결 (선택)
대신증권 CYBOS Plus 자료실의 파이썬 예제 패턴을 따라 만들었습니다.

| 기능 | COM 객체 | 확인한 패턴 |
|---|---|---|
| 연결 확인 | `CpUtil.CpCybos` | `IsConnect == 0`이면 미연결 |
| 주문 초기화 | `CpTrade.CpTdUtil` | `TradeInit(0)`, `AccountNumber[0]`, `GoodsList(acc, 1)` |
| 현재가 | `CpSysDib.MarketEye` | 요청 `[0,1,2,3,4,10,17]` → 응답 0=코드 3=대비 4=현재가 5=거래량 6=종목명 |
| 잔고 | `CpTrade.CpTd6033` | 헤더 7=건수, 데이터 0=종목명 7=수량 12=코드 17=장부단가 |
| 주문 | `CpTrade.CpTd0311` | 0=매수/매도 1=계좌 2=상품 3=코드 4=수량 5=단가 7=조건 8=호가구분 |
| 에러 | 모든 요청 | `BlockRequest()` 반환값 ≠ 0이면 실패(4는 요청 제한), 이어서 `GetDibStatus()`/`GetDibMsg1()` |

준비: 윈도우 + 대신증권 계좌 + CYBOS Plus 로그인 + `pip install pywin32` + **관리자 권한** 터미널
```
python main.py --cybos                       # 시세·잔고 조회만 (주문은 막혀 있음)
python main.py --cybos --allow-real-orders   # 실제 주문 허용 (주문 때마다 확인창)
```
**꼭 알아 두세요**
- 이 연결은 리눅스 개발 환경에서 **실행해 보지 못했습니다.** 자료실 예제와 대조해 작성했으며, 예제에서 확인되지 않은 부분(매도 구분 코드 `"1"`, 예수금 조회, 시장가 호가구분 코드)은 "미확인"으로 두었습니다.
- 그래서 실계좌 연결은 **시세·잔고 조회부터** 확인하고, 주문은 소액 지정가로만 시험하세요. 시장가 주문과 예수금 표시는 지원하지 않습니다.
- 실시간 구독(`StockCur`, `CpConclusion`)은 넣지 않고 새로고침 방식으로 구현했습니다. 실시간을 쓸 때는 자료실 예제처럼 `Request`+이벤트 방식이 필요합니다(`BlockRequest`는 실시간 수신 중 실패할 수 있음).
- 알림 기능은 모의 연결에서만 동작합니다.
