import React from 'react';
import { ActivityIndicator, Text, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { signOut } from 'firebase/auth';
import { auth } from './src/firebase';
import { AuthProvider, useAuth } from './src/context/AuthContext';
import { MarketProvider } from './src/context/MarketContext';
import LoginScreen from './src/screens/LoginScreen';
import WatchlistScreen from './src/screens/WatchlistScreen';
import OrderScreen from './src/screens/OrderScreen';
import AccountScreen from './src/screens/AccountScreen';
import DiscoverScreen from './src/screens/DiscoverScreen';
import StockDetailScreen from './src/screens/StockDetailScreen';
import { Btn } from './src/components/ui';
import { colors } from './src/utils/format';
import type { RootParamList, TabParamList } from './src/navigation';

const TAB_ICONS: Record<keyof TabParamList, string> = {
  Watchlist: '⭐',
  Order: '🧾',
  Account: '💼',
  Discover: '🔔',
};

const Tab = createBottomTabNavigator<TabParamList>();
const Stack = createNativeStackNavigator<RootParamList>();

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.brand },
        headerTintColor: '#fff',
        tabBarActiveTintColor: colors.brand,
        // 기본 아이콘 글꼴이 웹에서 네모로 보이는 문제를 피하려고 이모지를 쓴다
        tabBarIcon: ({ focused }) => <Text style={{ fontSize: 20, opacity: focused ? 1 : 0.55 }}>{TAB_ICONS[route.name]}</Text>,
      })}
    >
      <Tab.Screen
        name="Watchlist"
        component={WatchlistScreen}
        options={{
          title: '관심종목',
          headerRight: () => <Btn title="로그아웃" kind="ghost" onPress={() => signOut(auth)} style={{ marginRight: 8, paddingVertical: 6 }} />,
        }}
      />
      <Tab.Screen name="Order" component={OrderScreen} options={{ title: '주문' }} />
      <Tab.Screen name="Account" component={AccountScreen} options={{ title: '계좌정보' }} />
      <Tab.Screen name="Discover" component={DiscoverScreen} options={{ title: '발굴·알림' }} />
    </Tab.Navigator>
  );
}

function Root() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center' }}>
        <ActivityIndicator size="large" color={colors.brand} />
      </View>
    );
  }
  if (!user) return <LoginScreen />;
  return (
    <MarketProvider>
      <Stack.Navigator>
        <Stack.Screen name="Tabs" component={Tabs} options={{ headerShown: false }} />
        <Stack.Screen
          name="StockDetail"
          component={StockDetailScreen}
          options={{ title: '현재가', headerStyle: { backgroundColor: colors.brand }, headerTintColor: '#fff' }}
        />
      </Stack.Navigator>
    </MarketProvider>
  );
}

export default function App() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <NavigationContainer>
          <StatusBar style="light" />
          <Root />
        </NavigationContainer>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
