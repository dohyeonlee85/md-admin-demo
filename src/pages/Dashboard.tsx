import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { useStore } from '../lib/store'
import { available, buildMetrics } from '../lib/metrics'
import { dateTime, krwShort, maskName, money, num } from '../lib/format'
import { Badge, Card, PageHeader, cx } from '../components/ui'
import { OrderBadge } from '../components/status'
import { rules } from '../lib/settings'

function Kpi({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: 'up' | 'down' }) {
  return (
    <div className="rounded-lg border border-line bg-white p-4">
      <p className="text-xs text-ink-sub">{label}</p>
      <p className="num mt-1.5 text-[22px] font-semibold leading-none tracking-tight">{value}</p>
      {sub && <p className={cx('num mt-2 text-xs', tone === 'up' ? 'text-success' : tone === 'down' ? 'text-danger' : 'text-ink-mute')}>{sub}</p>}
    </div>
  )
}

export default function Dashboard() {
  const { data, session } = useStore()
  const nav = useNavigate()
  const m = useMemo(() => buildMetrics(data), [data])
  const masked = session?.role !== 'admin'
  const diff = m.today.net - m.yesterday.net
  const pct = m.yesterday.net ? Math.round((diff / Math.abs(m.yesterday.net)) * 100) : null
  const artistTotal = m.artistSplit.reduce((s, a) => s + a.krw, 0) || 1
  const skuName = (id: string) => {
    const s = data.skus.find((x) => x.id === id)!
    const p = data.products.find((x) => x.id === s.productId)
    return `${p?.name ?? ''}${s.option !== '단품' ? ' · ' + s.option : ''}`
  }
  const todos = [
    { label: '출고 대기', n: m.todo.toShip, to: '/orders?f=toShip', tone: 'primary' as const },
    { label: `결제 대기 ${rules.pendingCancelHours}시간 경과`, n: m.todo.pendingExpired, to: '/orders?f=expired', tone: 'warning' as const },
    { label: '배송 지연', n: m.todo.delayed, to: '/orders?f=delayed', tone: 'danger' as const },
    { label: '재고 부족 SKU', n: m.todo.lowStock, to: '/inventory?f=low', tone: 'warning' as const },
    { label: '미처리 문의·교환', n: m.todo.csOpen, to: '/customers?tab=cs', tone: m.todo.csDelayed ? 'danger' as const : 'primary' as const },
    { label: '기획 승인 대기', n: m.todo.planReview, to: '/planning', tone: 'primary' as const },
  ]

  return (
    <>
      <PageHeader title="Dashboard" desc="순매출 = 결제 − 환불 · 원화 환산은 결제 시점 환율 · 한국 시간 기준" />
      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Kpi label="오늘 순매출" value={krwShort(m.today.net)}
          sub={pct === null ? '어제 매출 없음' : `어제 대비 ${diff >= 0 ? '+' : ''}${pct}%`} tone={diff >= 0 ? 'up' : 'down'} />
        <Kpi label="최근 30일 순매출" value={krwShort(m.net30)} sub={`환불 ${krwShort(m.refund30)} 차감`} />
        <Kpi label="오늘 결제 주문" value={num(m.today.orders) + '건'} sub={`30일 ${num(m.orders30)}건`} />
        <Kpi label="재고 부족 SKU" value={num(m.todo.lowStock) + '개'} sub="가용 재고가 부족 기준 미만" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card title="일별 순매출 (최근 30일)" className="xl:col-span-2">
          <div className="h-64 p-3 pr-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={m.series} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="net" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#5B67D8" stopOpacity={0.28} />
                    <stop offset="100%" stopColor="#5B67D8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke="#EEF0F3" vertical={false} />
                <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9197A3' }} tickLine={false} axisLine={{ stroke: '#E6E8EC' }} interval={4} />
                <YAxis tick={{ fontSize: 11, fill: '#9197A3' }} tickLine={false} axisLine={false} width={52}
                  tickFormatter={(v: number) => (v / 10000).toLocaleString() + '만'} />
                <Tooltip formatter={(v: number) => [money(v), '순매출']} labelFormatter={(l) => `${l} (KST)`}
                  contentStyle={{ fontSize: 12, borderRadius: 8, borderColor: '#E6E8EC' }} />
                <Area type="monotone" dataKey="net" stroke="#5B67D8" strokeWidth={2} fill="url(#net)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card title="처리 대기 업무">
          <ul>
            {todos.map((t) => (
              <li key={t.label} className="border-b border-line last:border-0">
                <Link to={t.to} className="flex h-12 items-center justify-between px-4 hover:bg-bg">
                  <span>{t.label}</span>
                  <span className="flex items-center gap-2">
                    <Badge tone={t.n ? t.tone : 'gray'}>{t.n}건</Badge>
                    <span className="text-ink-mute">›</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
          <div className="border-t border-line p-4">
            <p className="mb-2 text-xs font-medium text-ink-sub">아티스트별 실적 (30일)</p>
            {m.artistSplit.map((a, i) => (
              <div key={a.name} className="mb-2 last:mb-0">
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{a.name}</span>
                  <span className="num text-ink-sub">{krwShort(a.krw)} · {Math.round((a.krw / artistTotal) * 100)}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-bg">
                  <div className={cx('h-full rounded-full', i === 0 ? 'bg-primary' : 'bg-success')} style={{ width: `${(a.krw / artistTotal) * 100}%` }} />
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card title="인기 상품 TOP 10 (30일 판매 수량)">
          <ol>
            {m.top10.map((p, i) => (
              <li key={p.name} className="flex h-10 items-center gap-3 border-b border-line px-4 last:border-0">
                <span className="num w-5 text-xs font-semibold text-ink-mute">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="num text-ink-sub">{num(p.qty)}개</span>
              </li>
            ))}
          </ol>
        </Card>

        <Card title="최근 주문" action={<Link to="/orders" className="text-xs text-primary hover:underline">전체 보기</Link>}>
          <ul>
            {m.recent.map((o) => (
              <li key={o.id}>
                <button onClick={() => nav('/orders?id=' + o.id)} className="flex h-[50px] w-full items-center gap-3 border-b border-line px-4 text-left hover:bg-bg">
                  <span className="min-w-0 flex-1">
                    <span className="num block truncate text-xs font-medium">{o.orderNo}</span>
                    <span className="block truncate text-[11px] text-ink-mute">{masked ? maskName(o.customerName) : o.customerName} · {dateTime(o.createdAt)}</span>
                  </span>
                  <span className="num text-xs">{money(o.total, o.currency)}</span>
                  <OrderBadge s={o.orderStatus} />
                </button>
              </li>
            ))}
          </ul>
        </Card>

        <Card title="재고 부족 알림" action={<Link to="/inventory?f=low" className="text-xs text-primary hover:underline">재고 관리</Link>}>
          {m.lowStock.length === 0 && <p className="p-6 text-center text-ink-mute">부족한 재고가 없습니다.</p>}
          <ul>
            {m.lowStock.slice(0, 8).map((s) => (
              <li key={s.id} className="flex h-[50px] items-center gap-3 border-b border-line px-4 last:border-0">
                <span className="min-w-0 flex-1 truncate">{skuName(s.id)}</span>
                <span className="num text-xs text-ink-sub">가용 {num(available(s))}</span>
                <Badge tone={available(s) <= 0 ? 'danger' : 'warning'}>{available(s) <= 0 ? '품절' : '부족'}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
