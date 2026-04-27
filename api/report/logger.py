from __future__ import annotations
"""보고서 생성 이력 로거. DB 우선, 파일(JSONL) fallback."""

import json
import os
import uuid
from datetime import datetime

from config.settings import LOG_DIR, REPORT_LOG_FILE
from data.database import (
    is_db_available,
    log_report as db_log_report,
    get_report_history as db_get_report_history,
)


class ReportLogger:
    """보고서 생성 이력을 기록한다."""

    def __init__(self):
        if not is_db_available():
            os.makedirs(LOG_DIR, exist_ok=True)

    def log(
        self,
        company_name: str,
        total_announcements: int,
        recommended_count: int,
        top_match_title: str = "",
        top_match_score: float = 0,
        report_format: str = "",
        report_path: str = "",
        crawl_source: str = "cache",
        crawl_date: str = "",
    ) -> dict:
        """보고서 생성 이력을 기록한다."""
        # DB 우선
        if is_db_available():
            result = db_log_report(
                company_name=company_name,
                total_announcements=total_announcements,
                recommended_count=recommended_count,
                top_match_title=top_match_title,
                top_match_score=top_match_score,
                report_format=report_format,
                crawl_source=crawl_source,
                crawl_date=crawl_date,
            )
            if result:
                return result

        # 파일 기반 fallback
        entry = {
            "id": str(uuid.uuid4())[:8],
            "generated_at": datetime.now().isoformat(),
            "company_name": company_name,
            "total_announcements": total_announcements,
            "recommended_count": recommended_count,
            "top_match_title": top_match_title,
            "top_match_score": top_match_score,
            "report_format": report_format,
            "report_path": report_path,
            "crawl_source": crawl_source,
            "crawl_date": crawl_date,
        }

        with open(REPORT_LOG_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")

        return entry

    def get_history(self, company_name: str = None) -> list:
        """저장된 이력을 조회한다."""
        # DB 우선
        if is_db_available():
            history = db_get_report_history(company_name)
            if history:
                return history

        # 파일 기반 fallback
        if not os.path.exists(REPORT_LOG_FILE):
            return []

        entries = []
        with open(REPORT_LOG_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                entry = json.loads(line)
                if company_name and entry.get("company_name") != company_name:
                    continue
                entries.append(entry)

        return entries

    def get_latest(self, company_name: str = None) -> dict:
        """가장 최근 이력을 반환한다."""
        history = self.get_history(company_name)
        return history[-1] if history else {}
