import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase';
import { Btn, Field, Notice, s } from '../components/ui';
import { colors } from '../utils/format';
import { notify } from '../utils/notify';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  const run = async (mode: 'login' | 'signup') => {
    setBusy(true);
    try {
      if (mode === 'login') await signInWithEmailAndPassword(auth, email.trim(), password);
      else await createUserWithEmailAndPassword(auth, email.trim(), password);
    } catch (e) {
      notify(mode === 'login' ? '로그인 실패' : '가입 실패', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setBusy(false);
    }
  };

  const reset = async () => {
    if (!email.trim()) return notify('비밀번호 재설정', '위에 이메일을 먼저 입력하세요.');
    setBusy(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      notify('메일을 보냈습니다', '받은편지함(스팸함 포함)의 링크로 새 비밀번호를 정한 뒤 다시 로그인하세요.');
    } catch (e) {
      notify('재설정 실패', e instanceof Error ? e.message : '알 수 없는 오류');
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView style={s.screen} contentContainerStyle={s.pad}>
      <Notice />
      <Text style={[s.title, { marginTop: 24, fontSize: 24, color: colors.brand }]}>모의투자 트레이더</Text>
      {!isFirebaseConfigured && (
        <Text style={{ color: colors.up, marginBottom: 12 }}>
          Firebase 설정이 비어 있습니다. app/.env 파일에 값을 채운 뒤 앱을 다시 시작하세요.
        </Text>
      )}
      <Field label="이메일" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" />
      <Field label="비밀번호 (6자 이상)" value={password} onChangeText={setPassword} secureTextEntry />
      <Btn title="로그인" onPress={() => run('login')} disabled={busy} />
      <Btn title="회원가입 (가상 자금 1억 원 지급)" kind="ghost" onPress={() => run('signup')} disabled={busy} style={{ marginTop: 10 }} />
      <Btn title="비밀번호를 잊었어요 (재설정 메일 받기)" kind="ghost" onPress={reset} disabled={busy} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}
