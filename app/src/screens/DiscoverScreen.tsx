import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { removeAlert, subscribeAlerts, subscribeNotifications } from '../services/account';
import { Notice, QuoteRow, Segment, s } from '../components/ui';
import { colors, won } from '../utils/format';
import type { AlertDoc, NotificationDoc } from '../types';
import type { TabParamList } from '../navigation';

type Filter = 'rise' | 'fall' | 'volume';

export default function DiscoverScreen({ navigation }: BottomTabScreenProps<TabParamList, 'Discover'>) {
  const { user } = useAuth();
  const { quotes, date } = useMarket();
  const [filter, setFilter] = useState<Filter>('rise');
  const [alerts, setAlerts] = useState<AlertDoc[]>([]);
  const [notes, setNotes] = useState<NotificationDoc[]>([]);

  useEffect(() => {
    if (!user) return;
    const offs = [subscribeAlerts(user.uid, setAlerts), subscribeNotifications(user.uid, setNotes)];
    return () => offs.forEach((f) => f());
  }, [user]);

  const list = useMemo(() => {
    const sorted = [...quotes].sort((a, b) =>
      filter === 'rise' ? b.rate - a.rate : filter === 'fall' ? a.rate - b.rate : b.volume - a.volume,
    );
    return sorted.slice(0, 20);
  }, [quotes, filter]);

  return (
    <ScrollView style={s.screen}>
      <Notice date={date} />
      <View style={s.pad}>
        <View style={s.card}>
          <Text style={s.title}>종목 발굴</Text>
          <Segment
            value={filter}
            onChange={setFilter}
            options={[
              { value: 'rise', label: '등락률 상위' },
              { value: 'fall', label: '등락률 하위' },
              { value: 'volume', label: '거래량 상위' },
            ]}
          />
          {list.map((q) => (
            <QuoteRow key={q.code} q={q} onPress={() => navigation.getParent()?.navigate('StockDetail', { code: q.code })} />
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.title}>내 알림</Text>
          {alerts.length === 0 && <Text style={{ color: colors.sub }}>종목 상세 화면에서 알림을 등록할 수 있습니다.</Text>}
          {alerts.map((a) => (
            <View key={a.id} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6 }}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{a.name}</Text>
                <Text style={s.rowSub}>
                  {a.targetPrice ? `목표 ${won(a.targetPrice)} ` : ''}
                  {a.stopPrice ? `손절 ${won(a.stopPrice)} ` : ''}· {a.active ? '감시중' : '완료'}
                </Text>
              </View>
              <Pressable onPress={() => user && removeAlert(user.uid, a.id)}>
                <Text style={{ color: colors.down }}>삭제</Text>
              </Pressable>
            </View>
          ))}
        </View>

        <View style={s.card}>
          <Text style={s.title}>받은 알림</Text>
          {notes.length === 0 && <Text style={{ color: colors.sub }}>받은 알림이 없습니다.</Text>}
          {notes.map((n) => (
            <View key={n.id} style={{ paddingVertical: 6 }}>
              <Text style={s.rowName}>{n.title}</Text>
              <Text style={s.rowSub}>
                {n.body} · {new Date(n.createdAt).toLocaleString('ko-KR')}
              </Text>
            </View>
          ))}
        </View>
      </View>
    </ScrollView>
  );
}
