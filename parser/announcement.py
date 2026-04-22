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

    # --- 확장 파서 메서드 (매칭 엔진용) ---

    @staticmethod
    def parse_target_age(raw: str) -> dict:
        """대상연령 문자열을 구조화된 범위 리스트로 파싱한다.

        예: "만 20세 이상 ~ 만 39세 이하, 만 40세 이상"
          → {"all": False, "ranges": [{"min": 20, "max": 39}, {"min": 40, "max": None}]}
        """
        if not raw or raw.strip() == "전체":
            return {"all": True, "ranges": []}

        ranges = []
        # 쉼표로 구분된 각 범위를 처리
        segments = re.split(r",\s*", raw)

        for segment in segments:
            age_min = None
            age_max = None

            # "만 N세 이상 ~ 만 M세 이하" 패턴
            range_match = re.search(
                r"만\s*(\d+)\s*세\s*(이상|초과).*?만\s*(\d+)\s*세\s*(이하|미만)", segment
            )
            if range_match:
                age_min = int(range_match.group(1))
                age_max = int(range_match.group(3))
                if range_match.group(4) == "미만":
                    age_max -= 1
                ranges.append({"min": age_min, "max": age_max})
                continue

            # 단일 "만 N세 이상" 패턴
            min_match = re.search(r"만\s*(\d+)\s*세\s*(이상|초과)", segment)
            if min_match:
                age_min = int(min_match.group(1))
                if min_match.group(2) == "초과":
                    age_min += 1
                ranges.append({"min": age_min, "max": None})
                continue

            # 단일 "만 N세 이하/미만" 패턴
            max_match = re.search(r"만\s*(\d+)\s*세\s*(이하|미만)", segment)
            if max_match:
                age_max = int(max_match.group(1))
                if max_match.group(2) == "미만":
                    age_max -= 1
                ranges.append({"min": None, "max": age_max})
                continue

        if not ranges:
            return {"all": True, "ranges": []}

        return {"all": False, "ranges": ranges}

    @staticmethod
    def parse_biz_experience(raw: str) -> dict:
        """창업업력 문자열을 구조화된 데이터로 파싱한다.

        예: "예비창업자, 1년미만, 3년미만, 5년미만"
          → {"all": False, "allows_pre_startup": True, "max_years": 5}
        """
        if not raw or raw.strip() == "전체":
            return {"all": True, "allows_pre_startup": True, "max_years": None}

        allows_pre = "예비창업자" in raw or "예비" in raw
        year_matches = re.findall(r"(\d+)\s*년\s*미만", raw)
        max_years = max(int(y) for y in year_matches) if year_matches else None

        # "N년이상" 패턴도 확인 (상한은 없지만 하한이 있는 경우)
        min_matches = re.findall(r"(\d+)\s*년\s*이상", raw)

        if not year_matches and not min_matches and not allows_pre:
            return {"all": True, "allows_pre_startup": True, "max_years": None}

        return {
            "all": False,
            "allows_pre_startup": allows_pre,
            "max_years": max_years,
        }

    @staticmethod
    def parse_region(raw: str) -> str:
        """지역 문자열을 정규화한다."""
        if not raw:
            return ""
        raw = raw.strip()
        if raw == "전국":
            return "전국"
        # 시/도 단위만 추출 (첫 번째 공백 앞까지)
        region_map = {
            "서울": "서울특별시", "부산": "부산광역시", "대구": "대구광역시",
            "인천": "인천광역시", "광주": "광주광역시", "대전": "대전광역시",
            "울산": "울산광역시", "세종": "세종특별자치시",
            "경기": "경기도", "강원": "강원특별자치도",
            "충북": "충청북도", "충남": "충청남도",
            "전북": "전북특별자치도", "전남": "전라남도",
            "경북": "경상북도", "경남": "경상남도", "제주": "제주특별자치도",
        }
        for short, full in region_map.items():
            if short in raw or full in raw:
                return full
        return raw

    @staticmethod
    def parse_reception_period(raw: str) -> tuple:
        """접수기간을 (시작일, 종료일) datetime으로 파싱한다.

        예: "2026-02-09 ~ 2026-03-06 18:00" → (datetime, datetime)
        """
        if not raw:
            return None, None

        date_pattern = r"(\d{4}-\d{1,2}-\d{1,2})"
        dates = re.findall(date_pattern, raw)

        start = None
        end = None
        if len(dates) >= 1:
            try:
                start = datetime.strptime(dates[0], "%Y-%m-%d")
            except ValueError:
                pass
        if len(dates) >= 2:
            try:
                end = datetime.strptime(dates[1], "%Y-%m-%d")
            except ValueError:
                pass

        return start, end
