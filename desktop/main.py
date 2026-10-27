"""실행 파일.

  python main.py                      모의투자 (기본, 실제 계좌와 연결되지 않음)
  python main.py --cybos              대신증권 CYBOS Plus 연결 (윈도우, 관리자 권한, CYBOS Plus 로그인 필요)
  python main.py --cybos --allow-real-orders   실제 주문까지 허용 (주문 때마다 확인창이 뜸)
"""
import argparse
import sys


def main() -> int:
    p = argparse.ArgumentParser(description="모의투자 트레이더 (WinForms 스타일)")
    p.add_argument("--cybos", action="store_true", help="대신증권 CYBOS Plus 연결 사용")
    p.add_argument("--allow-real-orders", action="store_true", help="CYBOS 연결에서 실제 주문 허용")
    args = p.parse_args()

    if args.cybos:
        from brokers.cybos import CybosBroker, CybosError

        try:
            broker = CybosBroker(allow_real_orders=args.allow_real_orders)
        except CybosError as e:
            print(f"CYBOS Plus 연결 실패: {e}", file=sys.stderr)
            return 1
    else:
        from brokers.mock import MockBroker

        broker = MockBroker()

    from ui import TradingApp

    TradingApp(broker).mainloop()
    return 0


if __name__ == "__main__":
    sys.exit(main())
