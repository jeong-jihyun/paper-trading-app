import React from 'react';
import { Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle } from 'react-native';
import Svg, { Polyline } from 'react-native-svg';
import { changeColor, colors, pct, signed, won } from '../utils/format';
import { DATA_SOURCE_NOTICE, MOCK_NOTICE } from '../config';
import type { Quote } from '../types';

export function Notice({ date }: { date?: string }) {
  return (
    <View style={s.notice}>
      <Text style={s.noticeText}>{MOCK_NOTICE}</Text>
      <Text style={s.noticeSub}>
        {DATA_SOURCE_NOTICE}
        {date ? ` · 기준일 ${date.slice(0, 4)}.${date.slice(4, 6)}.${date.slice(6, 8)}` : ''}
      </Text>
    </View>
  );
}

export function Btn(props: { title: string; onPress: () => void; kind?: 'primary' | 'buy' | 'sell' | 'ghost'; disabled?: boolean; style?: ViewStyle }) {
  const bg = props.kind === 'buy' ? colors.up : props.kind === 'sell' ? colors.down : props.kind === 'ghost' ? '#E5E7EB' : colors.brand;
  const fg = props.kind === 'ghost' ? colors.text : '#fff';
  return (
    <Pressable
      onPress={props.onPress}
      disabled={props.disabled}
      style={[s.btn, { backgroundColor: bg, opacity: props.disabled ? 0.4 : 1 }, props.style]}
    >
      <Text style={{ color: fg, fontWeight: '700' }}>{props.title}</Text>
    </Pressable>
  );
}

export function Field(props: TextInputProps & { label: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={s.label}>{label}</Text>
      <TextInput placeholderTextColor="#9CA3AF" style={[s.input, style]} {...rest} />
    </View>
  );
}

export function Segment<T extends string>(props: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <View style={s.segment}>
      {props.options.map((o) => (
        <Pressable key={o.value} onPress={() => props.onChange(o.value)} style={[s.segItem, props.value === o.value && s.segOn]}>
          <Text style={{ color: props.value === o.value ? '#fff' : colors.text, fontWeight: '600' }}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function QuoteRow({ q, onPress, right }: { q: Quote; onPress?: () => void; right?: React.ReactNode }) {
  const c = changeColor(q.change);
  return (
    <Pressable onPress={onPress} style={s.row}>
      <View style={{ flex: 1 }}>
        <Text style={s.rowName}>{q.name}</Text>
        <Text style={s.rowSub}>
          {q.code} · {q.market}
        </Text>
      </View>
      {right ?? (
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={[s.rowPrice, { color: c }]}>{won(q.close)}</Text>
          <Text style={{ color: c, fontSize: 12 }}>
            {signed(q.change)} ({pct(q.rate)})
          </Text>
        </View>
      )}
    </Pressable>
  );
}

export function LineChart({ values, width = 320, height = 140 }: { values: number[]; width?: number; height?: number }) {
  if (values.length < 2) return <Text style={s.rowSub}>차트 데이터가 아직 부족합니다.</Text>;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pts = values
    .map((v, i) => `${(i / (values.length - 1)) * width},${height - 6 - ((v - min) / span) * (height - 12)}`)
    .join(' ');
  const up = values[values.length - 1] >= values[0];
  return (
    <Svg width={width} height={height}>
      <Polyline points={pts} fill="none" stroke={up ? colors.up : colors.down} strokeWidth={2} />
    </Svg>
  );
}

export const s = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: 14 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, marginBottom: 12 },
  title: { fontSize: 18, fontWeight: '800', color: colors.text, marginBottom: 8 },
  label: { fontSize: 12, color: colors.sub, marginBottom: 4 },
  input: { backgroundColor: '#fff', borderWidth: 1, borderColor: colors.line, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 15 },
  btn: { borderRadius: 10, paddingVertical: 12, paddingHorizontal: 16, alignItems: 'center' },
  notice: { backgroundColor: '#FEF3C7', paddingVertical: 6, paddingHorizontal: 12 },
  noticeText: { fontSize: 12, fontWeight: '700', color: '#92400E' },
  noticeSub: { fontSize: 11, color: '#92400E' },
  segment: { flexDirection: 'row', backgroundColor: '#E5E7EB', borderRadius: 10, padding: 3, marginBottom: 10 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: 8 },
  segOn: { backgroundColor: colors.brand },
  row: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#fff', padding: 14, borderBottomWidth: 1, borderBottomColor: colors.line },
  rowName: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowSub: { fontSize: 12, color: colors.sub },
  rowPrice: { fontSize: 16, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.sub, marginTop: 40 },
});
