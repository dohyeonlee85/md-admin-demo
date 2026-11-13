import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { Bar, CartesianGrid, ComposedChart, Legend, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store'
import { buildAnalytics, type Filter } from '../lib/analytics'
import { krwShort, money, num } from '../lib/format'
import { COUNTRY_LABEL, CURRENCIES, type Currency } from '../lib/types'
import { Badge, Card, DataTable, PageHeader, cx } from '../components/ui'

type ProductRow = ReturnType<typeof buildAnalytics>['products'][number]

const PERIODS = [7, 30, 90]

function Seg<T extends string | number>({ label, value, options, onChange }: {
  label: string; value: T; options: { v: T; t: string }[]; onChange: (v: T) => void
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-md border border-line bg-white p-0.5">
      {options.map((o) => (
        <button key={String(o.v)} type="button" aria-pressed={value === o.v} onClick={() => onChange(o.v)}
          className={cx('h-8 rounded px-3 text-[13px] font-medium', value === o.v ? 'bg-primary text-white' : 'text-ink-sub hover:bg-bg')}>
          {o.t}
        </button>
      ))}
    </div>
  )
}

function Kpi({ label, value, sub, className }: { label: string; value: string; sub?: string; className?: string }) {
  return (
    <div className={cx('rounded-lg border border-line bg-white p-4', className)}>
      <p className="text-xs text-ink-sub">{label}</p>
      <p className="num mt-1.5 text-[22px] font-semibold leading-none tracking-tight">{value}</p>
      {sub && <p className="num mt-2 text-xs text-ink-mute">{sub}</p>}
    </div>
  )
}

const columns: ColumnDef<ProductRow, any>[] = [
  { accessorKey: 'name', header: '상품', cell: (c) => <span className="block max-w-[260px] truncate">{c.getValue()}</span> },
  { accessorKey: 'artist', header: '아티스트' },
  { accessorKey: 'category', header: '분류' },
  { accessorKey: 'qty', header: '판매 수량', meta: { right: true }, cell: (c) => num(c.getValue()) },
  { accessorKey: 'krw', header: '매출(원화)', meta: { right: true }, cell: (c) => money(c.getValue()) },
  { accessorKey: 'refundQty', header: '환불 수량', meta: { right: true }, cell: (c) => (c.getValue() ? <span className="text-danger">{num(c.getValue())}</span> : '0') },
]

export default function Analytics() {
  const { data } = useStore()
  const [f, setF] = useState<Filter>({ days: 30, artistId: 'ALL', currency: 'ALL' })
  const a = useMemo(() => buildAnalytics(data, f), [data, f])
  const products = useMemo(() => [...a.products].sort((x, y) => y.qty - x.qty), [a.products])
  const catTotal = a.categories.reduce((s, c) => s + c.krw, 0) || 1

  return (
    <>
      <PageHeader title="Analytics" desc="순매출 = 결제 − 환불 · 결제는 결제일, 환불은 환불일 기준 · 원화 환산은 결제 시점 환율 · 한국 시간" />

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Seg label="기간" value={f.days} onChange={(days) => setF({ ...f, days })}
          options={PERIODS.map((d) => ({ v: d, t: `최근 ${d}일` }))} />
        <Seg label="아티스트" value={f.artistId} onChange={(artistId) => setF({ ...f, artistId })}
          options={[{ v: 'ALL', t: '전체' }, ...data.artists.map((x) => ({ v: x.id, t: x.name }))]} />
        <Seg<'ALL' | Currency> label="국가" value={f.currency} onChange={(currency) => setF({ ...f, currency })}
          options={[{ v: 'ALL', t: '전체 국가' }, ...CURRENCIES.map((c) => ({ v: c, t: c }))]} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        <Kpi label="순매출" value={krwShort(a.net)} sub={`결제 ${krwShort(a.sales)} − 환불 ${krwShort(a.refund)}`} />
        <Kpi label="결제 주문" value={num(a.orders) + '건'} sub={`일평균 ${(a.orders / f.days).toFixed(1)}건`} />
        <Kpi label="판매 수량" value={num(a.qty) + '개'} sub="환불 주문 제외" />
        <Kpi label="객단가" value={money(a.aov)} sub="결제 금액 ÷ 결제 주문" />
        <Kpi className="col-span-2 md:col-span-1" label="환불률" value={(a.refundRate * 100).toFixed(1) + '%'} sub={`환불 주문 ${num(a.refundOrders)}건`} />
      </div>

      <Card title={`일별 매출 추이 (최근 ${f.days}일)`} className="mt-3">
        <div className="h-72 p-3 pr-4">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={a.series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }} stackOffset="sign">
              <CartesianGrid stroke="#EEF0F3" vertical={false} />
              <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9197A3' }} tickLine={false} axisLine={{ stroke: '#E6E8EC' }}
                interval={f.days <= 7 ? 0 : f.days <= 30 ? 4 : 14} />
              <YAxis tick={{ fontSize: 11, fill: '#9197A3' }} tickLine={false} axisLine={false} width={52}
                tickFormatter={(v: number) => (v / 10000).toLocaleString() + '만'} />
              <Tooltip formatter={(v: number, n: string) => [money(Math.abs(v)), n]} labelFormatter={(l) => `${l} (KST)`}
                contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#E6E8EC' }} />
              <Legend wrapperStyle={{ fontSize: 12 }} iconSize={10} />
              <Bar dataKey="sales" name="결제" stackId="a" fill="#C9CEF3" radius={[2, 2, 0, 0]} />
              <Bar dataKey="refund" name="환불" stackId="a" fill="#F1B5BA" radius={[0, 0, 2, 2]} />
              <Line type="monotone" dataKey="net" name="순매출" stroke="#5B67D8" strokeWidth={2} dot={false} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <Card title="분류별 실적 (환불 주문 제외)">
          {a.categories.length === 0 && <p className="p-6 text-center text-ink-mute">기간 내 판매가 없습니다.</p>}
          <ul className="p-4">
            {a.categories.map((c) => (
              <li key={c.name} className="mb-3 last:mb-0">
                <div className="mb-1 flex justify-between gap-2 text-xs">
                  <span className="font-medium">{c.name}</span>
                  <span className="num text-ink-sub">{num(c.qty)}개 · {krwShort(c.krw)} · {Math.round((c.krw / catTotal) * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${(c.krw / catTotal) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="국가별 실적 (결제 기준)">
          <div className="overflow-x-auto">
            <table className="w-full min-w-max text-[13px]">
              <thead>
                <tr className="border-b border-line bg-bg/60 text-xs text-ink-sub">
                  <th className="h-9 px-4 text-left font-medium">국가</th>
                  <th className="px-3 text-right font-medium">주문</th>
                  <th className="px-3 text-right font-medium">결제 통화 금액</th>
                  <th className="px-3 text-right font-medium">원화 환산</th>
                  <th className="px-4 text-right font-medium">객단가</th>
                </tr>
              </thead>
              <tbody>
                {a.currencies.map((c) => (
                  <tr key={c.code} className="border-b border-line last:border-0">
                    <td className="h-11 px-4">{COUNTRY_LABEL[c.code]} <span className="text-xs text-ink-mute">{c.code}</span></td>
                    <td className="num px-3 text-right">{num(c.orders)}</td>
                    <td className="num px-3 text-right">{money(Math.round(c.local * 100) / 100, c.code)}</td>
                    <td className="num px-3 text-right">{krwShort(c.krw)}</td>
                    <td className="num px-4 text-right">{c.orders ? krwShort(Math.round(c.krw / c.orders)) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-line px-4 py-2.5 text-[11px] text-ink-mute">원화 환산은 주문마다 저장된 결제 시점 환율을 사용합니다.</p>
        </Card>
      </div>

      <Card title="ALBUM 발매 후 7일 판매 수량" className="mt-3"
        action={<span className="text-[11px] text-ink-mute">기간 선택과 무관 · 환불 주문 제외</span>}>
        {a.albums.length === 0 && <p className="p-6 text-center text-ink-mute">해당 ALBUM이 없습니다.</p>}
        <div className="grid gap-px bg-line md:grid-cols-2">
          {a.albums.map((al) => {
            const max = Math.max(1, ...al.daily)
            return (
              <div key={al.id} className="bg-white p-4">
                <div className="mb-1 flex items-start justify-between gap-2">
                  <p className="min-w-0 truncate font-medium">{al.name}</p>
                  <Badge tone={al.done ? 'success' : 'warning'}>{al.done ? '집계 완료' : '집계 중'}</Badge>
                </div>
                <p className="mb-3 text-xs text-ink-sub">{al.basis} {al.release} 기준</p>
                <p className="num text-[22px] font-semibold leading-none">{num(al.total)}<span className="ml-1 text-sm font-normal text-ink-sub">개</span></p>
                <div className="mt-3 flex h-16 items-end gap-1.5" aria-label="발매 후 일별 판매 수량">
                  {al.daily.map((q, i) => (
                    <div key={i} className="flex flex-1 flex-col items-center gap-1">
                      <div className="w-full rounded-sm bg-primary/80" style={{ height: `${(q / max) * 48}px`, minHeight: q ? 2 : 0 }} title={`${i + 1}일차 ${q}개`} />
                      <span className="num text-[10px] text-ink-mute">D{i + 1}</span>
                    </div>
                  ))}
                </div>
                {al.byOption.length > 0 && (
                  <p className="mt-3 text-xs text-ink-sub">
                    {al.byOption.map((o) => `${o.option} ${num(o.qty)}개`).join(' · ')}
                  </p>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <Card title="상품별 실적" className="mt-3" action={<span className="text-[11px] text-ink-mute">머리글을 누르면 정렬</span>}>
        <DataTable data={products} columns={columns} pageSize={10} empty="기간 내 판매된 상품이 없습니다." />
      </Card>

      <p className="mt-3 text-[11px] leading-relaxed text-ink-mute">
        운영 설계: 일 단위 집계는 매일 한국 시간 00:00에 갱신하고 당일은 실시간 반영. 이 데모는 저장된 주문 자료로 화면에서 즉시 계산합니다.
      </p>
    </>
  )
}
