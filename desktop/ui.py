"""WinForms 스타일 데스크톱 화면 (tkinter). 대신증권 CYBOS Touch 메뉴 구성을 따른다.
탭: 관심종목·현재가 / 주문 / 계좌정보 / 종목발굴·알림
"""
from __future__ import annotations

import sys
import time
import tkinter as tk
import tkinter.font as tkfont
from tkinter import messagebox, ttk
from typing import List, Optional

from brokers.base import Broker
from trading_core import evaluate

UP, DOWN, FLAT = "#E5383B", "#2F6FEB", "#6B7280"
MOCK_NOTICE = "모의투자이며 실제 거래가 아닙니다."


def won(n: float) -> str:
    return f"{round(n):,}"


def signed(n: float) -> str:
    return f"{'+' if n > 0 else ''}{won(n)}"


def pct(n: float) -> str:
    return f"{'+' if n > 0 else ''}{n:.2f}%"


def tag_for(n: float) -> str:
    return "up" if n > 0 else "down" if n < 0 else "flat"


FONT_CANDIDATES = ["Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "NanumGothic", "Noto Sans CJK KR", "Noto Sans KR", "Noto Sans CJK JP"]


def apply_korean_font(root: tk.Misc, size: int = 10) -> None:
    """한글이 깨지지 않도록 화면 전체 글꼴을 한글 글꼴로 맞춘다 (윈도우는 맑은 고딕)."""
    available = {f.lower(): f for f in tkfont.families(root)}  # 글꼴 이름 대소문자는 환경마다 달라서 소문자로 비교
    family = next((available[c.lower()] for c in FONT_CANDIDATES if c.lower() in available), None)
    if family is None:
        return
    for name in ("TkDefaultFont", "TkTextFont", "TkMenuFont", "TkHeadingFont", "TkCaptionFont", "TkSmallCaptionFont", "TkTooltipFont"):
        try:
            tkfont.nametofont(name).configure(family=family, size=size)
        except tk.TclError:
            pass
    root.option_add("*Font", (family, size))


def make_tree(parent, columns, widths, height=12) -> ttk.Treeview:
    tree = ttk.Treeview(parent, columns=[c for c, _ in columns], show="headings", height=height)
    for (cid, title), w in zip(columns, widths):
        tree.heading(cid, text=title)
        tree.column(cid, width=w, anchor="w" if cid in ("name", "code") else "e")
    tree.tag_configure("up", foreground=UP)
    tree.tag_configure("down", foreground=DOWN)
    tree.tag_configure("flat", foreground=FLAT)
    sb = ttk.Scrollbar(parent, orient="vertical", command=tree.yview)
    tree.configure(yscrollcommand=sb.set)
    tree.pack(side="left", fill="both", expand=True)
    sb.pack(side="left", fill="y")
    return tree


class TradingApp(tk.Tk):
    def __init__(self, broker: Broker):
        super().__init__()
        self.broker = broker
        self.title("모의투자 트레이더" if not broker.is_real else "CYBOS Plus 트레이딩 (실계좌)")
        self.geometry("1000x680")
        self.minsize(900, 600)
        style = ttk.Style(self)
        style.theme_use("vista" if sys.platform == "win32" and "vista" in style.theme_names() else "clam")
        apply_korean_font(self)
        style.configure("Treeview", rowheight=24)

        self._build_menu()
        self._build_header()
        # 상태 표시줄을 먼저 아래쪽에 배치해야, 창이 작아져도 잘리지 않는다
        self.status = tk.StringVar(value="준비되었습니다.")
        ttk.Label(self, textvariable=self.status, relief="sunken", anchor="w").pack(fill="x", side="bottom")
        self.nb = ttk.Notebook(self)
        self.nb.pack(fill="both", expand=True, padx=8, pady=4)
        self._build_watch_tab()
        self._build_order_tab()
        self._build_account_tab()
        self._build_discover_tab()

        self.refresh_all()

    # ---------- 공통 ----------
    def _build_menu(self) -> None:
        menubar = tk.Menu(self)
        m = tk.Menu(menubar, tearoff=0)
        m.add_command(label="새로고침", command=self.refresh_all, accelerator="F5")
        m.add_separator()
        m.add_command(label="종료", command=self.destroy)
        menubar.add_cascade(label="파일", menu=m)
        h = tk.Menu(menubar, tearoff=0)
        h.add_command(label="정보", command=lambda: messagebox.showinfo("정보", f"{self.broker.name}\n{MOCK_NOTICE if not self.broker.is_real else '실계좌 연결 모드입니다.'}"))
        menubar.add_cascade(label="도움말", menu=h)
        self.config(menu=menubar)
        self.bind("<F5>", lambda e: self.refresh_all())

    def _build_header(self) -> None:
        f = tk.Frame(self, bg="#B91C1C" if self.broker.is_real else "#0F4C81")
        f.pack(fill="x")
        text = f"{self.broker.name}  |  " + ("실계좌 연결 모드 - 주문은 실제로 체결될 수 있습니다" if self.broker.is_real else MOCK_NOTICE)
        tk.Label(f, text=text, bg=f["bg"], fg="white", anchor="w").pack(side="left", padx=8, pady=4)
        notice = getattr(self.broker, "notice", "")
        if notice:
            tk.Label(f, text=notice, bg=f["bg"], fg="#FDE68A").pack(side="right", padx=8)

    def resolve(self, text: str) -> Optional[str]:
        """코드(005930 / A005930) 또는 종목명 일부로 종목코드를 찾는다."""
        t = text.strip()
        if not t:
            return None
        quotes = self.broker.quotes()
        for cand in (t.upper(), "A" + t.upper()):
            if cand in quotes:
                return cand
        for code, q in quotes.items():
            if t in q.name:
                return code
        return None

    def watch_codes(self) -> List[str]:
        if hasattr(self.broker, "watchlist"):
            return self.broker.watchlist()
        return list(getattr(self.broker, "watch_codes", []))

    def refresh_all(self) -> None:
        try:
            self.broker.refresh()
            if hasattr(self.broker, "check_alerts"):
                for msg in self.broker.check_alerts():
                    messagebox.showinfo("알림", msg)
        except Exception as e:  # 연결 오류는 화면에 알리고 계속 동작
            self.status.set(f"시세 갱신 실패: {e}")
        self.fill_watch()
        self.fill_account()
        self.fill_pending()
        self.fill_discover()
        self.fill_alerts()
        self.status.set(f"갱신 완료 {time.strftime('%H:%M:%S')}")

    def auto_tick(self) -> None:
        if self.auto.get():
            self.refresh_all()
            self.after(10_000, self.auto_tick)

    # ---------- 관심종목 ----------
    def _build_watch_tab(self) -> None:
        tab = ttk.Frame(self.nb, padding=8)
        self.nb.add(tab, text="관심종목·현재가")
        bar = ttk.Frame(tab)
        bar.pack(fill="x", pady=(0, 6))
        ttk.Label(bar, text="종목(코드/이름)").pack(side="left")
        self.watch_entry = ttk.Entry(bar, width=18)
        self.watch_entry.pack(side="left", padx=4)
        ttk.Button(bar, text="추가/제거", command=self.toggle_watch).pack(side="left")
        ttk.Button(bar, text="새로고침", command=self.refresh_all).pack(side="left", padx=8)
        self.auto = tk.BooleanVar(value=False)
        ttk.Checkbutton(bar, text="10초마다 자동 갱신", variable=self.auto, command=self.auto_tick).pack(side="right")
        box = ttk.Frame(tab)
        box.pack(fill="both", expand=True)
        cols = [("code", "코드"), ("name", "종목명"), ("close", "현재가"), ("change", "대비"), ("rate", "등락률"), ("volume", "거래량")]
        self.watch_tree = make_tree(box, cols, [90, 200, 110, 100, 90, 120])
        self.watch_tree.bind("<Double-1>", self.watch_to_order)
        ttk.Label(tab, text="종목을 더블클릭하면 주문 탭으로 넘어갑니다.", foreground=FLAT).pack(anchor="w", pady=4)

    def toggle_watch(self) -> None:
        code = self.resolve(self.watch_entry.get())
        if not code:
            messagebox.showwarning("관심종목", "종목을 찾을 수 없습니다.")
            return
        if hasattr(self.broker, "toggle_watch"):
            self.broker.toggle_watch(code)
        elif hasattr(self.broker, "add_watch_code"):
            try:
                self.broker.add_watch_code(code)
            except Exception as e:
                messagebox.showerror("관심종목", str(e))
        self.watch_entry.delete(0, "end")
        self.fill_watch()

    def fill_watch(self) -> None:
        self.watch_tree.delete(*self.watch_tree.get_children())
        for code in self.watch_codes():
            q = self.broker.quote(code)
            if q:
                self.watch_tree.insert("", "end", iid=code, values=(code, q.name, won(q.close), signed(q.change), pct(q.rate), won(q.volume)), tags=(tag_for(q.change),))

    def watch_to_order(self, _e=None) -> None:
        sel = self.watch_tree.selection()
        if sel:
            self.o_code.set(sel[0])
            self.update_order_quote()
            self.nb.select(1)

    # ---------- 주문 ----------
    def _build_order_tab(self) -> None:
        tab = ttk.Frame(self.nb, padding=8)
        self.nb.add(tab, text="주문")
        form = ttk.LabelFrame(tab, text="주문 입력", padding=8)
        form.pack(fill="x")
        self.o_code = tk.StringVar()
        self.o_side = tk.StringVar(value="buy")
        self.o_type = tk.StringVar(value="limit" if self.broker.is_real else "market")
        self.o_qty = tk.StringVar(value="1")
        self.o_price = tk.StringVar()
        self.o_info = tk.StringVar(value="종목을 입력하세요.")

        ttk.Label(form, text="종목(코드/이름)").grid(row=0, column=0, sticky="w")
        e = ttk.Entry(form, textvariable=self.o_code, width=16)
        e.grid(row=0, column=1, padx=4, pady=3, sticky="w")
        e.bind("<FocusOut>", lambda _e: self.update_order_quote())
        e.bind("<Return>", lambda _e: self.update_order_quote())
        ttk.Label(form, textvariable=self.o_info, foreground=FLAT).grid(row=0, column=2, columnspan=4, sticky="w", padx=8)

        ttk.Label(form, text="구분").grid(row=1, column=0, sticky="w")
        sf = ttk.Frame(form)
        sf.grid(row=1, column=1, sticky="w")
        ttk.Radiobutton(sf, text="매수", value="buy", variable=self.o_side).pack(side="left")
        ttk.Radiobutton(sf, text="매도", value="sell", variable=self.o_side).pack(side="left", padx=8)

        ttk.Label(form, text="유형").grid(row=2, column=0, sticky="w")
        tf = ttk.Frame(form)
        tf.grid(row=2, column=1, sticky="w")
        if not self.broker.is_real:
            ttk.Radiobutton(tf, text="시장가", value="market", variable=self.o_type).pack(side="left")
        ttk.Radiobutton(tf, text="지정가", value="limit", variable=self.o_type).pack(side="left", padx=8)

        ttk.Label(form, text="수량").grid(row=3, column=0, sticky="w")
        ttk.Spinbox(form, from_=1, to=1_000_000, textvariable=self.o_qty, width=12).grid(row=3, column=1, sticky="w", padx=4, pady=3)
        ttk.Label(form, text="지정가").grid(row=3, column=2, sticky="e")
        ttk.Entry(form, textvariable=self.o_price, width=12).grid(row=3, column=3, sticky="w", padx=4)
        ttk.Button(form, text="주문", command=self.submit_order).grid(row=3, column=4, padx=12)

        pend = ttk.LabelFrame(tab, text="미체결 주문", padding=8)
        pend.pack(fill="both", expand=True, pady=8)
        box = ttk.Frame(pend)
        box.pack(fill="both", expand=True)
        cols = [("id", "주문번호"), ("name", "종목명"), ("side", "구분"), ("qty", "수량"), ("price", "지정가")]
        self.pend_tree = make_tree(box, cols, [110, 200, 80, 90, 110], height=7)
        ttk.Button(pend, text="선택 주문 취소", command=self.cancel_selected).pack(anchor="e", pady=4)

    def update_order_quote(self) -> None:
        code = self.resolve(self.o_code.get())
        if not code:
            self.o_info.set("종목을 찾을 수 없습니다.")
            return
        q = self.broker.quote(code)
        self.o_code.set(code)
        self.o_info.set(f"{q.name}  현재가 {won(q.close)}원  ({signed(q.change)}, {pct(q.rate)})")
        if not self.o_price.get():
            self.o_price.set(str(round(q.close)))

    def submit_order(self) -> None:
        code = self.resolve(self.o_code.get())
        if not code:
            messagebox.showwarning("주문", "종목을 찾을 수 없습니다.")
            return
        try:
            qty = int(self.o_qty.get())
        except ValueError:
            messagebox.showwarning("주문", "수량은 정수로 입력하세요.")
            return
        price: Optional[float] = None
        if self.o_type.get() == "limit":
            try:
                price = float(self.o_price.get().replace(",", ""))
            except ValueError:
                messagebox.showwarning("주문", "지정가를 숫자로 입력하세요.")
                return
        q = self.broker.quote(code)
        side_txt = "매수" if self.o_side.get() == "buy" else "매도"
        detail = f"{q.name}({code})\n{side_txt} {qty:,}주 / " + (f"지정가 {won(price)}원" if price else "시장가")
        if self.broker.is_real and not messagebox.askyesno("실거래 주문 확인", "실제 계좌로 주문이 나갑니다.\n\n" + detail + "\n\n진행할까요?", icon="warning"):
            return
        res = self.broker.place_order(self.o_side.get(), code, qty, price)
        (messagebox.showinfo if res.ok else messagebox.showwarning)("주문 결과", res.message)
        self.refresh_all()

    def fill_pending(self) -> None:
        self.pend_tree.delete(*self.pend_tree.get_children())
        for o in self.broker.pending_orders():
            self.pend_tree.insert("", "end", iid=o.id, values=(o.id, o.name, "매수" if o.side == "buy" else "매도", won(o.qty), won(o.price) if o.price else "-"))

    def cancel_selected(self) -> None:
        sel = self.pend_tree.selection()
        if sel and self.broker.cancel_order(sel[0]):
            self.refresh_all()
        elif sel:
            messagebox.showinfo("주문 취소", "이 연결에서는 주문 취소를 지원하지 않습니다.")

    # ---------- 계좌정보 ----------
    def _build_account_tab(self) -> None:
        tab = ttk.Frame(self.nb, padding=8)
        self.nb.add(tab, text="계좌정보")
        self.acc_cash = tk.StringVar()
        self.acc_total = tk.StringVar()
        self.acc_pnl = tk.StringVar()
        top = ttk.Frame(tab)
        top.pack(fill="x", pady=(0, 6))
        for label, var in (("예수금", self.acc_cash), ("총평가금액", self.acc_total), ("평가손익", self.acc_pnl)):
            f = ttk.LabelFrame(top, text=label, padding=8)
            f.pack(side="left", padx=4, fill="x", expand=True)
            ttk.Label(f, textvariable=var, font=("", 13, "bold")).pack(anchor="w")
        h = ttk.LabelFrame(tab, text="보유 종목", padding=6)
        h.pack(fill="both", expand=True)
        box = ttk.Frame(h)
        box.pack(fill="both", expand=True)
        cols = [("name", "종목명"), ("qty", "수량"), ("avg", "평균단가"), ("close", "현재가"), ("eval", "평가금액"), ("pnl", "평가손익"), ("rate", "수익률")]
        self.hold_tree = make_tree(box, cols, [180, 70, 100, 100, 120, 110, 80], height=8)
        hist = ttk.LabelFrame(tab, text="거래내역", padding=6)
        hist.pack(fill="both", expand=True, pady=(6, 0))
        box2 = ttk.Frame(hist)
        box2.pack(fill="both", expand=True)
        cols2 = [("time", "시각"), ("name", "종목명"), ("side", "구분"), ("qty", "수량"), ("price", "체결가"), ("status", "상태"), ("pnl", "실현손익")]
        self.hist_tree = make_tree(box2, cols2, [140, 170, 70, 70, 100, 80, 100], height=6)

    def fill_account(self) -> None:
        try:
            acc = self.broker.account()
        except Exception as e:
            self.status.set(f"계좌 조회 실패: {e}")
            return
        self.hold_tree.delete(*self.hold_tree.get_children())
        eval_sum = pnl_sum = 0
        for h in acc.holdings:
            ev = evaluate(h.qty, h.avg_price, h.close)
            eval_sum += ev["eval_amount"]
            pnl_sum += ev["pnl"]
            self.hold_tree.insert("", "end", values=(h.name, won(h.qty), won(h.avg_price), won(h.close), won(ev["eval_amount"]), signed(ev["pnl"]), pct(ev["rate"])), tags=(tag_for(ev["pnl"]),))
        self.acc_cash.set("조회 미지원" if acc.cash is None else f"{won(acc.cash)}원")
        self.acc_total.set(f"{won(eval_sum + (acc.cash or 0))}원")
        self.acc_pnl.set(f"{signed(pnl_sum)}원")
        self.hist_tree.delete(*self.hist_tree.get_children())
        for o in self.broker.order_history()[:100]:
            when = time.strftime("%m-%d %H:%M", time.localtime(o.created_at / 1000))
            st = {"filled": "체결", "canceled": "취소", "rejected": "거부"}.get(o.status, o.status)
            self.hist_tree.insert("", "end", values=(when, o.name, "매수" if o.side == "buy" else "매도", won(o.qty), won(o.fill_price) if o.fill_price else "-", st, signed(o.realized_pnl) if o.realized_pnl else "-"))

    # ---------- 종목발굴·알림 ----------
    def _build_discover_tab(self) -> None:
        tab = ttk.Frame(self.nb, padding=8)
        self.nb.add(tab, text="종목발굴·알림")
        bar = ttk.Frame(tab)
        bar.pack(fill="x", pady=(0, 6))
        ttk.Label(bar, text="조건").pack(side="left")
        self.d_filter = tk.StringVar(value="등락률 상위")
        cb = ttk.Combobox(bar, textvariable=self.d_filter, state="readonly", width=16, values=["등락률 상위", "등락률 하위", "거래량 상위"])
        cb.pack(side="left", padx=4)
        cb.bind("<<ComboboxSelected>>", lambda _e: self.fill_discover())
        box = ttk.Frame(tab)
        box.pack(fill="both", expand=True)
        cols = [("code", "코드"), ("name", "종목명"), ("close", "현재가"), ("rate", "등락률"), ("volume", "거래량")]
        self.disc_tree = make_tree(box, cols, [90, 200, 110, 90, 130], height=8)

        al = ttk.LabelFrame(tab, text="목표가·손절가 알림" + ("" if self.broker.supports_alerts else " (이 연결에서는 지원하지 않음)"), padding=8)
        al.pack(fill="x", pady=(8, 0))
        self.a_code, self.a_target, self.a_stop = tk.StringVar(), tk.StringVar(), tk.StringVar()
        row = ttk.Frame(al)
        row.pack(fill="x")
        for label, var, w in (("종목", self.a_code, 14), ("목표가", self.a_target, 10), ("손절가", self.a_stop, 10)):
            ttk.Label(row, text=label).pack(side="left")
            ttk.Entry(row, textvariable=var, width=w).pack(side="left", padx=4)
        state = "normal" if self.broker.supports_alerts else "disabled"
        ttk.Button(row, text="알림 추가", command=self.add_alert, state=state).pack(side="left", padx=6)
        ttk.Button(row, text="선택 삭제", command=self.remove_alert, state=state).pack(side="left")
        self.alert_list = tk.Listbox(al, height=4)
        self.alert_list.pack(fill="x", pady=4)
        self.alert_ids: List[str] = []
        self.note_list = tk.Listbox(al, height=3, foreground=DOWN)
        self.note_list.pack(fill="x")

    def fill_discover(self) -> None:
        quotes = list(self.broker.quotes().values())
        key = {"등락률 상위": lambda q: -q.rate, "등락률 하위": lambda q: q.rate, "거래량 상위": lambda q: -q.volume}[self.d_filter.get()]
        self.disc_tree.delete(*self.disc_tree.get_children())
        for q in sorted(quotes, key=key)[:30]:
            self.disc_tree.insert("", "end", values=(q.code, q.name, won(q.close), pct(q.rate), won(q.volume)), tags=(tag_for(q.change),))

    def add_alert(self) -> None:
        code = self.resolve(self.a_code.get())

        def num(s: str) -> Optional[float]:
            s = s.strip().replace(",", "")
            return float(s) if s else None

        try:
            target, stop = num(self.a_target.get()), num(self.a_stop.get())
        except ValueError:
            messagebox.showwarning("알림", "가격은 숫자로 입력하세요.")
            return
        if not code or (target is None and stop is None):
            messagebox.showwarning("알림", "종목과 목표가/손절가 중 하나 이상을 입력하세요.")
            return
        self.broker.add_alert(code, target, stop)
        self.a_code.set("")
        self.a_target.set("")
        self.a_stop.set("")
        self.fill_alerts()

    def remove_alert(self) -> None:
        sel = self.alert_list.curselection()
        if sel:
            self.broker.remove_alert(self.alert_ids[sel[0]])
            self.fill_alerts()

    def fill_alerts(self) -> None:
        self.alert_list.delete(0, "end")
        self.alert_ids = []
        self.note_list.delete(0, "end")
        if not hasattr(self.broker, "alerts"):
            return
        for a in self.broker.alerts():
            t = f"목표 {won(a['target'])}" if a["target"] else ""
            s = f"손절 {won(a['stop'])}" if a["stop"] else ""
            self.alert_list.insert("end", f"{a['name']}  {t} {s}  [{'감시중' if a['active'] else '완료'}]")
            self.alert_ids.append(a["id"])
        for n in self.broker.notifications()[:20]:
            self.note_list.insert("end", f"{time.strftime('%m-%d %H:%M', time.localtime(n['at'] / 1000))}  {n['text']}")
