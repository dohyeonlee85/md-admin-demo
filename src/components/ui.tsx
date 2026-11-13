import {
  createContext, useCallback, useContext, useEffect, useState,
  type ButtonHTMLAttributes, type ReactNode,
} from 'react'
import {
  flexRender, getCoreRowModel, getPaginationRowModel, getSortedRowModel, useReactTable,
  type ColumnDef, type SortingState,
} from '@tanstack/react-table'

const cx = (...a: (string | false | undefined | null)[]) => a.filter(Boolean).join(' ')

// ── 버튼
type Variant = 'primary' | 'default' | 'danger' | 'ghost'
const VARIANT: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-dark border-transparent',
  default: 'bg-white text-ink border-line hover:bg-bg',
  danger: 'bg-white text-danger border-danger/40 hover:bg-danger-soft',
  ghost: 'bg-transparent text-ink-sub border-transparent hover:bg-black/5',
}
export function Button({ variant = 'default', className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...p}
      className={cx(
        'inline-flex h-9 shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md border px-3 text-[13px] font-medium transition-colors',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-primary',
        'disabled:cursor-not-allowed disabled:opacity-45',
        VARIANT[variant], className,
      )}
    />
  )
}

// ── 뱃지
export type Tone = 'gray' | 'primary' | 'success' | 'warning' | 'danger'
const TONE: Record<Tone, string> = {
  gray: 'bg-black/5 text-ink-sub',
  primary: 'bg-primary-soft text-primary-dark',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-[#9A6A16]',
  danger: 'bg-danger-soft text-danger',
}
export function Badge({ tone = 'gray', children }: { tone?: Tone; children: ReactNode }) {
  return <span className={cx('inline-flex h-5 items-center whitespace-nowrap rounded px-1.5 text-[11px] font-semibold', TONE[tone])}>{children}</span>
}

export function Card({ title, action, children, className }: { title?: ReactNode; action?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cx('rounded-lg border border-line bg-surface', className)}>
      {title && (
        <header className="flex min-h-11 items-center justify-between gap-2 border-b border-line px-4 py-2">
          <h2 className="text-[13px] font-semibold">{title}</h2>
          {action}
        </header>
      )}
      {children}
    </section>
  )
}

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-[11px] text-ink-mute">{hint}</span>}
    </label>
  )
}

// ── 모달 · 사이드 패널
function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [onClose])
}
export function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className="flex max-h-[92dvh] w-full flex-col rounded-t-xl bg-white shadow-xl sm:max-w-lg sm:rounded-xl">
        <header className="flex items-center justify-between border-b border-line px-4 py-3">
          <h3 className="text-sm font-semibold">{title}</h3>
          <button onClick={onClose} aria-label="닫기" className="grid h-8 w-8 place-items-center rounded-md text-ink-sub hover:bg-black/5">✕</button>
        </header>
        <div className="overflow-y-auto p-4">{children}</div>
        {footer && <footer className="flex justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
      </div>
    </div>
  )
}
export function Drawer({ title, onClose, children, footer }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEscape(onClose)
  return (
    <div className="fixed inset-0 z-40 flex justify-end bg-black/30" onMouseDown={onClose}>
      <aside role="dialog" aria-modal="true" onMouseDown={(e) => e.stopPropagation()} className="flex h-full w-full flex-col bg-white shadow-xl sm:max-w-[520px]">
        <header className="flex items-center justify-between gap-2 border-b border-line px-4 py-3">
          <div className="min-w-0 text-sm font-semibold">{title}</div>
          <button onClick={onClose} aria-label="닫기" className="grid h-8 w-8 shrink-0 place-items-center rounded-md text-ink-sub hover:bg-black/5">✕</button>
        </header>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-line px-4 py-3">{footer}</footer>}
      </aside>
    </div>
  )
}

// ── Toast
type Toast = { id: number; tone: 'success' | 'danger'; text: string }
const ToastContext = createContext<(tone: Toast['tone'], text: string) => void>(() => {})
export function ToastProvider({ children }: { children: ReactNode }) {
  const [list, setList] = useState<Toast[]>([])
  const push = useCallback((tone: Toast['tone'], text: string) => {
    const id = Date.now() + Math.random()
    setList((l) => [...l, { id, tone, text }])
    setTimeout(() => setList((l) => l.filter((t) => t.id !== id)), 3800)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 top-3 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {list.map((t) => (
          <div key={t.id} className={cx('max-w-md rounded-md px-3.5 py-2.5 text-[13px] font-medium text-white shadow-lg', t.tone === 'success' ? 'bg-ink' : 'bg-danger')}>
            {t.text}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
/** 저장 동작 실행 + 성공·실패 알림 */
export function useRun() {
  const toast = useContext(ToastContext)
  const [busy, setBusy] = useState(false)
  const run = useCallback(async (fn: () => Promise<unknown>, ok: string) => {
    setBusy(true)
    try { await fn(); toast('success', ok); return true }
    catch (e) { toast('danger', e instanceof Error ? e.message : '처리 중 오류가 발생했습니다.'); return false }
    finally { setBusy(false) }
  }, [toast])
  return { run, busy }
}

// ── 공통 테이블 (정렬 · 페이지)
export function DataTable<T>({ data, columns, onRowClick, pageSize = 15, empty = '조건에 맞는 자료가 없습니다.' }: {
  data: T[]; columns: ColumnDef<T, any>[]; onRowClick?: (row: T) => void; pageSize?: number; empty?: string
}) {
  const [sorting, setSorting] = useState<SortingState>([])
  const table = useReactTable({
    data, columns, state: { sorting }, onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(), getSortedRowModel: getSortedRowModel(), getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize } },
  })
  const { pageIndex } = table.getState().pagination
  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-max border-collapse text-[13px]">
          <thead>
            {table.getHeaderGroups().map((hg) => (
              <tr key={hg.id} className="border-b border-line bg-bg/60">
                {hg.headers.map((h) => {
                  const right = (h.column.columnDef.meta as { right?: boolean } | undefined)?.right
                  const sorted = h.column.getIsSorted()
                  return (
                    <th key={h.id} className={cx('h-9 whitespace-nowrap px-3 text-xs font-medium text-ink-sub', right ? 'text-right' : 'text-left')}
                      aria-sort={sorted === 'asc' ? 'ascending' : sorted === 'desc' ? 'descending' : undefined}>
                      {h.column.getCanSort() ? (
                        <button className="inline-flex items-center gap-1 hover:text-ink" onClick={h.column.getToggleSortingHandler()}>
                          {flexRender(h.column.columnDef.header, h.getContext())}
                          <span className="text-[10px] text-ink-mute">{sorted === 'asc' ? '▲' : sorted === 'desc' ? '▼' : '↕'}</span>
                        </button>
                      ) : flexRender(h.column.columnDef.header, h.getContext())}
                    </th>
                  )
                })}
              </tr>
            ))}
          </thead>
          <tbody>
            {table.getRowModel().rows.map((row) => (
              <tr key={row.id} onClick={onRowClick ? () => onRowClick(row.original) : undefined}
                className={cx('border-b border-line last:border-0', onRowClick && 'cursor-pointer hover:bg-primary-soft/40')}>
                {row.getVisibleCells().map((c) => {
                  const right = (c.column.columnDef.meta as { right?: boolean } | undefined)?.right
                  return <td key={c.id} className={cx('h-10 whitespace-nowrap px-3', right && 'num text-right')}>{flexRender(c.column.columnDef.cell, c.getContext())}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {data.length === 0 && <p className="px-4 py-10 text-center text-ink-mute">{empty}</p>}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between border-t border-line px-3 py-2 text-xs text-ink-sub">
          <span className="num">총 {data.length.toLocaleString()}건</span>
          <div className="flex items-center gap-1">
            <Button variant="ghost" className="h-8 px-2" disabled={!table.getCanPreviousPage()} onClick={() => table.previousPage()}>이전</Button>
            <span className="num px-1">{pageIndex + 1} / {table.getPageCount()}</span>
            <Button variant="ghost" className="h-8 px-2" disabled={!table.getCanNextPage()} onClick={() => table.nextPage()}>다음</Button>
          </div>
        </div>
      )}
    </div>
  )
}

export function PageHeader({ title, desc, action }: { title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        {desc && <p className="mt-0.5 text-xs text-ink-sub">{desc}</p>}
      </div>
      {action && <div className="flex flex-wrap gap-2">{action}</div>}
    </div>
  )
}

export { cx }
