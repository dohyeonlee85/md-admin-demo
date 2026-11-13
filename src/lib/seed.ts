// 시연용 자료 생성기. 실존 고객 정보가 아닌 테스트 데이터만 만든다.
import type {
  Category, Currency, Customer, Data, InventoryLog, Order, OrderItem, OrderStatus,
  PaymentStatus, Product, ProductStatus, SaleType, Sku,
} from './types'
import { dayKey } from './format'

function rng(seed: number) {
  let a = seed
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const DAY = 86400000
const HOUR = 3600000

type P = [string, 'ateez' | 'xikers', Category, SaleType, string, ProductStatus, number, string[], number?]
// 이름, 아티스트, 분류, 판매유형, 회차, 상태, 원화 가격, 옵션, 인기도
const PRODUCTS: P[] = [
  ['ATEEZ OFFICIAL LIGHT STICK VER.3', 'ateez', 'MD', 'NORMAL', '재판매', 'ON_SALE', 49000, ['단품'], 9],
  ['ATEEZ 2027 SEASON\'S GREETINGS', 'ateez', "SEASON'S GREETINGS", 'PREORDER', '1차', 'ON_SALE', 45000, ['단품'], 10],
  ['ATEEZ WORLD TOUR HOODIE', 'ateez', 'TOUR MD', 'NORMAL', '1차', 'ON_SALE', 79000, ['S', 'M', 'L', 'XL'], 7],
  ['ATEEZ WORLD TOUR T-SHIRT', 'ateez', 'TOUR MD', 'NORMAL', '2차', 'ON_SALE', 39000, ['S', 'M', 'L', 'XL'], 8],
  ['ATEEZ WORLD TOUR SLOGAN TOWEL', 'ateez', 'TOUR MD', 'NORMAL', '1차', 'ON_SALE', 22000, ['단품'], 6],
  ['ATEEZ MINI ALBUM (DEMO EDITION)', 'ateez', 'ALBUM', 'NORMAL', '1차', 'ON_SALE', 19800, ['A ver.', 'B ver.', 'C ver.'], 10],
  ['ATEEZ PHOTOBOOK : ON THE ROAD', 'ateez', 'PHOTOBOOK', 'LIMITED', '1차', 'ON_SALE', 42000, ['단품'], 5],
  ['ATEEZ ACRYLIC KEYRING SET', 'ateez', 'MD', 'NORMAL', '재판매', 'ON_SALE', 15000, ['A SET', 'B SET'], 6],
  ['ATEEZ PHOTO CARD BINDER', 'ateez', 'MD', 'NORMAL', '1차', 'ON_SALE', 28000, ['BLACK', 'IVORY'], 5],
  ['ATEEZ OFFICIAL MEMBERSHIP KIT', 'ateez', 'MEMBERSHIP', 'NORMAL', '1차', 'ON_SALE', 33000, ['단품'], 4],
  ['ATEEZ BALL CAP', 'ateez', 'MD', 'NORMAL', '1차', 'PAUSED', 35000, ['BLACK', 'NAVY'], 2],
  ['ATEEZ FANMEETING MD PACKAGE', 'ateez', 'MD', 'PREORDER', '1차', 'DRAFT', 58000, ['단품'], 0],
  ['ATEEZ 2026 SEASON\'S GREETINGS', 'ateez', "SEASON'S GREETINGS", 'NORMAL', '1차', 'ARCHIVED', 42000, ['단품'], 0],
  ['xikers OFFICIAL LIGHT STICK', 'xikers', 'MD', 'NORMAL', '2차', 'ON_SALE', 45000, ['단품'], 6],
  ['xikers MINI ALBUM (DEMO EDITION)', 'xikers', 'ALBUM', 'NORMAL', '1차', 'ON_SALE', 18500, ['HIKER ver.', 'TRICKY ver.'], 7],
  ['xikers TOUR T-SHIRT', 'xikers', 'TOUR MD', 'NORMAL', '1차', 'ON_SALE', 36000, ['M', 'L', 'XL'], 4],
  ['xikers PHOTOBOOK : ROAD TRIP', 'xikers', 'PHOTOBOOK', 'PREORDER', '1차', 'ON_SALE', 38000, ['단품'], 4],
  ['xikers ACRYLIC STAND', 'xikers', 'MD', 'LIMITED', '1차', 'ON_SALE', 16000, ['단품'], 3],
  ['xikers 2027 SEASON\'S GREETINGS', 'xikers', "SEASON'S GREETINGS", 'PREORDER', '1차', 'ON_SALE', 39000, ['단품'], 5],
  ['xikers OFFICIAL MEMBERSHIP KIT', 'xikers', 'MEMBERSHIP', 'NORMAL', '1차', 'ON_SALE', 30000, ['단품'], 3],
  ['xikers ECO BAG', 'xikers', 'MD', 'NORMAL', '1차', 'DRAFT', 19000, ['단품'], 0],
]

const KO_LAST = ['김', '이', '박', '최', '정', '강', '조', '윤', '장', '임', '한', '오']
const KO_FIRST = ['서연', '민준', '지우', '하준', '수아', '도윤', '예린', '시우', '유나', '건우', '채원', '지호', '다은', '현우']
const EN = ['Emma Carter', 'Liam Brooks', 'Olivia Hayes', 'Noah Bennett', 'Sophia Reed', 'Mason Cole', 'Ava Morgan', 'Lucas Perry', 'Mia Foster', 'Ethan Ward', 'Chloe Barnes', 'Daniel Price']
const JP = ['Sato Yui', 'Suzuki Haruto', 'Takahashi Rin', 'Tanaka Sota', 'Ito Mei', 'Watanabe Ren', 'Yamamoto Aoi', 'Nakamura Riku', 'Kobayashi Hina', 'Kato Yuto']
const ADDR: Record<Currency, string[]> = {
  KRW: ['서울특별시 마포구 테스트로 12', '부산광역시 해운대구 샘플대로 45', '경기도 성남시 분당구 데모길 8', '대구광역시 수성구 예시로 101', '인천광역시 연수구 가상대로 77'],
  USD: ['100 Sample St, Los Angeles, CA', '25 Demo Ave, New York, NY', '8 Test Rd, Austin, TX', '300 Example Blvd, Seattle, WA'],
  JPY: ['東京都渋谷区サンプル1-2-3', '大阪府大阪市北区テスト4-5', '福岡県福岡市中央区デモ6-7'],
}

export function generateSeed(now = Date.now()): Data {
  const r = rng(20261113)
  const pick = <T,>(arr: T[]) => arr[Math.floor(r() * arr.length)]
  const int = (min: number, max: number) => Math.floor(r() * (max - min + 1)) + min

  const artists = [{ id: 'ateez', name: 'ATEEZ' }, { id: 'xikers', name: 'xikers' }]

  // ── 상품 · SKU
  const products: Product[] = []
  const skus: Sku[] = []
  const weight: { sku: Sku; product: Product; w: number }[] = []
  PRODUCTS.forEach(([name, artistId, category, saleType, round, status, krw, options, pop = 0], i) => {
    const id = 'p' + String(i + 1).padStart(2, '0')
    const prices: Product['prices'] = {
      KRW: krw,
      USD: Math.floor(krw / 1350) + 0.99,
      JPY: Math.round(krw / 9 / 100) * 100,
    }
    // 경우의 수: 일본 가격이 비어 있어 판매 시작이 막히는 상품
    if (name.includes('FANMEETING')) delete prices.JPY
    const p: Product = {
      id, name, artistId, category, saleType, round, status, prices,
      purchaseLimit: saleType === 'LIMITED' ? 2 : category === 'ALBUM' ? 0 : 5,
      createdAt: now - int(20, 120) * DAY,
      updatedAt: now - int(0, 15) * DAY,
    }
    if (saleType === 'PREORDER') p.shipFrom = dayKey(now + int(10, 35) * DAY)
    // ALBUM 발매일: ATEEZ는 발매 7일 경과(집계 완료), xikers는 발매 4일째(집계 중)
    if (category === 'ALBUM') p.releasedAt = now - (artistId === 'ateez' ? 9 : 3) * DAY - 9 * HOUR
    products.push(p)
    options.forEach((option, j) => {
      const sku: Sku = {
        id: `${id}-s${j + 1}`, productId: id, code: `SKU-${id.toUpperCase()}-${j + 1}`,
        option, onHand: int(180, 900), allocated: 0, threshold: 100,
      }
      skus.push(sku)
      if (status === 'ON_SALE' || status === 'PAUSED') weight.push({ sku, product: p, w: pop })
    })
  })
  const totalW = weight.reduce((s, x) => s + x.w, 0)
  const pickSku = () => {
    let t = r() * totalW
    for (const x of weight) { t -= x.w; if (t <= 0) return x }
    return weight[0]
  }

  // ── 고객 (전부 가상 인물)
  const customers: Customer[] = []
  for (let i = 0; i < 60; i++) {
    const country: Currency = i < 34 ? 'KRW' : i < 48 ? 'USD' : 'JPY'
    const name = country === 'KRW' ? pick(KO_LAST) + pick(KO_FIRST) : country === 'USD' ? pick(EN) : pick(JP)
    const membership: string[] = []
    if (r() < 0.45) membership.push('ATEEZ')
    if (r() < 0.2) membership.push('xikers')
    customers.push({
      id: 'c' + String(i + 1).padStart(3, '0'), name,
      email: `test.user${i + 1}@example.com`,
      phone: country === 'KRW' ? `010-${int(1000, 9999)}-${int(1000, 9999)}` : country === 'USD' ? `+1-555-${int(1000, 9999)}` : `+81-90-${int(1000, 9999)}`,
      country, membership, joinedAt: now - int(30, 700) * DAY,
    })
  }

  // ── 주문
  const orders: Order[] = []
  const seq: Record<string, number> = {}
  const N = 280
  for (let i = 0; i < N; i++) {
    // 최근일수록 주문이 많도록 분포
    const ageDays = Math.pow(r(), 1.6) * 45
    let createdAt = now - ageDays * DAY - int(0, 20) * 60000
    const c = pick(customers)
    const currency = c.country
    const fxRate = currency === 'KRW' ? 1 : currency === 'USD' ? int(1335, 1368) : Math.round((8.9 + r() * 0.4) * 100) / 100
    const items: OrderItem[] = []
    const used = new Set<string>()
    const lines = r() < 0.62 ? 1 : r() < 0.8 ? 2 : 3
    for (let k = 0; k < lines; k++) {
      const { sku, product } = pickSku()
      if (used.has(sku.id)) continue
      used.add(sku.id)
      items.push({
        skuId: sku.id, productId: product.id, productName: product.name, option: sku.option,
        unitPrice: product.prices[currency] ?? 0, qty: r() < 0.75 ? 1 : int(2, 3),
      })
    }
    const total = Math.round(items.reduce((s, it) => s + it.unitPrice * it.qty, 0) * 100) / 100
    const totalKrw = Math.round(total * fxRate)

    let orderStatus: OrderStatus
    let paymentStatus: PaymentStatus = 'PAID'
    const x = r()
    if (ageDays < 1) orderStatus = x < 0.25 ? 'PENDING' : x < 0.8 ? 'PAID' : 'PREPARING'
    else if (ageDays < 3) orderStatus = x < 0.3 ? 'PAID' : x < 0.65 ? 'PREPARING' : 'SHIPPED'
    else if (ageDays < 8) orderStatus = x < 0.08 ? 'PREPARING' : x < 0.5 ? 'SHIPPED' : 'DELIVERED'
    else orderStatus = x < 0.06 ? 'DELIVERED' : 'CONFIRMED'

    const o: Order = {
      id: 'o' + String(i + 1).padStart(4, '0'), orderNo: '', customerId: c.id, customerName: c.name,
      country: currency, currency, fxRate, items, total, totalKrw, orderStatus, paymentStatus, createdAt,
      address: pick(ADDR[currency]), addressDetail: `${int(101, 120)}동 ${int(101, 1904)}호`, phone: c.phone,
    }
    if (orderStatus === 'PENDING') o.paymentStatus = 'WAITING'
    else o.paidAt = createdAt + int(1, 40) * 60000
    const overseas = currency !== 'KRW'
    if (['SHIPPED', 'DELIVERED', 'CONFIRMED'].includes(orderStatus)) {
      o.shippedAt = Math.min(now - HOUR, o.paidAt! + int(20, 50) * HOUR)
      o.carrier = overseas ? 'EMS' : pick(['CJ대한통운', '한진택배', '롯데택배'])
      o.trackingNo = String(int(100000, 999999)) + String(int(100000, 999999))
    }
    if (['DELIVERED', 'CONFIRMED'].includes(orderStatus))
      o.deliveredAt = Math.min(now - HOUR / 2, o.shippedAt! + int(1, overseas ? 6 : 2) * DAY)

    // 경우의 수: 취소 · 환불
    const y = r()
    if (y < 0.05 && ageDays > 0.5) {
      o.orderStatus = 'CANCELED'; o.paymentStatus = 'CANCELED'
      delete o.paidAt; delete o.shippedAt; delete o.deliveredAt; delete o.carrier; delete o.trackingNo
    } else if (y < 0.1 && ageDays > 4 && o.paidAt) {
      o.paymentStatus = 'REFUNDED'
      o.refundedAt = Math.min(now - HOUR, o.paidAt + int(2, 6) * DAY)
      o.refundAmountKrw = totalKrw
      o.refundReason = pick(['상품 불량', '오배송', '구성품 누락', '고객 변심(출고 전)'])
      if (!o.shippedAt) o.orderStatus = 'CANCELED'
    }
    orders.push(o)
  }
  // 경우의 수: 결제 대기 24시간 경과 / 배송 지연(국내 5일)
  const pend = orders.filter((o) => o.orderStatus === 'PENDING').slice(0, 3)
  pend.forEach((o, i) => { o.createdAt = now - (26 + i * 5) * HOUR })
  const late = orders.filter((o) => o.orderStatus === 'PREPARING' && o.currency === 'KRW').slice(0, 2)
  late.forEach((o, i) => { o.createdAt = now - (6 + i) * DAY; o.paidAt = o.createdAt + 10 * 60000 })

  orders.sort((a, b) => a.createdAt - b.createdAt)
  orders.forEach((o) => {
    const d = dayKey(o.createdAt).replace(/-/g, '').slice(2)
    seq[d] = (seq[d] ?? 0) + 1
    o.orderNo = `MD-${d}-${String(seq[d]).padStart(4, '0')}`
  })

  // ── 재고: 출고 전 주문 수량 = 할당
  const skuMap = new Map(skus.map((s) => [s.id, s]))
  for (const o of orders) {
    if (!['PENDING', 'PAID', 'PREPARING'].includes(o.orderStatus)) continue
    for (const it of o.items) skuMap.get(it.skuId)!.allocated += it.qty
  }
  // 경우의 수: 재고 부족 · 품절
  const lowTargets: [string, number][] = [
    ['p03-s2', 34], ['p04-s3', 0], ['p06-s2', 61], ['p08-s1', 88], ['p15-s1', 47], ['p18-s1', 12], ['p01-s1', 96],
  ]
  for (const [id, extra] of lowTargets) {
    const s = skuMap.get(id)!
    s.onHand = s.allocated + extra
  }

  // ── 재고 변경 이력
  const inventoryLogs: InventoryLog[] = []
  let n = 0
  const log = (l: Omit<InventoryLog, 'id'>) => inventoryLogs.push({ id: 'l' + String(++n).padStart(4, '0'), ...l })
  for (const s of skus) {
    log({ skuId: s.id, type: 'INBOUND', delta: s.onHand + 40, allocDelta: 0, onHandAfter: s.onHand + 40, reason: '초도 입고', actor: 'admin', createdAt: now - int(46, 60) * DAY })
    log({ skuId: s.id, type: 'SHIP', delta: -40, allocDelta: -40, onHandAfter: s.onHand, reason: '주문 출고 합계(시드)', actor: 'system', createdAt: now - int(2, 20) * DAY })
  }
  log({ skuId: 'p04-s3', type: 'ADJUST', delta: -6, allocDelta: 0, onHandAfter: skuMap.get('p04-s3')!.onHand, reason: '검수 불량 폐기', actor: 'admin', createdAt: now - 3 * DAY })
  log({ skuId: 'p18-s1', type: 'ADJUST', delta: -2, allocDelta: 0, onHandAfter: skuMap.get('p18-s1')!.onHand, reason: '실사 차이 조정', actor: 'admin', createdAt: now - 1 * DAY })

  return { artists, products, skus, orders, customers, inventoryLogs }
}
