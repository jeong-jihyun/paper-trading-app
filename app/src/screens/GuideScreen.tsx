import React, { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useGuide } from '../context/GuideContext';
import { Btn, s } from '../components/ui';
import { Help } from '../components/guide';
import { HELP } from '../utils/guide';
import { colors } from '../utils/format';
import type { TabParamList } from '../navigation';

const RULES = ['한 종목은 자산의 10%까지', '오늘은 절반만 산다', '-7%면 판다 (손절)', '+14%면 판다 (목표)'];

/** 가이드 탭: 지금 누를 것 하나 + 순서 + 규칙 4줄. */
export default function GuideScreen({ navigation }: BottomTabScreenProps<TabParamList, 'Guide'>) {
  const { steps, current } = useGuide();
  const [more, setMore] = useState(false);

  return (
    <ScrollView style={s.screen}>
      <View style={s.pad}>
        <View style={[s.card, { borderWidth: 2, borderColor: colors.brand }]}>
          {current ? (
            <>
              <Text style={{ color: colors.brand, fontWeight: '700' }}>지금 할 일 {current.no}/{steps.length}</Text>
              <Text style={{ fontSize: 26, fontWeight: '800', color: colors.text, marginVertical: 6 }}>{current.title}</Text>
              <Text style={{ fontSize: 15, color: colors.text, marginBottom: 12 }}>{current.desc}</Text>
              <Btn title="하러 가기 →" onPress={() => navigation.navigate(current.tab)} />
            </>
          ) : (
            <Text style={{ fontSize: 20, fontWeight: '800', color: '#166534' }}>✅ 연습 완료</Text>
          )}
        </View>

        <View style={s.card}>
          <Text style={s.title}>순서</Text>
          {steps.map((st) => (
            <Pressable key={st.key} onPress={() => navigation.navigate(st.tab)} style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 7 }}>
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: st.done ? '#16A34A' : st.current ? colors.brand : '#D1D5DB',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginRight: 10,
                }}
              >
                <Text style={{ color: '#fff', fontWeight: '800' }}>{st.done ? '✓' : st.no}</Text>
              </View>
              <Text style={{ fontSize: 16, fontWeight: st.current ? '800' : '500', color: st.done ? colors.sub : colors.text }}>
                {st.title}
                {st.current ? '  ← 지금' : ''}
              </Text>
            </Pressable>
          ))}
        </View>

        <View style={[s.card, { backgroundColor: '#F0FDF4' }]}>
          <Text style={[s.title, { color: '#166534' }]}>📗 손실 줄이는 규칙 4개</Text>
          {RULES.map((r, i) => (
            <Text key={r} style={{ fontSize: 16, color: colors.text, paddingVertical: 3 }}>
              {i + 1}. {r}
            </Text>
          ))}
          <Text style={[s.rowSub, { marginTop: 6 }]}>주문 화면의 초록 버튼이 이 규칙대로 채워 줍니다. 손실이 0이 되지는 않습니다.</Text>
        </View>

        <Pressable onPress={() => setMore((v) => !v)}>
          <Text style={{ color: colors.brand, textAlign: 'center', padding: 8 }}>{more ? '용어 닫기 ▴' : '용어 보기 ▾'}</Text>
        </Pressable>
        {more && (
          <View style={s.card}>
            <Help label="매수 · 매도" text={HELP.side} />
            <Help label="시장가 · 지정가" text={HELP.type} />
            <Help label="목표가 · 손절가" text={HELP.target} />
            <Help label="평가손익 · 실현손익" text={HELP.pnl} />
          </View>
        )}
      </View>
    </ScrollView>
  );
}
