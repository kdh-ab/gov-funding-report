from __future__ import annotations
"""맞춤형 정부지원사업 추천 엔진.

2단계 구조:
  1단계 — 자격 필터 (Pass/Fail, 점수 없음)
  2단계 — 적합도 점수 (0~100 정규화) → 시그널 레벨 1~5
"""

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

# ── 적합도 가중치 (합계 100) ──
_W_RELEVANCE = 45   # 사업 관련도 (키워드/분야 매칭) — 가장 중요
_W_TARGET = 25      # 대상 부합도 (기업유형, 성별)
_W_URGENCY = 15     # 긴급도 (마감임박 D-day)
_W_DATA = 15        # 정보 신뢰도 (필드 완성도)


def _score_to_level(score: float) -> int:
    """0~100 점수를 1~5 시그널 레벨로 변환."""
    if score >= 80:
        return 5
    if score >= 60:
        return 4
    if score >= 40:
        return 3
    if score >= 20:
        return 2
    return 1


class RecommendationEngine:
    """기업 프로필 기반 정부지원사업 추천 엔진.

    1단계: 자격 필터 — Hard 규칙 실패 시 제외 (점수 없음)
    2단계: 적합도 평가 — 0~100 정규화 점수 + 시그널 레벨 1~5
    """

    def __init__(self, profile: CompanyProfile):
        self.profile = profile
        self.parser = AnnouncementParser()

    def recommend(self, announcements: list[Announcement]) -> list[MatchResult]:
        """공고 목록을 매칭하고 적합도순으로 정렬하여 반환한다."""
        results = []
        for ann in announcements:
            result = self._evaluate(ann)
            if result:
                results.append(result)

        results.sort(key=lambda r: r.score, reverse=True)
        return results

    # ── 1단계: 자격 필터 ──

    def _check_eligibility(self, ann: Announcement) -> tuple:
        """자격 필터를 적용한다. (통과여부, 제외사유 리스트)를 반환."""
        reject_reasons = []

        # 접수마감
        _, end = self.parser.parse_reception_period(ann.receptionPeriod)
        if end is not None and end.date() < date.today():
            return False, [f"접수마감 ({end.strftime('%Y-%m-%d')})"]

        # 대상연령
        parsed_age = self.parser.parse_target_age(ann.targetAge)
        if not parsed_age["all"]:
            ceo_age = self.profile.get_ceo_age()
            if ceo_age is not None:
                age_ok = False
                for r in parsed_age["ranges"]:
                    min_age = r.get("min")
                    max_age = r.get("max")
                    if min_age is not None and ceo_age < min_age:
                        continue
                    if max_age is not None and ceo_age > max_age:
                        continue
                    age_ok = True
                    break
                if not age_ok:
                    return False, [f"대표자 연령 부적합 (만 {ceo_age}세, 조건: {ann.targetAge})"]

        # 창업업력
        parsed_biz = self.parser.parse_biz_experience(ann.bizExperience)
        if not parsed_biz["all"]:
            biz_years = self.profile.get_biz_years()
            if biz_years is None or biz_years <= 0:
                if not parsed_biz["allows_pre_startup"]:
                    return False, [f"예비창업자 부적합 (조건: {ann.bizExperience})"]
            else:
                biz_ok = False
                if parsed_biz["max_years"] is not None and biz_years < parsed_biz["max_years"]:
                    biz_ok = True
                elif parsed_biz["max_years"] is None and parsed_biz["allows_pre_startup"]:
                    biz_ok = True
                if not biz_ok:
                    return False, [f"업력 부적합 ({biz_years}년, 조건: {ann.bizExperience})"]

        # 지역
        ann_region = self.parser.parse_region(ann.region)
        if ann_region and ann_region != "전국":
            profile_region = self.parser.parse_region(self.profile.region)
            if profile_region and ann_region != profile_region:
                return False, [f"지역 부적합 (기업: {profile_region}, 공고: {ann_region})"]

        return True, reject_reasons

    # ── 2단계: 적합도 평가 ──

    def _score_relevance(self, ann: Announcement) -> tuple:
        """사업 관련도 (0.0~1.0)를 평가한다."""
        profile_text = " ".join(filter(None, [
            self.profile.business_item_summary,
            self.profile.main_sector,
            self.profile.main_industry,
        ]))
        if not profile_text:
            return 0.0, []

        ann_text = " ".join(filter(None, [
            ann.title,
            ann.supportField,
            ann.contentText[:500],
        ]))
        if not ann_text:
            return 0.0, []

        profile_tokens = self._tokenize(profile_text)
        ann_tokens = self._tokenize(ann_text)
        if not profile_tokens or not ann_tokens:
            return 0.0, []

        overlap = profile_tokens & ann_tokens
        if not overlap:
            return 0.0, []

        # 매칭 비율 기반 (프로필 토큰 중 몇 %가 공고에 등장하는지)
        ratio = len(overlap) / len(profile_tokens)
        score = min(ratio * 2.0, 1.0)  # 50% 이상 겹치면 만점

        matched_str = ", ".join(sorted(overlap)[:5])
        reasons = [f"키워드 매칭: {matched_str}"]
        return score, reasons

    def _score_target_fit(self, ann: Announcement) -> tuple:
        """대상 부합도 (0.0~1.0)를 평가한다."""
        score = 0.0
        reasons = []

        # 기업유형 매칭
        target = ann.target
        if not target or target.strip() == "전체":
            score += 0.5
        else:
            biz_years = self.profile.get_biz_years()
            company_types = []
            if biz_years is None or biz_years <= 0:
                company_types.append("예비창업자")
            else:
                company_types.extend(["일반기업", "일반인"])
                if biz_years < 7:
                    company_types.append("창업기업")

            target_lower = target.lower()
            matched = False
            for ct in company_types:
                if ct in target_lower:
                    score += 0.7
                    reasons.append(f"대상 유형 일치 ({ct})")
                    matched = True
                    break
            if not matched:
                score += 0.2  # 불확실 — 약간의 점수

        # 성별 매칭
        if self.profile.ceo_gender:
            text = f"{ann.title} {ann.contentText[:500]}"
            is_female = self.profile.ceo_gender.upper() == "F"

            female_patterns = ["여성", "우먼", "맘", "경력단절"]
            female_only = any(p in text for p in female_patterns) and any(
                kw in text for kw in ["한정", "대상", "전용", "우대"]
            )
            if female_only:
                if is_female:
                    score += 0.3
                    reasons.append("여성 대상 공고 (우대)")
                # 남성인 경우 가점 없음 (감점은 하지 않음)
            else:
                score += 0.15  # 성별 제한 없음

        return min(score, 1.0), reasons

    def _score_urgency(self, ann: Announcement) -> tuple:
        """긴급도 (0.0~1.0)를 평가한다. 마감이 가까울수록 높은 점수."""
        _, end = self.parser.parse_reception_period(ann.receptionPeriod)
        if end is None:
            return 0.3, []  # 마감일 불명 — 중립

        days_left = (end.date() - date.today()).days
        if days_left <= 0:
            return 0.0, []  # 이미 자격 필터에서 걸러짐
        if days_left <= 3:
            return 1.0, [f"마감임박 (D-{days_left})"]
        if days_left <= 7:
            return 0.8, [f"마감임박 (D-{days_left})"]
        if days_left <= 14:
            return 0.5, [f"D-{days_left}"]
        if days_left <= 30:
            return 0.3, []
        return 0.2, []  # 여유 있음

    def _score_data_quality(self, ann: Announcement) -> tuple:
        """정보 신뢰도 (0.0~1.0)를 평가한다. 필드 완성도 기반."""
        fields = [
            ann.targetAge,
            ann.bizExperience,
            ann.region,
            ann.target,
            ann.receptionPeriod,
            ann.contentText,
            ann.supportField,
            ann.supervisionOrg,
        ]
        filled = sum(1 for f in fields if f and f.strip())
        ratio = filled / len(fields)

        reasons = []
        if ratio < 0.4:
            reasons.append("공고 정보 부족 (확인 필요)")

        return ratio, reasons

    # ── 종합 평가 ──

    def _evaluate(self, ann: Announcement) -> Optional[MatchResult]:
        """단일 공고에 대해 자격 필터 + 적합도 평가를 수행한다."""
        # 1단계: 자격 필터
        eligible, reject_reasons = self._check_eligibility(ann)
        if not eligible:
            return None

        # 2단계: 적합도 점수 (각 0.0~1.0 → 가중합 → 0~100)
        rel_score, rel_reasons = self._score_relevance(ann)
        tgt_score, tgt_reasons = self._score_target_fit(ann)
        urg_score, urg_reasons = self._score_urgency(ann)
        dat_score, dat_reasons = self._score_data_quality(ann)

        total = (
            rel_score * _W_RELEVANCE
            + tgt_score * _W_TARGET
            + urg_score * _W_URGENCY
            + dat_score * _W_DATA
        )
        total = round(min(total, 100.0), 1)

        match_reasons = rel_reasons + tgt_reasons + urg_reasons
        all_reject = dat_reasons  # 정보 부족은 reject_reasons로

        level = _score_to_level(total)

        # 3단계: 예상 경쟁 강도
        comp_level, comp_reasons = self._estimate_competition(ann)

        return MatchResult(
            announcement=ann,
            score=total,
            level=level,
            match_reasons=match_reasons,
            reject_reasons=all_reject,
            competition_level=comp_level,
            competition_reasons=comp_reasons,
        )

    def _estimate_competition(self, ann: Announcement) -> tuple:
        """공고의 예상 경쟁 강도를 1~5로 추정한다.

        시그널:
          - 조회수 (BizInfo만 제공)
          - 자격요건 범위 (넓을수록 경쟁 치열)
          - 지원분야 인기도
          - 지역 범위 (전국 > 특정 지역)
          - 마감 임박도 (임박할수록 누적 지원자 많음)
        """
        score = 0.0
        reasons = []

        # 1) 조회수 — 가장 직접적인 지표 (BizInfo)
        if ann.viewCount > 0:
            if ann.viewCount >= 1000:
                score += 2.0
                reasons.append(f"조회수 {ann.viewCount:,}회")
            elif ann.viewCount >= 500:
                score += 1.5
                reasons.append(f"조회수 {ann.viewCount:,}회")
            elif ann.viewCount >= 200:
                score += 1.0
                reasons.append(f"조회수 {ann.viewCount:,}회")
            elif ann.viewCount >= 50:
                score += 0.5

        # 2) 지역 범위
        region = ann.region.strip()
        if not region or region == "전국" or "전국" in region:
            score += 1.0
            reasons.append("전국 대상")
        elif "," in region or "·" in region:
            score += 0.5
            reasons.append("복수 지역")

        # 3) 자격요건 범위 — 조건이 적을수록 넓은 문
        narrow_count = 0
        if ann.targetAge:
            narrow_count += 1
        if ann.bizExperience:
            narrow_count += 1
        if ann.target and ("예비" not in ann.target):
            narrow_count += 1

        if narrow_count == 0:
            score += 1.0
            reasons.append("자격제한 없음")
        elif narrow_count == 1:
            score += 0.5

        # 4) 지원분야 인기도
        popular_fields = {"사업화", "R&D", "융자"}
        if any(f in (ann.supportField or "") for f in popular_fields):
            score += 0.5
            reasons.append(f"{ann.supportField} 분야")

        # 5) 마감 임박 — 누적 신청자가 많을 시기
        _, end = self.parser.parse_reception_period(ann.receptionPeriod)
        if end is not None:
            days_left = (end.date() - date.today()).days
            if 0 <= days_left <= 7:
                score += 0.5
                reasons.append("마감임박")

        # 0~5 범위로 클램프, 최소 1
        level = max(1, min(5, round(score)))
        return level, reasons

    @staticmethod
    def _tokenize(text: str) -> set[str]:
        """텍스트를 의미 있는 토큰 집합으로 변환한다."""
        tokens = set(re.findall(r"[가-힣]{2,}|[a-zA-Z]{2,}", text))
        return tokens - _STOPWORDS
