import React, { useState } from 'react';
import { ScrollView, Text } from 'react-native';
import { createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword } from 'firebase/auth';
import { auth, isFirebaseConfigured } from '../firebase';
import { Btn, Field, Notice, s } from '../components/ui';
import { colors } from '../utils/format';
import { notify } from '../utils/notify';

/** Firebase 오류 코드를 "무슨 일인지 + 어떻게 하면 되는지"로 바꾼다. */
function explain(e: unknown): string {
  const code = (e as { code?: string })?.code ?? '';
  const map: Record<string, string> = {
    'auth/invalid-credential': '이메일 또는 비밀번호가 맞지 않습니다.\n→ 비밀번호가 기억나지 않으면 아래 "비밀번호를 잊었어요"를 누르세요.\n→ 처음이라면 "회원가입"을 누르세요.',
    'auth/email-already-in-use': '이미 가입된 이메일입니다.\n→ "회원가입"이 아니라 "로그인"을 누르세요.\n→ 비밀번호가 기억나지 않으면 "비밀번호를 잊었어요"를 누르세요.',
    'auth/invalid-email': '이메일 형식이 올바르지 않습니다.\n→ name@example.com 처럼 적으세요.',
    'auth/missing-password': '비밀번호를 입력하세요.',
    'auth/weak-password': '비밀번호가 너무 짧습니다.\n→ 6자 이상으로 정하세요.',
    'auth/network-request-failed': '인터넷에 연결되지 않았습니다.\n→ 와이파이·데이터를 확인하고 다시 시도하세요.',
    'auth/too-many-requests': '시도가 너무 많아 잠시 막혔습니다.\n→ 몇 분 뒤에 다시 하거나 비밀번호를 재설정하세요.',
  };
  return map[code] ?? (e instanceof Error ? e.message : '알 수 없는 오류');
}

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
      notify(mode === 'login' ? '로그인 실패' : '가입 실패', explain(e));
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
      notify('재설정 실패', explain(e));
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
      <Text style={{ color: colors.sub, fontSize: 13, marginBottom: 10 }}>
        처음이면 이메일·비밀번호를 적고 "회원가입"을, 가입한 적이 있으면 "로그인"을 누르세요.
      </Text>
      <Btn title="로그인" onPress={() => run('login')} disabled={busy} />
      <Btn title="회원가입 (가상 자금 1억 원 지급)" kind="ghost" onPress={() => run('signup')} disabled={busy} style={{ marginTop: 10 }} />
      <Btn title="비밀번호를 잊었어요 (재설정 메일 받기)" kind="ghost" onPress={reset} disabled={busy} style={{ marginTop: 10 }} />
    </ScrollView>
  );
}
