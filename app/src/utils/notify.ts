import { Alert, Platform } from 'react-native';

/** 안내창. 앱에서는 기본 Alert, 웹 브라우저에서는 Alert.alert가 동작하지 않아 window.alert를 쓴다. */
export function notify(title: string, message?: string): void {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined') window.alert(message ? `${title}\n\n${message}` : title);
    return;
  }
  Alert.alert(title, message);
}
