import json
import os
import re
from glob import glob

from config import settings
from data.models import CompanyProfile


class CompanyManager:
    """기업 프로필 JSON 파일 기반 CRUD."""

    def __init__(self):
        os.makedirs(settings.COMPANY_DIR, exist_ok=True)

    def _filepath(self, company_name: str) -> str:
        safe_name = re.sub(r'[^\w가-힣]', '_', company_name).strip('_')
        return os.path.join(settings.COMPANY_DIR, f"{safe_name}.json")

    def save(self, profile: CompanyProfile) -> str:
        profile.region = self.extract_region(profile.address)
        filepath = self._filepath(profile.company_name)
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(profile.to_dict(), f, ensure_ascii=False, indent=2)
        return filepath

    def load(self, company_name: str) -> CompanyProfile:
        filepath = self._filepath(company_name)
        if not os.path.exists(filepath):
            raise FileNotFoundError(f"기업 프로필을 찾을 수 없습니다: {company_name}")
        with open(filepath, "r", encoding="utf-8") as f:
            data = json.load(f)
        return CompanyProfile.from_dict(data)

    def list_companies(self) -> list[str]:
        pattern = os.path.join(settings.COMPANY_DIR, "*.json")
        results = []
        for filepath in sorted(glob(pattern)):
            with open(filepath, "r", encoding="utf-8") as f:
                data = json.load(f)
            results.append(data.get("company_name", os.path.basename(filepath)))
        return results

    def exists(self, company_name: str) -> bool:
        return os.path.exists(self._filepath(company_name))

    @staticmethod
    def extract_region(address: str) -> str:
        """주소에서 시/도 단위 지역을 추출한다."""
        if not address:
            return ""

        region_keywords = [
            "서울특별시", "부산광역시", "대구광역시", "인천광역시",
            "광주광역시", "대전광역시", "울산광역시", "세종특별자치시",
            "경기도", "강원특별자치도", "충청북도", "충청남도",
            "전북특별자치도", "전라남도", "경상북도", "경상남도",
            "제주특별자치도",
        ]
        for region in region_keywords:
            if region in address:
                return region

        short_map = {
            "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시",
            "인천": "인천광역시", "광주": "광주광역시", "대전": "대전광역시",
            "울산": "울산광역시", "세종": "세종특별자치시",
            "경기": "경기도", "강원": "강원특별자치도",
            "충북": "충청북도", "충남": "충청남도",
            "전북": "전북특별자치도", "전남": "전라남도",
            "경북": "경상북도", "경남": "경상남도", "제주": "제주특별자치도",
        }
        first_token = address.split()[0] if address.split() else ""
        for short, full in short_map.items():
            if short in first_token:
                return full

        return ""
