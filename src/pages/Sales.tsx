import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useStore } from '../lib/store'
import { roundMissingPrices } from '../lib/actions'
import { dateTime, dayKey, money, num } from '../lib/format'
import { COUNTRY_LABEL, CURRENCIES, ROUNDS, type Currency, type RoundStatus, type SaleRound } from '../lib/types'
import { Button, Card, DataTable, Drawer, Field, PageHeader, Row, Stat, Tabs, useRun } from '../components/ui'
import { ProductBadge, RoundBadge } from '../components/status'

type Tab = 'ALL' | RoundStatus
type RowT = SaleRound & { productName: string; artist: string; qty: number; blocked: boolean }

export default function Sales() {
  const { data, actions } = useStore()
  const { run, busy } = useRun()
  const [tab, setTab] = useState<Tab>('OPEN')
  const [artist, setArtist] = useState('')
  const [draft, setDraft] = useState<SaleRound | null>(null)
  const [isNew, setIsNew] = useState(false)

  const productMap = useMemo(() => new Map(data.products.map((p) => [p.id, p])), [data.products])
  /** 회차 판매 기간(실제 시작~종료) 안에 결제된 수량. 환불 주문 제외 */
  const qtyOf = (r: SaleRound) => {
    if (!r.openedAt) return 0
    const end = r.closedAt ?? Date.now()
    let q = 0
    for (const o of data.orders) {
      if (!o.paidAt || o.paidAt < r.openedAt || o.paidAt > end || o.paymentStatus !== 'PAID') continue
      for (const it of o.items) if (it.productId === r.productId) q += it.qty
    }
    return q
  }
  const all = useMemo<RowT[]>(() => data.saleRounds.map((r) => {
    const p = productMap.get(r.productId)
    return {
      ...r, productName: p?.name ?? r.productId, artist: data.artists.find((a) => a.id === p?.artistId)?.name ?? '-',
      qty: qtyOf(r), blocked: r.status === 'SCHEDULED' && !!p && roundMissingPrices(p, r.countries).length > 0,
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }), [data.saleRounds, data.orders, productMap, data.artists])
  const count = (s: RoundStatus) => all.filter((r) => r.status === s).length
  const rows = useMemo(() => all
    .filter((r) => (tab === 'ALL' || r.status === tab) && (!artist || productMap.get(r.productId)?.artistId === artist))
    .sort((a, b) => b.startDate.localeCompare(a.startDate)), [all, tab, artist, productMap])

  const columns = useMemo<ColumnDef<RowT, any>[]>(() => [
    { header: '상품', accessorKey: 'productName', cell: (c) => <span className="block max-w-[280px] truncate font-medium">{c.getValue()}</span> },
    { header: '아티스트', accessorKey: 'artist' },
    { header: '회차', accessorKey: 'round' },
    { header: '판매 기간', accessorKey: 'startDate', cell: (c) => <span className="num">{c.row.original.startDate} ~ {c.row.original.endDate}</span> },
    { header: '판매 국가', accessorFn: (r) => r.countries.join(' · ') },
    { header: '판매 수량', accessorKey: 'qty', cell: (c) => (c.row.original.openedAt ? num(c.getValue()) : '-'), meta: { right: true } },
    { header: '상태', accessorKey: 'status', cell: (c) => (
      <span className="flex items-center gap-1.5"><RoundBadge s={c.getValue()} />{c.row.original.blocked && <span className="text-[11px] text-danger">가격 미입력</span>}</span>
    ) },
  ], [])

  const openNew = () => {
    const now = Date.now()
    const first = data.products.find((p) => p.status !== 'ARCHIVED')
    setDraft({ id: 'r' + now.toString(36), productId: first?.id ?? '', round: '1차', startDate: dayKey(now + 7 * 86400000), endDate: dayKey(now + 37 * 86400000), countries: [...CURRENCIES], status: 'SCHEDULED', memo: '', createdAt: now })
    setIsNew(true)
  }
  const set = <K extends keyof SaleRound>(k: K, v: SaleRound[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const saved = draft ? data.saleRounds.find((r) => r.id === draft.id) : undefined
  const st: RoundStatus = saved?.status ?? 'SCHEDULED'
  const product = draft ? productMap.get(draft.productId) : undefined
  const miss = product && draft ? roundMissingPrices(product, draft.countries) : []
  const savedMiss = product && saved ? roundMissingPrices(product, saved.countries) : []
  const toggle = (c: Currency) => draft && set('countries', draft.countries.includes(c) ? draft.countries.filter((x) => x !== c) : CURRENCIES.filter((x) => x === c || draft.countries.includes(x)))
  const save = async () => { if (draft && await run(() => actions.saveRound(draft), isNew ? '판매 회차를 등록했습니다.' : '저장했습니다.')) setIsNew(false) }

  return (
    <>
      <PageHeader title="Sales Management" desc="판매 회차(1차·2차·재판매)와 국가별 판매를 운영합니다. 판매 시작은 수동이며, 선택한 국가의 가격이 모두 입력되어야 시작할 수 있습니다."
        action={<Button variant="primary" onClick={openNew}>+ 판매 회차 등록</Button>} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="판매 중 회차" value={count('OPEN') + '건'} />
        <Stat label="예정 회차" value={count('SCHEDULED') + '건'} sub="수동으로 판매 시작" />
        <Stat label="시작 불가" value={all.filter((r) => r.blocked).length + '건'} sub="가격 미입력 국가 있음" />
        <Stat label="종료 회차" value={count('CLOSED') + '건'} />
      </div>

      <Card className="mt-3">
        <Tabs label="회차 상태" value={tab} onChange={setTab} items={[
          { v: 'OPEN', t: '판매 중', n: count('OPEN') }, { v: 'SCHEDULED', t: '예정', n: count('SCHEDULED') },
          { v: 'CLOSED', t: '종료', n: count('CLOSED') }, { v: 'ALL', t: '전체', n: all.length },
        ]} />
        <div className="border-b border-line p-3">
          <select className="field max-w-[200px]" aria-label="아티스트" value={artist} onChange={(e) => setArtist(e.target.value)}>
            <option value="">아티스트 전체</option>
            {data.artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
        </div>
        <DataTable data={rows} columns={columns} onRowClick={(r) => { setDraft({ ...data.saleRounds.find((x) => x.id === r.id)! }); setIsNew(false) }}
          empty="해당하는 판매 회차가 없습니다. 자료가 전혀 없다면 관리자 계정의 '시연 자료 초기화'를 실행하세요." />
      </Card>

      {draft && (
        <Drawer onClose={() => setDraft(null)}
          title={<span className="flex items-center gap-2"><span className="truncate">{isNew ? '판매 회차 등록' : `${product?.name ?? ''} · ${draft.round}`}</span>{!isNew && <RoundBadge s={st} />}</span>}
          footer={<>
            <Button onClick={() => setDraft(null)}>닫기</Button>
            {st !== 'CLOSED' && <Button disabled={busy} onClick={save}>{isNew ? '등록' : '저장'}</Button>}
            {!isNew && st === 'SCHEDULED' && (
              <Button variant="primary" disabled={busy || savedMiss.length > 0} onClick={() => run(() => actions.openRound(draft.id, data.saleRounds), '판매를 시작했습니다.')}>판매 시작</Button>
            )}
            {!isNew && st === 'OPEN' && <Button variant="danger" disabled={busy} onClick={() => run(() => actions.closeRound(draft.id), '판매를 종료했습니다.')}>판매 종료</Button>}
          </>}>
          <div className="space-y-4">
            <fieldset disabled={st === 'CLOSED'} className="space-y-4">
              <Field label="상품" hint={isNew ? undefined : '등록 후에는 상품을 바꿀 수 없습니다.'}>
                <select className="field" disabled={!isNew} value={draft.productId} onChange={(e) => set('productId', e.target.value)}>
                  {data.products.filter((p) => p.status !== 'ARCHIVED' || p.id === draft.productId).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </Field>
              <div className="grid grid-cols-3 gap-3">
                <Field label="회차">
                  <select className="field" value={draft.round} onChange={(e) => set('round', e.target.value)}>{ROUNDS.map((r) => <option key={r}>{r}</option>)}</select>
                </Field>
                <Field label="시작일"><input className="field num" type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
                <Field label="종료일"><input className="field num" type="date" value={draft.endDate} onChange={(e) => set('endDate', e.target.value)} /></Field>
              </div>
              <div>
                <p className="label">판매 국가와 가격</p>
                <div className="overflow-hidden rounded-md border border-line">
                  {CURRENCIES.map((c) => {
                    const price = product?.prices[c]
                    return (
                      <label key={c} className="flex h-11 cursor-pointer items-center gap-3 border-b border-line px-3 last:border-0">
                        <input type="checkbox" className="h-4 w-4 accent-[#5B67D8]" checked={draft.countries.includes(c)} onChange={() => toggle(c)} />
                        <span className="flex-1">{COUNTRY_LABEL[c]} <span className="text-xs text-ink-mute">{c}</span></span>
                        <span className={Number(price) > 0 ? 'num' : 'text-xs text-danger'}>{Number(price) > 0 ? money(price!, c) : '가격 미입력'}</span>
                      </label>
                    )
                  })}
                </div>
                {miss.length > 0 && (
                  <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-xs leading-relaxed text-[#7A5410]">
                    가격 미입력 국가: {miss.map((c) => COUNTRY_LABEL[c]).join(', ')}. 상품 관리에서 가격을 입력하거나 해당 국가를 판매 대상에서 빼야 판매를 시작할 수 있습니다.
                  </p>
                )}
              </div>
              <Field label="메모"><textarea className="field h-16" value={draft.memo} onChange={(e) => set('memo', e.target.value)} /></Field>
            </fieldset>

            {!isNew && saved && product && (
              <div>
                <p className="label">운영 현황</p>
                <div className="rounded-md border border-line px-3">
                  <Row k="상품 상태"><ProductBadge s={product.status} /></Row>
                  <Row k="실제 시작">{saved.openedAt ? dateTime(saved.openedAt) : '아직 시작하지 않음 (수동 시작)'}</Row>
                  {saved.closedAt && <Row k="실제 종료">{dateTime(saved.closedAt)}</Row>}
                  <Row k="판매 수량">{saved.openedAt ? `${num(qtyOf(saved))}개 (기간 내 결제, 환불 제외)` : '-'}</Row>
                </div>
              </div>
            )}
          </div>
        </Drawer>
      )}
    </>
  )
}
