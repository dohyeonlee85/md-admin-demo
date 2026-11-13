import { initializeApp } from 'firebase/app'
import { connectAuthEmulator, getAuth } from 'firebase/auth'
import { connectFirestoreEmulator, initializeFirestore } from 'firebase/firestore'

const env = import.meta.env
/** Firebase 설정값(.env)이 있으면 실제 DB 연결, 없으면 로컬 데모 모드 */
export const firebaseEnabled = Boolean(env.VITE_FIREBASE_API_KEY && env.VITE_FIREBASE_PROJECT_ID)

const app = firebaseEnabled
  ? initializeApp({
      apiKey: env.VITE_FIREBASE_API_KEY,
      authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: env.VITE_FIREBASE_PROJECT_ID,
      appId: env.VITE_FIREBASE_APP_ID,
    })
  : null

export const auth = app ? getAuth(app) : null
// undefined 값은 저장하지 않도록 설정 (Firestore 는 undefined 를 허용하지 않음)
export const db = app ? initializeFirestore(app, { ignoreUndefinedProperties: true }) : null

// 개발용: 로컬 에뮬레이터 연결 (VITE_USE_EMULATOR=1 일 때만)
if (env.VITE_USE_EMULATOR === '1' && auth && db) {
  connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true })
  connectFirestoreEmulator(db, '127.0.0.1', 8080)
}
export const ADMIN_EMAIL: string = (env.VITE_ADMIN_EMAIL ?? '').toLowerCase()
export const DEMO_EMAIL: string = env.VITE_DEMO_EMAIL ?? ''
export const DEMO_PASSWORD: string = env.VITE_DEMO_PASSWORD ?? ''
