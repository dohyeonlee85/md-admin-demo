import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useStore } from '../lib/store'
import { missingPrices } from '../lib/actions'
import { available } from '../lib/metrics'
import { money, num } from '../lib/format'
import {
  CATEGORIES, COUNTRY_LABEL, CURRENCIES, PRODUCT_STATUS_LABEL, SALE_TYPE_LABEL,
  type Category, type Product, type ProductStatus, type SaleType, type Sku,
} from '../lib/types'
import { Button, Card, DataTable, Drawer, Field, PageHeader, useRun } from '../components/ui'
import { ProductBadge, StockBadge } from '../components/status'

const ROUNDS = ['1차', '2차', '재판매']

function blank(artistId: string): Product {
  return {
    id: 'p' + Date.now().toString(36), name: '', artistId, category: 'MD', saleType: 'NORMAL', round: '1차',
    status: 'DRAFT', prices: {}, purchaseLimit: 0, createdAt: Date.now(), updatedAt: Date.now(),
  }
}

export default function Products() {
  const { data, actions } = useStore()
  const [q, setQ] = useState('')
  const [artist, setArtist] = useState('')
  const [category, setCategory] = useState('')
  const [status, setStatus] = useState('')
  const [draft, setDraft] = useState<Product | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [options, setOptions] = useState('단품')
  const [newOption, setNewOption] = useState('')
  const { run, busy } = useRun()

  const artistName = (id: string) => data.artists.find((a) => a.id === id)?.name ?? id
  const stockOf = useMemo(() => {
    const m = new Map<string, number>()
    data.skus.forEach((s) => m.set(s.productId, (m.get(s.productId) ?? 0) + available(s)))
    return m
  }, [data.skus])

  const rows = useMemo(() => data.products
    .filter((p) => (!q || p.name.toLowerCase().includes(q.toLowerCase())) && (!artist || p.artistId === artist) &&
      (!category || p.category === category) && (!status || p.status === status))
    .sort((a, b) => b.updatedAt - a.updatedAt), [data.products, q, artist, category, status])

  const columns = useMemo<ColumnDef<Product, any>[]>(() => [
    { header: '상품명', accessorKey: 'name', cell: (c) => <span className="font-medium">{c.getValue()}</span> },
    { header: '아티스트', accessorFn: (p) => artistName(p.artistId) },
    { header: '분류', accessorKey: 'category' },
    { header: '판매 유형', accessorFn: (p) => SALE_TYPE_LABEL[p.saleType] },
    { header: '회차', accessorKey: 'round' },
    { header: '국내 가격', accessorFn: (p) => p.prices.KRW ?? 0, cell: (c) => (c.getValue() ? money(c.getValue()) : '-'), meta: { right: true } },
    { header: '가용 재고', accessorFn: (p) => stockOf.get(p.id) ?? 0, cell: (c) => num(c.getValue()), meta: { right: true } },
    { header: '상태', accessorKey: 'status', cell: (c) => <ProductBadge s={c.getValue()} /> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [data.artists, stockOf])

  const open = (p: Product) => { setDraft({ ...p, prices: { ...p.prices } }); setIsNew(false); setNewOption('') }
  const openNew = () => { setDraft(blank(data.artists[0]?.id ?? 'ateez')); setIsNew(true); setOptions('단품') }
  const set = <K extends keyof Product>(k: K, v: Product[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const skus = draft ? data.skus.filter((s) => s.productId === draft.id) : []
  const miss = draft ? missingPrices(draft) : []
  // 저장된 최신 상태 (상태 변경 버튼은 저장된 값 기준)
  const saved = draft ? data.products.find((p) => p.id === draft.id) : undefined

  const save = async () => {
    if (!draft) return
    const newSkus: Sku[] = isNew
      ? options.split(',').map((o) => o.trim()).filter(Boolean).map((option, i) => ({
          id: `${draft.id}-s${i + 1}`, productId: draft.id, code: `SKU-${draft.id.toUpperCase()}-${i + 1}`,
          option, onHand: 0, allocated: 0, threshold: 100,
        }))
      : []
    if (isNew && newSkus.length === 0) newSkus.push({ id: `${draft.id}-s1`, productId: draft.id, code: `SKU-${draft.id.toUpperCase()}-1`, option: '단품', onHand: 0, allocated: 0, threshold: 100 })
    const clean = { ...draft }
    if (!clean.shipFrom) delete clean.shipFrom
    if (await run(() => actions.saveProduct(clean, newSkus), isNew ? '상품을 등록했습니다.' : '상품 정보를 저장했습니다.')) setIsNew(false)
  }
  const changeStatus = async (s: ProductStatus) => {
    if (!draft) return
    if (await run(() => actions.setProductStatus(draft.id, s), `상태를 '${PRODUCT_STATUS_LABEL[s]}'(으)로 변경했습니다.`)) set('status', s)
  }

  return (
    <>
      <PageHeader title="Product Management" desc="상품과 SKU(옵션별 재고 단위)를 분리해 관리합니다. 삭제 대신 판매 중지·보관을 사용합니다."
        action={<Button variant="primary" onClick={openNew}>+ 상품 등록</Button>} />
      <Card>
        <div className="grid grid-cols-2 gap-2 border-b border-line p-3 md:grid-cols-4">
          <input className="field col-span-2 md:col-span-1" placeholder="상품명 검색" aria-label="상품명 검색" value={q} onChange={(e) => setQ(e.target.value)} />
          <select className="field" aria-label="아티스트" value={artist} onChange={(e) => setArtist(e.target.value)}>
            <option value="">아티스트 전체</option>
            {data.artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="field" aria-label="분류" value={category} onChange={(e) => setCategory(e.target.value)}>
            <option value="">분류 전체</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
          <select className="field" aria-label="상태" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">상태 전체</option>
            {Object.entries(PRODUCT_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <DataTable data={rows} columns={columns} onRowClick={open} />
      </Card>

      {draft && (
        <Drawer onClose={() => setDraft(null)}
          title={<span className="flex items-center gap-2"><span className="truncate">{isNew ? '상품 등록' : draft.name}</span>{!isNew && saved && <ProductBadge s={saved.status} />}</span>}
          footer={<>
            <Button onClick={() => setDraft(null)}>닫기</Button>
            <Button variant="primary" disabled={busy} onClick={save}>{isNew ? '등록' : '저장'}</Button>
          </>}>
          <div className="space-y-4">
            <Field label="상품명"><input className="field" value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="아티스트">
                <select className="field" value={draft.artistId} onChange={(e) => set('artistId', e.target.value)}>
                  {data.artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
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
              <Field label="판매 회차">
                <select className="field" value={draft.round} onChange={(e) => set('round', e.target.value)}>
                  {ROUNDS.map((r) => <option key={r}>{r}</option>)}
                </select>
              </Field>
              <Field label="1인당 구매 제한" hint="0 = 제한 없음 (고객 계정 기준)">
                <input className="field num" type="number" min={0} value={draft.purchaseLimit} onChange={(e) => set('purchaseLimit', Math.max(0, Number(e.target.value)))} />
              </Field>
              {draft.saleType === 'PREORDER' && (
                <Field label="출고 예정일" hint="예약판매 전용">
                  <input className="field num" type="date" value={draft.shipFrom ?? ''} onChange={(e) => set('shipFrom', e.target.value)} />
                </Field>
              )}
            </div>

            <div>
              <p className="label">국가별 판매 가격</p>
              <div className="grid grid-cols-3 gap-3">
                {CURRENCIES.map((c) => (
                  <Field key={c} label={`${COUNTRY_LABEL[c]} (${c})`}>
                    <input className="field num" type="number" min={0} step={c === 'USD' ? 0.01 : 1} placeholder="미입력"
                      value={draft.prices[c] ?? ''} onChange={(e) => {
                        const prices = { ...draft.prices }
                        if (e.target.value === '') delete prices[c]; else prices[c] = Number(e.target.value)
                        set('prices', prices)
                      }} />
                  </Field>
                ))}
              </div>
              {miss.length > 0 && (
                <p className="mt-2 rounded-md bg-warning-soft px-3 py-2 text-xs text-[#7A5410]">
                  가격 미입력 국가: {miss.map((c) => COUNTRY_LABEL[c]).join(', ')}. 모든 국가 가격을 입력하고 저장해야 판매를 시작할 수 있습니다.
                </p>
              )}
            </div>

            {isNew ? (
              <Field label="옵션 (SKU)" hint="쉼표로 구분. 예: S, M, L · 옵션이 없으면 '단품'">
                <input className="field" value={options} onChange={(e) => setOptions(e.target.value)} />
              </Field>
            ) : (
              <>
                <div>
                  <p className="label">SKU · 재고</p>
                  <div className="overflow-hidden rounded-md border border-line">
                    {skus.map((s) => (
                      <div key={s.id} className="flex h-10 items-center gap-3 border-b border-line px-3 last:border-0">
                        <span className="min-w-0 flex-1 truncate">{s.option} <span className="num ml-1 text-[11px] text-ink-mute">{s.code}</span></span>
                        <span className="num text-xs text-ink-sub">보유 {num(s.onHand)} · 할당 {num(s.allocated)}</span>
                        <StockBadge sku={s} />
                      </div>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <input className="field" placeholder="새 옵션명 (예: XXL)" aria-label="새 옵션명" value={newOption} onChange={(e) => setNewOption(e.target.value)} />
                    <Button disabled={busy} onClick={async () => { if (await run(() => actions.addSku(draft.id, newOption), '옵션을 추가했습니다.')) setNewOption('') }}>옵션 추가</Button>
                  </div>
                </div>

                {saved && (
                  <div>
                    <p className="label">판매 상태 변경</p>
                    <div className="flex flex-wrap gap-2">
                      {saved.status !== 'ON_SALE' && saved.status !== 'ARCHIVED' && (
                        <Button variant="primary" disabled={busy || missingPrices(saved).length > 0} onClick={() => changeStatus('ON_SALE')}>판매 시작</Button>
                      )}
                      {saved.status === 'ON_SALE' && <Button variant="danger" disabled={busy} onClick={() => changeStatus('PAUSED')}>판매 중지</Button>}
                      {saved.status !== 'ARCHIVED' && saved.status !== 'ON_SALE' && <Button disabled={busy} onClick={() => changeStatus('ARCHIVED')}>보관</Button>}
                      {saved.status === 'ARCHIVED' && <Button disabled={busy} onClick={() => changeStatus('DRAFT')}>판매 준비로 복원</Button>}
                    </div>
                    {saved.status !== 'ON_SALE' && saved.status !== 'ARCHIVED' && missingPrices(saved).length > 0 && (
                      <p className="mt-2 text-xs text-ink-mute">저장된 가격에 미입력 국가가 있어 '판매 시작'이 비활성화되어 있습니다.</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </Drawer>
      )}
    </>
  )
}
