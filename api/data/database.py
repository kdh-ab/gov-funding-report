from __future__ import annotations
"""Vercel Postgres (Neon) 연동 모듈.

DATABASE_URL 또는 POSTGRES_URL 환경변수가 설정되어 있으면 DB를 사용하고,
없으면 기존 파일 기반 동작으로 fallback한다.
"""

import json
import os
from datetime import datetime
from typing import Optional

def _get_database_url() -> Optional[str]:
    return os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")


def is_db_available() -> bool:
    return _get_database_url() is not None


def get_conn():
    """psycopg2 커넥션을 반환한다."""
    import psycopg2
    return psycopg2.connect(_get_database_url(), connect_timeout=10)


def init_db():
    """테이블이 없으면 생성한다. 앱 startup에서 호출."""
    if not is_db_available():
        return

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS announcements (
                    id SERIAL PRIMARY KEY,
                    pbanc_sn TEXT NOT NULL DEFAULT '',
                    source TEXT NOT NULL DEFAULT '',
                    title TEXT NOT NULL DEFAULT '',
                    support_field TEXT DEFAULT '',
                    target_age TEXT DEFAULT '',
                    org_type TEXT DEFAULT '',
                    department TEXT DEFAULT '',
                    region TEXT DEFAULT '',
                    reception_period TEXT DEFAULT '',
                    supervision_org TEXT DEFAULT '',
                    target TEXT DEFAULT '',
                    biz_experience TEXT DEFAULT '',
                    contact TEXT DEFAULT '',
                    content_text TEXT DEFAULT '',
                    attachments JSONB DEFAULT '[]',
                    detail_url TEXT DEFAULT '',
                    crawled_at TIMESTAMPTZ DEFAULT NOW(),
                    view_count INT DEFAULT 0,
                    collected_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
            # 중복 방지 인덱스 (pbanc_sn이 비어있지 않은 경우)
            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_pbanc_sn_source
                ON announcements (pbanc_sn, source)
                WHERE pbanc_sn != ''
            """)
            # title + supervision_org 중복 방지 (pbanc_sn이 없는 경우)
            cur.execute("""
                CREATE UNIQUE INDEX IF NOT EXISTS idx_announcements_title_org
                ON announcements (title, supervision_org)
                WHERE pbanc_sn = ''
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS companies (
                    id SERIAL PRIMARY KEY,
                    company_name TEXT NOT NULL UNIQUE,
                    ceo_name TEXT DEFAULT '',
                    ceo_birth_date TEXT DEFAULT '',
                    ceo_gender TEXT DEFAULT '',
                    address TEXT DEFAULT '',
                    region TEXT DEFAULT '',
                    established_date TEXT DEFAULT '',
                    main_industry TEXT DEFAULT '',
                    main_sector TEXT DEFAULT '',
                    business_item_summary TEXT DEFAULT '',
                    created_at TIMESTAMPTZ DEFAULT NOW(),
                    updated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)

            cur.execute("""
                CREATE TABLE IF NOT EXISTS report_logs (
                    id SERIAL PRIMARY KEY,
                    company_name TEXT NOT NULL,
                    total_announcements INT DEFAULT 0,
                    recommended_count INT DEFAULT 0,
                    top_match_title TEXT DEFAULT '',
                    top_match_score FLOAT DEFAULT 0,
                    report_format TEXT DEFAULT '',
                    crawl_source TEXT DEFAULT 'cache',
                    crawl_date TEXT DEFAULT '',
                    generated_at TIMESTAMPTZ DEFAULT NOW()
                )
            """)
        conn.commit()
    finally:
        conn.close()


def seed_announcements_if_empty():
    """announcements 테이블이 비어있으면 시드 데이터를 INSERT한다."""
    if not is_db_available():
        return

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM announcements")
            count = cur.fetchone()[0]
            if count > 0:
                return

        from config.settings import SEED_DATA_PATH
        if not os.path.exists(SEED_DATA_PATH):
            return

        with open(SEED_DATA_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)

        items = data.get("items", [])
        if not items:
            return

        source = data.get("source", "")
        crawled_at = data.get("crawledAt", datetime.now().isoformat())

        with conn.cursor() as cur:
            for item in items:
                item_source = item.get("source", "")
                if not item_source and source:
                    if "k-startup" in source.lower():
                        item_source = "K-Startup"
                    elif "bizinfo" in source.lower():
                        item_source = "BIZINFO"

                cur.execute("""
                    INSERT INTO announcements (
                        pbanc_sn, source, title, support_field, target_age,
                        org_type, department, region, reception_period,
                        supervision_org, target, biz_experience, contact,
                        content_text, attachments, detail_url, crawled_at, view_count
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT DO NOTHING
                """, (
                    item.get("pbancSn", ""),
                    item_source,
                    item.get("title", ""),
                    item.get("supportField", ""),
                    item.get("targetAge", ""),
                    item.get("orgType", ""),
                    item.get("department", ""),
                    item.get("region", ""),
                    item.get("receptionPeriod", ""),
                    item.get("supervisionOrg", ""),
                    item.get("target", ""),
                    item.get("bizExperience", ""),
                    item.get("contact", ""),
                    item.get("contentText", ""),
                    json.dumps(item.get("attachments", []), ensure_ascii=False),
                    item.get("detailUrl", ""),
                    item.get("crawledAt", "") or crawled_at,
                    item.get("viewCount", 0),
                ))
        conn.commit()
    finally:
        conn.close()


# ── Announcements CRUD ───────────────────────────────────────────

def upsert_announcements(announcements) -> int:
    """공고 목록을 DB에 upsert한다. 삽입된 건수를 반환."""
    if not is_db_available():
        return 0

    conn = get_conn()
    inserted = 0
    try:
        with conn.cursor() as cur:
            for a in announcements:
                d = a.to_dict() if hasattr(a, "to_dict") else a
                crawled_at = d.get("crawledAt", "") or None
                if crawled_at == "":
                    crawled_at = datetime.now().isoformat()
                cur.execute("""
                    INSERT INTO announcements (
                        pbanc_sn, source, title, support_field, target_age,
                        org_type, department, region, reception_period,
                        supervision_org, target, biz_experience, contact,
                        content_text, attachments, detail_url, crawled_at, view_count
                    ) VALUES (
                        %s, %s, %s, %s, %s, %s, %s, %s, %s, %s,
                        %s, %s, %s, %s, %s, %s, %s, %s
                    )
                    ON CONFLICT DO NOTHING
                """, (
                    d.get("pbancSn", ""),
                    d.get("source", ""),
                    d.get("title", ""),
                    d.get("supportField", ""),
                    d.get("targetAge", ""),
                    d.get("orgType", ""),
                    d.get("department", ""),
                    d.get("region", ""),
                    d.get("receptionPeriod", ""),
                    d.get("supervisionOrg", ""),
                    d.get("target", ""),
                    d.get("bizExperience", ""),
                    d.get("contact", ""),
                    d.get("contentText", ""),
                    json.dumps(d.get("attachments", []), ensure_ascii=False),
                    d.get("detailUrl", ""),
                    crawled_at,
                    d.get("viewCount", 0),
                ))
                inserted += cur.rowcount
        conn.commit()
    finally:
        conn.close()
    return inserted


def get_announcements(source: Optional[str] = None):
    """DB에서 공고 목록을 조회한다. → list[Announcement]"""
    if not is_db_available():
        return []

    from data.models import Announcement

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if source:
                cur.execute(
                    "SELECT * FROM announcements WHERE source = %s ORDER BY crawled_at DESC",
                    (source,),
                )
            else:
                cur.execute("SELECT * FROM announcements ORDER BY crawled_at DESC")
            rows = cur.fetchall()
            cols = [desc[0] for desc in cur.description]
    finally:
        conn.close()

    results = []
    for row in rows:
        r = dict(zip(cols, row))
        results.append(Announcement(
            pbancSn=r.get("pbanc_sn", ""),
            source=r.get("source", ""),
            title=r.get("title", ""),
            supportField=r.get("support_field", ""),
            targetAge=r.get("target_age", ""),
            orgType=r.get("org_type", ""),
            department=r.get("department", ""),
            region=r.get("region", ""),
            receptionPeriod=r.get("reception_period", ""),
            supervisionOrg=r.get("supervision_org", ""),
            target=r.get("target", ""),
            bizExperience=r.get("biz_experience", ""),
            contact=r.get("contact", ""),
            contentText=r.get("content_text", ""),
            attachments=r.get("attachments", []),
            detailUrl=r.get("detail_url", ""),
            crawledAt=r.get("crawled_at", "").isoformat() if r.get("crawled_at") else "",
            viewCount=r.get("view_count", 0),
        ))
    return results


def get_cache_info() -> Optional[dict]:
    """DB에 저장된 공고의 최신 크롤링 정보를 반환한다."""
    if not is_db_available():
        return None

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                SELECT crawled_at, source, COUNT(*) as cnt
                FROM announcements
                GROUP BY crawled_at, source
                ORDER BY crawled_at DESC
                LIMIT 1
            """)
            row = cur.fetchone()
    finally:
        conn.close()

    if not row:
        return None

    return {
        "crawled_at": row[0].isoformat() if row[0] else "",
        "source": row[1] or "",
        "count": row[2],
    }


# ── Companies CRUD ───────────────────────────────────────────────

def upsert_company(profile) -> None:
    """기업 프로필을 DB에 upsert한다."""
    if not is_db_available():
        return

    d = profile.to_dict() if hasattr(profile, "to_dict") else profile
    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO companies (
                    company_name, ceo_name, ceo_birth_date, ceo_gender,
                    address, region, established_date,
                    main_industry, main_sector, business_item_summary
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                ON CONFLICT (company_name) DO UPDATE SET
                    ceo_name = EXCLUDED.ceo_name,
                    ceo_birth_date = EXCLUDED.ceo_birth_date,
                    ceo_gender = EXCLUDED.ceo_gender,
                    address = EXCLUDED.address,
                    region = EXCLUDED.region,
                    established_date = EXCLUDED.established_date,
                    main_industry = EXCLUDED.main_industry,
                    main_sector = EXCLUDED.main_sector,
                    business_item_summary = EXCLUDED.business_item_summary,
                    updated_at = NOW()
            """, (
                d.get("company_name", ""),
                d.get("ceo_name", ""),
                d.get("ceo_birth_date", ""),
                d.get("ceo_gender", ""),
                d.get("address", ""),
                d.get("region", ""),
                d.get("established_date", ""),
                d.get("main_industry", ""),
                d.get("main_sector", ""),
                d.get("business_item_summary", ""),
            ))
        conn.commit()
    finally:
        conn.close()


def get_company(company_name: str):
    """DB에서 기업 프로필을 조회한다. 없으면 None."""
    if not is_db_available():
        return None

    from data.models import CompanyProfile

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute(
                "SELECT * FROM companies WHERE company_name = %s",
                (company_name,),
            )
            row = cur.fetchone()
            if not row:
                return None
            cols = [desc[0] for desc in cur.description]
    finally:
        conn.close()

    r = dict(zip(cols, row))
    return CompanyProfile(
        company_name=r.get("company_name", ""),
        ceo_name=r.get("ceo_name", ""),
        ceo_birth_date=r.get("ceo_birth_date", ""),
        ceo_gender=r.get("ceo_gender", ""),
        address=r.get("address", ""),
        region=r.get("region", ""),
        established_date=r.get("established_date", ""),
        main_industry=r.get("main_industry", ""),
        main_sector=r.get("main_sector", ""),
        business_item_summary=r.get("business_item_summary", ""),
    )


def list_companies() -> list:
    """DB에서 모든 기업명을 조회한다."""
    if not is_db_available():
        return []

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT company_name FROM companies ORDER BY company_name")
            return [row[0] for row in cur.fetchall()]
    finally:
        conn.close()


# ── Report Logs CRUD ─────────────────────────────────────────────

def log_report(
    company_name: str,
    total_announcements: int = 0,
    recommended_count: int = 0,
    top_match_title: str = "",
    top_match_score: float = 0,
    report_format: str = "",
    crawl_source: str = "cache",
    crawl_date: str = "",
) -> Optional[dict]:
    """보고서 생성 이력을 DB에 기록한다."""
    if not is_db_available():
        return None

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            cur.execute("""
                INSERT INTO report_logs (
                    company_name, total_announcements, recommended_count,
                    top_match_title, top_match_score, report_format,
                    crawl_source, crawl_date
                ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING id, generated_at
            """, (
                company_name, total_announcements, recommended_count,
                top_match_title, top_match_score, report_format,
                crawl_source, crawl_date,
            ))
            row = cur.fetchone()
        conn.commit()
    finally:
        conn.close()

    return {
        "id": row[0],
        "generated_at": row[1].isoformat() if row[1] else "",
        "company_name": company_name,
    }


def get_report_history(company_name: Optional[str] = None) -> list:
    """보고서 생성 이력을 DB에서 조회한다."""
    if not is_db_available():
        return []

    conn = get_conn()
    try:
        with conn.cursor() as cur:
            if company_name:
                cur.execute(
                    "SELECT * FROM report_logs WHERE company_name = %s ORDER BY generated_at DESC",
                    (company_name,),
                )
            else:
                cur.execute("SELECT * FROM report_logs ORDER BY generated_at DESC")
            rows = cur.fetchall()
            cols = [desc[0] for desc in cur.description]
    finally:
        conn.close()

    results = []
    for row in rows:
        r = dict(zip(cols, row))
        if r.get("generated_at"):
            r["generated_at"] = r["generated_at"].isoformat()
        results.append(r)
    return results
