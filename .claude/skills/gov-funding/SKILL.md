---
name: gov-funding
description: 정부지원사업 맞춤추천 시스템 구현 가이드. 프로젝트 구조, 아키텍처, 구현 상태, 남은 작업을 참조하여 작업한다.
user-invocable: true
argument-hint: [작업내용]
---

# 정부지원사업 맞춤형 추천 시스템

## 프로젝트 목적

기업 정보(사업자등록증 기반)를 입력받아 K-Startup/기업마당 공고 중 해당 기업에 적합한 공고를 추천하고 보고서를 생성한다.

**핵심 사용자**: 정부지원사업을 찾는 기업 대표자
**핵심 가치**: "내가 신청할 수 있는 지원사업이 뭐야?"를 빠르게 답해주는 것

## 사용자 플로우

```
[1단계] 사업자등록증 업로드 → Claude API OCR → 폼 자동입력
   추출: 기업명, 대표자명, 소재지, 설립연월일, 업태→주업종, 종목→주요산업
[2단계] 나머지 3개만 수동 입력: 대표자 생년월일, 성별, 사업아이템 한줄정리
[3단계] 추천 결과 웹에서 바로 조회 (카드 리스트, D-day 뱃지, 필터/정렬)
[4단계] 보고서 다운로드 (Excel/PDF)
```

## 아키텍처

```
frontend/               — Next.js 16 + Tailwind (App Router, Server Actions)
  src/app/
    actions/            — Server Actions (OCR, Python subprocess 호출)
    components/         — React 컴포넌트
    page.tsx            — 메인 페이지

Python 백엔드 (프로젝트 루트, subprocess로 호출)
  crawler/              — K-Startup, 기업마당 크롤러
    kstartup.py         — n8n 워크플로우 검증 CSS 선택자 기반
    bizinfo.py          — 새 URL(selectSIIA200View.do) POST/GET 대응
  matcher/engine.py     — 규칙 기반 추천 (Hard/Soft 필터 + 점수)
  parser/announcement.py — 연령/업력/지역/접수기간 파서
  report/generator.py   — Excel 4시트 + PDF 카드형 보고서
  report/logger.py      — JSONL 보고서 이력
  data/models.py        — Announcement, CompanyProfile, MatchResult dataclass
  data/store.py         — 크롤링 캐시 관리 (result.json 시드 데이터)
  company/manager.py    — 기업 프로필 JSON CRUD
  config/settings.py    — URL, 경로, 딜레이 설정
  main.py               — CLI (argparse)
```

## 매칭 엔진 규칙 (matcher/engine.py)

| 규칙 | 유형 | 점수 |
|------|------|------|
| 접수마감일 경과 | **Hard** (제외) | - |
| 대상연령 ↔ 대표자 나이 | **Hard** | +10 |
| 창업업력 ↔ 설립연월일 | **Hard** | +10 |
| 지역 ↔ 소재지 | **Hard** (전국은 통과) | +15/+5 |
| 대상 ↔ 기업유형 | Soft | +10/-5 |
| 성별 (contentText 키워드) | Soft | +5 |
| 제목/내용 ↔ 사업아이템 유사도 | Soft (0~20) | 키워드 오버랩 |

## 데이터 참조

- `result.json` — n8n 크롤링 결과 195건 (2026-02-27, 시드 데이터)
- `workflow.json` — n8n 워크플로우 원본 (CSS 선택자 레퍼런스)
- 기업 프로필: `data/companies/*.json` (gitignore됨)
- 크롤링 캐시: `data/cache/*.json` (gitignore됨)
- 보고서 이력: `logs/report_history.jsonl` (gitignore됨)

## 크롤링 소스 & CSS 선택자

**K-Startup 목록**: `.middle a[href*='go_view']`, `p.tit`, `.flag:not(.day)`, `.flag.day`, `.flag_agency`
**K-Startup 상세**: `.title h3`, `.dot_list .table_inner p.tit/txt`, `.box .box_inner`, `.board_file li a.file_bg/btn_down`
**페이지네이션**: `fn_egov_link_page(N)` 정규식으로 총 페이지 동적 감지

## 구현 상태

### 완료
- 데이터 모델, 캐시/스토어, 파서 확장(연령/업력/지역/접수기간)
- 기업 프로필 CRUD, K-Startup/BizInfo 크롤러 (목록+상세)
- 매칭 엔진 7개 규칙 (마감일 필터 포함), 보고서 생성 (Excel/PDF), JSONL 로깅
- CLI (argparse)
- 사업자등록증 OCR (Claude API Vision, `actions/ocr.ts`)
- 스텝형 폼 UI (업로드 → 자동입력 → 보완입력 → 결과)
- 추천 결과 웹 렌더링 (카드, D-day 뱃지, 마감임박 하이라이트, 적합도순/마감임박순, 분야필터)
- Server Action → Python subprocess 연동 (`run_match.py`, `run_report.py`)
- 보고서 다운로드 (Excel/PDF, base64 전송)
- 데이터 최신성 표시 (크롤링 날짜)
- 실시간 크롤링 트리거 (`run_match.py --refresh`, 결과 화면에서 버튼 클릭)
- 캐시 나이 표시 + 오래된 데이터 강조 (24시간 기준)
- 크롤링 중 풀스크린 로딩 오버레이 (~2분 안내)

### 미구현 (TODO)
- [ ] 실제 ANTHROPIC_API_KEY 설정 후 OCR 테스트
- [ ] 보고서 이력 조회 페이지
- [ ] 복수 기업 관리 (기업 선택 드롭다운)

## 주의사항

- Python 3.9 — `X | None` 사용 불가, `Optional[X]` 사용
- K-Startup 크롤링 1초 간격 (rate limit)
- PDF 한글폰트: macOS=AppleSDGothicNeo, Linux=NanumGothic
- Next.js 16: params/searchParams는 Promise (await 필요)
- `.env`에 `ANTHROPIC_API_KEY` 필요 (OCR용)

## 작업 지시

`$ARGUMENTS` 내용에 따라 위 컨텍스트를 참조하여 작업한다.
TODO 목록의 항목을 구현할 때는 기존 코드 패턴과 컨벤션을 따른다.
작업 완료시 이 SKILL.md의 구현 상태를 업데이트한다.
