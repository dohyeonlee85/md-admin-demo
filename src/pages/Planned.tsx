import { Card, PageHeader } from '../components/ui'

const SCOPE: Record<string, string[]> = {
  'Artist & IP': ['아티스트·IP 프로젝트 등록', '상품과 IP 연결 현황'],
  'Product Planning': ['상품 기획안 작성·승인', '기획 일정 관리'],
  'Sales Management': ['판매 회차(1차·2차·재판매) 운영', '국가별 판매 기간 설정'],
  'Customer & CS': ['고객 조회(개인정보 마스킹)', '문의·교환 접수, 공지·FAQ(KO·EN·JA)'],
  'System Settings': ['관리자 계정·권한', '환율·기준값 설정'],
}

export default function Planned({ menu }: { menu: string }) {
  return (
    <>
      <PageHeader title={menu} desc="설계 완료 · 구현 예정" />
      <Card>
        <div className="p-6">
          <p className="mb-3 text-sm font-semibold">이 메뉴는 아직 구현되지 않았습니다.</p>
          <p className="mb-4 leading-relaxed text-ink-sub">
            화면별 상세 기능 명세(설계)는 완료된 상태이며, 이 데모에서는 Dashboard · 상품 관리 · 주문·결제 · 재고·물류 · 분석 5개 메뉴가 실제로 작동합니다.
          </p>
          <p className="label">설계된 주요 기능</p>
          <ul className="list-disc space-y-1 pl-5 text-ink-sub">
            {(SCOPE[menu] ?? []).map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      </Card>
    </>
  )
}
