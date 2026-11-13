# MD SHOP ADMIN · 데모

ATEEZ · xikers 공식 MD SHOP 관리자 시스템의 포트폴리오용 데모입니다.
모든 자료는 테스트 데이터이며 실제 회사 운영 자료가 아닙니다.

## 구현 범위

| 메뉴 | 상태 |
|---|---|
| Dashboard, Product Management, Order & Payment, Inventory & Logistics, Analytics | 작동 |
| Artist & IP, Product Planning, Sales Management, Customer & CS, System Settings | 설계 완료 · 구현 예정 |

제외: 결제 대행사(PG)·택배사·이메일 연동, 엑셀 업로드.

## 기술 구성

| 구분 | 사용 기술 | 역할 |
|---|---|---|
| 화면 | React + Vite + TypeScript + Tailwind CSS | 관리자 화면 |
| 표 · 차트 | TanStack Table, Recharts | 목록 정렬·페이지, 매출 차트 |
| 데이터 · 로그인 | Firebase Firestore, Firebase Auth | 자료 저장, 계정 확인 |
| 호스팅 | Cloudflare | 공개 주소 제공 |

## 계정 2종

| 계정 | 저장 | 개인정보 |
|---|---|---|
| 체험 (로그인 없이 체험하기) | 화면에만 반영, 새로고침 시 초기화 | 마스킹 |
| 관리자 (이메일 로그인) | Firebase DB에 실제 저장 | 전체 표시 |

- 체험 계정은 DB 쓰기가 보안 규칙으로 차단되어 있어 누가 눌러도 원본 자료가 바뀌지 않습니다.
- Firebase가 연결된 상태에서 "로그인 없이 체험하기"를 누르면 `.env` 의 체험 계정으로 자동 로그인되어 DB 자료를 읽기 전용으로 보여 줍니다.

## 핵심 업무 규칙 (코드 위치: `src/lib/actions.ts`, `src/lib/metrics.ts`, `src/lib/analytics.ts`)

- 재고: 주문 시 할당, 출고 시 차감. 가용 재고 = 보유 − 할당. 부족 기준 기본 100개.
- 재고 변경은 수량과 이력을 한 묶음(트랜잭션)으로 저장. 이력은 수정 불가.
- 할당 수량보다 적게 재고를 줄일 수 없음.
- 주문 상태와 결제 상태 분리. 주문 당시 상품명·가격·환율을 주문에 보존.
- 결제 대기 24시간 경과 주문은 취소 대상. 배송 지연 기준 국내 5일 · 해외 14일.
- 판매 시작은 3개 국가(KRW·USD·JPY) 가격이 모두 입력되어야 가능.
- 순매출 = 결제 − 환불. 환불은 환불일에 차감. 원화 환산은 결제 시점 환율 고정. 날짜는 한국 시간.
- 분석(Analytics): 기간(7·30·90일)·아티스트·국가별 순매출, 주문, 판매 수량, 객단가, 환불률, 분류·국가·상품별 실적. 아티스트 필터는 주문 안의 상품 단위로 분리 계산.
- ALBUM 지표: 발매일부터 7일간 판매 수량(환불 제외), 버전별 수량. 7일 경과 전에는 '집계 중' 표시.

## 폴더 구조

```
src/lib/types.ts      자료 형식 정의
src/lib/seed.ts       시연용 자료 생성
src/lib/backend.ts    저장소 2종 (메모리 / Firestore)
src/lib/actions.ts    업무 규칙
src/lib/metrics.ts    매출·재고 집계
src/lib/analytics.ts  분석 화면 집계
src/lib/store.tsx     로그인 상태와 자료 연결
src/pages/            화면 (Dashboard, Products, Orders, Inventory, Analytics)
firestore.rules       DB 보안 규칙
public/_redirects     새로고침 시 화면 주소 유지 (Cloudflare용)
```

---

# 따라 하기 (Windows PowerShell 기준)

전체 순서: **0. 준비 → 1. 내 PC 실행 → 2. Firebase 연결 → 3. GitHub 업로드 → 4. Cloudflare 배포**

명령어는 PowerShell 창에 한 줄씩 붙여 넣고 Enter를 누릅니다.

## 0. 준비물

| 항목 | 확인 명령 | 없을 때 |
|---|---|---|
| Node.js (LTS, 18 이상) | `node -v` | nodejs.org 에서 LTS 설치 |
| Git | `git --version` | git-scm.com 에서 설치 |
| GitHub 저장소 | — | `md-admin-demo` (생성 완료) |
| Firebase 프로젝트 | — | `md-admin-demo-292bb` (생성 완료) |

## 1. 내 PC에서 실행

### 1-1. 처음 한 번만: PowerShell 실행 정책 변경

`npm install` 시 "이 시스템에서 스크립트를 실행할 수 없으므로…" 오류가 나면 일반 PowerShell(관리자 아님)에서 실행합니다.

```
Set-ExecutionPolicy -Scope CurrentUser -ExecutionPolicy RemoteSigned
```

"Y" 입력 후 Enter. 현재 사용자 계정에만 적용되며 다른 프로그램에는 영향이 없습니다.

### 1-2. 설치와 실행

```
cd C:\Users\이도현\md-admin-demo\md-admin-demo
npm install
npm run dev
```

- 폴더 경로는 `package.json` 파일이 들어 있는 폴더로 맞춥니다.
- `npm install` 은 처음 한 번, 또는 `package.json` 이 바뀌었을 때만 실행합니다.
- 브라우저에서 `http://localhost:5173/` 접속.
- `.env` 파일이 없으면 Firebase 없이 **로컬 데모 모드**로 실행됩니다. "로그인 없이 체험하기"로 모든 화면 확인 가능.
- 실행 중에는 PowerShell 창을 닫지 않습니다. 끌 때는 `Ctrl + C`.

## 2. Firebase 연결

console.firebase.google.com → `md-admin-demo-292bb` 프로젝트 선택 후 진행합니다.

### 2-1. Firestore(DB) 만들기
- 왼쪽 메뉴 **빌드 → Firestore Database → 데이터베이스 만들기**
- 위치 **asia-northeast3 (서울)**, 시작 모드 **프로덕션 모드**
- 위치는 나중에 바꿀 수 없으므로 반드시 서울 선택.

### 2-2. 로그인 기능 켜기
- **빌드 → Authentication → 시작하기**
- **로그인 방법 → 이메일/비밀번호 → 사용 설정 → 저장**

### 2-3. 계정 2개 만들기
- Authentication → **사용자** 탭 → **사용자 추가**

| 계정 | 이메일 | 용도 |
|---|---|---|
| 관리자 | 본인 이메일 | 면접 시연, DB 저장 |
| 체험 | 별도 이메일 (예: demo 계정) | 채용담당자 체험, 읽기 전용 |

### 2-4. 웹 앱 설정값 복사
- 프로젝트 설정(톱니바퀴) → **일반 → 내 앱 → 웹(`</>`) 아이콘 → 앱 등록**
- 표시되는 `apiKey`, `appId` 값을 메모장에 복사.
- 이 값은 공개되어도 괜찮습니다. 실제 보안은 계정과 보안 규칙이 담당합니다.

### 2-5. 보안 규칙 적용과 `.env` 파일 만들기

**보안 규칙**
1. 프로젝트 폴더의 `firestore.rules` 를 메모장으로 열어 `ADMIN_EMAIL_HERE` 를 관리자 이메일(소문자)로 바꿈.
2. 전체 내용을 복사해 Firestore → **규칙** 탭에 붙여 넣고 **게시**.

**`.env` 파일**
```
Copy-Item .env.example .env
notepad .env
```

| 항목 | 넣을 값 |
|---|---|
| `VITE_FIREBASE_API_KEY` | 2-4 의 apiKey |
| `VITE_FIREBASE_AUTH_DOMAIN` | 미리 입력됨 (`md-admin-demo-292bb.firebaseapp.com`) |
| `VITE_FIREBASE_PROJECT_ID` | 미리 입력됨 (`md-admin-demo-292bb`) |
| `VITE_FIREBASE_APP_ID` | 2-4 의 appId |
| `VITE_ADMIN_EMAIL` | 관리자 이메일 (규칙과 동일) |
| `VITE_DEMO_EMAIL` | 체험 계정 이메일 |
| `VITE_DEMO_PASSWORD` | 체험 계정 비밀번호 |

- 값은 `=` 뒤에 따옴표·공백 없이 입력.
- 저장 후 PowerShell에서 `Ctrl + C` → `npm run dev` 다시 실행 (`.env` 는 시작할 때만 읽힘).

### 2-6. 시연 자료 넣기
- 관리자 계정으로 로그인 → 상단 **"시연 자료 초기화"** → 초기화 실행.
- 이후 체험 계정에서도 같은 자료가 보이면 연결 완료.

## 3. GitHub 업로드

`.env` 파일은 `.gitignore` 에 등록되어 있어 자동으로 제외됩니다.

```
cd C:\Users\이도현\md-admin-demo\md-admin-demo
git add .
git commit -m "admin demo"
git push
```

- `git status` 로 올라갈 파일 목록을 미리 확인할 수 있습니다. 목록에 `.env` 가 보이면 멈추고 `.gitignore` 를 확인합니다.
- 업로드 확인: github.com/dohyeonlee85/md-admin-demo 에 `src` 폴더와 `package.json` 이 보이면 성공.

## 4. Cloudflare 배포 (검증 전)

> 아래 절차는 아직 실제 배포로 확인하지 않았습니다. 화면 이름은 Cloudflare 업데이트에 따라 다를 수 있습니다.

1. Cloudflare 대시보드 → **Workers & Pages → Create → Pages → Connect to Git** → GitHub 연결 → `md-admin-demo` 선택.
2. 빌드 설정

| 항목 | 값 |
|---|---|
| Framework preset | `Vite` (없으면 None) |
| Build command | `npm run build` |
| Build output directory | `dist` |
| Root directory | 비워 둠 (`package.json` 이 저장소 맨 위에 있을 때) |

3. **Environment variables** 에 `.env` 의 `VITE_` 값 7개를 이름·값 그대로 등록.
   - 빌드할 때 값이 화면 코드에 들어가므로 **첫 배포 전에** 등록합니다.
   - 빌드 오류 시 `NODE_VERSION` = `20` 을 추가로 등록.
4. **Save and Deploy** → 완료 후 발급된 `https://○○○.pages.dev` 주소가 포트폴리오 링크.
5. 이후 `git push` 할 때마다 자동으로 다시 배포됩니다.
6. 환경 변수를 바꾼 뒤에는 **Deployments → 최근 배포 → Retry deployment** 로 다시 배포해야 반영됩니다.

## 5. 막히기 쉬운 지점

| 증상 | 원인 · 해결 |
|---|---|
| `npm : 이 시스템에서 스크립트를 실행할 수 없으므로…` | 1-1 실행 정책 변경 |
| `npm install` 시 `package.json` 없음 오류 | `cd` 경로가 틀림. `package.json` 이 있는 폴더로 이동 |
| `.env` 를 만들었는데 로컬 데모 모드 그대로 | 파일 이름이 `.env.txt` 로 저장됨 → 파일 탐색기 "보기 → 파일 확장명" 켜고 이름 확인. 또는 서버 재시작 안 함 |
| 로그인 후 "권한 없음" | 규칙의 관리자 이메일과 `VITE_ADMIN_EMAIL` 오타 · 대소문자 확인, 규칙 **게시** 여부 확인 |
| 체험하기 클릭 시 로그인 실패 | 체험 계정 이메일·비밀번호 오타, Authentication 사용자 목록에 있는지 확인 |
| 배포 주소에서 로그인 실패 (검증 전) | Authentication → 설정 → **승인된 도메인**에 `○○○.pages.dev` 추가 |
| 배포 주소에서 새로고침 시 404 | `public/_redirects` 파일이 저장소에 올라갔는지 확인 |
| `git push` 시 이름·이메일 설정 요구 | 표시된 `git config` 명령 2줄에 본인 이름·이메일 입력 후 다시 실행 |
