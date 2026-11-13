import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { ADMIN_EMAIL, DEMO_EMAIL, DEMO_PASSWORD, auth, db, firebaseEnabled } from './firebase'
import { FirestoreBackend, MemoryBackend, emptyData, loadAll, type Backend } from './backend'
import { createActions, type Actions } from './actions'
import { generateSeed } from './seed'
import type { Data } from './types'

/** admin: DB에 실제 저장 / demo: 체험 모드(저장 안 됨, 개인정보 마스킹) */
export type Role = 'admin' | 'demo'
export interface Session { email: string; role: Role }

interface Ctx {
  session: Session | null
  booting: boolean
  loading: boolean
  data: Data
  actions: Actions
  storage: 'firestore' | 'memory'
  firebaseEnabled: boolean
  login(email: string, password: string): Promise<void>
  loginDemo(): Promise<void>
  logout(): Promise<void>
  reseed(): Promise<void>
}
const StoreContext = createContext<Ctx | null>(null)

export function StoreProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [booting, setBooting] = useState(firebaseEnabled)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<Data>(emptyData)
  const [backend, setBackend] = useState<Backend>(() => new MemoryBackend(emptyData()))
  const unsub = useRef<() => void>()

  const attach = useCallback((b: Backend, s: Session) => {
    unsub.current?.()
    setBackend(b)
    setSession(s)
    unsub.current = b.subscribe((d) => { setData(d); setLoading(false) })
  }, [])

  // Firebase 로그인 상태가 바뀔 때마다 역할에 맞는 저장소를 연결
  useEffect(() => {
    if (!auth || !db) return
    return onAuthStateChanged(auth, async (user) => {
      if (!user?.email) {
        unsub.current?.(); setSession(null); setData(emptyData()); setBooting(false)
        return
      }
      const role: Role = user.email.toLowerCase() === ADMIN_EMAIL ? 'admin' : 'demo'
      setLoading(true)
      try {
        if (role === 'admin') attach(new FirestoreBackend(db!), { email: user.email, role })
        else {
          const loaded = await loadAll(db!)
          attach(new MemoryBackend(loaded.products.length ? loaded : generateSeed()), { email: user.email, role })
        }
      } finally { setBooting(false) }
    })
  }, [attach])

  const value = useMemo<Ctx>(() => ({
    session, booting, loading, data, firebaseEnabled,
    storage: backend.kind,
    actions: createActions(backend, session?.email ?? 'demo'),
    async login(email, password) {
      if (!auth) throw new Error('Firebase 설정이 없어 관리자 로그인을 사용할 수 없습니다.')
      await signInWithEmailAndPassword(auth, email, password)
    },
    async loginDemo() {
      if (auth && DEMO_EMAIL) await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD)
      else attach(new MemoryBackend(generateSeed()), { email: 'demo@local', role: 'demo' })
    },
    async logout() {
      if (auth?.currentUser) await signOut(auth)
      else { unsub.current?.(); setSession(null) }
    },
    async reseed() { await backend.replaceAll(generateSeed()) },
  }), [session, booting, loading, data, backend, attach])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

export function useStore() {
  const v = useContext(StoreContext)
  if (!v) throw new Error('StoreProvider 밖에서 useStore 를 호출했습니다.')
  return v
}
