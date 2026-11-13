import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { onAuthStateChanged, signInWithEmailAndPassword, signOut } from 'firebase/auth'
import { ADMIN_EMAIL, DEMO_EMAIL, DEMO_PASSWORD, auth, db, firebaseEnabled } from './firebase'
import { FirestoreBackend, MemoryBackend, emptyData, loadAll, type Backend } from './backend'
import { createActions, type Actions } from './actions'
import { generateSeed } from './seed'
import { applySettings } from './settings'
import type { Data } from './types'

/** admin: DB에 실제 저장 / demo: 체험 모드(저장 안 됨, 개인정보 마스킹) */
export type Role = 'admin' | 'demo'
export interface Session { email: string; role: Role }

interface Ctx {
  session: Session | null
  booting: boolean
  loading: boolean
  error: string
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
  const [error, setError] = useState('')
  const [data, setData] = useState<Data>(emptyData)
  const [backend, setBackend] = useState<Backend>(() => new MemoryBackend(emptyData()))
  const unsub = useRef<() => void>()

  const attach = useCallback((b: Backend, s: Session) => {
    unsub.current?.()
    setBackend(b)
    setSession(s)
    setError('')
    unsub.current = b.subscribe(
      (d) => { applySettings(d.settings[0]); setData(d); setLoading(false) },
      (e) => { setError(explain(e)); setLoading(false) },
    )
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
          // DB를 읽지 못해도 체험은 가능하도록 시연 자료로 대체
          const loaded = await loadAll(db!).catch(() => emptyData())
          attach(new MemoryBackend(loaded.products.length ? fillMissing(loaded) : generateSeed()), { email: user.email, role })
        }
      } finally { setBooting(false) }
    })
  }, [attach])

  const value = useMemo<Ctx>(() => ({
    session, booting, loading, error, data, firebaseEnabled,
    storage: backend.kind,
    actions: createActions(backend, session?.email ?? 'demo'),
    async login(email, password) {
      if (!auth) throw new Error('Firebase 설정이 없어 관리자 로그인을 사용할 수 없습니다.')
      await signInWithEmailAndPassword(auth, email, password)
    },
    async loginDemo() {
      // 체험 계정 로그인이 실패해도(계정 미생성·비밀번호 불일치) 시연 자료로 체험은 가능하게
      if (auth && DEMO_EMAIL && DEMO_EMAIL.toLowerCase() !== ADMIN_EMAIL) {
        try { await signInWithEmailAndPassword(auth, DEMO_EMAIL, DEMO_PASSWORD); return }
        catch (e) { console.warn('[demo] 체험 계정 로그인 실패, 로컬 시연 자료로 전환', (e as { code?: string }).code) }
      }
      attach(new MemoryBackend(generateSeed()), { email: 'demo@local', role: 'demo' })
    },
    async logout() {
      if (auth?.currentUser) await signOut(auth)
      else { unsub.current?.(); setSession(null) }
    },
    async reseed() { await backend.replaceAll(generateSeed()) },
  }), [session, booting, loading, error, data, backend, attach])

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>
}

/** 예전에 넣은 시연 자료에는 없는 메뉴(기획·회차·CS 등) 자료를 체험 모드에서만 채워 준다 */
function fillMissing(d: Data): Data {
  if (d.settings.length) return d
  const seed = generateSeed()
  const next = { ...d }
  for (const k of ['ipProjects', 'plans', 'saleRounds', 'inquiries', 'notices', 'settings'] as const)
    if (!d[k].length) (next as Record<string, unknown>)[k] = seed[k]
  return next
}

/** DB 읽기 실패 원인을 쉬운 말로 */
function explain(e: Error & { code?: string }) {
  if (e.code === 'permission-denied')
    return 'DB 읽기 권한이 없습니다. Firestore 규칙의 관리자 이메일과 VITE_ADMIN_EMAIL 이 같은지, 규칙을 게시했는지 확인하세요.'
  if (e.code === 'not-found' || e.code === 'failed-precondition')
    return 'Firestore 데이터베이스를 찾을 수 없습니다. Firebase 콘솔에서 데이터베이스가 만들어졌는지 확인하세요.'
  return `자료를 불러오지 못했습니다. (${e.code ?? e.message})`
}

export function useStore() {
  const v = useContext(StoreContext)
  if (!v) throw new Error('StoreProvider 밖에서 useStore 를 호출했습니다.')
  return v
}
