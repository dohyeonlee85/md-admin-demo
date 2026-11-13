import { Badge, type Tone } from './ui'
import {
  ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL, PRODUCT_STATUS_LABEL,
  type OrderStatus, type PaymentStatus, type ProductStatus, type Sku,
} from '../lib/types'
import { available } from '../lib/metrics'
import {
  INQUIRY_STATUS_LABEL, IP_STATUS_LABEL, PLAN_STATUS_LABEL, ROUND_STATUS_LABEL,
  type InquiryStatus, type IpStatus, type PlanStatus, type RoundStatus,
} from '../lib/types'

const ORDER_TONE: Record<OrderStatus, Tone> = {
  PENDING: 'warning', PAID: 'primary', PREPARING: 'primary', SHIPPED: 'primary',
  DELIVERED: 'success', CONFIRMED: 'success', CANCELED: 'gray',
}
export const OrderBadge = ({ s }: { s: OrderStatus }) => <Badge tone={ORDER_TONE[s]}>{ORDER_STATUS_LABEL[s]}</Badge>

const PAY_TONE: Record<PaymentStatus, Tone> = { WAITING: 'warning', PAID: 'success', REFUNDED: 'danger', CANCELED: 'gray' }
export const PayBadge = ({ s }: { s: PaymentStatus }) => <Badge tone={PAY_TONE[s]}>{PAYMENT_STATUS_LABEL[s]}</Badge>

const PRODUCT_TONE: Record<ProductStatus, Tone> = { DRAFT: 'warning', ON_SALE: 'success', PAUSED: 'danger', ARCHIVED: 'gray' }
export const ProductBadge = ({ s }: { s: ProductStatus }) => <Badge tone={PRODUCT_TONE[s]}>{PRODUCT_STATUS_LABEL[s]}</Badge>

export function StockBadge({ sku }: { sku: Sku }) {
  const a = available(sku)
  if (a <= 0) return <Badge tone="danger">품절</Badge>
  if (a < sku.threshold) return <Badge tone="warning">부족</Badge>
  return <Badge tone="success">정상</Badge>
}

// ── 추가 메뉴용 상태 뱃지

const IP_TONE: Record<IpStatus, Tone> = { PLANNED: 'warning', ACTIVE: 'success', CLOSED: 'gray' }
export const IpBadge = ({ s }: { s: IpStatus }) => <Badge tone={IP_TONE[s]}>{IP_STATUS_LABEL[s]}</Badge>

const PLAN_TONE: Record<PlanStatus, Tone> = { DRAFT: 'gray', REVIEW: 'warning', APPROVED: 'success', REJECTED: 'danger' }
export const PlanBadge = ({ s }: { s: PlanStatus }) => <Badge tone={PLAN_TONE[s]}>{PLAN_STATUS_LABEL[s]}</Badge>

const ROUND_TONE: Record<RoundStatus, Tone> = { SCHEDULED: 'warning', OPEN: 'success', CLOSED: 'gray' }
export const RoundBadge = ({ s }: { s: RoundStatus }) => <Badge tone={ROUND_TONE[s]}>{ROUND_STATUS_LABEL[s]}</Badge>

const INQ_TONE: Record<InquiryStatus, Tone> = { OPEN: 'warning', ANSWERED: 'success', APPROVED: 'success', REJECTED: 'gray' }
export const InquiryBadge = ({ s }: { s: InquiryStatus }) => <Badge tone={INQ_TONE[s]}>{INQUIRY_STATUS_LABEL[s]}</Badge>
