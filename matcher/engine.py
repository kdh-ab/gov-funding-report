"""맞춤형 정부지원사업 추천 엔진."""

import re
from datetime import date
from typing import Optional

from data.models import Announcement, CompanyProfile, MatchResult
from parser.announcement import AnnouncementParser


# 매칭 점수에서 제외할 불용어 (제목/내용 유사도 계산시)
_STOPWORDS = {
    "사업", "공고", "모집", "지원", "년", "차", "제", "및", "등", "의", "을", "를",
    "에", "와", "과", "으로", "로", "이", "가", "는", "은", "한", "할", "수",
    "있는", "위한", "대상", "대한", "관련", "통한", "참여", "안내", "접수",
    "기업", "창업", "프로그램", "선정", "계획",
}


class RecommendationEngine:
    """기업 프로필 기반 정부지원사업 추천 엔진.

    각 규칙은 (통과여부, 점수, 사유) 튜플을 반환한다.
    Hard 규칙 실패 → 제외, Soft 규칙은 점수에만 반영.
    """

    def __init__(self, profile: CompanyProfile):
        self.profile = profile
        self.parser = AnnouncementParser()

    def recommend(self, announcements: list[Announcement]) -> list[MatchResult]:
        """공고 목록을 매칭하고 점수순으로 정렬하여 반환한다."""
        results = []
        for ann in announcements:
            result = self._evaluate(ann)
            if result:
                results.append(result)

        results.sort(key=lambda r: r.score, reverse=True)
        return results

    def _evaluate(self, ann: Announcement) -> Optional[MatchResult]:
        """단일 공고에 대해 모든 규칙을 적용한다."""
        score = 0.0
        match_reasons = []
        reject_reasons = []

        checks = [
            self._check_deadline(ann),
            self._check_age(ann),
            self._check_biz_experience(ann),
            self._check_region(ann),
            self._check_target_type(ann),
            self._check_gender(ann),
            self._check_title_similarity(ann),
        ]

        for is_pass, delta, reason, is_hard in checks:
            if not is_pass and is_hard:
                return None  # Hard fail → 제외
            score += delta
            if delta > 0:
                match_reasons.append(reason)
            elif delta < 0:
                reject_reasons.append(reason)

        return MatchResult(
            announcement=ann,
            score=score,
            match_reasons=match_reasons,
            reject_reasons=reject_reasons,
        )

    def _check_deadline(self, ann: Announcement) -> tuple[bool, float, str, bool]:
        """접수마감일이 지난 공고를 제외한다. Hard 규칙."""
        _, end = self.parser.parse_reception_period(ann.receptionPeriod)
        if end is None:
            return True, 0, "", False  # 마감일 파싱 불가 → 통과

        today = date.today()
        if end.date() < today:
            return False, 0, f"접수마감 ({end.strftime('%Y-%m-%d')})", True

        days_left = (end.date() - today).days
        if days_left <= 7:
            return True, 5, f"마감임박 (D-{days_left})", False

        return True, 0, "", False

    def _check_age(self, ann: Announcement) -> tuple[bool, float, str, bool]:
        """대상연령 ↔ 대표자 나이 매칭. Hard 규칙."""
        parsed = self.parser.parse_target_age(ann.targetAge)

        if parsed["all"]:
            return True, 0, "", False

        ceo_age = self.profile.get_ceo_age()
        if ceo_age is None:
            return True, 0, "대표자 생년월일 미입력 (연령 검증 생략)", False

        for r in parsed["ranges"]:
            min_age = r.get("min")
            max_age = r.get("max")
            if min_age is not None and ceo_age < min_age:
                continue
            if max_age is not None and ceo_age > max_age:
                continue
            return True, 10, f"대표자 연령 적합 (만 {ceo_age}세)", True

        return False, 0, f"대표자 연령 부적합 (만 {ceo_age}세, 조건: {ann.targetAge})", True

    def _check_biz_experience(self, ann: Announcement) -> tuple[bool, float, str, bool]:
        """창업업력 ↔ 설립연월일 매칭. Hard 규칙."""
        parsed = self.parser.parse_biz_experience(ann.bizExperience)

        if parsed["all"]:
            return True, 0, "", False

        biz_years = self.profile.get_biz_years()

        # 업력이 없으면 예비창업자로 간주
        if biz_years is None or biz_years <= 0:
            if parsed["allows_pre_startup"]:
                return True, 10, "예비창업자 대상 포함", True
            return False, 0, f"예비창업자 부적합 (조건: {ann.bizExperience})", True

        # 업력 연수 확인
        if parsed["max_years"] is not None and biz_years < parsed["max_years"]:
            return True, 10, f"업력 적합 ({biz_years}년, {parsed['max_years']}년 미만 조건)", True

        # max_years가 없고 allows_pre_startup만 있는 경우
        if parsed["max_years"] is None and parsed["allows_pre_startup"]:
            return True, 5, "예비창업자 대상 공고", True

        return False, 0, f"업력 부적합 ({biz_years}년, 조건: {ann.bizExperience})", True

    def _check_region(self, ann: Announcement) -> tuple[bool, float, str, bool]:
        """지역 ↔ 소재지 매칭. Hard 규칙 (전국은 항상 통과)."""
        ann_region = self.parser.parse_region(ann.region)

        if not ann_region or ann_region == "전국":
            return True, 5, "전국 대상 공고", False

        profile_region = self.parser.parse_region(self.profile.region)
        if not profile_region:
            return True, 0, "기업 소재지 미입력 (지역 검증 생략)", False

        if ann_region == profile_region:
            return True, 15, f"소재지 일치 ({profile_region})", True

        return False, 0, f"지역 부적합 (기업: {profile_region}, 공고: {ann_region})", True

    def _check_target_type(self, ann: Announcement) -> tuple[bool, float, str, bool]:
        """대상 ↔ 기업유형 매칭. Soft 규칙."""
        target = ann.target
        if not target or target.strip() == "전체":
            return True, 5, "", False

        # 기업 유형 추정
        biz_years = self.profile.get_biz_years()
        company_types = []
        if biz_years is None or biz_years <= 0:
            company_types.append("예비창업자")
        else:
            company_types.extend(["일반기업", "일반인"])
            if biz_years < 7:
                company_types.append("창업기업")

        target_lower = target.lower()
        for ct in company_types:
            if ct in target_lower:
                return True, 10, f"대상 유형 일치 ({ct})", False

        # 명확히 부적합하지 않으면 약한 감점
        return True, -5, f"대상 유형 불확실 (공고 대상: {target[:30]})", False

    def _check_gender(self, ann: Announcement) -> tuple[bool, float, str, bool]:
        """성별 관련 키워드 매칭. Soft 규칙."""
        if not self.profile.ceo_gender:
            return True, 0, "", False

        text = f"{ann.title} {ann.contentText[:500]}"
        is_female = self.profile.ceo_gender.upper() == "F"
        is_male = self.profile.ceo_gender.upper() == "M"

        # 여성 전용 공고 감지
        female_patterns = ["여성", "우먼", "맘", "경력단절"]
        female_only = any(p in text for p in female_patterns) and any(
            kw in text for kw in ["한정", "대상", "전용", "우대"]
        )

        if female_only:
            if is_female:
                return True, 5, "여성 대상 공고 (우대)", False
            else:
                return True, -5, "여성 대상 공고 (비해당)", False

        return True, 0, "", False

    def _check_title_similarity(self, ann: Announcement) -> tuple[bool, float, str, bool]:
        """제목/내용 ↔ 사업아이템 키워드 유사도. Soft 규칙 (0~20점)."""
        profile_text = " ".join(filter(None, [
            self.profile.business_item_summary,
            self.profile.main_sector,
            self.profile.main_industry,
        ]))
        if not profile_text:
            return True, 0, "", False

        ann_text = " ".join(filter(None, [
            ann.title,
            ann.supportField,
            ann.contentText[:500],
        ]))
        if not ann_text:
            return True, 0, "", False

        profile_tokens = self._tokenize(profile_text)
        ann_tokens = self._tokenize(ann_text)

        if not profile_tokens or not ann_tokens:
            return True, 0, "", False

        overlap = profile_tokens & ann_tokens
        if not overlap:
            return True, 0, "", False

        # 점수: 매칭 토큰 수 기반 (최대 20점)
        score = min(len(overlap) * 5, 20)
        matched_str = ", ".join(sorted(overlap)[:5])
        return True, score, f"키워드 매칭: {matched_str}", False

    @staticmethod
    def _tokenize(text: str) -> set[str]:
        """텍스트를 의미 있는 토큰 집합으로 변환한다."""
        # 한글 2글자 이상 단어 + 영문 2글자 이상 단어 추출
        tokens = set(re.findall(r"[가-힣]{2,}|[a-zA-Z]{2,}", text))
        return tokens - _STOPWORDS
