import { useState, type FormEvent } from 'react'
import { useStore } from '../lib/store'
import { Button, Field, useRun } from '../components/ui'

export default function Login() {
  const { login, loginDemo, firebaseEnabled } = useStore()
  const { run, busy } = useRun()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showAdmin, setShowAdmin] = useState(false)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    run(() => login(email, password).catch(() => { throw new Error('이메일 또는 비밀번호를 확인해 주세요.') }), '로그인했습니다.')
  }

  return (
    <div className="grid min-h-full place-items-center bg-sidebar p-4">
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-2xl">
        <div className="mb-5 flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-md bg-primary text-xs font-bold text-white">MD</span>
          <div>
            <p className="text-sm font-semibold tracking-tight">MD SHOP ADMIN</p>
            <p className="text-[11px] text-ink-mute">ATEEZ · xikers 관리자 시스템 데모</p>
          </div>
        </div>
        <p className="mb-4 text-[13px] leading-relaxed text-ink-sub">
          상품·주문·재고 업무를 한곳에서 처리하는 관리자 화면입니다. 포트폴리오용 데모이며 모든 자료는 테스트 데이터입니다.
        </p>
        <Button variant="primary" className="h-11 w-full text-sm" disabled={busy}
          onClick={() => run(loginDemo, '체험 모드로 시작합니다.')}>
          로그인 없이 체험하기
        </Button>
        <p className="mt-2 text-center text-[11px] text-ink-mute">변경 내용은 저장되지 않으니 자유롭게 눌러 보세요.</p>

        {firebaseEnabled && (
          <div className="mt-5 border-t border-line pt-4">
            {!showAdmin ? (
              <button className="w-full text-center text-xs text-ink-sub underline-offset-2 hover:underline" onClick={() => setShowAdmin(true)}>
                관리자 로그인
              </button>
            ) : (
              <form onSubmit={submit} className="space-y-3">
                <Field label="이메일"><input className="field" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
                <Field label="비밀번호"><input className="field" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
                <Button type="submit" className="w-full" disabled={busy}>관리자 로그인</Button>
              </form>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
