// 업무 규칙. 모든 변경은 runTx(묶음 처리) 안에서 "현재 값 확인 → 검증 → 저장" 순서로 진행한다.
import type { Backend, Tx } from './backend'
import {
  CURRENCIES, ORDER_STATUS_LABEL, type Currency, type Inquiry, type InventoryLog, type IpProject, type LogType,
  type Notice, type Order, type OrderStatus, type Plan, type Product, type ProductStatus, type SaleRound,
  type Settings, type Sku,
} from './types'
import { rules } from './settings'

export const HOUR = 3600000
export const DAY = 24 * HOUR
// 기준값(결제 대기 취소·배송 지연 등)은 settings.ts 의 rules 에서 읽는다. System Settings 화면에서 변경 가능.
const pendingLimit = () => rules.pendingCancelHours * HOUR
const isDate = (v: string) => /^\d{4}-\d{2}-\d{2}$/.test(v)

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
        t.set('skus', { id, productId, code: 'SKU-' + id.toUpperCase(), option: option.trim(), onHand: 0, allocated: 0, threshold: rules.lowStockThreshold })
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
      const targets = orders.filter((o) => o.orderStatus === 'PENDING' && Date.now() - o.createdAt > pendingLimit())
      for (const o of targets) {
        await tx(async (t) => {
          const cur = await mustGet(t.get('orders', o.id), '주문')
          if (cur.orderStatus !== 'PENDING') return
          await release(t, cur, `결제 기한 경과 ${cur.orderNo}`)
          t.set('orders', { ...cur, orderStatus: 'CANCELED', paymentStatus: 'CANCELED', refundReason: `결제 기한(${rules.pendingCancelHours}시간) 경과` })
        })
      }
      return targets.length
    },

    // ── 아티스트 · IP
    async saveIp(ip: IpProject) {
      if (!ip.name.trim()) throw new Error('프로젝트명을 입력해 주세요.')
      if (!isDate(ip.startDate)) throw new Error('시작일을 입력해 주세요.')
      if (ip.endDate && ip.endDate < ip.startDate) throw new Error('종료일은 시작일보다 빠를 수 없습니다.')
      await tx(async (t) => { t.set('ipProjects', { ...ip, name: ip.name.trim(), updatedAt: Date.now() }) })
    },
    /** 상품을 IP 프로젝트에 연결하거나(ipId) 연결을 해제한다(빈 값) */
    async linkProductIp(productId: string, ipId: string) {
      await tx(async (t) => {
        const p = await mustGet(t.get('products', productId), '상품')
        const next = { ...p, updatedAt: Date.now() }
        if (ipId) {
          const ip = await mustGet(t.get('ipProjects', ipId), 'IP 프로젝트')
          if (ip.artistId !== p.artistId) throw new Error('다른 아티스트의 IP 프로젝트에는 연결할 수 없습니다.')
          next.ipId = ipId
        } else delete next.ipId
        t.set('products', next)
      })
    },

    // ── 상품 기획
    async savePlan(plan: Plan) {
      if (!plan.title.trim()) throw new Error('기획안 제목을 입력해 주세요.')
      await tx(async (t) => {
        const cur = await t.get('plans', plan.id)
        if (cur && cur.status !== 'DRAFT' && cur.status !== 'REJECTED')
          throw new Error('승인 대기·승인 상태의 기획안은 수정할 수 없습니다.')
        t.set('plans', { ...plan, title: plan.title.trim(), status: cur?.status ?? 'DRAFT', updatedAt: Date.now() })
      })
    },
    async requestPlanReview(id: string) {
      await tx(async (t) => {
        const p = await mustGet(t.get('plans', id), '기획안')
        if (p.status !== 'DRAFT' && p.status !== 'REJECTED') throw new Error('작성 중·반려 상태에서만 승인을 요청할 수 있습니다.')
        if (!(p.targetPriceKrw > 0) || !(p.targetQty > 0)) throw new Error('목표 가격과 목표 수량을 입력해 주세요.')
        if (!isDate(p.launchDate)) throw new Error('출시 목표일을 입력해 주세요.')
        const next = { ...p, status: 'REVIEW' as const, requestedAt: Date.now(), updatedAt: Date.now() }
        delete next.rejectReason
        t.set('plans', next)
      })
    },
    /** 기획 승인·반려. 관리자 1인 체계에서는 본인 승인, 다중 관리자 확장 시 작성자와 승인자를 분리한다 */
    async decidePlan(id: string, approve: boolean, reason = '') {
      if (!approve && !reason.trim()) throw new Error('반려 사유를 입력해 주세요.')
      await tx(async (t) => {
        const p = await mustGet(t.get('plans', id), '기획안')
        if (p.status !== 'REVIEW') throw new Error('승인 대기 상태의 기획안만 처리할 수 있습니다.')
        t.set('plans', {
          ...p, status: approve ? 'APPROVED' : 'REJECTED', decidedAt: Date.now(), decidedBy: actor, updatedAt: Date.now(),
          ...(approve ? {} : { rejectReason: reason.trim() }),
        })
      })
    },
    /** 승인된 기획안을 '판매 준비' 상품으로 전환 (가격은 국내만 채워지고, 해외 가격은 상품 관리에서 입력) */
    async createProductFromPlan(id: string) {
      const productId = uid('p')
      await tx(async (t) => {
        const p = await mustGet(t.get('plans', id), '기획안')
        if (p.status !== 'APPROVED') throw new Error('승인된 기획안만 상품으로 전환할 수 있습니다.')
        if (p.productId) throw new Error('이미 상품으로 전환된 기획안입니다.')
        const now = Date.now()
        const product: Product = {
          id: productId, name: p.title, artistId: p.artistId, category: p.category, saleType: p.saleType, round: '1차',
          status: 'DRAFT', prices: { KRW: p.targetPriceKrw }, purchaseLimit: 0, planId: p.id, createdAt: now, updatedAt: now,
        }
        if (p.ipId) product.ipId = p.ipId
        t.set('products', product)
        t.set('skus', { id: productId + '-s1', productId, code: 'SKU-' + productId.toUpperCase() + '-1', option: '단품', onHand: 0, allocated: 0, threshold: rules.lowStockThreshold })
        t.set('plans', { ...p, productId, updatedAt: now })
      })
    },

    // ── 판매 회차
    async saveRound(r: SaleRound) {
      if (!isDate(r.startDate) || !isDate(r.endDate)) throw new Error('판매 기간을 입력해 주세요.')
      if (r.endDate < r.startDate) throw new Error('종료일은 시작일보다 빠를 수 없습니다.')
      if (!r.countries.length) throw new Error('판매 국가를 1개 이상 선택해 주세요.')
      await tx(async (t) => {
        await mustGet(t.get('products', r.productId), '상품')
        const cur = await t.get('saleRounds', r.id)
        if (cur && cur.status === 'CLOSED') throw new Error('종료된 회차는 수정할 수 없습니다.')
        t.set('saleRounds', { ...r, status: cur?.status ?? 'SCHEDULED' })
      })
    },
    /** 판매 시작은 수동. 선택한 국가의 가격이 모두 입력되어 있어야 하고, 한 상품에 판매 중 회차는 1개만 */
    async openRound(id: string, others: SaleRound[]) {
      await tx(async (t) => {
        const r = await mustGet(t.get('saleRounds', id), '판매 회차')
        if (r.status !== 'SCHEDULED') throw new Error('예정 상태의 회차만 판매를 시작할 수 있습니다.')
        const p = await mustGet(t.get('products', r.productId), '상품')
        if (p.status === 'ARCHIVED') throw new Error('보관된 상품은 판매를 시작할 수 없습니다.')
        const miss = roundMissingPrices(p, r.countries)
        if (miss.length) throw new Error(`가격 미입력 국가가 있어 판매를 시작할 수 없습니다. (${miss.join(', ')})`)
        for (const o of others) {
          if (o.id === id || o.productId !== r.productId) continue
          const cur = await t.get('saleRounds', o.id)
          if (cur?.status === 'OPEN') throw new Error(`이미 판매 중인 회차(${cur.round})가 있습니다. 먼저 종료해 주세요.`)
        }
        t.set('saleRounds', { ...r, status: 'OPEN', openedAt: Date.now() })
        t.set('products', { ...p, status: 'ON_SALE', round: r.round, updatedAt: Date.now() })
      })
    },
    async closeRound(id: string) {
      await tx(async (t) => {
        const r = await mustGet(t.get('saleRounds', id), '판매 회차')
        if (r.status !== 'OPEN') throw new Error('판매 중인 회차만 종료할 수 있습니다.')
        const p = await mustGet(t.get('products', r.productId), '상품')
        t.set('saleRounds', { ...r, status: 'CLOSED', closedAt: Date.now() })
        if (p.status === 'ON_SALE') t.set('products', { ...p, status: 'PAUSED', updatedAt: Date.now() })
      })
    },

    // ── 고객 · CS
    async answerInquiry(id: string, answer: string) {
      if (!answer.trim()) throw new Error('답변 내용을 입력해 주세요.')
      await tx(async (t) => {
        const q = await mustGet(t.get('inquiries', id), '문의')
        if (q.type !== 'QUESTION') throw new Error('교환 접수는 승인·반려로 처리해 주세요.')
        if (q.status !== 'OPEN') throw new Error('이미 처리된 문의입니다.')
        t.set('inquiries', { ...q, status: 'ANSWERED', answer: answer.trim(), answeredBy: actor, answeredAt: Date.now() })
      })
    },
    /** 교환 승인·반려. 승인은 배송 완료 주문이고 접수 기한 안에 들어온 건만 가능 */
    async decideExchange(id: string, approve: boolean, note: string) {
      if (!note.trim()) throw new Error(approve ? '처리 안내 내용을 입력해 주세요.' : '반려 사유를 입력해 주세요.')
      await tx(async (t) => {
        const q = await mustGet(t.get('inquiries', id), '교환 접수')
        if (q.type !== 'EXCHANGE') throw new Error('교환 접수 건이 아닙니다.')
        if (q.status !== 'OPEN') throw new Error('이미 처리된 접수입니다.')
        if (approve) {
          const o = q.orderId ? await t.get('orders', q.orderId) : undefined
          const block = exchangeBlock(q, o)
          if (block) throw new Error(block)
        }
        t.set('inquiries', { ...q, status: approve ? 'APPROVED' : 'REJECTED', answer: note.trim(), answeredBy: actor, answeredAt: Date.now() })
      })
    },
    async saveNotice(n: Notice) {
      if (!n.title.KO?.trim() || !n.body.KO?.trim()) throw new Error('한국어 제목과 내용을 입력해 주세요.')
      if (!n.title.EN?.trim() || !n.body.EN?.trim()) throw new Error('영어 제목과 내용을 입력해 주세요. (일본어가 없으면 영어로 노출됩니다)')
      const clean = { ...n, title: { ...n.title }, body: { ...n.body }, updatedAt: Date.now() }
      if (!clean.title.JA?.trim() || !clean.body.JA?.trim()) { delete clean.title.JA; delete clean.body.JA }
      await tx(async (t) => { t.set('notices', clean) })
    },
    async setNoticePublished(id: string, published: boolean) {
      await tx(async (t) => {
        const n = await mustGet(t.get('notices', id), '게시물')
        t.set('notices', { ...n, published, updatedAt: Date.now() })
      })
    },

    // ── 시스템 설정
    async saveSettings(v: Settings) {
      const ints: [keyof Settings, string][] = [
        ['lowStockThreshold', '재고 부족 기준'], ['pendingCancelHours', '결제 대기 취소 기준'], ['delayDomesticDays', '국내 배송 지연 기준'],
        ['delayOverseasDays', '해외 배송 지연 기준'], ['exchangeDays', '교환 접수 기한'], ['csDelayHours', '응답 지연 기준'], ['autoConfirmDays', '자동 구매 확정'],
      ]
      for (const [k, label] of ints) {
        const n = v[k] as number
        if (!Number.isInteger(n) || n < 1) throw new Error(`${label}: 1 이상의 정수로 입력해 주세요.`)
      }
      if (!(v.fxUSD > 0) || !(v.fxJPY > 0)) throw new Error('기준 환율은 0보다 커야 합니다.')
      await tx(async (t) => { t.set('settings', { ...v, id: 'main', updatedAt: Date.now(), updatedBy: actor }) })
    },
  }
}

/** 회차에 선택된 국가 중 가격이 비어 있는 국가 */
export function roundMissingPrices(p: Pick<Product, 'prices'>, countries: Currency[]) {
  return countries.filter((c) => !(Number(p.prices[c]) > 0))
}

/** 교환 승인을 막는 사유 (없으면 빈 문자열). 교환은 불량·오배송·누락만, 배송 완료 후 기한 안에 접수된 건만 */
export function exchangeBlock(q: Inquiry, o?: Order): string {
  if (!o) return '연결된 주문을 찾을 수 없어 교환을 승인할 수 없습니다.'
  if (!o.deliveredAt) return '배송 완료 전 주문은 교환을 승인할 수 없습니다.'
  if (q.createdAt - o.deliveredAt > rules.exchangeDays * DAY)
    return `교환 접수 기한(배송 완료 후 ${rules.exchangeDays}일)이 지난 접수입니다.`
  return ''
}
export const isCsDelayed = (q: Inquiry, now = Date.now()) =>
  q.status === 'OPEN' && now - q.createdAt > rules.csDelayHours * HOUR
export type Actions = ReturnType<typeof createActions>

export const isPendingExpired = (o: Order, now = Date.now()) =>
  o.orderStatus === 'PENDING' && now - o.createdAt > pendingLimit()
export const isDelayed = (o: Order, now = Date.now()) =>
  ['PAID', 'PREPARING', 'SHIPPED'].includes(o.orderStatus) && !!o.paidAt &&
  now - o.paidAt > (o.currency === 'KRW' ? rules.delayDomesticDays : rules.delayOverseasDays) * DAY
