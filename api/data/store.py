from __future__ import annotations
import json
import os
from datetime import datetime
from glob import glob
from typing import Optional

from config import settings
from data.models import Announcement
from data.database import (
    is_db_available,
    upsert_announcements,
    get_announcements,
    get_cache_info as db_get_cache_info,
)


class AnnouncementStore:
    """크롤링 결과 캐시 관리. DB가 있으면 DB 우선, 없으면 파일 기반."""

    def __init__(self):
        if not is_db_available():
            os.makedirs(settings.CACHE_DIR, exist_ok=True)

    def save(self, announcements: list[Announcement], source: str) -> str:
        """크롤링 결과를 저장한다."""
        # DB가 있으면 DB에 저장
        if is_db_available():
            upsert_announcements(announcements)
            return f"db:{source}:{len(announcements)}"

        # 파일 기반 fallback
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        filename = f"{source.lower().replace('-', '')}_{timestamp}.json"
        filepath = os.path.join(settings.CACHE_DIR, filename)

        data = {
            "crawledAt": datetime.now().isoformat(),
            "totalCount": len(announcements),
            "source": source,
            "items": [a.to_dict() for a in announcements],
        }
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        return filepath

    def load_latest(self, source: str = None) -> list[Announcement]:
        """가장 최근 데이터를 로드한다."""
        # DB 우선
        if is_db_available():
            items = get_announcements(source)
            if items:
                return items

        # 파일 기반 fallback
        pattern = os.path.join(settings.CACHE_DIR, "*.json")
        files = sorted(glob(pattern), key=os.path.getmtime, reverse=True)

        if source:
            source_prefix = source.lower().replace("-", "")
            files = [f for f in files if os.path.basename(f).startswith(source_prefix)]

        if not files:
            return []

        return self._load_file(files[0])

    def load_from_file(self, filepath: str) -> list[Announcement]:
        """지정된 JSON 파일에서 공고를 로드한다."""
        return self._load_file(filepath)

    def load_seed_data(self) -> list[Announcement]:
        """시드 데이터(result.json)를 로드한다."""
        seed_path = settings.SEED_DATA_PATH
        if not os.path.exists(seed_path):
            return []
        return self._load_file(seed_path)

    def _load_file(self, filepath: str) -> list[Announcement]:
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)

        items = data.get("items", [])
        source = data.get("source", "")

        announcements = []
        for item in items:
            if not item.get("source") and source:
                if "k-startup" in source.lower():
                    item["source"] = "K-Startup"
                elif "bizinfo" in source.lower():
                    item["source"] = "BIZINFO"
            announcements.append(Announcement.from_dict(item))
        return announcements

    def get_all(self, use_seed: bool = True) -> list[Announcement]:
        """공고를 로드한다. DB → 캐시 파일 → 시드 데이터 순서."""
        cached = self.load_latest()
        if cached:
            return cached
        if use_seed:
            return self.load_seed_data()
        return []

    def get_cache_info(self) -> Optional[dict]:
        """최신 캐시 메타 정보를 반환한다."""
        # DB 우선
        if is_db_available():
            info = db_get_cache_info()
            if info:
                return info

        # 파일 기반 fallback
        pattern = os.path.join(settings.CACHE_DIR, "*.json")
        files = sorted(glob(pattern), key=os.path.getmtime, reverse=True)
        if not files:
            return None

        with open(files[0], "r", encoding="utf-8") as f:
            data = json.load(f)

        return {
            "crawled_at": data.get("crawledAt", ""),
            "source": data.get("source", ""),
            "count": data.get("totalCount", 0),
        }

    @staticmethod
    def merge(existing: list[Announcement], new: list[Announcement]) -> list[Announcement]:
        """중복을 제거하며 두 리스트를 합친다."""
        seen = {}
        for a in existing + new:
            key = a.pbancSn if a.pbancSn else f"{a.title}_{a.supervisionOrg}"
            seen[key] = a
        return list(seen.values())
