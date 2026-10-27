import React, { useEffect, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { loadHistory } from '../services/market';
import { addAlert, setWatch, subscribeWatchlist } from '../services/account';
import { Btn, Field, LineChart, Notice, s } from '../components/ui';
import { OrderForm } from '../components/OrderForm';
import { changeColor, colors, pct, signed, won } from '../utils/format';
import type { HistoryPoint, WatchItem } from '../types';
import type { RootParamList } from '../navigation';
import { notify } from '../utils/notify';

export default function StockDetailScreen({ route }: NativeStackScreenProps<RootParamList, 'StockDetail'>) {
  const { user } = useAuth();
  const { byCode, date } = useMarket();
  const q = byCode[route.params.code];
  const [hist, setHist] = useState<HistoryPoint[]>([]);
  const [watch, setWatchList] = useState<WatchItem[]>([]);
  const [target, setTarget] = useState('');
  const [stop, setStop] = useState('');

  useEffect(() => {
    void loadHistory(route.params.code).then(setHist).catch(() => setHist([]));
  }, [route.params.code]);
  useEffect(() => (user ? subscribeWatchlist(user.uid, setWatchList) : undefined), [user]);

  if (!q) return <Text style={s.empty}>시세 정보를 찾을 수 없습니다.</Text>;
  const c = changeColor(q.change);
  const watching = watch.some((w) => w.code === q.code);

  const saveAlert = async () => {
    if (!user) return;
    const t = target ? Number(target) : null;
    const st = stop ? Number(stop) : null;
    if (t == null && st == null) return notify('알림', '목표가 또는 손절가를 입력하세요.');
    await addAlert(user.uid, { code: q.code, name: q.name, targetPrice: t, stopPrice: st });
    setTarget('');
    setStop('');
    notify('알림', '알림을 등록했습니다. 시세가 갱신될 때 조건을 검사합니다.');
  };

  return (
    <ScrollView style={s.screen}>
      <Notice date={date} />
      <View style={s.pad}>
        <View style={s.card}>
          <Text style={s.rowSub}>
            {q.code} · {q.market}
          </Text>
          <Text style={s.title}>{q.name}</Text>
          <Text style={{ fontSize: 30, fontWeight: '800', color: c }}>{won(q.close)}원</Text>
          <Text style={{ color: c, marginBottom: 10 }}>
            {signed(q.change)} ({pct(q.rate)})
          </Text>
          <LineChart values={hist.map((h) => h.c)} />
          <Text style={[s.rowSub, { marginTop: 8 }]}>
            시가 {won(q.open)} · 고가 {won(q.high)} · 저가 {won(q.low)} · 거래량 {won(q.volume)}
          </Text>
        </View>
        <Btn
          title={watching ? '관심종목 해제' : '관심종목 추가'}
          kind="ghost"
          onPress={() => user && setWatch(user.uid, q.code, q.name, !watching)}
          style={{ marginBottom: 12 }}
        />
        <View style={s.card}>
          <Text style={s.title}>주문</Text>
          <OrderForm quote={q} />
        </View>
        <View style={s.card}>
          <Text style={s.title}>목표가·손절가 알림</Text>
          <Field label="목표가(원) 이상이면 알림" value={target} onChangeText={setTarget} keyboardType="number-pad" />
          <Field label="손절가(원) 이하이면 알림" value={stop} onChangeText={setStop} keyboardType="number-pad" />
          <Btn title="알림 등록" onPress={saveAlert} />
        </View>
        <Text style={{ color: colors.sub, fontSize: 11 }}>시세는 하루 1회 갱신되는 공공데이터(전일 종가 기준)입니다.</Text>
      </View>
    </ScrollView>
  );
}
