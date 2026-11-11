import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Btn, Field, Segment } from './ui';
import { Help, IssueList, g } from './guide';
import { placeOrder } from '../services/account';
import { useAuth } from '../context/AuthContext';
import { useGuide } from '../context/GuideContext';
import { colors, won } from '../utils/format';
import { confirm, notify } from '../utils/notify';
import { HELP, checkOrder, compareToModel, modelAnswer } from '../utils/guide';
import type { OrderType, Quote, Side } from '../types';

/** 주문 입력. 단계마다 도움말을 보여주고, 잘못된 선택은 주문 전에 알려준다. */
export function OrderForm({ quote }: { quote: Quote }) {
  const { user } = useAuth();
  const { cash, holdings, totalAsset } = useGuide();
  const [side, setSide] = useState<Side>('buy');
  const [type, setType] = useState<OrderType>('market');
  const [qty, setQty] = useState('1');
  const [price, setPrice] = useState(String(quote.close));
  const [busy, setBusy] = useState(false);

  const holding = holdings.find((h) => h.code === quote.code);
  const check = useMemo(
    () =>
      checkOrder({
        side,
        type,
        qtyText: qty,
        priceText: price,
        close: quote.close,
        rate: quote.rate,
        volume: quote.volume,
        cash,
        holdingQty: holding?.qty ?? 0,
        holdingAvg: holding?.avgPrice ?? 0,
        totalAsset,
      }),
    [side, type, qty, price, quote, cash, holding, totalAsset],
  );

  const submit = async () => {
    if (!user || !check.canSubmit) return;
    if (check.warnings.length > 0) {
      const text = check.warnings.map((w) => `• ${w.msg}${w.how ? `\n  → ${w.how}` : ''}`).join('\n\n');
      const go = await confirm('주문 전에 확인하세요', `${text}\n\n그래도 주문할까요?`, '그래도 주문');
      if (!go) return;
    }
    setBusy(true);
    try {
      const res = await placeOrder(user.uid, {
        code: quote.code,
        name: quote.name,
        side,
        type,
        qty: Number(qty.replace(/,/g, '')),
        limitPrice: type === 'limit' ? Number(price.replace(/,/g, '')) : null,
        bar: { close: quote.close, open: quote.open, high: quote.high, low: quote.low },
      });
      const next =
        res.status === 'pending'
          ? '미체결 주문에서 취소할 수 있습니다.'
          : side === 'buy'
            ? '다음: 가이드 탭을 보세요.'
            : '계좌정보 탭에서 결과를 보세요.';
      notify('주문 결과', `${res.message}\n\n${next}`);
    } catch (e) {
      notify('주문 실패', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setBusy(false);
    }
  };

  const model = useMemo(() => modelAnswer(quote.close, totalAsset, cash), [quote.close, totalAsset, cash]);
  const qtyNum = Number(qty.replace(/,/g, ''));
  const verdict = side === 'buy' && check.canSubmit ? compareToModel(qtyNum, holding?.qty ?? 0, model) : null;
  const applyModel = () => {
    setSide('buy');
    setType('market');
    setQty(String(Math.max(1, model.firstQty)));
  };

  // 화면에는 고칠 것(빨강)과 주의(노랑)만 보여준다
  const shown = [...check.issues.filter((x) => x.level !== 'info'), ...(verdict && verdict.level === 'warn' ? [verdict] : [])];

  const addQty = (d: number) => setQty(String(Math.max(1, (Number(qty.replace(/,/g, '')) || 0) + d)));
  const sideName = side === 'buy' ? '매수' : '매도';

  return (
    <View>
      <Segment
        value={side}
        onChange={setSide}
        options={[
          { value: 'buy', label: '매수 (사기)' },
          { value: 'sell', label: '매도 (팔기)' },
        ]}
      />
      {side === 'buy' && (
        <Pressable onPress={applyModel} style={{ backgroundColor: '#16A34A', borderRadius: 10, padding: 12, marginBottom: 10 }}>
          <Text style={{ color: '#fff', fontWeight: '800', fontSize: 15 }}>📗 추천대로: {won(Math.max(1, model.firstQty))}주 사기 (누르면 채워짐)</Text>
          <Text style={{ color: '#fff', fontSize: 12, marginTop: 2 }}>
            손절 {won(model.stopPrice)} · 목표 {won(model.targetPrice)}
          </Text>
        </Pressable>
      )}
      <Segment
        value={type}
        onChange={setType}
        options={[
          { value: 'market', label: '시장가 (바로)' },
          { value: 'limit', label: '지정가 (가격 정함)' },
        ]}
      />
      <Field label={`수량 (보유 ${won(holding?.qty ?? 0)}주)`} value={qty} onChangeText={setQty} keyboardType="number-pad" />
      <View style={{ flexDirection: 'row', marginBottom: 10 }}>
        {[1, 10, 100].map((d) => (
          <Pressable key={d} onPress={() => addQty(d)}>
            <Text style={[g.chip, { marginRight: 6 }]}>+{d}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => check.maxQty > 0 && setQty(String(check.maxQty))}>
          <Text style={[g.chip, { opacity: check.maxQty > 0 ? 1 : 0.4 }]}>최대 {won(check.maxQty)}</Text>
        </Pressable>
      </View>
      {type === 'limit' && <Field label={`지정가 (현재가 ${won(quote.close)}원)`} value={price} onChangeText={setPrice} keyboardType="number-pad" />}

      <Text style={{ color: colors.text, fontWeight: '700', fontSize: 16, marginBottom: 8 }}>
        {sideName} {won(check.amount)}원 {check.immediate ? '' : '(대기)'}
      </Text>
      <IssueList issues={shown} />
      <Btn title={check.canSubmit ? `${sideName} 주문` : '빨간 안내를 먼저 고치세요'} kind={side} onPress={submit} disabled={busy || !check.canSubmit} />
      <Help label="도움말" text={`${HELP.side}\n\n${HELP.type}\n\n${HELP.est}`} />
    </View>
  );
}
