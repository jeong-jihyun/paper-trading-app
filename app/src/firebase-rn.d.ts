// Firebase의 React Native 전용 함수는 앱 실행(Metro) 때는 정상적으로 불러와지지만,
// TypeScript 기본 설정에서는 타입이 안 보여서 직접 선언해 준다.
import type { Persistence } from 'firebase/auth';

declare module 'firebase/auth' {
  export function getReactNativePersistence(storage: unknown): Persistence;
}
