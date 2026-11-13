// 매출 집계 규칙
// - 순매출 = 결제 금액 − 환불 금액 (원화 환산은 결제 시점 환율로 고정)
// - 결제는 결제일, 환불은 환불일에 반영 / 날짜는 한국 시간(KST) 기준
import { DAY, isDelayed, isPendingExpired } from './actions'
import { dayKey } from './format'
import type { Data, Sku } from './types'

export const available = (s: Sku) => s.onHand - s.allocated
export const isLow = (s: Sku) => available(s) < s.threshold

export function buildMetrics(d: Data, now = Date.now()) {
  const byDay = new Map<string, { sales: number; refund: number; orders: number }>()
  const slot = (k: string) => {
    let v = byDay.get(k)
    if (!v) byDay.set(k, (v = { sales: 0, refund: 0, orders: 0 }))
    return v
  }
  for (const o of d.orders) {
    if (o.paidAt) { const s = slot(dayKey(o.paidAt)); s.sales += o.totalKrw; s.orders += 1 }
    if (o.refundedAt) slot(dayKey(o.refundedAt)).refund += o.refundAmountKrw ?? 0
  }
  const series = Array.from({ length: 30 }, (_, i) => {
    const key = dayKey(now - (29 - i) * DAY)
    const v = byDay.get(key) ?? { sales: 0, refund: 0, orders: 0 }
    return { date: key.slice(5), net: v.sales - v.refund, ...v }
  })
  const today = series[29]
  const yesterday = series[28]
  const net30 = series.reduce((s, x) => s + x.net, 0)
  const orders30 = series.reduce((s, x) => s + x.orders, 0)
  const refund30 = series.reduce((s, x) => s + x.refund, 0)

  // 최근 30일 결제 주문 기준 상품·아티스트 실적
  const since = now - 30 * DAY
  const productMap = new Map(d.products.map((p) => [p.id, p]))
  const top = new Map<string, { name: string; qty: number; krw: number }>()
  const artist: Record<string, number> = {}
  for (const o of d.orders) {
    if (!o.paidAt || o.paidAt < since || o.paymentStatus !== 'PAID') continue
    for (const it of o.items) {
      const krw = Math.round(it.unitPrice * it.qty * o.fxRate)
      const t = top.get(it.productId) ?? { name: it.productName, qty: 0, krw: 0 }
      t.qty += it.qty; t.krw += krw
      top.set(it.productId, t)
      const a = productMap.get(it.productId)?.artistId ?? 'etc'
      artist[a] = (artist[a] ?? 0) + krw
    }
  }
  const top10 = [...top.values()].sort((a, b) => b.qty - a.qty).slice(0, 10)
  const artistSplit = d.artists.map((a) => ({ name: a.name, krw: artist[a.id] ?? 0 }))

  const lowStock = d.skus.filter(isLow).sort((a, b) => available(a) - available(b))
  const todo = {
    toShip: d.orders.filter((o) => o.orderStatus === 'PAID' || o.orderStatus === 'PREPARING').length,
    pendingExpired: d.orders.filter((o) => isPendingExpired(o, now)).length,
    delayed: d.orders.filter((o) => isDelayed(o, now)).length,
    lowStock: lowStock.length,
  }
  const recent = [...d.orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 8)
  return { series, today, yesterday, net30, orders30, refund30, top10, artistSplit, lowStock, todo, recent }
}
