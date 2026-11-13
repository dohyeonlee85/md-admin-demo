// 분석 집계 규칙 (Analytics)
// - 순매출 = 결제 − 환불. 결제는 결제일, 환불은 환불일에 반영. 날짜는 한국 시간(KST)
// - 원화 환산은 주문에 저장된 결제 시점 환율로 고정
// - 아티스트 필터는 주문 안의 상품 단위로 나눠 계산 (한 주문에 두 아티스트 상품이 섞여도 정확히 분리)
// - ALBUM 지표: 발매일(releasedAt, 없으면 첫 결제일)부터 7일간 판매 수량
import { DAY } from './actions'
import { dayKey } from './format'
import type { Category, Currency, Data, Order } from './types'
import { CATEGORIES, CURRENCIES } from './types'

export interface Filter { days: number; artistId: string; currency: 'ALL' | Currency }

const itemKrw = (o: Order, unitPrice: number, qty: number) => Math.round(unitPrice * qty * o.fxRate)

export function buildAnalytics(d: Data, f: Filter, now = Date.now()) {
  const productMap = new Map(d.products.map((p) => [p.id, p]))
  const keys = Array.from({ length: f.days }, (_, i) => dayKey(now - (f.days - 1 - i) * DAY))
  const inRange = new Set(keys)
  const day = new Map(keys.map((k) => [k, { sales: 0, refund: 0, orders: 0 }]))
  const matchItem = (productId: string) => f.artistId === 'ALL' || productMap.get(productId)?.artistId === f.artistId
  const matchOrder = (o: Order) => f.currency === 'ALL' || o.currency === f.currency

  let sales = 0, refund = 0, orders = 0, qty = 0, refundOrders = 0
  const byProduct = new Map<string, { qty: number; krw: number; refundQty: number }>()
  const byCategory = new Map<Category, { qty: number; krw: number }>(CATEGORIES.map((c) => [c, { qty: 0, krw: 0 }]))
  const byCurrency = new Map<Currency, { orders: number; local: number; krw: number }>(CURRENCIES.map((c) => [c, { orders: 0, local: 0, krw: 0 }]))

  for (const o of d.orders) {
    if (!matchOrder(o)) continue
    const items = o.items.filter((it) => matchItem(it.productId))
    if (!items.length) continue
    const krw = items.reduce((s, it) => s + itemKrw(o, it.unitPrice, it.qty), 0)
    const local = items.reduce((s, it) => s + it.unitPrice * it.qty, 0)

    // 결제 (결제일 기준)
    if (o.paidAt && inRange.has(dayKey(o.paidAt))) {
      const slot = day.get(dayKey(o.paidAt))!
      slot.sales += krw; slot.orders += 1
      sales += krw; orders += 1
      const cur = byCurrency.get(o.currency)!
      cur.orders += 1; cur.local += local; cur.krw += krw
      const refunded = o.paymentStatus === 'REFUNDED'
      if (refunded) refundOrders += 1
      for (const it of items) {
        const k = itemKrw(o, it.unitPrice, it.qty)
        const p = byProduct.get(it.productId) ?? { qty: 0, krw: 0, refundQty: 0 }
        if (refunded) p.refundQty += it.qty
        else {
          p.qty += it.qty; p.krw += k; qty += it.qty
          const c = productMap.get(it.productId)?.category
          if (c) { const cc = byCategory.get(c)!; cc.qty += it.qty; cc.krw += k }
        }
        byProduct.set(it.productId, p)
      }
    }
    // 환불 (환불일 기준, 해당 아티스트 상품 비율만큼)
    if (o.refundedAt && inRange.has(dayKey(o.refundedAt))) {
      const r = o.totalKrw ? Math.round((o.refundAmountKrw ?? 0) * (krw / o.totalKrw)) : 0
      day.get(dayKey(o.refundedAt))!.refund += r
      refund += r
    }
  }

  const series = keys.map((k) => {
    const v = day.get(k)!
    return { date: k.slice(5), sales: v.sales, refund: -v.refund, net: v.sales - v.refund, orders: v.orders }
  })
  const net = sales - refund
  const products = [...byProduct.entries()].map(([id, v]) => {
    const p = productMap.get(id)
    return {
      id, name: p?.name ?? id, artist: d.artists.find((a) => a.id === p?.artistId)?.name ?? '-',
      category: p?.category ?? '-', ...v,
    }
  })
  const categories = [...byCategory.entries()].map(([name, v]) => ({ name, ...v })).filter((c) => c.qty > 0)
    .sort((a, b) => b.krw - a.krw)
  const currencies = [...byCurrency.entries()].map(([code, v]) => ({ code, ...v }))
    .filter((c) => f.currency === 'ALL' || c.code === f.currency)

  return {
    series, net, sales, refund, orders, qty, refundOrders,
    aov: orders ? Math.round(sales / orders) : 0,
    refundRate: orders ? refundOrders / orders : 0,
    products, categories, currencies,
    albums: albumLaunch(d, f, now),
  }
}

/** ALBUM 발매 후 7일 판매 수량 (기간 필터와 무관, 아티스트·국가 필터는 적용) */
function albumLaunch(d: Data, f: Filter, now: number) {
  const albums = d.products.filter((p) => p.category === 'ALBUM' && (f.artistId === 'ALL' || p.artistId === f.artistId))
  return albums.map((p) => {
    const paid = d.orders.filter((o) => o.paidAt && (f.currency === 'ALL' || o.currency === f.currency) && o.items.some((it) => it.productId === p.id))
    const firstPaid = paid.reduce<number | undefined>((m, o) => (m === undefined || o.paidAt! < m ? o.paidAt : m), undefined)
    const start = p.releasedAt ?? firstPaid
    if (start === undefined) return { id: p.id, name: p.name, release: '-', basis: '-', total: 0, byOption: [] as { option: string; qty: number }[], daily: [] as number[], done: false }
    const startKey = dayKey(start)
    const windowKeys = Array.from({ length: 7 }, (_, i) => dayKey(start + i * DAY))
    const idx = new Map(windowKeys.map((k, i) => [k, i]))
    const daily = Array(7).fill(0) as number[]
    const opt = new Map<string, number>()
    for (const o of paid) {
      if (o.paymentStatus === 'REFUNDED') continue
      const i = idx.get(dayKey(o.paidAt!))
      if (i === undefined) continue
      for (const it of o.items) {
        if (it.productId !== p.id) continue
        daily[i] += it.qty
        opt.set(it.option, (opt.get(it.option) ?? 0) + it.qty)
      }
    }
    return {
      id: p.id, name: p.name, release: startKey, basis: p.releasedAt ? '발매일' : '첫 결제일',
      total: daily.reduce((s, x) => s + x, 0),
      byOption: [...opt.entries()].map(([option, qty]) => ({ option, qty })).sort((a, b) => b.qty - a.qty),
      daily, done: now - start >= 7 * DAY,
    }
  })
}
