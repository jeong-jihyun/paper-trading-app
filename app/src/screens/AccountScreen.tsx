import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { subscribeCash, subscribeHoldings, subscribeOrders } from '../services/account';
import { Notice, s } from '../components/ui';
import { evaluate } from '../utils/trading';
import { changeColor, colors, pct, signed, won } from '../utils/format';
import type { HoldingDoc, OrderDoc } from '../types';

export default function AccountScreen() {
  const { user } = useAuth();
  const { byCode, date } = useMarket();
  const [cash, setCash] = useState(0);
  const [holdings, setHoldings] = useState<HoldingDoc[]>([]);
  const [orders, setOrders] = useState<OrderDoc[]>([]);

  useEffect(() => {
    if (!user) return;
    const offs = [subscribeCash(user.uid, setCash), subscribeHoldings(user.uid, setHoldings), subscribeOrders(user.uid, setOrders)];
    return () => offs.forEach((f) => f());
  }, [user]);

  const rows = useMemo(
    () => holdings.map((h) => ({ h, ev: evaluate(h.qty, h.avgPrice, byCode[h.code]?.close ?? h.avgPrice) })),
    [holdings, byCode],
  );
  const evalSum = rows.reduce((a, r) => a + r.ev.evalAmount, 0);
  const pnlSum = rows.reduce((a, r) => a + r.ev.pnl, 0);
  const history = orders.filter((o) => o.status !== 'pending').slice(0, 30);

  return (
    <ScrollView style={s.screen}>
      <Notice date={date} />
      <View style={s.pad}>
        <View style={s.card}>
          <Text style={s.rowSub}>총평가금액</Text>
          <Text style={{ fontSize: 26, fontWeight: '800' }}>{won(cash + evalSum)}원</Text>
          <Text style={{ color: changeColor(pnlSum), marginTop: 4 }}>평가손익 {signed(pnlSum)}원</Text>
          <Text style={[s.rowSub, { marginTop: 4 }]}>예수금 {won(cash)}원</Text>
        </View>

        <View style={s.card}>
          <Text style={s.title}>보유 종목</Text>
          {rows.length === 0 && <Text style={{ color: colors.sub }}>보유 종목이 없습니다.</Text>}
          {rows.map(({ h, ev }) => (
            <View key={h.code} style={{ paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.line }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                <Text style={s.rowName}>{h.name}</Text>
                <Text style={{ color: changeColor(ev.pnl), fontWeight: '700' }}>
                  {signed(ev.pnl)} ({pct(ev.rate)})
                </Text>
              </View>
              <Text style={s.rowSub}>
                {won(h.qty)}주 · 평균 {won(h.avgPrice)} · 평가 {won(ev.evalAmount)}
              </Text>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.title}>거래내역</Text>
          {history.length === 0 && <Text style={{ color: colors.sub }}>거래내역이 없습니다.</Text>}
          {history.map((o) => (
            <View key={o.id} style={{ paddingVertical: 6 }}>
              <Text style={s.rowName}>
                {o.name} · {o.side === 'buy' ? '매수' : '매도'} {won(o.qty)}주
              </Text>
              <Text style={s.rowSub}>
                {new Date(o.createdAt).toLocaleString('ko-KR')} ·{' '}
                {o.status === 'filled' ? `체결가 ${won(o.fillPrice ?? 0)}` : o.status === 'canceled' ? '취소' : '거부'}
                {o.realizedPnl ? ` · 실현손익 ${signed(o.realizedPnl)}` : ''}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
