import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useStore } from '../lib/store'
import { dateTime, dayKey, krwShort, money, num } from '../lib/format'
import { CATEGORIES, PLAN_STATUS_LABEL, SALE_TYPE_LABEL, type Category, type Plan, type PlanStatus, type SaleType } from '../lib/types'
import { Button, Card, DataTable, Drawer, Field, PageHeader, Row, Stat, Tabs, useRun } from '../components/ui'
import { PlanBadge } from '../components/status'

type Tab = 'ALL' | PlanStatus

export default function Planning() {
  const { data, actions, session } = useStore()
  const { run, busy } = useRun()
  const [tab, setTab] = useState<Tab>('ALL')
  const [draft, setDraft] = useState<Plan | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [reason, setReason] = useState('')

  const artistName = (id: string) => data.artists.find((a) => a.id === id)?.name ?? id
  const ipName = (id?: string) => data.ipProjects.find((p) => p.id === id)?.name ?? '-'
  const count = (s: PlanStatus) => data.plans.filter((p) => p.status === s).length
  const rows = useMemo(() => data.plans.filter((p) => tab === 'ALL' || p.status === tab).sort((a, b) => b.updatedAt - a.updatedAt), [data.plans, tab])

  const columns = useMemo<ColumnDef<Plan, any>[]>(() => [
    { header: '기획안', accessorKey: 'title', cell: (c) => <span className="font-medium">{c.getValue()}</span> },
    { header: '아티스트', accessorFn: (p) => artistName(p.artistId) },
    { header: '분류', accessorKey: 'category' },
    { header: '목표 가격', accessorKey: 'targetPriceKrw', cell: (c) => money(c.getValue()), meta: { right: true } },
    { header: '목표 수량', accessorKey: 'targetQty', cell: (c) => num(c.getValue()), meta: { right: true } },
    { header: '예상 매출', accessorFn: (p) => p.targetPriceKrw * p.targetQty, cell: (c) => krwShort(c.getValue()), meta: { right: true } },
    { header: '출시 목표일', accessorKey: 'launchDate', cell: (c) => <span className="num">{c.getValue()}</span> },
    { header: '상태', accessorKey: 'status', cell: (c) => <PlanBadge s={c.getValue()} /> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [data.artists])

  const openNew = () => {
    const now = Date.now()
    setDraft({
      id: 'pl' + now.toString(36), title: '', artistId: data.artists[0]?.id ?? 'ateez', category: 'MD', saleType: 'NORMAL',
      targetPriceKrw: 0, targetQty: 0, launchDate: dayKey(now + 30 * 86400000), status: 'DRAFT', memo: '',
      createdBy: session?.email ?? 'demo', createdAt: now, updatedAt: now,
    })
    setIsNew(true); setReason('')
  }
  const set = <K extends keyof Plan>(k: K, v: Plan[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  // 버튼은 저장된 최신 상태 기준으로 보여 준다
  const saved = draft ? data.plans.find((p) => p.id === draft.id) : undefined
  const st: PlanStatus = saved?.status ?? 'DRAFT'
  const editable = st === 'DRAFT' || st === 'REJECTED'
  const ips = draft ? data.ipProjects.filter((p) => p.artistId === draft.artistId && p.status !== 'CLOSED') : []
  const save = async () => {
    if (!draft) return false
    const clean = { ...draft }
    if (!clean.ipId) delete clean.ipId
    const ok = await run(() => actions.savePlan(clean), isNew ? '기획안을 등록했습니다.' : '기획안을 저장했습니다.')
    if (ok) setIsNew(false)
    return ok
  }

  return (
    <>
      <PageHeader title="Product Planning" desc="기획안 작성 → 승인 요청 → 승인·반려 → 상품 등록 전환. 관리자 1인 체계에서는 본인 승인이며, 다중 관리자 확장 시 작성자와 승인자를 분리합니다."
        action={<Button variant="primary" onClick={openNew}>+ 기획안 작성</Button>} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="승인 대기" value={count('REVIEW') + '건'} sub="처리가 필요한 기획안" />
        <Stat label="작성 중" value={count('DRAFT') + '건'} />
        <Stat label="승인" value={count('APPROVED') + '건'} sub={`상품 전환 ${data.plans.filter((p) => p.productId).length}건`} />
        <Stat label="승인 기획 예상 매출" value={krwShort(data.plans.filter((p) => p.status === 'APPROVED').reduce((s, p) => s + p.targetPriceKrw * p.targetQty, 0))} sub="목표 가격 × 목표 수량" />
      </div>

      <Card className="mt-3">
        <Tabs label="기획안 상태" value={tab} onChange={setTab} items={[
          { v: 'ALL', t: '전체', n: data.plans.length },
          ...(Object.keys(PLAN_STATUS_LABEL) as PlanStatus[]).map((s) => ({ v: s as Tab, t: PLAN_STATUS_LABEL[s], n: count(s) })),
        ]} />
        <DataTable data={rows} columns={columns} onRowClick={(p) => { setDraft({ ...p }); setIsNew(false); setReason('') }}
          empty="기획안이 없습니다. 관리자라면 상단의 '시연 자료 초기화'로 자료를 넣을 수 있습니다." />
      </Card>

      {draft && (
        <Drawer onClose={() => setDraft(null)}
          title={<span className="flex items-center gap-2"><span className="truncate">{isNew ? '기획안 작성' : draft.title}</span>{!isNew && <PlanBadge s={st} />}</span>}
          footer={<>
            <Button onClick={() => setDraft(null)}>닫기</Button>
            {editable && <Button disabled={busy} onClick={save}>{isNew ? '등록' : '저장'}</Button>}
            {editable && !isNew && (
              <Button variant="primary" disabled={busy} onClick={async () => { if (await save()) await run(() => actions.requestPlanReview(draft.id), '승인을 요청했습니다.') }}>승인 요청</Button>
            )}
          </>}>
          <div className="space-y-4">
            {st === 'REJECTED' && saved?.rejectReason && (
              <p className="rounded-md bg-danger-soft px-3 py-2 text-xs leading-relaxed text-danger">반려 사유: {saved.rejectReason}<br />내용을 보완한 뒤 다시 승인을 요청할 수 있습니다.</p>
            )}
            <fieldset disabled={!editable} className="space-y-4 disabled:opacity-80">
              <Field label="기획안 제목 (상품명)"><input className="field" value={draft.title} onChange={(e) => set('title', e.target.value)} /></Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="아티스트">
                  <select className="field" value={draft.artistId} onChange={(e) => setDraft({ ...draft, artistId: e.target.value, ipId: undefined })}>
                    {data.artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                  </select>
                </Field>
                <Field label="IP 프로젝트">
                  <select className="field" value={draft.ipId ?? ''} onChange={(e) => set('ipId', e.target.value || undefined)}>
                    <option value="">연결 안 함</option>
                    {ips.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </Field>
                <Field label="상품 분류">
                  <select className="field" value={draft.category} onChange={(e) => set('category', e.target.value as Category)}>
                    {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </Field>
                <Field label="판매 유형">
                  <select className="field" value={draft.saleType} onChange={(e) => set('saleType', e.target.value as SaleType)}>
                    {Object.entries(SALE_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </Field>
                <Field label="목표 가격 (원)"><input className="field num" type="number" min={0} value={draft.targetPriceKrw || ''} onChange={(e) => set('targetPriceKrw', Math.max(0, Number(e.target.value)))} /></Field>
                <Field label="목표 수량"><input className="field num" type="number" min={0} value={draft.targetQty || ''} onChange={(e) => set('targetQty', Math.max(0, Math.round(Number(e.target.value))))} /></Field>
                <Field label="출시 목표일"><input className="field num" type="date" value={draft.launchDate} onChange={(e) => set('launchDate', e.target.value)} /></Field>
                <Field label="예상 매출"><p className="num flex h-9 items-center font-medium">{money(draft.targetPriceKrw * draft.targetQty)}</p></Field>
              </div>
              <Field label="기획 메모"><textarea className="field h-20" value={draft.memo} onChange={(e) => set('memo', e.target.value)} /></Field>
            </fieldset>

            {st === 'REVIEW' && (
              <div className="rounded-md border border-line p-3">
                <p className="label">승인 처리</p>
                <textarea className="field h-16" placeholder="반려할 때는 사유를 입력합니다." aria-label="반려 사유" value={reason} onChange={(e) => setReason(e.target.value)} />
                <div className="mt-2 flex justify-end gap-2">
                  <Button variant="danger" disabled={busy} onClick={async () => { if (await run(() => actions.decidePlan(draft.id, false, reason), '기획안을 반려했습니다.')) setReason('') }}>반려</Button>
                  <Button variant="primary" disabled={busy} onClick={() => run(() => actions.decidePlan(draft.id, true), '기획안을 승인했습니다.')}>승인</Button>
                </div>
              </div>
            )}
            {st === 'APPROVED' && saved && (
              <div className="rounded-md border border-line p-3">
                <p className="label">상품 등록 전환</p>
                {saved.productId ? (
                  <p className="text-[13px] leading-relaxed text-ink-sub">
                    상품으로 전환되었습니다. <Link className="text-primary hover:underline" to="/products">상품 관리</Link>에서 해외 가격과 옵션을 입력하면 판매를 시작할 수 있습니다.
                  </p>
                ) : (
                  <>
                    <p className="mb-2 text-xs leading-relaxed text-ink-sub">'판매 준비' 상태의 상품이 만들어집니다. 국내 가격만 채워지므로 해외 가격을 입력해야 판매를 시작할 수 있습니다.</p>
                    <Button variant="primary" disabled={busy} onClick={() => run(() => actions.createProductFromPlan(draft.id), '상품을 만들었습니다. 상품 관리에서 확인하세요.')}>상품으로 전환</Button>
                  </>
                )}
              </div>
            )}

            {!isNew && saved && (
              <div>
                <p className="label">진행 이력</p>
                <div className="rounded-md border border-line px-3">
                  <Row k="작성">{dateTime(saved.createdAt)} · {saved.createdBy}</Row>
                  <Row k="IP 프로젝트">{ipName(saved.ipId)}</Row>
                  {saved.requestedAt && <Row k="승인 요청">{dateTime(saved.requestedAt)}</Row>}
                  {saved.decidedAt && st !== 'REVIEW' && st !== 'DRAFT' && <Row k={st === 'APPROVED' ? '승인' : '반려'}>{dateTime(saved.decidedAt)} · {saved.decidedBy}</Row>}
                </div>
              </div>
            )}
          </div>
        </Drawer>
      )}
    </>
  )
}
