import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { loadMarket } from '../services/market';
import type { Quote } from '../types';

interface MarketValue {
  quotes: Quote[];
  byCode: Record<string, Quote>;
  date: string; // 시세 기준일 YYYYMMDD
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

const Ctx = createContext<MarketValue>({
  quotes: [],
  byCode: {},
  date: '',
  loading: true,
  error: null,
  reload: async () => {},
});

export function MarketProvider({ children }: { children: React.ReactNode }) {
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      setQuotes(await loadMarket());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : '시세를 불러오지 못했습니다.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const value = useMemo<MarketValue>(() => {
    const byCode: Record<string, Quote> = {};
    for (const q of quotes) byCode[q.code] = q;
    return { quotes, byCode, date: quotes[0]?.date ?? '', loading, error, reload };
  }, [quotes, loading, error, reload]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useMarket = () => useContext(Ctx);
