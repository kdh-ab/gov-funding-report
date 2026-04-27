from __future__ import annotations

import base64
import json
import os
from typing import Optional

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from company.manager import CompanyManager
from crawler import KStartupCrawler, BizinfoCrawler
from data.models import CompanyProfile
from data.store import AnnouncementStore
from matcher.engine import RecommendationEngine
from report.generator import ReportGenerator
from report.logger import ReportLogger

from contextlib import asynccontextmanager
from data.database import init_db, seed_announcements_if_empty


@asynccontextmanager
async def lifespan(app):
    # Startup: DB 테이블 생성 + 시드 데이터 삽입
    init_db()
    seed_announcements_if_empty()
    yield


app = FastAPI(title="정부지원사업 맞춤 추천 API", lifespan=lifespan)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        os.environ.get("FRONTEND_URL", ""),
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ── Pydantic 스키마 ──────────────────────────────────────────────

class CompanyData(BaseModel):
    company_name: str
    ceo_name: str = ""
    ceo_birth_date: str = ""
    ceo_gender: str = ""
    address: str = ""
    region: str = ""
    established_date: str = ""
    main_industry: str = ""
    main_sector: str = ""
    business_item_summary: str = ""


class RecommendRequest(BaseModel):
    company: CompanyData
    refresh: bool = False


class ReportRequest(BaseModel):
    company: CompanyData
    format: str = "xlsx"


# ── 헬퍼 ─────────────────────────────────────────────────────────

def _build_profile(data: CompanyData) -> CompanyProfile:
    """Pydantic 모델 → CompanyProfile dataclass."""
    d = data.model_dump()
    if not d.get("region") and d.get("address"):
        d["region"] = CompanyManager.extract_region(d["address"])
    return CompanyProfile.from_dict(d)


def _crawl_fresh(store: AnnouncementStore, max_pages: int = 5) -> list:
    """K-Startup + BizInfo 실시간 크롤링."""
    all_items = []

    try:
        kstartup = KStartupCrawler()
        k_items = kstartup.crawl(max_pages=max_pages)
        all_items.extend(k_items)
        if k_items:
            store.save(k_items, "K-Startup")
    except Exception:
        pass

    try:
        bizinfo = BizinfoCrawler()
        b_items = bizinfo.crawl(max_pages=max_pages)
        all_items.extend(b_items)
        if b_items:
            store.save(b_items, "BIZINFO")
    except Exception:
        pass

    return all_items


def _run_matching(profile: CompanyProfile, refresh: bool = False):
    """매칭 실행 → 결과 dict 반환."""
    store = AnnouncementStore()

    if refresh:
        announcements = _crawl_fresh(store)
        if not announcements:
            announcements = store.get_all(use_seed=True)
    else:
        announcements = store.get_all(use_seed=True)

    if not announcements:
        return {"error": "공고 데이터가 없습니다."}

    engine = RecommendationEngine(profile)
    matches = engine.recommend(announcements)

    crawled_at = ""
    for a in announcements:
        if a.crawledAt:
            crawled_at = a.crawledAt
            break

    return {
        "company": profile.to_dict(),
        "total_announcements": len(announcements),
        "recommended_count": len(matches),
        "crawled_at": crawled_at,
        "cache_info": store.get_cache_info(),
        "matches": [
            {
                "rank": i + 1,
                "score": m.score,
                "level": m.level,
                "match_reasons": m.match_reasons,
                "competition_level": m.competition_level,
                "competition_reasons": m.competition_reasons,
                "announcement": m.announcement.to_dict(),
            }
            for i, m in enumerate(matches)
        ],
    }


# ── 엔드포인트 ───────────────────────────────────────────────────

@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/recommend")
def recommend(req: RecommendRequest):
    profile = _build_profile(req.company)
    return _run_matching(profile, refresh=req.refresh)


@app.post("/recommend/stream")
def recommend_stream(req: RecommendRequest):
    """SSE 스트리밍으로 진행 상황을 전달하며 매칭 실행."""
    profile = _build_profile(req.company)

    def generate():
        store = AnnouncementStore()

        if req.refresh:
            yield _sse({"type": "progress", "step": "start", "message": "최신 공고 데이터를 수집합니다..."})

            all_items = []
            try:
                yield _sse({"type": "progress", "step": "kstartup", "message": "K-Startup 공고를 수집하고 있습니다..."})
                kstartup = KStartupCrawler()
                k_items = kstartup.crawl(max_pages=5)
                all_items.extend(k_items)
                if k_items:
                    store.save(k_items, "K-Startup")
                yield _sse({"type": "progress", "step": "kstartup_done", "message": f"K-Startup에서 {len(k_items)}건 수집 완료"})
            except Exception as e:
                yield _sse({"type": "progress", "step": "kstartup_error", "message": f"K-Startup 수집 중 오류: {e}"})

            try:
                yield _sse({"type": "progress", "step": "bizinfo", "message": "기업마당 공고를 수집하고 있습니다..."})
                bizinfo = BizinfoCrawler()
                b_items = bizinfo.crawl(max_pages=5)
                all_items.extend(b_items)
                if b_items:
                    store.save(b_items, "BIZINFO")
                yield _sse({"type": "progress", "step": "bizinfo_done", "message": f"기업마당에서 {len(b_items)}건 수집 완료"})
            except Exception as e:
                yield _sse({"type": "progress", "step": "bizinfo_error", "message": f"기업마당 수집 중 오류: {e}"})

            announcements = all_items
            if not announcements:
                yield _sse({"type": "progress", "step": "fallback", "message": "크롤링 결과가 없어 캐시 데이터를 사용합니다"})
                announcements = store.get_all(use_seed=True)
        else:
            announcements = store.get_all(use_seed=True)

        if not announcements:
            yield _sse({"type": "error", "message": "공고 데이터가 없습니다."})
            return

        yield _sse({"type": "progress", "step": "matching", "message": f"{len(announcements)}건의 공고를 분석하고 있습니다..."})
        engine = RecommendationEngine(profile)
        matches = engine.recommend(announcements)
        yield _sse({"type": "progress", "step": "done", "message": f"분석 완료! {len(matches)}건의 맞춤 공고를 찾았습니다"})

        crawled_at = ""
        for a in announcements:
            if a.crawledAt:
                crawled_at = a.crawledAt
                break

        result = {
            "company": profile.to_dict(),
            "total_announcements": len(announcements),
            "recommended_count": len(matches),
            "crawled_at": crawled_at,
            "cache_info": store.get_cache_info(),
            "matches": [
                {
                    "rank": i + 1,
                    "score": m.score,
                    "level": m.level,
                    "match_reasons": m.match_reasons,
                    "competition_level": m.competition_level,
                    "competition_reasons": m.competition_reasons,
                    "announcement": m.announcement.to_dict(),
                }
                for i, m in enumerate(matches)
            ],
        }
        yield _sse({"type": "result", "data": result})

    return StreamingResponse(generate(), media_type="text/event-stream")


@app.post("/report")
def report(req: ReportRequest):
    """보고서 생성 → base64로 반환."""
    profile = _build_profile(req.company)
    store = AnnouncementStore()
    announcements = store.get_all(use_seed=True)

    if not announcements:
        return {"error": "공고 데이터가 없습니다."}

    engine = RecommendationEngine(profile)
    matches = engine.recommend(announcements)

    gen = ReportGenerator()
    fmt = req.format if req.format in ("xlsx", "pdf") else "xlsx"
    filepath = gen.generate_recommendation(matches, profile, announcements, fmt=fmt)

    with open(filepath, "rb") as f:
        content = f.read()

    try:
        os.unlink(filepath)
    except OSError:
        pass

    mime_type = (
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        if fmt == "xlsx"
        else "application/pdf"
    )

    return {
        "base64": base64.b64encode(content).decode(),
        "filename": os.path.basename(filepath),
        "mime_type": mime_type,
    }


# ── SSE 유틸 ─────────────────────────────────────────────────────

def _sse(data: dict) -> str:
    return f"data: {json.dumps(data, ensure_ascii=False)}\n\n"
