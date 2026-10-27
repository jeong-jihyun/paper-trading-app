// 데모 전용(화면 미리보기용): firebase/auth 대체. 주소 끝에 #login 이 있으면 로그아웃 상태로 시작한다.
type User = { uid: string; email: string };
type Listener = (u: User | null) => void;

const demoUser: User = { uid: 'demo-user', email: 'demo@example.com' };
const listeners = new Set<Listener>();
const startLoggedOut = typeof window !== 'undefined' && window.location.hash === '#login';
let current: User | null = startLoggedOut ? null : demoUser;

const emit = () => listeners.forEach((l) => l(current));
const auth = { get currentUser() { return current; } };

export const getAuth = () => auth;
export const initializeAuth = () => auth;
export const getReactNativePersistence = () => ({});
export const onAuthStateChanged = (_a: unknown, cb: Listener) => {
  listeners.add(cb);
  setTimeout(() => cb(current), 50);
  return () => listeners.delete(cb);
};
export const signInWithEmailAndPassword = async (_a: unknown, email: string) => {
  current = { uid: 'demo-user', email };
  emit();
};
export const createUserWithEmailAndPassword = signInWithEmailAndPassword;
export const signOut = async () => {
  current = null;
  emit();
};
export type { User };
