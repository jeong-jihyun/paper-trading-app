import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { Field, QuoteRow } from './ui';
import { useMarket } from '../context/MarketContext';
import type { Quote } from '../types';

/** 종목명 또는 코드로 검색해서 고른다. */
export function StockSearch({ onPick }: { onPick: (q: Quote) => void }) {
  const { quotes } = useMarket();
  const [text, setText] = useState('');
  const results = useMemo(() => {
    const t = text.trim().toUpperCase();
    if (!t) return [];
    return quotes.filter((q) => q.name.toUpperCase().includes(t) || q.code.toUpperCase().includes(t)).slice(0, 15);
  }, [text, quotes]);

  return (
    <View>
      <Field label="종목 검색 (이름 또는 코드)" value={text} onChangeText={setText} placeholder="예: 삼성전자, A005930" />
      {results.map((q) => (
        <QuoteRow
          key={q.code}
          q={q}
          onPress={() => {
            onPick(q);
            setText('');
          }}
        />
      ))}
    </View>
  );
}
