import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { useStore } from '../lib/store'
import { exchangeBlock, isCsDelayed } from '../lib/actions'
import { rules } from '../lib/settings'
import { dateTime, krwShort, maskEmail, maskName, maskPhone, money, num } from '../lib/format'
import {
  COUNTRY_LABEL, EXCHANGE_REASON_LABEL, INQUIRY_TYPE_LABEL, LANGS, LANG_LABEL,
  type Customer, type Inquiry, type Lang, type Notice,
} from '../lib/types'
import { Badge, Button, Card, DataTable, Drawer, Field, PageHeader, Row, Stat, Tabs, cx, useRun } from '../components/ui'
import { InquiryBadge, OrderBadge } from '../components/status'

type Tab = 'customers' | 'cs' | 'notices'
type CsFilter = 'OPEN' | 'DELAYED' | 'EXCHANGE' | 'ALL'
type CustomerRow = Customer & { orders: number; krw: number }

/** 고객 언어에 맞는 문구. 일본어가 없으면 영어로 대체 */
const shown = (text: Partial<Record<Lang, string>>, lang: Lang) => text[lang] ?? text.EN ?? text.KO ?? ''

export default function Customers() {
  const { data, actions, session } = useStore()
  const { run, busy } = useRun()
  const [params, setParams] = useSearchParams()
  const tab = (params.get('tab') as Tab) || 'customers'
  const masked = session?.role !== 'admin'
  const name = (n: string) => (masked ? maskName(n) : n)

  // ── 고객
  const [q, setQ] = useState('')
  const [country, setCountry] = useState('')
  const [customer, setCustomer] = useState<CustomerRow | null>(null)
  const customers = useMemo<CustomerRow[]>(() => {
    const agg = new Map<string, { orders: number; krw: number }>()
    for (const o of data.orders) {
      if (o.paymentStatus !== 'PAID') continue
      const a = agg.get(o.customerId) ?? { orders: 0, krw: 0 }
      a.orders += 1; a.krw += o.totalKrw
      agg.set(o.customerId, a)
    }
    return data.customers.map((c) => ({ ...c, ...(agg.get(c.id) ?? { orders: 0, krw: 0 }) }))
  }, [data.customers, data.orders])
  const customerRows = useMemo(() => customers
    .filter((c) => (!country || c.country === country) && (!q || (c.name + c.email).toLowerCase().includes(q.toLowerCase())))
    .sort((a, b) => b.krw - a.krw), [customers, q, country])
  const customerCols = useMemo<ColumnDef<CustomerRow, any>[]>(() => [
    { header: '고객명', accessorKey: 'name', cell: (c) => <span className="font-medium">{name(c.getValue())}</span> },
    { header: '이메일', accessorKey: 'email', cell: (c) => (masked ? maskEmail(c.getValue()) : c.getValue()) },
    { header: '연락처', accessorKey: 'phone', cell: (c) => <span className="num">{masked ? maskPhone(c.getValue()) : c.getValue()}</span> },
    { header: '국가', accessorFn: (c) => COUNTRY_LABEL[c.country] },
    { header: '멤버십', accessorFn: (c) => c.membership.join(','), cell: (c) => (
      <span className="flex gap-1">{c.row.original.membership.length ? c.row.original.membership.map((m) => <Badge key={m} tone="primary">{m}</Badge>) : <span className="text-ink-mute">-</span>}</span>
    ) },
    { header: '결제 주문', accessorKey: 'orders', cell: (c) => num(c.getValue()), meta: { right: true } },
    { header: '누적 결제(원화)', accessorKey: 'krw', cell: (c) => money(c.getValue()), meta: { right: true } },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [masked])
  const customerOrders = customer ? data.orders.filter((o) => o.customerId === customer.id).sort((a, b) => b.createdAt - a.createdAt) : []

  // ── 문의 · 교환
  const [filter, setFilter] = useState<CsFilter>((params.get('f') as CsFilter) || 'OPEN')
  const [inq, setInq] = useState<Inquiry | null>(null)
  const [answer, setAnswer] = useState('')
  const open = data.inquiries.filter((x) => x.status === 'OPEN')
  const delayed = data.inquiries.filter((x) => isCsDelayed(x))
  const csRows = useMemo(() => data.inquiries.filter((x) =>
    filter === 'ALL' ? true : filter === 'OPEN' ? x.status === 'OPEN' : filter === 'DELAYED' ? isCsDelayed(x) : x.type === 'EXCHANGE',
  ).sort((a, b) => b.createdAt - a.createdAt), [data.inquiries, filter])
  const csCols = useMemo<ColumnDef<Inquiry, any>[]>(() => [
    { header: '접수 일시', accessorKey: 'createdAt', cell: (c) => <span className="num">{dateTime(c.getValue())}</span> },
    { header: '유형', accessorFn: (x) => INQUIRY_TYPE_LABEL[x.type], cell: (c) => <Badge tone={c.row.original.type === 'EXCHANGE' ? 'primary' : 'gray'}>{c.getValue()}</Badge> },
    { header: '제목', accessorKey: 'title', cell: (c) => <span className="block max-w-[280px] truncate font-medium">{c.getValue()}</span> },
    { header: '고객', accessorKey: 'customerName', cell: (c) => name(c.getValue()) },
    { header: '주문번호', accessorFn: (x) => x.orderNo ?? '-', cell: (c) => <span className="num">{c.getValue()}</span> },
    { header: '상태', accessorKey: 'status', cell: (c) => (
      <span className="flex items-center gap-1.5"><InquiryBadge s={c.getValue()} />{isCsDelayed(c.row.original) && <Badge tone="danger">응답 지연</Badge>}</span>
    ) },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [masked])
  const savedInq = inq ? data.inquiries.find((x) => x.id === inq.id) : undefined
  const inqOrder = savedInq?.orderId ? data.orders.find((o) => o.id === savedInq.orderId) : undefined
  const block = savedInq?.type === 'EXCHANGE' && savedInq.status === 'OPEN' ? exchangeBlock(savedInq, inqOrder) : ''

  // ── 공지 · FAQ
  const [notice, setNotice] = useState<Notice | null>(null)
  const [noticeNew, setNoticeNew] = useState(false)
  const [lang, setLang] = useState<Lang>('KO')
  const noticeRows = useMemo(() => [...data.notices].sort((a, b) => b.updatedAt - a.updatedAt), [data.notices])
  const noticeCols = useMemo<ColumnDef<Notice, any>[]>(() => [
    { header: '구분', accessorKey: 'kind', cell: (c) => <Badge tone={c.getValue() === 'FAQ' ? 'gray' : 'primary'}>{c.getValue() === 'FAQ' ? 'FAQ' : '공지'}</Badge> },
    { header: '제목 (한국어)', accessorFn: (n) => n.title.KO ?? '', cell: (c) => <span className="block max-w-[320px] truncate font-medium">{c.getValue()}</span> },
    { header: '작성 언어', accessorFn: (n) => LANGS.filter((l) => n.title[l]).join(' · '), cell: (c) => (
      <span className="flex items-center gap-1.5"><span className="num">{c.getValue()}</span>{!c.row.original.title.JA && <span className="text-[11px] text-ink-mute">일본 → 영어 노출</span>}</span>
    ) },
    { header: '수정 일시', accessorKey: 'updatedAt', cell: (c) => <span className="num">{dateTime(c.getValue())}</span> },
    { header: '게시', accessorKey: 'published', cell: (c) => <Badge tone={c.getValue() ? 'success' : 'gray'}>{c.getValue() ? '게시 중' : '미게시'}</Badge> },
  ], [])
  const savedNotice = notice ? data.notices.find((n) => n.id === notice.id) : undefined
  const setText = (key: 'title' | 'body', v: string) => setNotice((n) => (n ? { ...n, [key]: { ...n[key], [lang]: v } } : n))
  const openNotice = (n: Notice, isNew = false) => { setNotice({ ...n, title: { ...n.title }, body: { ...n.body } }); setNoticeNew(isNew); setLang('KO') }

  return (
    <>
      <PageHeader title="Customer & CS" desc={`고객 조회, 문의·교환 처리, 공지·FAQ 관리. 교환은 불량·오배송·누락만, 배송 완료 후 ${rules.exchangeDays}일 이내 접수 건만 승인됩니다.`}
        action={tab === 'notices' ? (
          <Button variant="primary" onClick={() => openNotice({ id: 'n' + Date.now().toString(36), kind: 'NOTICE', title: {}, body: {}, published: false, createdAt: Date.now(), updatedAt: Date.now() }, true)}>+ 공지·FAQ 등록</Button>
        ) : undefined} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        <Stat label="고객" value={num(data.customers.length) + '명'} sub="전부 가상 인물 (테스트 데이터)" />
        <Stat label="미처리 문의·교환" value={open.length + '건'} />
        <Stat label="응답 지연" value={delayed.length + '건'} sub={`접수 후 ${rules.csDelayHours}시간 경과`} />
        <Stat label="게시 중 공지·FAQ" value={data.notices.filter((n) => n.published).length + '건'} />
      </div>

      <Card className="mt-3">
        <Tabs label="고객·CS 구분" value={tab} onChange={(v) => setParams(v === 'customers' ? {} : { tab: v })} items={[
          { v: 'customers', t: '고객', n: data.customers.length }, { v: 'cs', t: '문의·교환', n: open.length }, { v: 'notices', t: '공지·FAQ', n: data.notices.length },
        ]} />

        {tab === 'customers' && (
          <>
            <div className="grid grid-cols-2 gap-2 border-b border-line p-3 md:max-w-md">
              <input className="field" placeholder="이름·이메일 검색" aria-label="이름·이메일 검색" value={q} onChange={(e) => setQ(e.target.value)} />
              <select className="field" aria-label="국가" value={country} onChange={(e) => setCountry(e.target.value)}>
                <option value="">국가 전체</option>
                {Object.entries(COUNTRY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            {masked && <p className="border-b border-line bg-bg/60 px-4 py-2 text-xs text-ink-sub">체험 모드에서는 이름·이메일·연락처가 마스킹되어 보입니다. 관리자 계정에서는 전체가 표시됩니다.</p>}
            <DataTable data={customerRows} columns={customerCols} onRowClick={setCustomer} />
          </>
        )}

        {tab === 'cs' && (
          <>
            <div className="flex flex-wrap gap-1.5 border-b border-line p-3">
              {([['OPEN', `미처리 ${open.length}`], ['DELAYED', `응답 지연 ${delayed.length}`], ['EXCHANGE', '교환 접수'], ['ALL', '전체']] as [CsFilter, string][]).map(([k, t]) => (
                <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
                  className={cx('h-8 rounded-full border px-3 text-xs font-medium', filter === k ? 'border-primary bg-primary-soft text-primary-dark' : 'border-line bg-white text-ink-sub hover:bg-bg')}>{t}</button>
              ))}
            </div>
            <DataTable data={csRows} columns={csCols} onRowClick={(x) => { setInq(x); setAnswer('') }}
              empty="해당하는 접수 건이 없습니다. 자료가 전혀 없다면 관리자 계정의 '시연 자료 초기화'를 실행하세요." />
          </>
        )}

        {tab === 'notices' && (
          <DataTable data={noticeRows} columns={noticeCols} onRowClick={(n) => openNotice(n)}
            empty="공지·FAQ가 없습니다. 자료가 전혀 없다면 관리자 계정의 '시연 자료 초기화'를 실행하세요." />
        )}
      </Card>

      {customer && (
        <Drawer onClose={() => setCustomer(null)} title={name(customer.name)} footer={<Button onClick={() => setCustomer(null)}>닫기</Button>}>
          <div className="space-y-4">
            <div className="rounded-md border border-line px-3">
              <Row k="이메일">{masked ? maskEmail(customer.email) : customer.email}</Row>
              <Row k="연락처"><span className="num">{masked ? maskPhone(customer.phone) : customer.phone}</span></Row>
              <Row k="국가">{COUNTRY_LABEL[customer.country]}</Row>
              <Row k="멤버십">{customer.membership.length ? <span className="flex gap-1">{customer.membership.map((m) => <Badge key={m} tone="primary">{m}</Badge>)}</span> : '없음'}</Row>
              <Row k="가입일"><span className="num">{dateTime(customer.joinedAt)}</span></Row>
              <Row k="누적 결제">{krwShort(customer.krw)} · {num(customer.orders)}건</Row>
            </div>
            <div>
              <p className="label">주문 내역 ({customerOrders.length})</p>
              <div className="overflow-hidden rounded-md border border-line">
                {customerOrders.length === 0 && <p className="px-3 py-4 text-center text-xs text-ink-mute">주문 내역이 없습니다.</p>}
                {customerOrders.slice(0, 12).map((o) => (
                  <div key={o.id} className="flex min-h-11 items-center gap-2 border-b border-line px-3 last:border-0">
                    <span className="min-w-0 flex-1">
                      <span className="num block truncate text-xs font-medium">{o.orderNo}</span>
                      <span className="block truncate text-[11px] text-ink-mute">{o.items.map((it) => it.productName).join(', ')}</span>
                    </span>
                    <span className="num text-xs">{money(o.total, o.currency)}</span>
                    <OrderBadge s={o.orderStatus} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Drawer>
      )}

      {inq && savedInq && (
        <Drawer onClose={() => setInq(null)}
          title={<span className="flex items-center gap-2"><span className="truncate">{savedInq.title}</span><InquiryBadge s={savedInq.status} /></span>}
          footer={<>
            <Button onClick={() => setInq(null)}>닫기</Button>
            {savedInq.status === 'OPEN' && savedInq.type === 'QUESTION' && (
              <Button variant="primary" disabled={busy} onClick={async () => { if (await run(() => actions.answerInquiry(savedInq.id, answer), '답변을 등록했습니다.')) setAnswer('') }}>답변 등록</Button>
            )}
            {savedInq.status === 'OPEN' && savedInq.type === 'EXCHANGE' && <>
              <Button variant="danger" disabled={busy} onClick={async () => { if (await run(() => actions.decideExchange(savedInq.id, false, answer), '교환을 반려했습니다.')) setAnswer('') }}>교환 반려</Button>
              <Button variant="primary" disabled={busy || !!block} onClick={async () => { if (await run(() => actions.decideExchange(savedInq.id, true, answer), '교환을 승인했습니다.')) setAnswer('') }}>교환 승인</Button>
            </>}
          </>}>
          <div className="space-y-4">
            {isCsDelayed(savedInq) && <p className="rounded-md bg-danger-soft px-3 py-2 text-xs text-danger">접수 후 {rules.csDelayHours}시간이 지났습니다. 응답 지연 건입니다.</p>}
            <div className="rounded-md border border-line px-3">
              <Row k="유형">{INQUIRY_TYPE_LABEL[savedInq.type]}{savedInq.exchangeReason && ` · ${EXCHANGE_REASON_LABEL[savedInq.exchangeReason]}`}</Row>
              <Row k="고객">{name(savedInq.customerName)}</Row>
              <Row k="접수 일시"><span className="num">{dateTime(savedInq.createdAt)}</span></Row>
              {inqOrder && <Row k="주문"><span className="num">{inqOrder.orderNo}</span> <OrderBadge s={inqOrder.orderStatus} /></Row>}
              {inqOrder?.deliveredAt && <Row k="배송 완료"><span className="num">{dateTime(inqOrder.deliveredAt)}</span></Row>}
            </div>
            <div>
              <p className="label">접수 내용</p>
              <p className="whitespace-pre-wrap rounded-md bg-bg px-3 py-2.5 text-[13px] leading-relaxed">{savedInq.body}</p>
            </div>
            {inqOrder && savedInq.type === 'EXCHANGE' && (
              <div>
                <p className="label">주문 상품</p>
                <div className="overflow-hidden rounded-md border border-line">
                  {inqOrder.items.map((it) => (
                    <div key={it.skuId} className="flex min-h-10 items-center gap-2 border-b border-line px-3 last:border-0">
                      <span className="min-w-0 flex-1 truncate">{it.productName} <span className="text-xs text-ink-mute">{it.option}</span></span>
                      <span className="num text-xs text-ink-sub">{it.qty}개</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            {block && <p className="rounded-md bg-warning-soft px-3 py-2 text-xs leading-relaxed text-[#7A5410]">{block} 승인은 할 수 없고, 사유를 적어 반려할 수 있습니다.</p>}
            {savedInq.status === 'OPEN' ? (
              <Field label={savedInq.type === 'EXCHANGE' ? '처리 안내 · 반려 사유' : '답변'}>
                <textarea className="field h-28" value={answer} onChange={(e) => setAnswer(e.target.value)} placeholder="고객에게 전달할 내용을 입력합니다." />
              </Field>
            ) : (
              <div>
                <p className="label">처리 내용 · {savedInq.answeredBy} · <span className="num">{dateTime(savedInq.answeredAt)}</span></p>
                <p className="whitespace-pre-wrap rounded-md bg-primary-soft/60 px-3 py-2.5 text-[13px] leading-relaxed">{savedInq.answer}</p>
              </div>
            )}
            <p className="text-[11px] leading-relaxed text-ink-mute">이메일 연동이 없어 답변은 기록만 남습니다. 교환 승인 후 재발송은 재고·물류에서 별도로 처리합니다.</p>
          </div>
        </Drawer>
      )}

      {notice && (
        <Drawer onClose={() => setNotice(null)}
          title={<span className="flex items-center gap-2"><span className="truncate">{noticeNew ? '공지·FAQ 등록' : notice.title.KO}</span>{savedNotice && <Badge tone={savedNotice.published ? 'success' : 'gray'}>{savedNotice.published ? '게시 중' : '미게시'}</Badge>}</span>}
          footer={<>
            <Button onClick={() => setNotice(null)}>닫기</Button>
            {savedNotice && <Button disabled={busy} variant={savedNotice.published ? 'danger' : 'default'} onClick={() => run(() => actions.setNoticePublished(savedNotice.id, !savedNotice.published), savedNotice.published ? '게시를 내렸습니다.' : '게시했습니다.')}>{savedNotice.published ? '게시 내리기' : '게시하기'}</Button>}
            <Button variant="primary" disabled={busy} onClick={async () => { if (await run(() => actions.saveNotice(notice), noticeNew ? '등록했습니다.' : '저장했습니다.')) setNoticeNew(false) }}>{noticeNew ? '등록' : '저장'}</Button>
          </>}>
          <div className="space-y-4">
            <Field label="구분">
              <select className="field" value={notice.kind} onChange={(e) => setNotice({ ...notice, kind: e.target.value as Notice['kind'] })}>
                <option value="NOTICE">공지</option><option value="FAQ">FAQ</option>
              </select>
            </Field>
            <div>
              <div className="mb-2 inline-flex rounded-md border border-line bg-white p-0.5">
                {LANGS.map((l) => (
                  <button key={l} type="button" aria-pressed={lang === l} onClick={() => setLang(l)}
                    className={cx('h-8 rounded px-3 text-[13px] font-medium', lang === l ? 'bg-primary text-white' : 'text-ink-sub hover:bg-bg')}>
                    {LANG_LABEL[l]}{l === 'JA' ? ' (선택)' : ''}
                  </button>
                ))}
              </div>
              <Field label={`제목 · ${LANG_LABEL[lang]}`}><input className="field" value={notice.title[lang] ?? ''} onChange={(e) => setText('title', e.target.value)} /></Field>
              <div className="mt-3"><Field label={`내용 · ${LANG_LABEL[lang]}`}><textarea className="field h-28" value={notice.body[lang] ?? ''} onChange={(e) => setText('body', e.target.value)} /></Field></div>
            </div>
            <div>
              <p className="label">국가별 노출 미리보기</p>
              <div className="overflow-hidden rounded-md border border-line">
                {([['KO', '한국'], ['EN', '미국·글로벌'], ['JA', '일본']] as [Lang, string][]).map(([l, label]) => (
                  <div key={l} className="border-b border-line px-3 py-2 last:border-0">
                    <p className="mb-0.5 flex items-center gap-1.5 text-[11px] text-ink-sub">{label}{l === 'JA' && !(notice.title.JA && notice.body.JA) && <Badge tone="warning">일본어 없음 → 영어 노출</Badge>}</p>
                    <p className="truncate text-[13px] font-medium">{shown(notice.title, l) || <span className="font-normal text-ink-mute">미입력</span>}</p>
                    <p className="truncate text-xs text-ink-sub">{shown(notice.body, l)}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Drawer>
      )}
    </>
  )
}
