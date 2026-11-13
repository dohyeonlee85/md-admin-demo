import { useMemo, useState } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { useStore } from '../lib/store'
import { dayKey, num } from '../lib/format'
import { IP_STATUS_LABEL, IP_TYPE_LABEL, type IpProject, type IpStatus, type IpType } from '../lib/types'
import { Button, Card, DataTable, Drawer, Field, PageHeader, Stat, useRun } from '../components/ui'
import { IpBadge, ProductBadge } from '../components/status'

const blank = (artistId: string): IpProject => ({
  id: 'ip' + Date.now().toString(36), artistId, name: '', type: 'ALBUM', status: 'PLANNED',
  startDate: dayKey(Date.now()), memo: '', createdAt: Date.now(), updatedAt: Date.now(),
})

export default function Artists() {
  const { data, actions } = useStore()
  const { run, busy } = useRun()
  const [artist, setArtist] = useState('')
  const [status, setStatus] = useState('')
  const [draft, setDraft] = useState<IpProject | null>(null)
  const [isNew, setIsNew] = useState(false)
  const [toLink, setToLink] = useState('')

  const artistName = (id: string) => data.artists.find((a) => a.id === id)?.name ?? id
  const linked = useMemo(() => {
    const m = new Map<string, number>()
    data.products.forEach((p) => p.ipId && m.set(p.ipId, (m.get(p.ipId) ?? 0) + 1))
    return m
  }, [data.products])
  const rows = useMemo(() => data.ipProjects
    .filter((p) => (!artist || p.artistId === artist) && (!status || p.status === status))
    .sort((a, b) => b.startDate.localeCompare(a.startDate)), [data.ipProjects, artist, status])
  const unlinked = data.products.filter((p) => !p.ipId && p.status !== 'ARCHIVED')

  const columns = useMemo<ColumnDef<IpProject, any>[]>(() => [
    { header: '프로젝트', accessorKey: 'name', cell: (c) => <span className="font-medium">{c.getValue()}</span> },
    { header: '아티스트', accessorFn: (p) => artistName(p.artistId) },
    { header: '유형', accessorFn: (p) => IP_TYPE_LABEL[p.type] },
    { header: '기간', accessorFn: (p) => p.startDate, cell: (c) => <span className="num">{c.row.original.startDate} ~ {c.row.original.endDate ?? '상시'}</span> },
    { header: '연결 상품', accessorFn: (p) => linked.get(p.id) ?? 0, cell: (c) => num(c.getValue()) + '개', meta: { right: true } },
    { header: '상태', accessorKey: 'status', cell: (c) => <IpBadge s={c.getValue()} /> },
  // eslint-disable-next-line react-hooks/exhaustive-deps
  ], [data.artists, linked])

  const set = <K extends keyof IpProject>(k: K, v: IpProject[K]) => setDraft((d) => (d ? { ...d, [k]: v } : d))
  const products = draft ? data.products.filter((p) => p.ipId === draft.id) : []
  const candidates = draft ? data.products.filter((p) => !p.ipId && p.artistId === draft.artistId) : []
  const save = async () => {
    if (!draft) return
    const clean = { ...draft }
    if (!clean.endDate) delete clean.endDate
    if (await run(() => actions.saveIp(clean), isNew ? 'IP 프로젝트를 등록했습니다.' : '저장했습니다.')) setIsNew(false)
  }

  return (
    <>
      <PageHeader title="Artist & IP" desc="앨범 활동·투어 같은 IP 프로젝트 단위로 상품을 묶어 관리합니다."
        action={<Button variant="primary" onClick={() => { setDraft(blank(data.artists[0]?.id ?? 'ateez')); setIsNew(true) }}>+ IP 프로젝트 등록</Button>} />

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {data.artists.map((a) => {
          const ips = data.ipProjects.filter((p) => p.artistId === a.id)
          return <Stat key={a.id} label={a.name} value={`${ips.filter((p) => p.status === 'ACTIVE').length}건 진행`}
            sub={`IP ${ips.length}건 · 상품 ${data.products.filter((p) => p.artistId === a.id).length}개`} />
        })}
        <Stat label="IP 미연결 상품" value={num(unlinked.length) + '개'} sub="보관 상품 제외" />
        <Stat label="준비 중 프로젝트" value={num(data.ipProjects.filter((p) => p.status === 'PLANNED').length) + '건'} sub="일정 확정 전" />
      </div>

      <Card className="mt-3">
        <div className="grid grid-cols-2 gap-2 border-b border-line p-3 md:max-w-md">
          <select className="field" aria-label="아티스트" value={artist} onChange={(e) => setArtist(e.target.value)}>
            <option value="">아티스트 전체</option>
            {data.artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select className="field" aria-label="상태" value={status} onChange={(e) => setStatus(e.target.value)}>
            <option value="">상태 전체</option>
            {Object.entries(IP_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </div>
        <DataTable data={rows} columns={columns} onRowClick={(p) => { setDraft({ ...p }); setIsNew(false); setToLink('') }}
          empty="IP 프로젝트가 없습니다. 관리자라면 상단의 '시연 자료 초기화'로 자료를 넣을 수 있습니다." />
      </Card>

      {unlinked.length > 0 && (
        <Card title="IP 미연결 상품" className="mt-3">
          <ul>
            {unlinked.map((p) => (
              <li key={p.id} className="flex h-10 items-center gap-3 border-b border-line px-4 last:border-0">
                <span className="min-w-0 flex-1 truncate">{p.name}</span>
                <span className="text-xs text-ink-sub">{artistName(p.artistId)}</span>
                <ProductBadge s={p.status} />
              </li>
            ))}
          </ul>
        </Card>
      )}

      {draft && (
        <Drawer onClose={() => setDraft(null)} title={isNew ? 'IP 프로젝트 등록' : draft.name}
          footer={<><Button onClick={() => setDraft(null)}>닫기</Button><Button variant="primary" disabled={busy} onClick={save}>{isNew ? '등록' : '저장'}</Button></>}>
          <div className="space-y-4">
            <Field label="프로젝트명"><input className="field" value={draft.name} onChange={(e) => set('name', e.target.value)} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="아티스트" hint={!isNew && products.length ? '연결 상품이 있어 변경할 수 없습니다.' : undefined}>
                <select className="field" disabled={!isNew && products.length > 0} value={draft.artistId} onChange={(e) => set('artistId', e.target.value)}>
                  {data.artists.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
              </Field>
              <Field label="유형">
                <select className="field" value={draft.type} onChange={(e) => set('type', e.target.value as IpType)}>
                  {Object.entries(IP_TYPE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
              <Field label="시작일"><input className="field num" type="date" value={draft.startDate} onChange={(e) => set('startDate', e.target.value)} /></Field>
              <Field label="종료일" hint="비우면 상시"><input className="field num" type="date" value={draft.endDate ?? ''} onChange={(e) => set('endDate', e.target.value)} /></Field>
              <Field label="상태">
                <select className="field" value={draft.status} onChange={(e) => set('status', e.target.value as IpStatus)}>
                  {Object.entries(IP_STATUS_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </Field>
            </div>
            <Field label="메모"><textarea className="field h-20 py-2" value={draft.memo} onChange={(e) => set('memo', e.target.value)} /></Field>

            {!isNew && (
              <div>
                <p className="label">연결 상품 ({products.length})</p>
                <div className="overflow-hidden rounded-md border border-line">
                  {products.length === 0 && <p className="px-3 py-4 text-center text-xs text-ink-mute">연결된 상품이 없습니다.</p>}
                  {products.map((p) => (
                    <div key={p.id} className="flex min-h-10 items-center gap-2 border-b border-line px-3 last:border-0">
                      <span className="min-w-0 flex-1 truncate">{p.name}</span>
                      <ProductBadge s={p.status} />
                      <Button variant="ghost" className="h-8 px-2" disabled={busy} onClick={() => run(() => actions.linkProductIp(p.id, ''), '연결을 해제했습니다.')}>해제</Button>
                    </div>
                  ))}
                </div>
                <div className="mt-2 flex gap-2">
                  <select className="field" aria-label="연결할 상품" value={toLink} onChange={(e) => setToLink(e.target.value)}>
                    <option value="">같은 아티스트의 미연결 상품 선택</option>
                    {candidates.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                  <Button disabled={busy || !toLink} onClick={async () => { if (await run(() => actions.linkProductIp(toLink, draft.id), '상품을 연결했습니다.')) setToLink('') }}>연결</Button>
                </div>
              </div>
            )}
          </div>
        </Drawer>
      )}
    </>
  )
}
