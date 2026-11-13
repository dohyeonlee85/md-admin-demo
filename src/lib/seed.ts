// 시연용 자료 생성기. 실존 고객 정보가 아닌 테스트 데이터만 만든다.
import type {
  Category, Currency, Customer, Data, Inquiry, InventoryLog, IpProject, Notice, Order, OrderItem, OrderStatus,
  PaymentStatus, Plan, Product, ProductStatus, SaleRound, SaleType, Sku,
} from './types'
import { dayKey } from './format'
import { DEFAULT_SETTINGS } from './settings'

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

  // ── 이하 추가 메뉴용 자료. 위 자료의 난수 순서를 건드리지 않도록 별도 난수를 쓴다.
  const r2 = rng(7701)
  const int2 = (min: number, max: number) => Math.floor(r2() * (max - min + 1)) + min
  const pick2 = <T,>(arr: T[]) => arr[Math.floor(r2() * arr.length)]
  const d = (offsetDays: number) => dayKey(now + offsetDays * DAY)

  // IP 프로젝트와 상품 연결
  const ipDefs: [string, 'ateez' | 'xikers', IpProject['type'], IpProject['status'], number, number | null, string][] = [
    ['ip-a-tour', 'ateez', 'TOUR', 'ACTIVE', -60, 45, 'ATEEZ WORLD TOUR (DEMO)'],
    ['ip-a-album', 'ateez', 'ALBUM', 'ACTIVE', -20, 40, 'ATEEZ MINI ALBUM 활동 (DEMO)'],
    ['ip-a-sg27', 'ateez', 'SEASON', 'ACTIVE', -15, 50, "ATEEZ 2027 SEASON'S GREETINGS"],
    ['ip-a-fm', 'ateez', 'FANMEETING', 'PLANNED', 30, 60, 'ATEEZ FANMEETING (DEMO)'],
    ['ip-a-sg26', 'ateez', 'SEASON', 'CLOSED', -400, -300, "ATEEZ 2026 SEASON'S GREETINGS"],
    ['ip-a-mem', 'ateez', 'MEMBERSHIP', 'ACTIVE', -200, null, 'ATEEZ OFFICIAL MEMBERSHIP'],
    ['ip-x-album', 'xikers', 'ALBUM', 'ACTIVE', -10, 45, 'xikers MINI ALBUM 활동 (DEMO)'],
    ['ip-x-tour', 'xikers', 'TOUR', 'ACTIVE', -40, 30, 'xikers TOUR (DEMO)'],
    ['ip-x-sg27', 'xikers', 'SEASON', 'PLANNED', -5, 50, "xikers 2027 SEASON'S GREETINGS"],
  ]
  const ipProjects: IpProject[] = ipDefs.map(([id, artistId, type, status, from, to, name]) => {
    const ip: IpProject = { id, artistId, name, type, status, startDate: d(from), memo: '', createdAt: now - 90 * DAY, updatedAt: now - int2(1, 20) * DAY }
    if (to !== null) ip.endDate = d(to)
    return ip
  })
  // 경우의 수: 일부 상품(라이트스틱·키링 등 상시 MD)은 IP에 연결하지 않은 상태로 둔다
  const linkRule: [RegExp, string][] = [
    [/ATEEZ WORLD TOUR/, 'ip-a-tour'], [/ATEEZ MINI ALBUM/, 'ip-a-album'], [/ATEEZ 2027/, 'ip-a-sg27'],
    [/ATEEZ FANMEETING/, 'ip-a-fm'], [/ATEEZ 2026/, 'ip-a-sg26'], [/ATEEZ OFFICIAL MEMBERSHIP/, 'ip-a-mem'],
    [/ATEEZ PHOTOBOOK/, 'ip-a-tour'], [/xikers MINI ALBUM/, 'ip-x-album'], [/xikers TOUR/, 'ip-x-tour'],
    [/xikers PHOTOBOOK/, 'ip-x-tour'], [/xikers 2027/, 'ip-x-sg27'],
  ]
  for (const p of products) {
    const hit = linkRule.find(([re]) => re.test(p.name))
    if (hit) p.ipId = hit[1]
  }

  // 상품 기획안: 작성 중 · 승인 대기 · 승인(전환 전/후) · 반려
  const planDefs: [string, 'ateez' | 'xikers', string | undefined, Category, SaleType, number, number, number, Plan['status'], string][] = [
    ['ATEEZ FANMEETING 응원 슬로건', 'ateez', 'ip-a-fm', 'MD', 'PREORDER', 18000, 3000, 35, 'REVIEW', '팬미팅 현장 수령과 온라인 예약 판매를 병행'],
    ['ATEEZ FANMEETING 포토카드 세트', 'ateez', 'ip-a-fm', 'MD', 'LIMITED', 12000, 5000, 35, 'DRAFT', '멤버별 8종, 1인당 구매 제한 검토 필요'],
    ['ATEEZ WORLD TOUR 앙코르 후드 집업', 'ateez', 'ip-a-tour', 'TOUR MD', 'NORMAL', 89000, 2000, 25, 'APPROVED', '앙코르 공연 일정에 맞춰 2차 생산'],
    ['xikers 2027 SEASON\'S GREETINGS 달력 단품', 'xikers', 'ip-x-sg27', "SEASON'S GREETINGS", 'PREORDER', 15000, 1500, 40, 'REJECTED', '시즌 그리팅 구성품과 중복'],
    ['xikers TOUR 볼캡', 'xikers', 'ip-x-tour', 'TOUR MD', 'NORMAL', 32000, 1200, 20, 'REVIEW', '투어 로고 자수, 2색'],
    ['xikers 미니 키링', 'xikers', undefined, 'MD', 'NORMAL', 9000, 4000, 50, 'DRAFT', ''],
  ]
  const plans: Plan[] = planDefs.map(([title, artistId, ipId, category, saleType, price, qty, launch, status, memo], i) => {
    const createdAt = now - (20 - i * 2) * DAY
    const plan: Plan = {
      id: 'pl' + String(i + 1).padStart(2, '0'), title, artistId, category, saleType, targetPriceKrw: price, targetQty: qty,
      launchDate: d(launch), status, memo, createdBy: 'admin', createdAt, updatedAt: createdAt + DAY,
    }
    if (ipId) plan.ipId = ipId
    if (status !== 'DRAFT') plan.requestedAt = createdAt + DAY
    if (status === 'APPROVED' || status === 'REJECTED') { plan.decidedAt = createdAt + 2 * DAY; plan.decidedBy = 'admin' }
    if (status === 'REJECTED') plan.rejectReason = '기존 시즌 그리팅 구성품과 겹쳐 수요가 분산될 우려. 구성 차별화 후 재요청.'
    return plan
  })
  // 경우의 수: 기획안에서 출발해 이미 상품으로 전환된 건 (FANMEETING MD PACKAGE)
  const fm = products.find((p) => p.name.includes('FANMEETING'))
  if (fm) {
    const createdAt = now - 30 * DAY
    plans.push({
      id: 'pl07', title: fm.name, artistId: fm.artistId, ipId: 'ip-a-fm', category: fm.category, saleType: fm.saleType,
      targetPriceKrw: 58000, targetQty: 2500, launchDate: d(35), status: 'APPROVED', memo: '팬미팅 공식 패키지',
      requestedAt: createdAt + DAY, decidedAt: createdAt + 2 * DAY, decidedBy: 'admin', productId: fm.id,
      createdBy: 'admin', createdAt, updatedAt: createdAt + 2 * DAY,
    })
    fm.planId = 'pl07'
  }

  // 판매 회차: 판매 중 상품은 현재 회차가 열려 있고, 2차·재판매 상품은 이전 회차가 종료된 상태
  const saleRounds: SaleRound[] = []
  let rn = 0
  const addRound = (r: Omit<SaleRound, 'id' | 'createdAt' | 'memo'> & { memo?: string }) =>
    saleRounds.push({ id: 'r' + String(++rn).padStart(3, '0'), createdAt: now - 50 * DAY, memo: '', ...r })
  const ALL: Currency[] = ['KRW', 'USD', 'JPY']
  for (const p of products) {
    const prev = p.round === '2차' ? ['1차'] : p.round === '재판매' ? ['1차', '2차'] : []
    prev.forEach((round, i) => {
      const from = -160 + i * 50
      addRound({ productId: p.id, round, startDate: d(from), endDate: d(from + 30), countries: ALL, status: 'CLOSED', openedAt: now + from * DAY, closedAt: now + (from + 30) * DAY })
    })
    if (p.status === 'ON_SALE')
      addRound({ productId: p.id, round: p.round, startDate: d(-45), endDate: d(int2(10, 40)), countries: ALL, status: 'OPEN', openedAt: now - 45 * DAY })
    else if (p.status === 'PAUSED')
      addRound({ productId: p.id, round: p.round, startDate: d(-45), endDate: d(-3), countries: ALL, status: 'CLOSED', openedAt: now - 45 * DAY, closedAt: now - 3 * DAY, memo: '재고 점검으로 조기 종료' })
    else if (p.status === 'DRAFT')
      // 경우의 수: 가격 미입력 국가가 있어 시작이 막히는 예정 회차 / 한국만 먼저 여는 예정 회차
      addRound({ productId: p.id, round: '1차', startDate: d(7), endDate: d(37), countries: p.name.includes('FANMEETING') ? ALL : ['KRW'], status: 'SCHEDULED' })
  }
  const hoodie = products.find((p) => p.name.includes('HOODIE'))
  if (hoodie) addRound({ productId: hoodie.id, round: '2차', startDate: d(20), endDate: d(50), countries: ALL, status: 'SCHEDULED', memo: '1차 종료 후 시작' })

  // 문의 · 교환 접수
  const inquiries: Inquiry[] = []
  const delivered = orders.filter((o) => o.deliveredAt && o.paymentStatus === 'PAID').sort((a, b) => b.deliveredAt! - a.deliveredAt!)
  const recentDelivered = delivered.filter((o) => now - o.deliveredAt! < 6 * DAY)
  const oldDelivered = delivered.filter((o) => now - o.deliveredAt! > 12 * DAY)
  const shipping = orders.filter((o) => o.orderStatus === 'SHIPPED')
  let qn = 0
  const addQ = (q: Omit<Inquiry, 'id' | 'customerId' | 'customerName' | 'orderId' | 'orderNo'>, o?: Order) => {
    const c = o ? undefined : pick2(customers)
    const item: Inquiry = { id: 'q' + String(++qn).padStart(3, '0'), customerId: o?.customerId ?? c!.id, customerName: o?.customerName ?? c!.name, ...q }
    if (o) { item.orderId = o.id; item.orderNo = o.orderNo }
    inquiries.push(item)
  }
  const QUESTIONS: [string, string][] = [
    ['배송은 언제 시작되나요?', '주문한 지 3일이 지났는데 아직 상품 준비 중으로 나옵니다.'],
    ['예약 상품과 일반 상품을 같이 주문하면 따로 오나요?', '시즌 그리팅과 티셔츠를 함께 주문했습니다.'],
    ['해외 배송 관세는 누가 부담하나요?', 'Is customs duty included in the shipping fee?'],
    ['주소를 변경하고 싶습니다', '출고 전이라면 배송지를 바꿀 수 있을까요?'],
    ['멤버십 키트 구성품 문의', '키트에 포함된 구성품 목록을 알고 싶습니다.'],
    ['재입고 일정 문의', '품절된 티셔츠 XL 사이즈 재입고 계획이 있나요?'],
  ]
  QUESTIONS.forEach(([title, body], i) => {
    const o = i < 2 ? shipping[i] : undefined
    // 경우의 수: 접수 후 48시간이 지난 미답변 문의 2건, 방금 들어온 문의, 답변 완료
    const ageH = [60, 75, 5, 20, 90, 130][i]
    const answered = i >= 4
    addQ({
      type: 'QUESTION', title, body, status: answered ? 'ANSWERED' : 'OPEN', createdAt: now - ageH * HOUR,
      ...(answered ? { answer: '안녕하세요. 문의 주신 내용 안내드립니다. (시연용 답변)', answeredBy: 'admin', answeredAt: now - (ageH - 10) * HOUR } : {}),
    }, o)
  })
  // 교환: 기한 안(승인 가능) 3건, 기한 경과(승인 불가) 1건, 처리 완료 2건
  const EX: [Inquiry['exchangeReason'], string, string][] = [
    ['DEFECT', '인쇄 불량 교환 요청', '후드 앞면 로고 인쇄가 번져 있습니다. 사진 첨부합니다.'],
    ['WRONG', '다른 사이즈가 왔습니다', 'L을 주문했는데 M이 배송되었습니다.'],
    ['MISSING', '포토카드가 빠져 있습니다', '앨범 구성품 중 포토카드가 누락되었습니다.'],
  ]
  EX.forEach(([exchangeReason, title, body], i) => {
    const o = recentDelivered[i]
    if (o) addQ({ type: 'EXCHANGE', exchangeReason, title, body, status: 'OPEN', createdAt: Math.min(now - (i + 1) * 6 * HOUR, o.deliveredAt! + DAY) }, o)
  })
  if (oldDelivered[0])
    addQ({ type: 'EXCHANGE', exchangeReason: 'DEFECT', title: '뒤늦게 발견한 불량', body: '보관만 하다가 이제 열어 보니 케이스가 깨져 있습니다.', status: 'OPEN', createdAt: now - 8 * HOUR }, oldDelivered[0])
  if (oldDelivered[1])
    addQ({ type: 'EXCHANGE', exchangeReason: 'WRONG', title: '옵션 오배송', body: 'A ver.을 주문했는데 B ver.이 왔습니다.', status: 'APPROVED', createdAt: oldDelivered[1].deliveredAt! + 2 * DAY, answer: '확인되었습니다. 회수 접수 후 올바른 옵션으로 재발송합니다.', answeredBy: 'admin', answeredAt: oldDelivered[1].deliveredAt! + 3 * DAY }, oldDelivered[1])
  if (oldDelivered[2])
    addQ({ type: 'EXCHANGE', exchangeReason: 'DEFECT', title: '교환 요청', body: '생각했던 색상과 달라 교환하고 싶습니다.', status: 'REJECTED', createdAt: oldDelivered[2].deliveredAt! + 3 * DAY, answer: '색상 차이는 불량·오배송·누락에 해당하지 않아 교환이 어렵습니다.', answeredBy: 'admin', answeredAt: oldDelivered[2].deliveredAt! + 4 * DAY }, oldDelivered[2])
  inquiries.sort((a, b) => b.createdAt - a.createdAt)

  // 공지 · FAQ (경우의 수: 일본어 미작성 → 일본 고객에게 영어로 노출 / 미게시 초안)
  const notices: Notice[] = [
    { id: 'n01', kind: 'NOTICE', published: true, createdAt: now - 12 * DAY, updatedAt: now - 12 * DAY,
      title: { KO: "2027 SEASON'S GREETINGS 예약 판매 안내", EN: "2027 SEASON'S GREETINGS Pre-order Notice", JA: "2027 SEASON'S GREETINGS 予約販売のご案内" },
      body: { KO: '예약 상품은 출고 예정일부터 순차 발송됩니다.', EN: 'Pre-order items ship in order from the scheduled shipping date.', JA: '予約商品は出荷予定日より順次発送いたします。' } },
    { id: 'n02', kind: 'NOTICE', published: true, createdAt: now - 5 * DAY, updatedAt: now - 5 * DAY,
      title: { KO: '연말 배송 지연 안내', EN: 'Year-end Shipping Delay Notice' },
      body: { KO: '물량 증가로 국내 배송이 1~2일 늦어질 수 있습니다.', EN: 'Domestic delivery may be delayed by 1-2 days due to high volume.' } },
    { id: 'n03', kind: 'NOTICE', published: false, createdAt: now - 1 * DAY, updatedAt: now - 1 * DAY,
      title: { KO: 'FANMEETING MD 판매 예고 (초안)', EN: 'FANMEETING MD Coming Soon (draft)' },
      body: { KO: '판매 일정 확정 후 게시 예정입니다.', EN: 'To be published once the schedule is confirmed.' } },
    { id: 'n04', kind: 'FAQ', published: true, createdAt: now - 40 * DAY, updatedAt: now - 40 * DAY,
      title: { KO: '교환은 어떤 경우에 가능한가요?', EN: 'When can I request an exchange?', JA: '交換はどのような場合に可能ですか？' },
      body: { KO: '상품 불량, 오배송, 구성품 누락의 경우 배송 완료 후 7일 이내 접수할 수 있습니다.', EN: 'Within 7 days of delivery for defective, wrong, or missing items.', JA: '不良・誤配送・付属品欠品の場合、配送完了後7日以内に受付可能です。' } },
    { id: 'n05', kind: 'FAQ', published: true, createdAt: now - 40 * DAY, updatedAt: now - 9 * DAY,
      title: { KO: '결제 후 주문을 취소할 수 있나요?', EN: 'Can I cancel after payment?' },
      body: { KO: '출고 전에는 취소할 수 있으며 결제 금액은 전액 환불됩니다.', EN: 'Orders can be cancelled before shipment for a full refund.' } },
    { id: 'n06', kind: 'FAQ', published: true, createdAt: now - 40 * DAY, updatedAt: now - 40 * DAY,
      title: { KO: '1인당 구매 수량 제한이 있나요?', EN: 'Is there a purchase limit per person?', JA: 'お一人様あたりの購入制限はありますか？' },
      body: { KO: '한정 상품은 계정당 구매 수량이 제한됩니다.', EN: 'Limited items have a per-account purchase limit.', JA: '限定商品はアカウントごとに購入数が制限されます。' } },
  ]

  const settings = [{ ...DEFAULT_SETTINGS, updatedAt: now - 30 * DAY, updatedBy: 'admin' }]

  return { artists, products, skus, orders, customers, inventoryLogs, ipProjects, plans, saleRounds, inquiries, notices, settings }
}
