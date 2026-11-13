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

export interface Collections {
  artists: Artist
  products: Product
  skus: Sku
  orders: Order
  customers: Customer
  inventoryLogs: InventoryLog
}
export type ColName = keyof Collections
export const COL_NAMES: ColName[] = ['artists', 'products', 'skus', 'orders', 'customers', 'inventoryLogs']
export type Data = { [K in ColName]: Collections[K][] }
