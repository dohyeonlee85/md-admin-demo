import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useStore } from '../lib/store'
import { available, isLow } from '../lib/metrics'
import { dateTime, num } from '../lib/format'
import { LOG_TYPE_LABEL, type InventoryLog, type Sku } from '../lib/types'
import { Badge, Button, Card, DataTable, Field, Modal, PageHeader, cx, useRun } from '../components/ui'
import { StockBadge } from '../components/status'

const signed = (n: number) => (n > 0 ? '+' : '') + num(n)

export default function Inventory() {
  const { data, actions } = useStore()
  const [params, setParams] = useSearchParams()
  const lowOnly = params.get('f') === 'low'
  const [tab, setTab] = useState<'stock' | 'logs'>('stock')
  const [q, setQ] = useState('')
  const [target, setTarget] = useState<Sku | null>(null)
  const [type, setType] = useState<'INBOUND' | 'ADJUST'>('INBOUND')
  const [qty, setQty] = useState('')
  const [reason, setReason] = useState('')
  const [threshold, setThreshold] = useState('')
  const { run, busy } = useRun()

  const productName = useMemo(() => new Map(data.products.map((p) => [p.id, p.name])), [data.products])
  const skuLabel = useMemo(() => new Map(data.skus.map((s) => [s.id, `${productName.get(s.productId) ?? ''} · ${s.option}`])), [data.skus, productName])

  const rows = useMemo(() => {
    const kw = q.trim().toLowerCase()
    return data.skus
      .filter((s) => (!lowOnly || isLow(s)) && (!kw || s.code.toLowerCase().includes(kw) || (productName.get(s.productId) ?? '').toLowerCase().includes(kw)))
      .sort((a, b) => available(a) - available(b))
  }, [data.skus, q, lowOnly, productName])
  const logs = useMemo(() => [...data.inventoryLogs].sort((a, b) => b.createdAt - a.createdAt), [data.inventoryLogs])

  const openAdjust = (s: Sku) => { setTarget(s); setType('INBOUND'); setQty(''); setReason(''); setThreshold(String(s.threshold)) }
  // 모달은 저장 후에도 최신 수량을 보여 준다
  const live = target ? data.skus.find((s) => s.id === target.id) ?? target : null
  const delta = Number(qty) || 0
  const after = live ? live.onHand + delta : 0

  const columns = useMemo<ColumnDef<Sku, any>[]>(() => [
    { header: 'SKU 코드', accessorKey: 'code', cell: (c) => <span className="num text-ink-sub">{c.getValue()}</span> },
    { header: '상품', accessorFn: (s) => productName.get(s.productId) ?? '', cell: (c) => <span className="block max-w-[260px] truncate font-medium">{c.getValue()}</span> },
    { header: '옵션', accessorKey: 'option' },
    { header: '보유', accessorKey: 'onHand', cell: (c) => num(c.getValue()), meta: { right: true } },
    { header: '할당', accessorKey: 'allocated', cell: (c) => num(c.getValue()), meta: { right: true } },
    { header: '가용', accessorFn: (s) => available(s), cell: (c) => <span className="font-semibold">{num(c.getValue())}</span>, meta: { right: true } },
    { header: '부족 기준', accessorKey: 'threshold', cell: (c) => num(c.getValue()), meta: { right: true } },
    { header: '상태', id: 'state', accessorFn: (s) => available(s) - s.threshold, cell: (c) => <StockBadge sku={c.row.original} /> },
    {
      header: '', id: 'act', enableSorting: false,
      cell: (c) => <Button className="h-8 px-2.5 text-xs" onClick={() => openAdjust(c.row.original)}>입고·조정</Button>,
    },
  ], [productName])

  const logColumns = useMemo<ColumnDef<InventoryLog, any>[]>(() => [
    { header: '일시', accessorKey: 'createdAt', cell: (c) => <span className="num text-ink-sub">{dateTime(c.getValue())}</span> },
    { header: '상품 · 옵션', accessorFn: (l) => skuLabel.get(l.skuId) ?? l.skuId, cell: (c) => <span className="block max-w-[280px] truncate">{c.getValue()}</span> },
    { header: '구분', accessorKey: 'type', cell: (c) => <Badge tone={c.getValue() === 'INBOUND' ? 'success' : c.getValue() === 'ADJUST' ? 'warning' : 'gray'}>{LOG_TYPE_LABEL[c.getValue() as InventoryLog['type']]}</Badge> },
    { header: '보유 변화', accessorKey: 'delta', cell: (c) => <span className={cx(c.getValue() > 0 && 'text-success', c.getValue() < 0 && 'text-danger')}>{signed(c.getValue())}</span>, meta: { right: true } },
    { header: '할당 변화', accessorKey: 'allocDelta', cell: (c) => signed(c.getValue()), meta: { right: true } },
    { header: '변경 후 보유', accessorKey: 'onHandAfter', cell: (c) => num(c.getValue()), meta: { right: true } },
    { header: '사유', accessorKey: 'reason' },
    { header: '처리자', accessorKey: 'actor', cell: (c) => <span className="text-ink-sub">{c.getValue()}</span> },
  ], [skuLabel])

  return (
    <>
      <PageHeader title="Inventory & Logistics" desc="가용 재고 = 보유 − 할당. 가용 재고가 부족 기준(기본 100개)보다 적으면 '부족'으로 표시합니다." />
      <Card>
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3">
          <div className="flex rounded-md border border-line p-0.5" role="tablist">
            {([['stock', '재고 현황'], ['logs', '변경 이력']] as const).map(([k, label]) => (
              <button key={k} role="tab" aria-selected={tab === k} onClick={() => setTab(k)}
                className={cx('h-8 rounded px-3 text-xs font-medium', tab === k ? 'bg-primary text-white' : 'text-ink-sub hover:bg-bg')}>{label}</button>
            ))}
          </div>
          {tab === 'stock' && (
            <>
              <input className="field max-w-[240px] flex-1" placeholder="상품명 · SKU 코드 검색" aria-label="재고 검색" value={q} onChange={(e) => setQ(e.target.value)} />
              <label className="flex h-9 cursor-pointer items-center gap-2 text-xs text-ink-sub">
                <input type="checkbox" className="h-4 w-4 accent-primary" checked={lowOnly}
                  onChange={(e) => setParams(e.target.checked ? { f: 'low' } : {}, { replace: true })} />
                부족·품절만 보기
              </label>
            </>
          )}
        </div>
        {tab === 'stock'
          ? <DataTable data={rows} columns={columns} />
          : <DataTable data={logs} columns={logColumns} empty="변경 이력이 없습니다." />}
      </Card>

      {live && (
        <Modal title="입고 · 재고 조정" onClose={() => setTarget(null)} footer={<>
          <Button onClick={() => setTarget(null)}>닫기</Button>
          <Button variant="primary" disabled={busy || !delta}
            onClick={async () => { if (await run(() => actions.adjustStock(live.id, type, delta, reason), '재고를 변경하고 이력을 기록했습니다.')) { setQty(''); setReason('') } }}>
            저장
          </Button>
        </>}>
          <div className="space-y-4">
            <div className="rounded-md bg-bg px-3 py-2.5">
              <p className="font-medium">{skuLabel.get(live.id)}</p>
              <p className="num mt-1 text-xs text-ink-sub">보유 {num(live.onHand)} · 할당 {num(live.allocated)} · 가용 {num(available(live))}</p>
            </div>
            <div className="grid grid-cols-2 gap-2">
              {([['INBOUND', '입고', '수량이 늘어납니다'], ['ADJUST', '재고 조정', '실사 차이·불량 등 (＋/－)']] as const).map(([k, label, hint]) => (
                <button key={k} onClick={() => { setType(k); setQty('') }} aria-pressed={type === k}
                  className={cx('rounded-md border px-3 py-2 text-left', type === k ? 'border-primary bg-primary-soft' : 'border-line hover:bg-bg')}>
                  <span className="block font-medium">{label}</span>
                  <span className="text-[11px] text-ink-mute">{hint}</span>
                </button>
              ))}
            </div>
            <Field label={type === 'INBOUND' ? '입고 수량' : '조정 수량 (줄이려면 −)'}>
              <input className="field num" type="number" step={1} min={type === 'INBOUND' ? 1 : undefined} value={qty} onChange={(e) => setQty(e.target.value)} placeholder={type === 'INBOUND' ? '예: 200' : '예: -5'} />
            </Field>
            {delta !== 0 && (
              <p className={cx('num text-xs', after < live.allocated ? 'text-danger' : 'text-ink-sub')}>
                변경 후 보유 {num(after)}개 (현재 {num(live.onHand)} {signed(delta)})
                {after < live.allocated && ` · 할당 수량 ${num(live.allocated)}개보다 적어 저장할 수 없습니다.`}
              </p>
            )}
            <Field label="사유 (필수)"><input className="field" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 2차 입고, 검수 불량 폐기" /></Field>
            <div className="flex items-end gap-2 border-t border-line pt-3">
              <div className="flex-1">
                <Field label="재고 부족 기준 (SKU별)"><input className="field num" type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} /></Field>
              </div>
              <Button disabled={busy || Number(threshold) === live.threshold} onClick={() => run(() => actions.setThreshold(live.id, Number(threshold)), '부족 기준을 변경했습니다.')}>기준 변경</Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  )
}
