import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { cancelOrder, subscribeOrders } from '../services/account';
import { Btn, Notice, QuoteRow, s } from '../components/ui';
import { OrderForm } from '../components/OrderForm';
import { StockSearch } from '../components/StockSearch';
import { colors, won } from '../utils/format';
import { notify } from '../utils/notify';
import type { OrderDoc, Quote } from '../types';

export default function OrderScreen() {
  const { user } = useAuth();
  const { date, byCode } = useMarket();
  const [picked, setPicked] = useState<Quote | null>(null);
  const [orders, setOrders] = useState<OrderDoc[]>([]);

  useEffect(() => (user ? subscribeOrders(user.uid, setOrders) : undefined), [user]);
  const pending = orders.filter((o) => o.status === 'pending');
  const current = picked ? byCode[picked.code] ?? picked : null;

  return (
    <ScrollView style={s.screen}>
      <Notice date={date} />
      <View style={s.pad}>
        <View style={s.card}>
          <Text style={s.title}>주문</Text>
          <StockSearch onPick={setPicked} />
          {current && (
            <View>
              <QuoteRow q={current} />
              <View style={{ height: 12 }} />
              <OrderForm key={current.code} quote={current} />
            </View>
          )}
        </View>
        <View style={s.card}>
          <Text style={s.title}>미체결 주문</Text>
          {pending.length === 0 && <Text style={{ color: colors.sub }}>미체결 주문이 없습니다.</Text>}
          {pending.map((o) => (
            <View key={o.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 8 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{o.name}</Text>
                <Text style={s.rowSub}>
                  {o.side === 'buy' ? '매수' : '매도'} {won(o.qty)}주 · 지정가 {won(o.limitPrice ?? 0)}원
                </Text>
              </View>
              <Btn
                title="취소"
                kind="ghost"
                onPress={() => user && cancelOrder(user.uid, o.id).catch((e) => notify('취소 실패', String(e)))}
              />
            </View>
          ))}
          <Text style={[s.rowSub, { marginTop: 8 }]}>지정가 주문은 다음 시세 갱신 때 체결 여부를 검사합니다.</Text>
        </View>
      </View>
    </ScrollView>
  );
}
