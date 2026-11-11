import React, { useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Btn, Field, Segment, s } from './ui';
import { Help, IssueList, g } from './guide';
import { placeOrder } from '../services/account';
import { useAuth } from '../context/AuthContext';
import { useGuide } from '../context/GuideContext';
import { colors, won } from '../utils/format';
import { confirm, notify } from '../utils/notify';
import { HELP, MODEL_HONEST, checkOrder, compareToModel, modelAnswer } from '../utils/guide';
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
          ? '주문 탭의 "미체결 주문"에서 확인·취소할 수 있습니다.'
          : side === 'buy'
            ? `다음: 종목 상세 화면에서 손절가 ${won(model.stopPrice)}원, 목표가 ${won(model.targetPrice)}원을 알림에 등록하세요(모범 답안).`
            : '다음: 계좌정보 탭의 거래내역에서 실현손익을 확인하세요.';
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

  const addQty = (d: number) => setQty(String(Math.max(1, (Number(qty.replace(/,/g, '')) || 0) + d)));
  const sideName = side === 'buy' ? '매수' : '매도';

  return (
    <View>
      <Text style={s.label}>① 살까요, 팔까요?</Text>
      <Segment
        value={side}
        onChange={setSide}
        options={[
          { value: 'buy', label: '매수 (사기)' },
          { value: 'sell', label: '매도 (팔기)' },
        ]}
      />
      <Help label="매수·매도가 뭔가요?" text={HELP.side} />
      <Text style={[s.rowSub, { marginBottom: 10 }]}>
        이 종목 보유 {won(holding?.qty ?? 0)}주{holding ? ` (평균 ${won(holding.avgPrice)}원)` : ''} · 예수금 {won(cash)}원
      </Text>

      <Text style={s.label}>② 어떤 방식으로 주문할까요?</Text>
      <Segment
        value={type}
        onChange={setType}
        options={[
          { value: 'market', label: '시장가 (바로)' },
          { value: 'limit', label: '지정가 (가격 정함)' },
        ]}
      />
      <Help label="시장가·지정가 차이" text={HELP.type} />

      <Field label="③ 수량 (주)" value={qty} onChangeText={setQty} keyboardType="number-pad" />
      <View style={{ flexDirection: 'row', marginBottom: 6 }}>
        {[1, 10, 100].map((d) => (
          <Pressable key={d} onPress={() => addQty(d)}>
            <Text style={[g.chip, { marginRight: 6 }]}>+{d}</Text>
          </Pressable>
        ))}
        <Pressable onPress={() => setQty('1')}>
          <Text style={[g.chip, { marginRight: 6 }]}>1주로</Text>
        </Pressable>
        <Pressable onPress={() => check.maxQty > 0 && setQty(String(check.maxQty))}>
          <Text style={[g.chip, { opacity: check.maxQty > 0 ? 1 : 0.4 }]}>최대 {won(check.maxQty)}주</Text>
        </Pressable>
      </View>
      <Help label="수량은 얼마나?" text={HELP.qty} />

      {type === 'limit' && (
        <>
          <Field label={`④ 지정가 (원) · 현재가 ${won(quote.close)}원`} value={price} onChangeText={setPrice} keyboardType="number-pad" />
          <Help label="지정가는 어떻게 적나요?" text={HELP.limit} />
        </>
      )}

      <View style={{ backgroundColor: colors.bg, borderRadius: 8, padding: 10, marginVertical: 8 }}>
        <Text style={{ color: colors.text, fontWeight: '700' }}>
          예상 {sideName}금액 {won(check.amount)}원 {check.immediate ? '(바로 체결)' : '(대기 주문)'}
        </Text>
        <Text style={s.rowSub}>
          가격 {won(check.price)}원 × {qty || 0}주 · 수수료 {won(check.fee)}원{side === 'sell' ? ` · 세금 ${won(check.tax)}원` : ''}
        </Text>
        <Help label="금액은 어떻게 계산되나요?" text={HELP.est} />
      </View>

      {side === 'buy' && (
        <View style={{ borderWidth: 1, borderColor: '#86EFAC', backgroundColor: '#F0FDF4', borderRadius: 8, padding: 10, marginBottom: 8 }}>
          <Text style={{ color: '#166534', fontWeight: '800' }}>📗 모범 답안 (손실을 작게 묶는 주문)</Text>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 20, marginTop: 4 }}>
            수량: 총 {won(model.qty)}주까지, 오늘은 절반인 {won(model.firstQty)}주{'\n'}
            손절가 {won(model.stopPrice)}원(-7%) · 목표가 {won(model.targetPrice)}원(+14%){'\n'}
            틀리면 약 -{won(model.maxLoss)}원(자산의 {model.lossPctOfAsset}%), 맞으면 약 +{won(model.expectedGain)}원
          </Text>
          <Pressable onPress={applyModel} style={{ marginTop: 8, alignSelf: 'flex-start' }}>
            <Text style={[g.chip, { backgroundColor: '#16A34A', color: '#fff' }]}>모범 답안대로 채우기</Text>
          </Pressable>
          <Text style={[s.rowSub, { marginTop: 6 }]}>{MODEL_HONEST}</Text>
        </View>
      )}
      {verdict && <IssueList issues={[verdict]} />}
      <IssueList issues={check.issues} okText="문제 없습니다. 주문할 수 있습니다." />
      <Btn title={check.canSubmit ? `${sideName} 주문` : '위의 빨간 안내를 먼저 고치세요'} kind={side} onPress={submit} disabled={busy || !check.canSubmit} />
      <Text style={[s.rowSub, { marginTop: 8 }]}>시장가는 기준일 종가로 즉시 체결됩니다.</Text>
    </View>
  );
}
