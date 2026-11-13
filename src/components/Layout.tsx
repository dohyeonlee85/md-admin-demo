import { useEffect, useState, type ReactNode } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { useStore } from '../lib/store'
import { Badge, Button, Modal, cx, useRun } from './ui'

export const MENUS = [
  { path: '/', label: 'Dashboard', ko: '대시보드', ready: true },
  { path: '/artists', label: 'Artist & IP', ko: '아티스트·IP', ready: true },
  { path: '/planning', label: 'Product Planning', ko: '상품 기획', ready: true },
  { path: '/products', label: 'Product Management', ko: '상품 관리', ready: true },
  { path: '/sales', label: 'Sales Management', ko: '판매 관리', ready: true },
  { path: '/orders', label: 'Order & Payment', ko: '주문·결제', ready: true },
  { path: '/inventory', label: 'Inventory & Logistics', ko: '재고·물류', ready: true },
  { path: '/customers', label: 'Customer & CS', ko: '고객·CS', ready: true },
  { path: '/analytics', label: 'Analytics', ko: '분석', ready: true },
  { path: '/settings', label: 'System Settings', ko: '시스템 설정', ready: true },
]

export default function Layout({ children }: { children: ReactNode }) {
  const { session, storage, logout, reseed, loading, error } = useStore()
  const [open, setOpen] = useState(false)
  const [confirmSeed, setConfirmSeed] = useState(false)
  const { run, busy } = useRun()
  const loc = useLocation()
  useEffect(() => setOpen(false), [loc.pathname])
  const current = MENUS.find((m) => m.path === loc.pathname)
  const isAdmin = session?.role === 'admin'

  return (
    <div className="flex h-full">
      {open && <div className="fixed inset-0 z-30 bg-black/40 lg:hidden" onClick={() => setOpen(false)} />}
      <nav aria-label="주 메뉴" className={cx(
        'fixed inset-y-0 left-0 z-30 flex w-60 flex-col bg-sidebar text-white transition-transform lg:static lg:translate-x-0',
        open ? 'translate-x-0' : '-translate-x-full',
      )}>
        <div className="flex h-14 items-center gap-2 px-5">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-xs font-bold">MD</span>
          <span className="text-sm font-semibold tracking-tight">MD SHOP ADMIN</span>
        </div>
        <ul className="flex-1 space-y-0.5 overflow-y-auto px-3 py-2">
          {MENUS.map((m) => (
            <li key={m.path}>
              <NavLink to={m.path} end className={({ isActive }) => cx(
                'flex h-10 items-center justify-between rounded-md px-3 text-[13px]',
                isActive ? 'bg-white/10 font-semibold text-white' : 'text-white/65 hover:bg-white/5 hover:text-white',
              )}>
                <span>{m.label}</span>
                {!m.ready && <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/55">예정</span>}
              </NavLink>
            </li>
          ))}
        </ul>
        <p className="border-t border-white/10 px-5 py-3 text-[11px] leading-relaxed text-white/45">
          포트폴리오용 데모입니다.<br />모든 자료는 테스트 데이터입니다.<br />
          <span className="text-white/30">빌드 {__BUILD_ID__}</span>
        </p>
      </nav>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-white px-4">
          <button className="grid h-9 w-9 place-items-center rounded-md hover:bg-black/5 lg:hidden" aria-label="메뉴 열기" onClick={() => setOpen(true)}>
            <span className="text-lg leading-none">☰</span>
          </button>
          <div className="min-w-0 flex-1 truncate text-xs text-ink-sub">
            Home <span className="mx-1 text-ink-mute">/</span>
            <span className="font-medium text-ink">{current?.label ?? ''}</span>
          </div>
          <Badge tone={isAdmin ? 'success' : 'warning'}>{isAdmin ? '관리자 · DB 저장' : '체험 모드'}</Badge>
          {isAdmin && storage === 'firestore' && (
            <Button className="hidden sm:inline-flex" onClick={() => setConfirmSeed(true)}>시연 자료 초기화</Button>
          )}
          {!isAdmin && (
            <Button className="hidden sm:inline-flex" disabled={busy} onClick={() => run(reseed, '처음 상태로 되돌렸습니다.')}>처음 상태로</Button>
          )}
          <Button variant="ghost" onClick={logout}>로그아웃</Button>
        </header>
        {!isAdmin && (
          <div className="border-b border-warning/30 bg-warning-soft px-4 py-1.5 text-xs text-[#7A5410]">
            체험 모드: 등록·수정·상태 변경을 자유롭게 눌러 보세요. 변경 내용은 이 화면에만 반영되고 새로고침하면 처음 상태로 돌아갑니다. 고객 정보는 마스킹되어 보입니다.
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-4 lg:p-6">
          {error ? (
            <div className="mx-auto max-w-lg rounded-lg border border-danger/30 bg-danger-soft p-4 text-[13px] leading-relaxed text-danger">{error}</div>
          ) : loading ? <p className="py-20 text-center text-ink-sub">자료를 불러오는 중…</p> : children}
        </main>
      </div>

      {confirmSeed && (
        <Modal title="시연 자료 초기화" onClose={() => setConfirmSeed(false)} footer={
          <>
            <Button onClick={() => setConfirmSeed(false)}>취소</Button>
            <Button variant="danger" disabled={busy} onClick={async () => {
              if (await run(reseed, '시연 자료를 새로 넣었습니다.')) setConfirmSeed(false)
            }}>{busy ? '처리 중…' : '초기화 실행'}</Button>
          </>
        }>
          <p className="leading-relaxed text-ink-sub">
            DB의 상품·주문·재고·고객 자료를 모두 지우고 시연용 자료를 새로 넣습니다. 지금까지 입력한 변경 내용은 사라집니다.
          </p>
        </Modal>
      )}
    </div>
  )
}
