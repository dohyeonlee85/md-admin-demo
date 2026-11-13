// 운영 기준값. System Settings 화면에서 바꾸면 DB에 저장되고, 아래 rules 값이 즉시 갱신된다.
// 지연·취소·교환 판정은 모두 이 값을 읽는다.
import type { Settings } from './types'

export const DEFAULT_SETTINGS: Settings = {
  id: 'main',
  lowStockThreshold: 100,
  pendingCancelHours: 24,
  delayDomesticDays: 5,
  delayOverseasDays: 14,
  exchangeDays: 7,
  csDelayHours: 48,
  autoConfirmDays: 7,
  fxUSD: 1350,
  fxJPY: 9.1,
  updatedAt: 0,
  updatedBy: 'system',
}

export const rules: Settings = { ...DEFAULT_SETTINGS }

export function applySettings(s?: Settings) {
  Object.assign(rules, DEFAULT_SETTINGS, s ?? {})
}
