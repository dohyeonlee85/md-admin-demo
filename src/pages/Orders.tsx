import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useStore } from '../lib/store'
import { isDelayed, isPendingExpired } from '../lib/actions'
import { dateTime, maskDetail, maskName, maskPhone, money } from '../lib/format'
import { COUNTRY_LABEL, CURRENCIES, ORDER_STATUS_LABEL, type Order } from '../lib/types'
import { Badge, Button, Card, DataTable, Drawer, Field, Modal, PageHeader, cx, useRun } from '../components/ui'
import { OrderBadge, PayBadge } from '../components/status'
import { rules } from '../lib/settings'

const QUICK = [
  { key: '', label: '전체' },
  { key: 'toShip', label: '출고 대기' },
  { key: 'expired', label: '결제 대기 기한 경과' },
  { key: 'delayed', label: '배송 지연' },
  { key: 'refunded', label: '환불' },
]
const CARRIERS = ['CJ대한통운', '한진택배', '롯데택배', 'EMS']

function Row({ k, children }: { k: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-3 py-1.5">
      <dt className="w-20 shrink-0 text-xs text-ink-sub">{k}</dt>
      <dd className="min-w-0 flex-1 break-words">{children}</dd>
    </div>
  )
}

export default function Orders() {
  const { data, actions, session } = useStore()
  const [params, setParams] = useSearchParams()
  const quick = params.get('f') ?? ''
  const openId = params.get('id')
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [country, setCountry] = useState('')
  const [dialog, setDialog] = useState<null | 'ship' | 'cancel' | 'refund'>(null)
  const [carrier, setCarrier] = useState(CARRIERS[0])
  const [tracking, setTracking] = useState('')
  const [reason, setReason] = useState('')
  const { run, busy } = useRun()
  const masked = session?.role !== 'admin'
  const name = (o: Order) => (masked ? maskName(o.customerName) : o.customerName)

  const setParam = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v); else next.delete(k)
    setParams(next, { replace: true })
  }

  const rows = useMemo(() => {
    const now = Date.now()
    const kw = q.trim().toLowerCase()
    return data.orders.filter((o) => {
      if (kw && !o.orderNo.toLowerCase().includes(kw) && !o.customerName.toLowerCase().includes(kw)) return false
      if (status && o.orderStatus !== status) return false
      if (country && o.country !== country) return false
      if (quick === 'toShip') return o.orderStatus === 'PAID' || o.orderStatus === 'PREPARING'
      if (quick === 'expired') return isPendingExpired(o, now)
      if (quick === 'delayed') return isDelayed(o, now)
      if (quick === 'refunded') return o.paymentStatus === 'REFUNDED'
      return true
    }).sort((a, b) => b.createdAt - a.createdAt)
  }, [data.orders, q, status, country, quick])

  const expiredCount = useMemo(() => data.orders.filter((o) => isPendingExpired(o)).length, [data.orders])
  const order = openId ? data.orders.find((o) => o.id === openId) : undefined

  const columns = useMemo<ColumnDef<Order, any>[]>(() => [
    { header: '주문번호', accessorKey: 'orderNo', cell: (c) => <span className="num font-medium">{c.getValue()}</span> },
    { header: '주문 일시', accessorKey: 'createdAt', cell: (c) => <span className="num text-ink-sub">{dateTime(c.getValue())}</span> },
    { header: '고객', accessorKey: 'customerName', cell: (c) => name(c.row.original) },
    { header: '국가', accessorKey: 'country', cell: (c) => COUNTRY_LABEL[c.getValue() as Order['country']] },
    {
      header: '상품', id: 'items', enableSorting: false,
      cell: (c) => {
        const it = c.row.original.items
        return <span className="block max-w-[220px] truncate">{it[0].productName}{it.length > 1 && <span className="text-ink-mute"> 외 {it.length - 1}건</span>}</span>
      },
    },
    { header: '결제 금액', accessorKey: 'totalKrw', cell: (c) => money(c.row.original.total, c.row.original.currency), meta: { right: true } },
    { header: '결제', accessorKey: 'paymentStatus', cell: (c) => <PayBadge s={c.getValue()} /> },
    {
      header: '주문 상태', accessorKey: 'orderStatus',
      cell: (c) => {
        const o = c.row.original
        return (
          <span className="flex items-center gap-1">
            <OrderBadge s={o.orderStatus} />
            {isPendingExpired(o) && <Badge tone="danger">기한 경과</Badge>}
            {isDelayed(o) && <Badge tone="danger">지연</Badge>}
          </span>
        )
      },
    },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [masked])

  const closeDialog = () => { setDialog(null); setReason(''); setTracking('') }
  const act = (fn: () => Promise<unknown>, ok: string) => run(fn, ok).then((done) => { if (done) closeDialog() })

  const steps = order ? [
    ['주문 접수', order.createdAt], ['결제 완료', order.paidAt], ['출고', order.shippedAt],
    ['배송 완료', order.deliveredAt], ['환불', order.refundedAt],
  ].filter((s): s is [string, number] => !!s[1]) : []

  return (
    <>
      <PageHeader title="Order & Payment" desc="주문 상태와 결제 상태를 분리해 관리합니다. 재고는 주문 시 할당, 출고 시 차감됩니다."
        action={
          <Button disabled={busy || expiredCount === 0}
            onClick={() => run(() => actions.cancelExpired(data.orders), `결제 기한 경과 주문 ${expiredCount}건을 취소했습니다.`)}>
            기한 경과 주문 취소 ({expiredCount})
          </Button>
        } />
      <Card>
        <div className="flex gap-1.5 overflow-x-auto border-b border-line px-3 py-2">
          {QUICK.map((f) => (
            <button key={f.key} onClick={() => setParam('f', f.key || null)} aria-pressed={quick === f.key}
              className={cx('h-8 shrink-0 rounded-full border px-3 text-xs font-medium',
                quick === f.key ? 'border-primary bg-primary-soft text-primary-dark' : 'border-line text-ink-sub hover:bg-bg')}>
              {f.label}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 border-b border-line p-3 md:grid-cols-4">
          <input className="field col-span-2" placeholder="주문번호 · 고객명 검색" aria-label="주문 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="field" aria-label="주문 상태" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">주문 상태 전체</option>
            {Object.entries(ORDER_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <select className="field" aria-label="국가" value={country} onChange={(e) => setCountry(e.target.value)}>
            <option value="">국가 전체</option>
            {CURRENCIES.map((c) => <option key={c} value={c}>{COUNTRY_LABEL[c]}</option>)}
          </select>
        </div>
        <DataTable data={rows} columns={columns} onRowClick={(o) => setParam('id', o.id)} />
      </Card>

      {order && (
        <Drawer onClose={() => setParam('id', null)}
          title={<span className="flex items-center gap-2"><span className="num">{order.orderNo}</span><OrderBadge s={order.orderStatus} /><PayBadge s={order.paymentStatus} /></span>}
          footer={<>
            {order.orderStatus === 'PENDING' && <Button variant="primary" disabled={busy} onClick={() => run(() => actions.confirmPayment(order.id), '결제 완료로 변경했습니다.')}>입금 확인</Button>}
            {order.orderStatus === 'PAID' && <Button disabled={busy} onClick={() => run(() => actions.startPreparing(order.id), '상품 준비로 변경했습니다.')}>상품 준비 시작</Button>}
            {(order.orderStatus === 'PAID' || order.orderStatus === 'PREPARING') && <Button variant="primary" onClick={() => { setCarrier(order.currency === 'KRW' ? CARRIERS[0] : 'EMS'); setDialog('ship') }}>출고 처리</Button>}
            {order.orderStatus === 'SHIPPED' && <Button variant="primary" disabled={busy} onClick={() => run(() => actions.markDelivered(order.id), '배송 완료로 변경했습니다.')}>배송 완료 처리</Button>}
            {order.orderStatus === 'DELIVERED' && <Button variant="primary" disabled={busy} onClick={() => run(() => actions.confirmPurchase(order.id), '구매 확정 처리했습니다.')}>구매 확정</Button>}
            {['PENDING', 'PAID', 'PREPARING'].includes(order.orderStatus) && <Button variant="danger" onClick={() => setDialog('cancel')}>주문 취소</Button>}
            {['SHIPPED', 'DELIVERED', 'CONFIRMED'].includes(order.orderStatus) && order.paymentStatus === 'PAID' && <Button variant="danger" onClick={() => setDialog('refund')}>환불 기록</Button>}
          </>}>
          <div className="space-y-5">
            {isPendingExpired(order) && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">결제 대기 {rules.pendingCancelHours}시간이 지났습니다. 자동 취소 대상입니다.</p>}
            {isDelayed(order) && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">배송 지연 기준(국내 {rules.delayDomesticDays}일 · 해외 {rules.delayOverseasDays}일)을 넘었습니다.</p>}

            <section>
              <p className="label">주문 상품 (주문 당시 상품명·가격 보존)</p>
              <div className="overflow-hidden rounded-md border border-line">
                {order.items.map((it) => (
                  <div key={it.skuId} className="flex items-center gap-3 border-b border-line px-3 py-2 last:border-0">
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{it.productName}</span>
                      <span className="text-xs text-ink-mute">{it.option} · <span className="num">{money(it.unitPrice, order.currency)} × {it.qty}</span></span>
                    </span>
                    <span className="num">{money(it.unitPrice * it.qty, order.currency)}</span>
                  </div>
                ))}
                <div className="flex justify-between bg-bg/60 px-3 py-2 font-semibold">
                  <span>결제 금액</span><span className="num">{money(order.total, order.currency)}</span>
                </div>
              </div>
              {order.currency !== 'KRW' && (
                <p className="num mt-1.5 text-xs text-ink-mute">원화 환산 {money(order.totalKrw)} · 결제 시점 환율 {order.fxRate.toLocaleString()} 고정</p>
              )}
            </section>

            <section>
              <p className="label">고객 · 배송지 {masked && <span className="font-normal text-ink-mute">(조회 권한: 개인정보 마스킹)</span>}</p>
              <dl className="rounded-md border border-line px-3 py-1.5">
                <Row k="고객명">{name(order)}</Row>
                <Row k="연락처"><span className="num">{masked ? maskPhone(order.phone) : order.phone}</span></Row>
                <Row k="국가">{COUNTRY_LABEL[order.country]}</Row>
                <Row k="주소">{order.address} {masked ? maskDetail(order.addressDetail) : order.addressDetail}</Row>
                {order.carrier && <Row k="배송"><span className="num">{order.carrier} {order.trackingNo}</span></Row>}
                {order.refundReason && <Row k="취소·환불">{order.refundReason}{order.refundAmountKrw ? <span className="num text-ink-sub"> · {money(order.refundAmountKrw)}</span> : null}</Row>}
              </dl>
            </section>

            <section>
              <p className="label">처리 이력</p>
              <ol className="rounded-md border border-line px-3 py-1.5">
                {steps.map(([label, ts]) => (
                  <li key={label} className="flex justify-between py-1.5">
                    <span>{label}</span><span className="num text-ink-sub">{dateTime(ts)}</span>
                  </li>
                ))}
              </ol>
            </section>
          </div>
        </Drawer>
      )}

      {order && dialog === 'ship' && (
        <Modal title="출고 처리" onClose={closeDialog} footer={<>
          <Button onClick={closeDialog}>취소</Button>
          <Button variant="primary" disabled={busy} onClick={() => act(() => actions.ship(order.id, carrier, tracking), '출고 처리했습니다. 재고가 차감되었습니다.')}>출고 확정</Button>
        </>}>
          <div className="space-y-3">
            <p className="text-xs text-ink-sub">출고를 확정하면 주문 수량만큼 보유 재고가 차감되고 재고 변경 이력에 기록됩니다.</p>
            <Field label="택배사">
              <select className="field" value={carrier} onChange={(e) => setCarrier(e.target.value)}>{CARRIERS.map((c) => <option key={c}>{c}</option>)}</select>
            </Field>
            <Field label="송장번호"><input className="field num" inputMode="numeric" value={tracking} onChange={(e) => setTracking(e.target.value)} placeholder="예: 123456789012" /></Field>
          </div>
        </Modal>
      )}
      {order && (dialog === 'cancel' || dialog === 'refund') && (
        <Modal title={dialog === 'cancel' ? '주문 취소' : '환불 기록'} onClose={closeDialog} footer={<>
          <Button onClick={closeDialog}>닫기</Button>
          <Button variant="danger" disabled={busy} onClick={() => dialog === 'cancel'
            ? act(() => actions.cancelOrder(order.id, reason), '주문을 취소했습니다. 할당 재고가 해제되었습니다.')
            : act(() => actions.recordRefund(order.id, reason), '환불을 기록했습니다.')}>
            {dialog === 'cancel' ? '취소 확정' : '환불 확정'}
          </Button>
        </>}>
          <div className="space-y-3">
            <p className="text-xs leading-relaxed text-ink-sub">
              {dialog === 'cancel'
                ? '출고 전 주문을 취소하고 할당된 재고를 해제합니다. 결제된 주문은 환불로 기록됩니다.'
                : '결제 대행사(PG) 연동이 없어 환불은 수동으로 기록합니다. 매출은 환불일 기준으로 차감되며, 회수 상품은 검수 후 재고 메뉴에서 입고 처리합니다.'}
            </p>
            <Field label="사유"><textarea className="field" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="예: 상품 불량" /></Field>
          </div>
        </Modal>
      )}
    </>
  )
}
