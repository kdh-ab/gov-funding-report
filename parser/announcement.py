"""공고 데이터 파싱 및 정제 모듈"""

import re
from datetime import datetime


class AnnouncementParser:
    """크롤링된 공고 데이터를 파싱하고 정제"""

    def parse(self, raw_items):
        """원시 데이터를 정제된 공고 목록으로 변환"""
        parsed = []
        for item in raw_items:
            parsed_item = self._parse_item(item)
            if parsed_item:
                parsed.append(parsed_item)
        return parsed

    def _parse_item(self, item):
        """단일 공고 항목 파싱"""
        title = self._clean_text(item.get("title", ""))
        if not title:
            return None

        start_date, end_date = self._parse_period(item.get("period", ""))

        return {
            "source": item.get("source", ""),
            "title": title,
            "organization": self._clean_text(item.get("organization", "")),
            "start_date": start_date,
            "end_date": end_date,
            "status": self._normalize_status(item.get("status", "")),
            "link": item.get("link", ""),
        }

    def _clean_text(self, text):
        """텍스트 정제"""
        text = re.sub(r"\s+", " ", text).strip()
        text = re.sub(r"\[.*?\]", "", text).strip()
        return text

    def _parse_period(self, period_str):
        """접수기간 파싱 → (시작일, 종료일)"""
        if not period_str:
            return "", ""

        date_pattern = r"(\d{4}[.\-/]\d{1,2}[.\-/]\d{1,2})"
        dates = re.findall(date_pattern, period_str)

        if len(dates) >= 2:
            return self._format_date(dates[0]), self._format_date(dates[1])
        elif len(dates) == 1:
            return self._format_date(dates[0]), ""

        return "", ""

    def _format_date(self, date_str):
        """날짜 형식 통일 (YYYY-MM-DD)"""
        date_str = date_str.replace("/", "-").replace(".", "-")
        parts = date_str.split("-")
        if len(parts) == 3:
            return f"{parts[0]}-{parts[1].zfill(2)}-{parts[2].zfill(2)}"
        return date_str

    def _normalize_status(self, status):
        """접수 상태 정규화"""
        status = status.strip()
        if "접수중" in status or "진행" in status or "모집" in status:
            return "접수중"
        elif "마감" in status or "종료" in status:
            return "마감"
        elif "예정" in status:
            return "접수예정"
        return status or "미확인"

    def filter_active(self, items):
        """접수중인 공고만 필터링"""
        return [item for item in items if item.get("status") == "접수중"]
