import json
import os
from datetime import datetime
from glob import glob

from config import settings
from data.models import Announcement


class AnnouncementStore:
    """크롤링 결과 캐시 관리."""

    def __init__(self):
        os.makedirs(settings.CACHE_DIR, exist_ok=True)

    def save(self, announcements: list[Announcement], source: str) -> str:
        """크롤링 결과를 캐시 파일로 저장한다."""
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
        """가장 최근 캐시 파일에서 공고를 로드한다."""
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
        """프로젝트 루트의 result.json을 시드 데이터로 로드한다."""
        seed_path = os.path.join(settings.BASE_DIR, "result.json")
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
        """캐시에서 모든 공고를 로드한다. 캐시가 없으면 시드 데이터를 사용한다."""
        cached = self.load_latest()
        if cached:
            return cached
        if use_seed:
            return self.load_seed_data()
        return []

    @staticmethod
    def merge(existing: list[Announcement], new: list[Announcement]) -> list[Announcement]:
        """중복을 제거하며 두 리스트를 합친다."""
        seen = {}
        for a in existing + new:
            key = a.pbancSn if a.pbancSn else f"{a.title}_{a.supervisionOrg}"
            seen[key] = a
        return list(seen.values())
