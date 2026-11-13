import { useEffect, useState } from 'react'
import { useStore } from '../lib/store'
import { DEFAULT_SETTINGS } from '../lib/settings'
import { dateTime } from '../lib/format'
import type { Settings as S } from '../lib/types'
import { Badge, Button, Card, PageHeader, useRun } from '../components/ui'

type Key = Exclude<keyof S, 'id' | 'updatedAt' | 'updatedBy'>
const FIELDS: { k: Key; label: string; unit: string; effect: string; live: boolean; step?: number }[] = [
  { k: 'lowStockThreshold', label: '재고 부족 기준', unit: '개', effect: '새로 만드는 SKU의 부족 기준. 기존 SKU는 재고·물류에서 개별 변경', live: true },
  { k: 'pendingCancelHours', label: '결제 대기 취소 기준', unit: '시간', effect: '주문·결제의 "결제 대기 기한 경과" 판정과 일괄 취소', live: true },
  { k: 'delayDomesticDays', label: '배송 지연 기준 (국내)', unit: '일', effect: 'Dashboard·주문의 배송 지연 판정', live: true },
  { k: 'delayOverseasDays', label: '배송 지연 기준 (해외)', unit: '일', effect: 'Dashboard·주문의 배송 지연 판정', live: true },
  { k: 'exchangeDays', label: '교환 접수 기한', unit: '일', effect: '배송 완료 후 이 기간 안에 접수된 교환만 승인 가능', live: true },
  { k: 'csDelayHours', label: '문의 응답 지연 기준', unit: '시간', effect: '고객·CS의 응답 지연 표시', live: true },
  { k: 'autoConfirmDays', label: '자동 구매 확정', unit: '일', effect: '배송 완료 후 자동 구매 확정 (자동 실행은 이 데모에 없음)', live: false },
  { k: 'fxUSD', label: '기준 환율 USD', unit: '원', effect: '신규 결제에 적용할 환율. 기존 주문은 결제 시점 환율 유지 (이 데모는 신규 결제 없음)', live: false, step: 0.01 },
  { k: 'fxJPY', label: '기준 환율 JPY', unit: '원', effect: '위와 같음', live: false, step: 0.01 },
]
const PERMS: [string, boolean, boolean][] = [
  ['자료 조회', true, true], ['등록·수정·상태 변경', true, false], ['DB 저장', true, false],
  ['고객 개인정보 전체 보기', true, false], ['기획 승인 · 재고 조정 승인', true, false], ['운영 기준값 변경', true, false],
]
const LINKS = ['결제 대행사(PG)', '택배사', '이메일 발송', 'SNS']

export default function Settings() {
  const { data, actions, session, storage } = useStore()
  const { run, busy } = useRun()
  const saved = data.settings[0] ?? DEFAULT_SETTINGS
  const [v, setV] = useState<S>(saved)
  useEffect(() => setV(saved), [saved])
  const dirty = FIELDS.some((f) => v[f.k] !== saved[f.k])
  const isAdmin = session?.role === 'admin'

  return (
    <>
      <PageHeader title="System Settings" desc="운영 기준값과 관리자 권한을 관리합니다. 기준값을 바꾸면 지연·취소·교환 판정에 바로 반영됩니다." />

      <Card title="운영 기준값" action={saved.updatedAt ? <span className="text-[11px] text-ink-mute">최종 변경 <span className="num">{dateTime(saved.updatedAt)}</span> · {saved.updatedBy}</span> : undefined}>
        <div className="divide-y divide-line">
          {FIELDS.map((f) => (
            <div key={f.k} className="grid gap-2 px-4 py-3 md:grid-cols-[220px_160px_1fr] md:items-center">
              <label htmlFor={f.k} className="flex items-center gap-2 text-[13px] font-medium">{f.label}{!f.live && <Badge>표시만</Badge>}</label>
              <div className="flex items-center gap-2">
                <input id={f.k} className="field num !w-28 shrink-0 text-right" type="number" min={0} step={f.step ?? 1} value={v[f.k]}
                  onChange={(e) => setV({ ...v, [f.k]: Number(e.target.value) })} />
                <span className="shrink-0 whitespace-nowrap text-xs text-ink-sub">{f.unit}</span>
              </div>
              <p className="text-xs leading-relaxed text-ink-sub">{f.effect}</p>
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3">
          <p className="text-xs text-ink-mute">{storage === 'firestore' ? '저장하면 DB에 기록됩니다.' : '체험 모드: 이 화면에만 반영되고 새로고침하면 처음 값으로 돌아갑니다.'}</p>
          <div className="flex gap-2">
            <Button disabled={busy || !dirty} onClick={() => setV(saved)}>되돌리기</Button>
            <Button disabled={busy} onClick={() => setV({ ...v, ...Object.fromEntries(FIELDS.map((f) => [f.k, DEFAULT_SETTINGS[f.k]])) })}>기본값 불러오기</Button>
            <Button variant="primary" disabled={busy || !dirty} onClick={() => run(() => actions.saveSettings(v), '기준값을 저장했습니다.')}>저장</Button>
          </div>
        </div>
      </Card>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Card title="관리자 계정 · 권한">
          <div className="border-b border-line px-4 py-3 text-[13px]">
            <p>현재 계정 <span className="font-medium">{isAdmin ? session?.email : '체험 계정'}</span> <Badge tone={isAdmin ? 'success' : 'warning'}>{isAdmin ? '관리자' : '체험'}</Badge></p>
          </div>
          <table className="w-full text-[13px]">
            <thead>
              <tr className="border-b border-line bg-bg/60 text-xs text-ink-sub">
                <th className="h-9 px-4 text-left font-medium">권한</th><th className="w-20 px-2 text-center font-medium">관리자</th><th className="w-20 px-2 text-center font-medium">체험</th>
              </tr>
            </thead>
            <tbody>
              {PERMS.map(([label, admin, demo]) => (
                <tr key={label} className="border-b border-line last:border-0">
                  <td className="h-10 px-4">{label}</td>
                  <td className="text-center">{admin ? <span className="text-success">가능</span> : <span className="text-ink-mute">-</span>}</td>
                  <td className="text-center">{demo ? <span className="text-success">가능</span> : <span className="text-ink-mute">-</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-sub">
            관리자는 1명으로 운영하며 기획 승인과 재고 조정은 본인 승인입니다. 관리자가 늘어나면 작성자와 승인자를 분리하도록 설계했습니다. 체험 계정의 저장은 DB 보안 규칙에서도 차단됩니다.
          </p>
        </Card>

        <Card title="외부 연동">
          <ul>
            {LINKS.map((l) => (
              <li key={l} className="flex h-11 items-center justify-between border-b border-line px-4 last:border-0">
                <span>{l}</span><Badge>연동 없음</Badge>
              </li>
            ))}
          </ul>
          <p className="border-t border-line px-4 py-3 text-xs leading-relaxed text-ink-sub">
            이 데모는 외부 연동 없이 동작합니다. 환불과 송장은 수동으로 기록하고, 문의 답변은 기록만 남깁니다.
          </p>
        </Card>
      </div>
    </>
  )
}
