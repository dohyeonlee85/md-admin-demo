// 업무 규칙. 모든 변경은 runTx(묶음 처리) 안에서 "현재 값 확인 → 검증 → 저장" 순서로 진행한다.
import type { Backend, Tx } from './backend'
import {
  CURRENCIES, ORDER_STATUS_LABEL, type InventoryLog, type LogType, type Order, type OrderStatus,
  type Product, type ProductStatus, type Sku,
} from './types'

export const HOUR = 3600000
export const DAY = 24 * HOUR
export const PENDING_LIMIT = 24 * HOUR // 결제 대기 자동 취소 기준
export const DELAY_DOMESTIC = 5 * DAY // 배송 지연 기준 (국내)
export const DELAY_OVERSEAS = 14 * DAY // 배송 지연 기준 (해외)

const uid = (prefix: string) => prefix + Date.now().toString(36) + Math.random().toString(36).slice(2, 6)

function makeLog(sku: Sku, type: LogType, delta: number, allocDelta: number, reason: string, actor: string): InventoryLog {
  return { id: uid('l'), skuId: sku.id, type, delta, allocDelta, onHandAfter: sku.onHand, reason, actor, createdAt: Date.now() }
}

async function mustGet<T>(p: Promise<T | undefined>, what: string): Promise<T> {
  const v = await p
  if (!v) throw new Error(`${what}을(를) 찾을 수 없습니다.`)
  return v
}
function expect(o: Order, ...allowed: OrderStatus[]) {
  if (!allowed.includes(o.orderStatus))
    throw new Error(`현재 상태(${ORDER_STATUS_LABEL[o.orderStatus]})에서는 처리할 수 없습니다.`)
}

/** 판매 시작 가능 여부: 3개 국가 가격이 모두 입력되어야 한다 */
export function missingPrices(p: Pick<Product, 'prices'>) {
  return CURRENCIES.filter((c) => !(Number(p.prices[c]) > 0))
}

export function createActions(backend: Backend, actor: string) {
  const tx = (fn: (t: Tx) => Promise<void>) => backend.runTx(fn)

  /** 할당 해제: 출고 전 주문이 취소되면 묶어 둔 재고를 풀어 준다 */
  async function release(t: Tx, o: Order, reason: string) {
    const skus = await Promise.all(o.items.map((it) => mustGet(t.get('skus', it.skuId), 'SKU')))
    o.items.forEach((it, i) => {
      const s = { ...skus[i], allocated: Math.max(0, skus[i].allocated - it.qty) }
      t.set('skus', s)
      t.set('inventoryLogs', makeLog(s, 'RELEASE', 0, -it.qty, reason, actor))
    })
  }

  return {
    // ── 상품
    async saveProduct(p: Product, newSkus: Sku[] = []) {
      if (!p.name.trim()) throw new Error('상품명을 입력해 주세요.')
      if (p.status === 'ON_SALE' && missingPrices(p).length)
        throw new Error(`판매 중 상품은 가격을 비울 수 없습니다. (${missingPrices(p).join(', ')})`)
      await tx(async (t) => {
        t.set('products', { ...p, updatedAt: Date.now() })
        newSkus.forEach((s) => t.set('skus', s))
      })
    },
    async setProductStatus(id: string, status: ProductStatus) {
      await tx(async (t) => {
        const p = await mustGet(t.get('products', id), '상품')
        const miss = missingPrices(p)
        if (status === 'ON_SALE' && miss.length)
          throw new Error(`가격 미입력 국가가 있어 판매를 시작할 수 없습니다. (${miss.join(', ')})`)
        t.set('products', { ...p, status, updatedAt: Date.now() })
      })
    },
    async addSku(productId: string, option: string) {
      if (!option.trim()) throw new Error('옵션명을 입력해 주세요.')
      const id = uid(productId + '-s')
      await tx(async (t) => {
        await mustGet(t.get('products', productId), '상품')
        t.set('skus', { id, productId, code: 'SKU-' + id.toUpperCase(), option: option.trim(), onHand: 0, allocated: 0, threshold: 100 })
      })
    },

    // ── 재고
    async adjustStock(skuId: string, type: 'INBOUND' | 'ADJUST', delta: number, reason: string) {
      if (!Number.isInteger(delta) || delta === 0) throw new Error('수량은 0이 아닌 정수로 입력해 주세요.')
      if (type === 'INBOUND' && delta < 0) throw new Error('입고 수량은 1 이상이어야 합니다.')
      if (!reason.trim()) throw new Error('사유를 입력해 주세요.')
      await tx(async (t) => {
        const s = await mustGet(t.get('skus', skuId), 'SKU')
        const onHand = s.onHand + delta
        if (onHand < s.allocated)
          throw new Error(`주문에 할당된 수량(${s.allocated})보다 적게 조정할 수 없습니다.`)
        const next = { ...s, onHand }
        t.set('skus', next)
        t.set('inventoryLogs', makeLog(next, type, delta, 0, reason.trim(), actor))
      })
    },
    async setThreshold(skuId: string, threshold: number) {
      if (!Number.isInteger(threshold) || threshold < 0) throw new Error('부족 기준은 0 이상 정수로 입력해 주세요.')
      await tx(async (t) => {
        const s = await mustGet(t.get('skus', skuId), 'SKU')
        t.set('skus', { ...s, threshold })
      })
    },

    // ── 주문
    async confirmPayment(id: string) {
      await tx(async (t) => {
        const o = await mustGet(t.get('orders', id), '주문')
        expect(o, 'PENDING')
        t.set('orders', { ...o, orderStatus: 'PAID', paymentStatus: 'PAID', paidAt: Date.now() })
      })
    },
    async startPreparing(id: string) {
      await tx(async (t) => {
        const o = await mustGet(t.get('orders', id), '주문')
        expect(o, 'PAID')
        t.set('orders', { ...o, orderStatus: 'PREPARING' })
      })
    },
    /** 출고 처리: 이 시점에 보유 재고를 차감한다 (주문 시 할당 → 출고 시 차감) */
    async ship(id: string, carrier: string, trackingNo: string) {
      if (!carrier.trim() || !trackingNo.trim()) throw new Error('택배사와 송장번호를 입력해 주세요.')
      await tx(async (t) => {
        const o = await mustGet(t.get('orders', id), '주문')
        expect(o, 'PAID', 'PREPARING')
        const skus = await Promise.all(o.items.map((it) => mustGet(t.get('skus', it.skuId), 'SKU')))
        o.items.forEach((it, i) => {
          const s = skus[i]
          if (s.onHand < it.qty) throw new Error(`재고 부족: ${it.productName} (${it.option}) 보유 ${s.onHand}개`)
          const next = { ...s, onHand: s.onHand - it.qty, allocated: Math.max(0, s.allocated - it.qty) }
          t.set('skus', next)
          t.set('inventoryLogs', makeLog(next, 'SHIP', -it.qty, -it.qty, `출고 ${o.orderNo}`, actor))
        })
        t.set('orders', { ...o, orderStatus: 'SHIPPED', shippedAt: Date.now(), carrier: carrier.trim(), trackingNo: trackingNo.trim() })
      })
    },
    async markDelivered(id: string) {
      await tx(async (t) => {
        const o = await mustGet(t.get('orders', id), '주문')
        expect(o, 'SHIPPED')
        t.set('orders', { ...o, orderStatus: 'DELIVERED', deliveredAt: Date.now() })
      })
    },
    async confirmPurchase(id: string) {
      await tx(async (t) => {
        const o = await mustGet(t.get('orders', id), '주문')
        expect(o, 'DELIVERED')
        t.set('orders', { ...o, orderStatus: 'CONFIRMED' })
      })
    },
    /** 출고 전 취소: 할당 해제. 결제된 주문이면 환불을 수동 기록한다 (PG 연동 없음) */
    async cancelOrder(id: string, reason: string) {
      if (!reason.trim()) throw new Error('취소 사유를 입력해 주세요.')
      await tx(async (t) => {
        const o = await mustGet(t.get('orders', id), '주문')
        expect(o, 'PENDING', 'PAID', 'PREPARING')
        await release(t, o, `주문 취소 ${o.orderNo}`)
        const paid = o.paymentStatus === 'PAID'
        t.set('orders', {
          ...o, orderStatus: 'CANCELED', refundReason: reason.trim(),
          ...(paid
            ? { paymentStatus: 'REFUNDED' as const, refundedAt: Date.now(), refundAmountKrw: o.totalKrw }
            : { paymentStatus: 'CANCELED' as const }),
        })
      })
    },
    /** 출고 후 환불 기록: 매출은 환불일 기준으로 차감. 회수 상품은 검수 후 '입고'로 따로 처리 */
    async recordRefund(id: string, reason: string) {
      if (!reason.trim()) throw new Error('환불 사유를 입력해 주세요.')
      await tx(async (t) => {
        const o = await mustGet(t.get('orders', id), '주문')
        expect(o, 'SHIPPED', 'DELIVERED', 'CONFIRMED')
        if (o.paymentStatus !== 'PAID') throw new Error('이미 환불 처리된 주문입니다.')
        t.set('orders', { ...o, paymentStatus: 'REFUNDED', refundedAt: Date.now(), refundAmountKrw: o.totalKrw, refundReason: reason.trim() })
      })
    },
    /** 결제 대기 24시간 경과 주문 일괄 취소 */
    async cancelExpired(orders: Order[]) {
      const targets = orders.filter((o) => o.orderStatus === 'PENDING' && Date.now() - o.createdAt > PENDING_LIMIT)
      for (const o of targets) {
        await tx(async (t) => {
          const cur = await mustGet(t.get('orders', o.id), '주문')
          if (cur.orderStatus !== 'PENDING') return
          await release(t, cur, `결제 기한 경과 ${cur.orderNo}`)
          t.set('orders', { ...cur, orderStatus: 'CANCELED', paymentStatus: 'CANCELED', refundReason: '결제 기한(24시간) 경과' })
        })
      }
      return targets.length
    },
  }
}
export type Actions = ReturnType<typeof createActions>

export const isPendingExpired = (o: Order, now = Date.now()) =>
  o.orderStatus === 'PENDING' && now - o.createdAt > PENDING_LIMIT
export const isDelayed = (o: Order, now = Date.now()) =>
  ['PAID', 'PREPARING', 'SHIPPED'].includes(o.orderStatus) && !!o.paidAt &&
  now - o.paidAt > (o.currency === 'KRW' ? DELAY_DOMESTIC : DELAY_OVERSEAS)
