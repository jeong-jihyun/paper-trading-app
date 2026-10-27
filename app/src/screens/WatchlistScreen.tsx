import React, { useEffect, useState } from 'react';
import { FlatList, RefreshControl, Text, View } from 'react-native';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { useAuth } from '../context/AuthContext';
import { useMarket } from '../context/MarketContext';
import { setWatch, subscribeWatchlist } from '../services/account';
import { Notice, QuoteRow, s } from '../components/ui';
import { StockSearch } from '../components/StockSearch';
import type { WatchItem } from '../types';
import type { TabParamList } from '../navigation';

export default function WatchlistScreen({ navigation }: BottomTabScreenProps<TabParamList, 'Watchlist'>) {
  const { user } = useAuth();
  const { byCode, date, loading, error, reload } = useMarket();
  const [items, setItems] = useState<WatchItem[]>([]);

  useEffect(() => (user ? subscribeWatchlist(user.uid, setItems) : undefined), [user]);

  return (
    <View style={s.screen}>
      <Notice date={date} />
      <FlatList
        data={items}
        keyExtractor={(i) => i.code}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={reload} />}
        ListHeaderComponent={
          <View style={s.pad}>
            <StockSearch onPick={(q) => user && setWatch(user.uid, q.code, q.name, true)} />
            {error && <Text style={{ color: 'red' }}>{error}</Text>}
          </View>
        }
        ListEmptyComponent={<Text style={s.empty}>위에서 종목을 검색해 관심종목에 추가하세요.</Text>}
        renderItem={({ item }) => {
          const q = byCode[item.code];
          if (!q) return null;
          return <QuoteRow q={q} onPress={() => navigation.getParent()?.navigate('StockDetail', { code: q.code })} />;
        }}
      />
    </View>
  );
}
