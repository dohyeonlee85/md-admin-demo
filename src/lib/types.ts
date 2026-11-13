export type Currency = 'KRW' | 'USD' | 'JPY'
export const CURRENCIES: Currency[] = ['KRW', 'USD', 'JPY']
export const COUNTRY_LABEL: Record<Currency, string> = { KRW: '한국', USD: '미국·글로벌', JPY: '일본' }

export type Category = 'ALBUM' | 'MD' | 'TOUR MD' | 'PHOTOBOOK' | "SEASON'S GREETINGS" | 'MEMBERSHIP'
export const CATEGORIES: Category[] = ['ALBUM', 'MD', 'TOUR MD', 'PHOTOBOOK', "SEASON'S GREETINGS", 'MEMBERSHIP']

export type SaleType = 'NORMAL' | 'PREORDER' | 'LIMITED'
export const SALE_TYPE_LABEL: Record<SaleType, string> = { NORMAL: '일반판매', PREORDER: '예약판매', LIMITED: '한정판매' }

export type ProductStatus = 'DRAFT' | 'ON_SALE' | 'PAUSED' | 'ARCHIVED'
export const PRODUCT_STATUS_LABEL: Record<ProductStatus, string> = {
  DRAFT: '판매 준비', ON_SALE: '판매 중', PAUSED: '판매 중지', ARCHIVED: '보관',
}

export interface Artist { id: string; name: string }

export interface Product {
  id: string
  name: string
  artistId: string
  category: Category
  saleType: SaleType
  round: string // 1차 · 2차 · 재판매
  status: ProductStatus
  prices: Partial<Record<Currency, number>>
  purchaseLimit: number // 1인당 구매 제한 (0 = 제한 없음)
  shipFrom?: string // 예약판매 출고 예정일 (YYYY-MM-DD)
  releasedAt?: number // ALBUM 발매일 (발매 후 7일 판매 지표 기준)
  ipId?: string // 연결된 IP 프로젝트
  planId?: string // 이 상품의 출발점이 된 기획안
  createdAt: number
  updatedAt: number
}

export interface Sku {
  id: string
  productId: string
  code: string
  option: string
  onHand: number // 창고 보유 수량
  allocated: number // 주문에 할당된 수량 (출고 전)
  threshold: number // 재고 부족 기준
}

export type OrderStatus = 'PENDING' | 'PAID' | 'PREPARING' | 'SHIPPED' | 'DELIVERED' | 'CONFIRMED' | 'CANCELED'
export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  PENDING: '결제 대기', PAID: '결제 완료', PREPARING: '상품 준비', SHIPPED: '배송 중',
  DELIVERED: '배송 완료', CONFIRMED: '구매 확정', CANCELED: '주문 취소',
}
export type PaymentStatus = 'WAITING' | 'PAID' | 'REFUNDED' | 'CANCELED'
export const PAYMENT_STATUS_LABEL: Record<PaymentStatus, string> = {
  WAITING: '입금 전', PAID: '결제됨', REFUNDED: '환불됨', CANCELED: '결제 취소',
}

export interface OrderItem {
  skuId: string
  productId: string
  // 주문 당시 정보 보존(스냅샷): 이후 상품명·가격이 바뀌어도 주문 기록은 그대로
  productName: string
  option: string
  unitPrice: number
  qty: number
}

export interface Order {
  id: string
  orderNo: string
  customerId: string
  customerName: string
  country: Currency
  currency: Currency
  fxRate: number // 결제 시점 환율 (원화 환산용, 고정)
  items: OrderItem[]
  total: number // 결제 통화 기준
  totalKrw: number
  orderStatus: OrderStatus
  paymentStatus: PaymentStatus
  createdAt: number
  paidAt?: number
  shippedAt?: number
  deliveredAt?: number
  refundedAt?: number
  refundAmountKrw?: number
  refundReason?: string
  carrier?: string
  trackingNo?: string
  address: string
  addressDetail: string
  phone: string
}

export interface Customer {
  id: string
  name: string
  email: string
  phone: string
  country: Currency
  membership: string[] // 아티스트별 멤버십 뱃지
  joinedAt: number
}

export type LogType = 'INBOUND' | 'ADJUST' | 'SHIP' | 'ALLOCATE' | 'RELEASE'
export const LOG_TYPE_LABEL: Record<LogType, string> = {
  INBOUND: '입고', ADJUST: '재고 조정', SHIP: '출고 차감', ALLOCATE: '주문 할당', RELEASE: '할당 해제',
}
export interface InventoryLog {
  id: string
  skuId: string
  type: LogType
  delta: number // 보유 수량 변화
  allocDelta: number // 할당 수량 변화
  onHandAfter: number
  reason: string
  actor: string
  createdAt: number
}

// ── 아티스트 · IP 프로젝트 (앨범 활동, 투어 등 상품이 묶이는 단위)
export type IpType = 'ALBUM' | 'TOUR' | 'FANMEETING' | 'SEASON' | 'MEMBERSHIP'
export const IP_TYPE_LABEL: Record<IpType, string> = {
  ALBUM: '앨범 활동', TOUR: '투어', FANMEETING: '팬미팅', SEASON: '시즌 기획', MEMBERSHIP: '멤버십',
}
export type IpStatus = 'PLANNED' | 'ACTIVE' | 'CLOSED'
export const IP_STATUS_LABEL: Record<IpStatus, string> = { PLANNED: '준비 중', ACTIVE: '진행 중', CLOSED: '종료' }
export interface IpProject {
  id: string
  artistId: string
  name: string
  type: IpType
  status: IpStatus
  startDate: string // YYYY-MM-DD
  endDate?: string
  memo: string
  createdAt: number
  updatedAt: number
}

// ── 상품 기획안: 작성 → 승인 요청 → 승인/반려 → 상품 등록으로 전환
export type PlanStatus = 'DRAFT' | 'REVIEW' | 'APPROVED' | 'REJECTED'
export const PLAN_STATUS_LABEL: Record<PlanStatus, string> = {
  DRAFT: '작성 중', REVIEW: '승인 대기', APPROVED: '승인', REJECTED: '반려',
}
export interface Plan {
  id: string
  title: string
  artistId: string
  ipId?: string
  category: Category
  saleType: SaleType
  targetPriceKrw: number
  targetQty: number
  launchDate: string // 출시 목표일 YYYY-MM-DD
  status: PlanStatus
  memo: string
  rejectReason?: string
  requestedAt?: number
  decidedAt?: number
  decidedBy?: string
  productId?: string // 승인 후 만들어진 상품
  createdBy: string
  createdAt: number
  updatedAt: number
}

// ── 판매 회차: 상품을 언제, 어느 국가에 파는지
export type RoundStatus = 'SCHEDULED' | 'OPEN' | 'CLOSED'
export const ROUND_STATUS_LABEL: Record<RoundStatus, string> = { SCHEDULED: '예정', OPEN: '판매 중', CLOSED: '종료' }
export const ROUNDS = ['1차', '2차', '재판매']
export interface SaleRound {
  id: string
  productId: string
  round: string
  startDate: string // 계획 기간 YYYY-MM-DD
  endDate: string
  countries: Currency[]
  status: RoundStatus
  openedAt?: number // 실제 판매 시작 (수동)
  closedAt?: number
  memo: string
  createdAt: number
}

// ── 고객 문의 · 교환 접수
export type InquiryType = 'QUESTION' | 'EXCHANGE'
export const INQUIRY_TYPE_LABEL: Record<InquiryType, string> = { QUESTION: '문의', EXCHANGE: '교환' }
export type ExchangeReason = 'DEFECT' | 'WRONG' | 'MISSING'
export const EXCHANGE_REASON_LABEL: Record<ExchangeReason, string> = { DEFECT: '상품 불량', WRONG: '오배송', MISSING: '구성품 누락' }
export type InquiryStatus = 'OPEN' | 'ANSWERED' | 'APPROVED' | 'REJECTED'
export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = {
  OPEN: '접수', ANSWERED: '답변 완료', APPROVED: '교환 승인', REJECTED: '교환 반려',
}
export interface Inquiry {
  id: string
  customerId: string
  customerName: string
  orderId?: string
  orderNo?: string
  type: InquiryType
  exchangeReason?: ExchangeReason
  title: string
  body: string
  status: InquiryStatus
  answer?: string
  answeredBy?: string
  createdAt: number
  answeredAt?: number
}

// ── 공지 · FAQ (한국어·영어 필수, 일본어가 없으면 영어로 노출)
export type Lang = 'KO' | 'EN' | 'JA'
export const LANGS: Lang[] = ['KO', 'EN', 'JA']
export const LANG_LABEL: Record<Lang, string> = { KO: '한국어', EN: '영어', JA: '일본어' }
export interface Notice {
  id: string
  kind: 'NOTICE' | 'FAQ'
  title: Partial<Record<Lang, string>>
  body: Partial<Record<Lang, string>>
  published: boolean
  createdAt: number
  updatedAt: number
}

// ── 운영 기준값 (문서 1개, id = 'main')
export interface Settings {
  id: string
  lowStockThreshold: number // 새 SKU의 재고 부족 기준
  pendingCancelHours: number // 결제 대기 자동 취소 기준
  delayDomesticDays: number // 배송 지연 기준 (국내)
  delayOverseasDays: number // 배송 지연 기준 (해외)
  exchangeDays: number // 교환 접수 기한 (배송 완료 후)
  csDelayHours: number // 문의 응답 지연 기준
  autoConfirmDays: number // 배송 완료 후 자동 구매 확정
  fxUSD: number // 기준 환율 (신규 결제에 적용, 기존 주문은 결제 시점 환율 유지)
  fxJPY: number
  updatedAt: number
  updatedBy: string
}

export interface Collections {
  artists: Artist
  products: Product
  skus: Sku
  orders: Order
  customers: Customer
  inventoryLogs: InventoryLog
  ipProjects: IpProject
  plans: Plan
  saleRounds: SaleRound
  inquiries: Inquiry
  notices: Notice
  settings: Settings
}
export type ColName = keyof Collections
export const COL_NAMES: ColName[] = [
  'artists', 'products', 'skus', 'orders', 'customers', 'inventoryLogs',
  'ipProjects', 'plans', 'saleRounds', 'inquiries', 'notices', 'settings',
]
export type Data = { [K in ColName]: Collections[K][] }
