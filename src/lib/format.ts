import type { Currency } from './types'

const SYMBOL: Record<Currency, string> = { KRW: '₩', USD: '$', JPY: '¥' }

export function money(v: number, c: Currency = 'KRW'): string {
  const digits = c === 'USD' ? 2 : 0
  return SYMBOL[c] + v.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}
export function krwShort(v: number): string {
  if (Math.abs(v) >= 1e8) return '₩' + (v / 1e8).toFixed(2) + '억'
  if (Math.abs(v) >= 1e4) return '₩' + Math.round(v / 1e4).toLocaleString('en-US') + '만'
  return '₩' + v.toLocaleString('en-US')
}
export const num = (v: number) => v.toLocaleString('en-US')

const KST = 'Asia/Seoul'
export function dateTime(ts?: number): string {
  if (!ts) return '-'
  return new Intl.DateTimeFormat('sv-SE', { timeZone: KST, dateStyle: 'short', timeStyle: 'short' }).format(ts)
}
/** KST 기준 날짜 (YYYY-MM-DD) */
export function dayKey(ts: number): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: KST, dateStyle: 'short' }).format(ts)
}

/** 이름 마스킹: 한글은 두 번째 글자, 영문은 마지막 3글자 */
export function maskName(name: string): string {
  if (/[가-힣]/.test(name)) return name.length < 2 ? name : name[0] + '*' + name.slice(2)
  return name.length <= 3 ? '***' : name.slice(0, -3) + '***'
}
/** 연락처 마스킹: 가운데 4자리 */
export function maskPhone(phone: string): string {
  const p = phone.split('-')
  if (p.length === 3) return `${p[0]}-****-${p[2]}`
  return phone.replace(/\d(?=\d{4})/g, '*')
}
export const maskDetail = (_: string) => '********'
export function maskEmail(email: string): string {
  const [id, domain] = email.split('@')
  return id.slice(0, 2) + '***@' + domain
}
