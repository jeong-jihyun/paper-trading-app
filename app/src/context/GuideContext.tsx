import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import { useMarket } from './MarketContext';
import { subscribeAlerts, subscribeCash, subscribeHoldings, subscribeOrders, subscribeWatchlist } from '../services/account';
import { buildSteps, type Step } from '../utils/guide';
import type { AlertDoc, HoldingDoc, OrderDoc, WatchItem } from '../types';

type Visited = { detail: boolean; account: boolean };

interface GuideValue {
  steps: Step[];
  current: Step | null; // 지금 할 일 (모두 끝났으면 null)
  doneCount: number;
  cash: number;
  holdings: HoldingDoc[];
  totalAsset: number; // 예수금 + 주식 평가금액
  markVisited: (key: keyof Visited) => void;
}

const Ctx = createContext<GuideValue>({
  steps: [],
  current: null,
  doneCount: 0,
  cash: 0,
  holdings: [],
  totalAsset: 0,
  markVisited: () => {},
});

/** 사용자의 진행 상황(관심종목·주문·알림·계좌)을 한곳에서 보고 "지금 할 일"을 계산한다. */
export function GuideProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { byCode } = useMarket();
  const [watch, setWatch] = useState<WatchItem[]>([]);
  const [holdings, setHoldings] = useState<HoldingDoc[]>([]);
  const [orders, setOrders] = useState<OrderDoc[]>([]);
  const [alerts, setAlerts] = useState<AlertDoc[]>([]);
  const [cash, setCash] = useState(0);
  const [visited, setVisited] = useState<Visited>({ detail: false, account: false });
  const uid = user?.uid;
  const storeKey = uid ? `guide-visited-${uid}` : null;

  useEffect(() => {
    if (!uid) return;
    const offs = [
      subscribeWatchlist(uid, setWatch),
      subscribeHoldings(uid, setHoldings),
      subscribeOrders(uid, setOrders),
      subscribeAlerts(uid, setAlerts),
      subscribeCash(uid, setCash),
    ];
    return () => offs.forEach((f) => f());
  }, [uid]);

  useEffect(() => {
    if (!storeKey) return;
    AsyncStorage.getItem(storeKey)
      .then((v) => v && setVisited((cur) => ({ ...cur, ...(JSON.parse(v) as Partial<Visited>) })))
      .catch(() => {});
  }, [storeKey]);

  const markVisited = useCallback(
    (key: keyof Visited) => {
      setVisited((cur) => {
        if (cur[key]) return cur;
        const next = { ...cur, [key]: true };
        if (storeKey) AsyncStorage.setItem(storeKey, JSON.stringify(next)).catch(() => {});
        return next;
      });
    },
    [storeKey],
  );

  const value = useMemo<GuideValue>(() => {
    const steps = buildSteps({
      watchCount: watch.length,
      visitedDetail: visited.detail,
      buyCount: orders.filter((o) => o.side === 'buy' && (o.status === 'filled' || o.status === 'pending')).length,
      alertCount: alerts.length,
      visitedAccount: visited.account,
      sellCount: orders.filter((o) => o.side === 'sell' && o.status === 'filled').length,
    });
    const evalSum = holdings.reduce((a, h) => a + Math.round(h.qty * (byCode[h.code]?.close ?? h.avgPrice)), 0);
    return {
      steps,
      current: steps.find((x) => x.current) ?? null,
      doneCount: steps.filter((x) => x.done).length,
      cash,
      holdings,
      totalAsset: cash + evalSum,
      markVisited,
    };
  }, [watch, visited, orders, alerts, holdings, cash, byCode, markVisited]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export const useGuide = () => useContext(Ctx);
