// 데모 전용(화면 미리보기용): firebase/firestore 를 메모리 DB로 흉내 낸다. 실제 앱 코드에는 쓰이지 않는다.
/* eslint-disable @typescript-eslint/no-explicit-any */
import { seed } from './seed';

const store = new Map<string, any>(Object.entries(seed()));
type Listener = () => void;
const listeners = new Set<Listener>();
const notify = () => listeners.forEach((l) => l());
let autoId = 0;

interface Ref { path: string; id: string; kind: 'doc' | 'col' }
const join = (segs: any[]): string => segs.filter((s) => typeof s === 'string').join('/');

export const getFirestore = () => ({ __db: true });
export const collection = (base: any, ...segs: string[]): Ref => {
  const path = base?.path ? [base.path, ...segs].join('/') : segs.join('/');
  return { path, id: path.split('/').pop() as string, kind: 'col' };
};
export const doc = (base: any, ...segs: string[]): Ref => {
  if (base?.kind === 'col' && segs.length === 0) {
    const id = `auto${++autoId}${Date.now().toString(36)}`;
    return { path: `${base.path}/${id}`, id, kind: 'doc' };
  }
  const path = base?.path ? [base.path, ...segs].join('/') : join(segs);
  return { path, id: path.split('/').pop() as string, kind: 'doc' };
};
export const orderBy = (field: string, dir: 'asc' | 'desc' = 'asc') => ({ t: 'order', field, dir });
export const limit = (n: number) => ({ t: 'limit', n });
export const query = (col: Ref, ...parts: any[]) => ({ ...col, parts });

const snapOf = (path: string) => {
  const data = store.get(path);
  return { id: path.split('/').pop() as string, exists: () => data !== undefined, data: () => data, ref: { path } };
};
const listCol = (q: any) => {
  const prefix = `${q.path}/`;
  let rows = [...store.entries()]
    .filter(([p]) => p.startsWith(prefix) && !p.slice(prefix.length).includes('/'))
    .map(([p, d]) => ({ id: p.slice(prefix.length), data: () => d, _d: d }));
  for (const part of q.parts ?? []) {
    if (part.t === 'order') rows.sort((a, b) => (part.dir === 'desc' ? -1 : 1) * ((a._d[part.field] ?? 0) - (b._d[part.field] ?? 0)));
    if (part.t === 'limit') rows = rows.slice(0, part.n);
  }
  return { docs: rows };
};

export const getDoc = async (ref: Ref) => snapOf(ref.path);
export const setDoc = async (ref: Ref, data: any) => { store.set(ref.path, { ...data }); notify(); };
export const updateDoc = async (ref: Ref, data: any) => { store.set(ref.path, { ...store.get(ref.path), ...data }); notify(); };
export const deleteDoc = async (ref: Ref) => { store.delete(ref.path); notify(); };
export const addDoc = async (col: Ref, data: any) => { const r = doc(col); store.set(r.path, { ...data }); notify(); return r; };

export const onSnapshot = (target: any, cb: (s: any) => void) => {
  const fire = () => cb(target.kind === 'doc' ? snapOf(target.path) : listCol(target));
  listeners.add(fire);
  setTimeout(fire, 0);
  return () => listeners.delete(fire);
};

export const runTransaction = async (_db: any, fn: (tx: any) => Promise<any>) => {
  const writes: Array<() => void> = [];
  const tx = {
    get: async (ref: Ref) => snapOf(ref.path),
    set: (ref: Ref, data: any) => writes.push(() => store.set(ref.path, { ...data })),
    update: (ref: Ref, data: any) => writes.push(() => store.set(ref.path, { ...store.get(ref.path), ...data })),
    delete: (ref: Ref) => writes.push(() => store.delete(ref.path)),
  };
  const result = await fn(tx);
  writes.forEach((w) => w());
  notify();
  return result;
};
export type Unsubscribe = () => void;
