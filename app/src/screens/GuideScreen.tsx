import React from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useGuide } from '../context/GuideContext';
import { useMarket } from '../context/MarketContext';
import { Btn, Notice, s } from '../components/ui';
import { Help, g } from '../components/guide';
import { GUIDE_DISCLAIMER, HELP, INVEST_TIPS, MODEL_HONEST, MODEL_STEPS, ORDER_FLOW } from '../utils/guide';
import { colors, won } from '../utils/format';
import type { TabParamList } from '../navigation';

/** 가이드 탭: 무엇을 어떤 순서로 하면 되는지 한눈에 본다. */
export default function GuideScreen({ navigation }: BottomTabScreenProps<TabParamList, 'Guide'>) {
  const { steps, current, doneCount, totalAsset, cash } = useGuide();
  const { date, quotes, loading } = useMarket();
  const ratio = steps.length ? doneCount / steps.length : 0;

  return (
    <ScrollView style={s.screen}>
      <Notice date={date} />
      <View style={s.pad}>
        {!loading && quotes.length === 0 && (
          <View style={[g.issue, { backgroundColor: '#FEE2E2' }]}>
            <Text style={{ color: '#991B1B', fontWeight: '700' }}>⛔ 시세를 불러오지 못했습니다.</Text>
            <Text style={{ color: '#991B1B', fontSize: 13 }}>→ 인터넷 연결을 확인하고 관심종목 탭에서 화면을 아래로 당겨 새로고침하세요.</Text>
          </View>
        )}

        {/* 지금 할 일 */}
        <View style={[s.card, { borderWidth: 2, borderColor: colors.brand }]}>
          <Text style={g.bannerStep}>지금 할 일</Text>
          {current ? (
            <>
              <Text style={{ fontSize: 20, fontWeight: '800', color: colors.text, marginTop: 2 }}>
                {current.no}단계 · {current.title}
              </Text>
              <Text style={{ color: colors.text, lineHeight: 20, marginVertical: 8 }}>{current.desc}</Text>
              <Btn title={`${current.tabLabel} 탭으로 가기 →`} onPress={() => navigation.navigate(current.tab)} />
            </>
          ) : (
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#166534', marginTop: 4 }}>
              ✅ 연습 순서를 모두 마쳤습니다. 이제 아래 원칙대로 종목과 수량을 바꿔 가며 연습하세요.
            </Text>
          )}
          <Text style={[s.rowSub, { marginTop: 10 }]}>
            내 자산 {won(totalAsset)}원 (예수금 {won(cash)}원)
          </Text>
        </View>

        {/* 연습 순서 (워크플로) */}
        <View style={s.card}>
          <Text style={s.title}>연습 순서 한눈에 보기</Text>
          <View style={{ height: 8, backgroundColor: '#E5E7EB', borderRadius: 4, marginBottom: 4 }}>
            <View style={{ height: 8, width: `${Math.round(ratio * 100)}%`, backgroundColor: '#16A34A', borderRadius: 4 }} />
          </View>
          <Text style={[s.rowSub, { marginBottom: 10 }]}>
            {steps.length}단계 중 {doneCount}단계 완료
          </Text>
          {steps.map((st, i) => {
            const circle = st.done ? '#16A34A' : st.current ? colors.brand : '#D1D5DB';
            return (
              <Pressable key={st.key} onPress={() => navigation.navigate(st.tab)} style={{ flexDirection: 'row' }}>
                <View style={{ alignItems: 'center', width: 34 }}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: circle, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontWeight: '800' }}>{st.done ? '✓' : st.no}</Text>
                  </View>
                  {i < steps.length - 1 && <View style={{ flex: 1, width: 2, backgroundColor: st.done ? '#16A34A' : '#E5E7EB', minHeight: 14 }} />}
                </View>
                <View
                  style={{
                    flex: 1,
                    marginLeft: 8,
                    marginBottom: 10,
                    padding: st.current ? 10 : 0,
                    borderRadius: 8,
                    backgroundColor: st.current ? '#EEF4FA' : 'transparent',
                  }}
                >
                  <Text style={{ fontWeight: '800', fontSize: 15, color: st.done ? colors.sub : colors.text, textDecorationLine: st.done ? 'line-through' : 'none' }}>
                    {st.title}
                    {st.current ? '  ← 지금' : ''}
                  </Text>
                  <Text style={{ color: colors.sub, fontSize: 12, marginTop: 1 }}>
                    {st.tabLabel} 탭 · {st.done ? '완료' : st.current ? '할 차례' : '다음에'}
                  </Text>
                  {st.current && <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 4 }}>{st.desc}</Text>}
                </View>
              </Pressable>
            );
          })}
        </View>

        {/* 주문 한 번의 흐름 */}
        <View style={s.card}>
          <Text style={s.title}>주문 한 번은 이렇게 흘러갑니다</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center' }}>
            {ORDER_FLOW.map((name, i) => (
              <View key={name} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <Text style={[g.chip, { backgroundColor: '#EEF4FA', color: colors.brand }]}>
                  {i + 1}. {name}
                </Text>
                {i < ORDER_FLOW.length - 1 && <Text style={{ color: colors.sub, marginHorizontal: 4 }}>→</Text>}
              </View>
            ))}
          </View>
          <Text style={s.rowSub}>잘못 고르면 주문 버튼 위에 빨간 안내가 뜨고, 고치는 방법을 알려줍니다.</Text>
        </View>

        {/* 모범 답안 */}
        <View style={[s.card, { borderWidth: 1, borderColor: '#86EFAC', backgroundColor: '#F0FDF4' }]}>
          <Text style={[s.title, { color: '#166534' }]}>📗 모범 답안: 손실을 작게 묶는 주문</Text>
          <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, marginBottom: 10 }}>{MODEL_HONEST}</Text>
          {MODEL_STEPS.map((t) => (
            <View key={t.title} style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '800', color: colors.text }}>{t.title}</Text>
              <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 2 }}>{t.body}</Text>
            </View>
          ))}
          <Text style={s.rowSub}>주문 화면에서 종목마다 이 답안을 실제 숫자(수량·손절가·목표가)로 계산해 보여주고, 내 주문과 비교합니다.</Text>
        </View>

        {/* 투자 원칙 */}
        <View style={s.card}>
          <Text style={s.title}>투자는 이렇게 연습하세요</Text>
          {INVEST_TIPS.map((t) => (
            <View key={t.title} style={{ marginBottom: 10 }}>
              <Text style={{ fontWeight: '800', color: colors.text }}>{t.title}</Text>
              <Text style={{ color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 2 }}>{t.body}</Text>
            </View>
          ))}
          <Text style={s.rowSub}>{GUIDE_DISCLAIMER}</Text>
        </View>

        {/* 용어 도움말 */}
        <View style={s.card}>
          <Text style={s.title}>용어 도움말 (눌러서 펼치기)</Text>
          <Help label="매수 · 매도" text={HELP.side} />
          <Help label="시장가 · 지정가" text={HELP.type} />
          <Help label="미체결 주문" text={HELP.pending} />
          <Help label="목표가 · 손절가" text={HELP.target} />
          <Help label="총평가금액 · 예수금" text={HELP.total} />
          <Help label="평가손익 · 실현손익" text={HELP.pnl} />
          <Help label="평균단가" text={HELP.avg} />
          <Help label="시가 · 고가 · 저가 · 거래량" text={HELP.price} />
          <Help label="수수료 · 세금" text={HELP.est} />
        </View>
      </View>
    </ScrollView>
  );
}
