import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { BottomTabNavigationProp } from '@react-navigation/bottom-tabs';
import { useGuide } from '../context/GuideContext';
import { colors } from '../utils/format';
import type { Issue } from '../utils/guide';
import type { TabParamList } from '../navigation';

/** 도움말(툴팁). "ⓘ 제목"을 누르면 바로 아래에 설명이 펼쳐진다. */
export function Help({ label, text, open: initial = false }: { label: string; text: string; open?: boolean }) {
  const [open, setOpen] = useState(initial);
  return (
    <View style={{ marginBottom: 6 }}>
      <Pressable onPress={() => setOpen((v) => !v)} hitSlop={8} style={g.helpRow} accessibilityRole="button" accessibilityLabel={`${label} 도움말`}>
        <Text style={g.helpIcon}>{open ? '▾' : 'ⓘ'}</Text>
        <Text style={g.helpLabel}>{label}</Text>
      </Pressable>
      {open && (
        <View style={g.bubble}>
          <Text style={g.bubbleText}>{text}</Text>
        </View>
      )}
    </View>
  );
}

const LEVEL = {
  error: { bg: '#FEE2E2', fg: '#991B1B', icon: '⛔', name: '고쳐야 주문됩니다' },
  warn: { bg: '#FEF3C7', fg: '#92400E', icon: '⚠️', name: '주의' },
  info: { bg: '#E0F2FE', fg: '#075985', icon: '💡', name: '안내' },
} as const;

/** 입력이 올바른지 점검한 결과를 색으로 구분해 보여준다. */
export function IssueList({ issues, okText }: { issues: Issue[]; okText?: string }) {
  if (issues.length === 0) {
    return okText ? (
      <View style={[g.issue, { backgroundColor: '#DCFCE7' }]}>
        <Text style={{ color: '#166534', fontWeight: '700' }}>✅ {okText}</Text>
      </View>
    ) : null;
  }
  return (
    <View>
      {issues.map((it, i) => {
        const lv = LEVEL[it.level];
        return (
          <View key={i} style={[g.issue, { backgroundColor: lv.bg }]}>
            <Text style={{ color: lv.fg, fontWeight: '700' }}>
              {lv.icon} {lv.name}: {it.msg}
            </Text>
            {it.how && <Text style={{ color: lv.fg, marginTop: 2, fontSize: 13 }}>→ {it.how}</Text>}
          </View>
        );
      })}
    </View>
  );
}

/** 각 탭 맨 위의 "지금 할 일" 띠. here = 이 탭의 이름. */
export function GuideBanner({ here }: { here: keyof TabParamList }) {
  const { current, doneCount, steps } = useGuide();
  const nav = useNavigation<BottomTabNavigationProp<TabParamList>>();
  if (steps.length === 0) return null;
  if (!current) {
    return (
      <Pressable style={[g.banner, { backgroundColor: '#DCFCE7', borderColor: '#86EFAC' }]} onPress={() => nav.navigate('Guide')}>
        <Text style={{ color: '#166534', fontWeight: '700' }}>✅ 연습 순서를 모두 마쳤습니다. 가이드에서 투자 원칙을 다시 볼 수 있습니다.</Text>
      </Pressable>
    );
  }
  const onThisTab = current.tab === here;
  return (
    <View style={g.banner}>
      <Text style={g.bannerStep}>
        지금 할 일 · {current.no}/{steps.length}단계 (완료 {doneCount})
      </Text>
      <Text style={g.bannerTitle}>{current.title}</Text>
      <Text style={g.bannerDesc}>{current.desc}</Text>
      <View style={{ flexDirection: 'row', marginTop: 8 }}>
        {onThisTab ? (
          <Text style={[g.chip, { backgroundColor: colors.brand, color: '#fff' }]}>👇 이 화면에서 하면 됩니다</Text>
        ) : (
          <Pressable onPress={() => nav.navigate(current.tab)}>
            <Text style={[g.chip, { backgroundColor: colors.brand, color: '#fff' }]}>{current.tabLabel} 탭으로 가기 →</Text>
          </Pressable>
        )}
        <Pressable onPress={() => nav.navigate('Guide')}>
          <Text style={[g.chip, { marginLeft: 8 }]}>전체 순서 보기</Text>
        </Pressable>
      </View>
    </View>
  );
}

export const g = StyleSheet.create({
  helpRow: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start' },
  helpIcon: { color: colors.brand, fontSize: 14, fontWeight: '800', width: 18 },
  helpLabel: { color: colors.brand, fontSize: 13, fontWeight: '600', textDecorationLine: 'underline' },
  bubble: { backgroundColor: '#EEF4FA', borderLeftWidth: 3, borderLeftColor: colors.brand, borderRadius: 6, padding: 10, marginTop: 4 },
  bubbleText: { color: colors.text, fontSize: 13, lineHeight: 19 },
  issue: { borderRadius: 8, padding: 10, marginBottom: 8 },
  banner: { backgroundColor: '#EEF4FA', borderColor: '#BFD4E8', borderWidth: 1, borderRadius: 12, padding: 12, marginBottom: 12 },
  bannerStep: { color: colors.brand, fontSize: 12, fontWeight: '700' },
  bannerTitle: { color: colors.text, fontSize: 16, fontWeight: '800', marginTop: 2 },
  bannerDesc: { color: colors.text, fontSize: 13, lineHeight: 19, marginTop: 2 },
  chip: { backgroundColor: '#E5E7EB', color: colors.text, fontWeight: '700', fontSize: 13, paddingVertical: 7, paddingHorizontal: 12, borderRadius: 16, overflow: 'hidden' },
});
