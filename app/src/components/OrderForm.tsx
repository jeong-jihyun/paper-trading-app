import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Btn, Field, Segment, s } from './ui';
import { placeOrder } from '../services/account';
import { useAuth } from '../context/AuthContext';
import { colors, won } from '../utils/format';
import { notify } from '../utils/notify';
import type { OrderType, Quote, Side } from '../types';

export function OrderForm({ quote }: { quote: Quote }) {
  const { user } = useAuth();
  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState(String(quote.close));
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    if (!user) return;
    const q = Number(qty);
    const limitPrice = type === 'limit' ? Number(price.replace(/,/g, '')) : null;
    setBusy(true);
    try {
      const res = await placeOrder(user.uid, {
        code: quote.code,
        name: quote.name,
        side,
        type,
        qty: q,
        limitPrice,
        bar: { close: quote.close, open: quote.open, high: quote.high, low: quote.low },
      });
      notify('주문 결과', res.message);
    } catch (e) {
      notify('주문 실패', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setBusy(false);
    }
  };

  const est = (type === 'limit' ? Number(price.replace(/,/g, '')) || 0 : quote.close) * (Number(qty) || 0);

  return (
    <View>
      <Segment
        value={side}
        onChange={setSide}
        options={[
          { value: 'buy', label: '매수' },
          { value: 'sell', label: '매도' },
        ]}
      />
      <Segment
        value={type}
        onChange={setType}
        options={[
          { value: 'market', label: '시장가' },
          { value: 'limit', label: '지정가' },
        ]}
      />
      <Field label="수량" value={qty} onChangeText={setQty} keyboardType="number-pad" />
      {type === 'limit' && <Field label="지정가(원)" value={price} onChangeText={setPrice} keyboardType="number-pad" />}
      <Text style={{ color: colors.sub, marginBottom: 10 }}>예상 주문금액 {won(est)}원 (수수료·세금 별도)</Text>
      <Btn title={side === 'buy' ? '매수 주문' : '매도 주문'} kind={side} onPress={submit} disabled={busy} />
      <Text style={[s.rowSub, { marginTop: 8 }]}>시장가는 기준일 종가로 즉시 체결됩니다.</Text>
    </View>
  );
}
