// 데이터 저장소 2종.
// - MemoryBackend: 브라우저 메모리에만 반영 (체험 모드, 새로고침 시 초기화)
// - FirestoreBackend: Firebase DB에 실제 저장 (관리자 모드)
// 두 저장소가 같은 사용법(runTx)을 가지므로 업무 로직(actions.ts)은 하나만 작성한다.
import {
  collection, doc, getDocs, onSnapshot, runTransaction, writeBatch, type Firestore,
} from 'firebase/firestore'
import { COL_NAMES, type ColName, type Collections, type Data } from './types'

export interface Tx {
  get<K extends ColName>(col: K, id: string): Promise<Collections[K] | undefined>
  set<K extends ColName>(col: K, value: Collections[K]): void
}
export interface Backend {
  kind: 'memory' | 'firestore'
  subscribe(cb: (d: Data) => void, onError?: (e: Error) => void): () => void
  /** 묶음 처리: 안의 변경이 전부 성공하거나 전부 취소된다 */
  runTx(fn: (tx: Tx) => Promise<void>): Promise<void>
  replaceAll(data: Data): Promise<void>
}

export const emptyData = (): Data => ({
  artists: [], products: [], skus: [], orders: [], customers: [], inventoryLogs: [],
  ipProjects: [], plans: [], saleRounds: [], inquiries: [], notices: [], settings: [],
})

export class MemoryBackend implements Backend {
  kind = 'memory' as const
  private listeners = new Set<(d: Data) => void>()
  constructor(private data: Data) {}

  subscribe(cb: (d: Data) => void) {
    this.listeners.add(cb)
    cb(this.data)
    return () => { this.listeners.delete(cb) }
  }
  async runTx(fn: (tx: Tx) => Promise<void>) {
    const writes: [ColName, { id: string }][] = []
    await fn({
      get: async (col, id) => (this.data[col] as { id: string }[]).find((x) => x.id === id) as never,
      set: (col, value) => { writes.push([col, value]) },
    })
    // fn 이 오류 없이 끝났을 때만 반영
    const next = { ...this.data }
    for (const [col, value] of writes) {
      const arr = next[col] as { id: string }[]
      const i = arr.findIndex((x) => x.id === value.id)
      ;(next as Record<ColName, unknown>)[col] = i >= 0 ? arr.map((x, j) => (j === i ? value : x)) : [...arr, value]
    }
    this.data = next
    this.listeners.forEach((l) => l(next))
  }
  async replaceAll(data: Data) {
    this.data = data
    this.listeners.forEach((l) => l(data))
  }
}

export async function loadAll(db: Firestore): Promise<Data> {
  const data = emptyData()
  await Promise.all(COL_NAMES.map(async (col) => {
    const snap = await getDocs(collection(db, col))
    ;(data as Record<ColName, unknown>)[col] = snap.docs.map((d) => d.data())
  }))
  return data
}

export class FirestoreBackend implements Backend {
  kind = 'firestore' as const
  constructor(private db: Firestore) {}

  subscribe(cb: (d: Data) => void, onError?: (e: Error) => void) {
    const data = emptyData()
    const ready = new Set<ColName>()
    const unsubs = COL_NAMES.map((col) =>
      onSnapshot(collection(this.db, col), (snap) => {
        ;(data as Record<ColName, unknown>)[col] = snap.docs.map((d) => d.data())
        ready.add(col)
        if (ready.size === COL_NAMES.length) cb({ ...data })
      }, (e) => onError?.(e)),
    )
    return () => unsubs.forEach((u) => u())
  }
  async runTx(fn: (tx: Tx) => Promise<void>) {
    await runTransaction(this.db, async (t) => {
      await fn({
        get: async (col, id) => {
          const s = await t.get(doc(this.db, col, id))
          return s.exists() ? (s.data() as never) : undefined
        },
        set: (col, value) => { t.set(doc(this.db, col, value.id), value) },
      })
    })
  }
  /** 기존 문서를 모두 지운 뒤 시연용 자료를 새로 넣는다 (한 번에 400건씩) */
  async replaceAll(data: Data) {
    type Op = (b: ReturnType<typeof writeBatch>) => void
    const commit = async (ops: Op[]) => {
      for (let i = 0; i < ops.length; i += 400) {
        const batch = writeBatch(this.db)
        ops.slice(i, i + 400).forEach((op) => op(batch))
        await batch.commit()
      }
    }
    const deletes: Op[] = []
    for (const col of COL_NAMES) {
      const snap = await getDocs(collection(this.db, col))
      snap.docs.forEach((d) => deletes.push((b) => b.delete(d.ref)))
    }
    await commit(deletes)
    const sets: Op[] = []
    for (const col of COL_NAMES)
      for (const v of data[col] as { id: string }[]) sets.push((b) => b.set(doc(this.db, col, v.id), v))
    await commit(sets)
  }
}
