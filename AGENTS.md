# 정부지원사업 맞춤형 추천 시스템

## 프로젝트 개요

기업 정보(사업자등록증 기반)를 입력받아 K-Startup, 기업마당에서 크롤링한 정부지원사업 공고 중 해당 기업에 적합한 공고를 추천하고 보고서를 생성하는 시스템.

**핵심 사용자**: 정부지원사업을 찾는 기업 대표자
**핵심 가치**: "내가 신청할 수 있는 지원사업이 뭐야?"를 빠르게 답해주는 것

## 아키텍처 (모노레포 — Vercel 배포)

```
frontend/          — Next.js 16 + Tailwind (App Router, Server Actions)
├── 사업자등록증 OCR (Codex API / Tesseract.js)
├── 기업정보 입력폼
├── 추천 결과 웹 렌더링
└── 보고서 다운로드

api/               — FastAPI 백엔드 (별도 Vercel 프로젝트)
├── app.py         — FastAPI 진입점 (/recommend, /report, /health)
├── crawler/       — K-Startup, 기업마당 크롤러 (requests + BeautifulSoup)
├── matcher/       — 규칙 기반 추천 엔진 (Hard/Soft 필터 + 점수)
├── parser/        — 공고 데이터 파싱 (연령, 업력, 지역 등)
├── report/        — Excel/PDF 보고서 생성 (pandas, reportlab)
├── data/          — 데이터 모델, 캐시, 시드 데이터
└── company/       — 기업 프로필 유틸리티

연동: Frontend Server Action → HTTP fetch → FastAPI 엔드포인트
```

## 사용자 플로우 (구현 목표)

```
[1단계] 사업자등록증 업로드 → Codex API OCR → 폼 자동입력
   추출 필드: 기업명, 대표자명, 소재지, 설립연월일, 업태(→주업종), 종목(→주요산업)
        ↓
[2단계] 나머지 3개만 수동 입력: 대표자 생년월일, 성별, 사업아이템 한줄정리
        ↓
[3단계] 추천 결과 웹에서 바로 조회 (카드 리스트, D-day, 필터/정렬)
        ↓
[4단계] 보고서 다운로드 (Excel/PDF)
```

## 매칭 엔진 규칙

| 규칙 | 유형 | 점수 |
|------|------|------|
| 접수마감일 경과 | **Hard** (제외) | - |
| 대상연령 ↔ 대표자 나이 | **Hard** | +10 |
| 창업업력 ↔ 설립연월일 | **Hard** | +10 |
| 지역 ↔ 소재지 | **Hard** (전국은 통과) | +15/+5 |
| 대상 ↔ 기업유형 | Soft | +10/-5 |
| 성별 (contentText 키워드) | Soft | +5 |
| 제목/내용 ↔ 사업아이템 유사도 | Soft (0~20) | 키워드 오버랩 |

## 크롤링 소스

- **K-Startup**: `https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do`
  - n8n 워크플로우(workflow.json)에서 검증된 CSS 선택자 사용
  - 목록 + 상세 페이지 16개 필드 수집
- **기업마당**: `https://www.bizinfo.go.kr/sii/siia/selectSIIA200View.do`
  - POST/GET 양방향 대응, 상세 크롤링

## 데이터

- `api/data/seed/result.json` — n8n 크롤링 결과 195건 (2026-02-27 기준, 시드 데이터)
- `workflow.json` — n8n 워크플로우 원본 (CSS 선택자 레퍼런스)
- Vercel 환경: /tmp 사용 (stateless), 시드 데이터만 번들에 포함

## 기술 스택

- **Backend**: FastAPI + Python 3.9+ (requests, beautifulsoup4, lxml, pandas, openpyxl, reportlab)
- **Frontend**: Next.js 16, Tailwind CSS, TypeScript
- **OCR**: Codex API (Vision) / Tesseract.js — 사업자등록증 이미지 → 구조화 데이터
- **연동**: Server Action → HTTP fetch → FastAPI
- **배포**: Vercel 모노레포 (frontend/ + api/ 각각 별도 프로젝트)

## 현재 구현 상태

### 완료
- [x] 데이터 모델 (Announcement, CompanyProfile, MatchResult)
- [x] 캐시/스토어 (AnnouncementStore)
- [x] 파서 확장 (연령, 업력, 지역, 접수기간)
- [x] 기업 프로필 관리 (CompanyManager)
- [x] K-Startup 크롤러 재작성 (n8n 선택자 + 상세)
- [x] BizInfo 크롤러 업데이트 (새 URL)
- [x] 매칭 엔진 (7개 규칙, 마감일 필터 포함)
- [x] 보고서 생성 (Excel 4시트 + PDF 카드형)
- [x] 보고서 로깅 (JSONL)
- [x] CLI (argparse)
- [x] 사업자등록증 OCR (Codex API Vision Server Action)
- [x] 스텝형 폼 UI (업로드 → 자동입력 → 보완입력 → 결과)
- [x] 추천 결과 웹 렌더링 (카드, D-day 뱃지, 적합도순/마감임박순, 분야필터)
- [x] Server Action → FastAPI HTTP 연동 (subprocess에서 전환)
- [x] 보고서 다운로드 (Excel/PDF, base64 전송)
- [x] 데이터 최신성 표시

### 미구현 (다음 작업)
- [ ] 실제 ANTHROPIC_API_KEY 설정 후 OCR 테스트
- [ ] 실시간 크롤링 트리거 (웹에서 --refresh 기능)
- [ ] 보고서 이력 조회 페이지
- [ ] 복수 기업 관리 (기업 선택 드롭다운)

## 주의사항

- Python 3.9 환경 — `X | None` 문법 사용 불가, `Optional[X]` 사용
- K-Startup 크롤링시 1초 간격 지켜야 함 (rate limit)
- PDF 한글 폰트: macOS는 AppleSDGothicNeo, Linux는 NanumGothic
- result.json은 시드 데이터로만 사용, 실 운영시 --refresh로 갱신 필요
- frontend/AGENTS.md에 Next.js 16 관련 안내 있음 (params/searchParams는 Promise)
