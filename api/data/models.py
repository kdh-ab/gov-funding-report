from __future__ import annotations
from dataclasses import dataclass, field
from datetime import date, datetime
from typing import Optional


@dataclass
class Announcement:
    """크롤링된 정부지원사업 공고 데이터."""
    pbancSn: str = ""
    source: str = ""  # "K-Startup" 또는 "BIZINFO"
    title: str = ""
    supportField: str = ""
    targetAge: str = ""
    orgType: str = ""
    department: str = ""
    region: str = ""
    receptionPeriod: str = ""
    supervisionOrg: str = ""
    target: str = ""
    bizExperience: str = ""
    contact: str = ""
    contentText: str = ""
    attachments: list = field(default_factory=list)
    detailUrl: str = ""
    crawledAt: str = ""
    viewCount: int = 0

    @classmethod
    def from_dict(cls, d: dict) -> "Announcement":
        valid_fields = {f.name for f in cls.__dataclass_fields__.values()}
        return cls(**{k: v for k, v in d.items() if k in valid_fields})

    def to_dict(self) -> dict:
        return {
            "pbancSn": self.pbancSn,
            "source": self.source,
            "title": self.title,
            "supportField": self.supportField,
            "targetAge": self.targetAge,
            "orgType": self.orgType,
            "department": self.department,
            "region": self.region,
            "receptionPeriod": self.receptionPeriod,
            "supervisionOrg": self.supervisionOrg,
            "target": self.target,
            "bizExperience": self.bizExperience,
            "contact": self.contact,
            "contentText": self.contentText,
            "attachments": self.attachments,
            "detailUrl": self.detailUrl,
            "crawledAt": self.crawledAt,
            "viewCount": self.viewCount,
        }


@dataclass
class CompanyProfile:
    """기업 프로필 정보."""
    company_name: str = ""
    ceo_name: str = ""
    ceo_birth_date: str = ""  # YYYY-MM-DD
    ceo_gender: str = ""  # M 또는 F
    address: str = ""
    region: str = ""  # 주소에서 추출한 시/도
    established_date: str = ""  # YYYY-MM-DD
    main_industry: str = ""  # 주업종
    main_sector: str = ""  # 주요산업
    business_item_summary: str = ""  # 사업아이템 한줄 정리

    def get_ceo_age(self, reference_date: Optional[date] = None) -> Optional[int]:
        """대표자의 만 나이를 계산한다."""
        if not self.ceo_birth_date:
            return None
        ref = reference_date or date.today()
        birth = datetime.strptime(self.ceo_birth_date, "%Y-%m-%d").date()
        age = ref.year - birth.year
        if (ref.month, ref.day) < (birth.month, birth.day):
            age -= 1
        return age

    def get_biz_years(self, reference_date: Optional[date] = None) -> Optional[float]:
        """설립일 기준 업력(년)을 계산한다."""
        if not self.established_date:
            return None
        ref = reference_date or date.today()
        est = datetime.strptime(self.established_date, "%Y-%m-%d").date()
        delta = ref - est
        return round(delta.days / 365.25, 1)

    @classmethod
    def from_dict(cls, d: dict) -> "CompanyProfile":
        valid_fields = {f.name for f in cls.__dataclass_fields__.values()}
        return cls(**{k: v for k, v in d.items() if k in valid_fields})

    def to_dict(self) -> dict:
        return {
            "company_name": self.company_name,
            "ceo_name": self.ceo_name,
            "ceo_birth_date": self.ceo_birth_date,
            "ceo_gender": self.ceo_gender,
            "address": self.address,
            "region": self.region,
            "established_date": self.established_date,
            "main_industry": self.main_industry,
            "main_sector": self.main_sector,
            "business_item_summary": self.business_item_summary,
        }


@dataclass
class MatchResult:
    """매칭 결과: 공고 + 적합도 점수 + 시그널 레벨 + 사유."""
    announcement: Announcement = field(default_factory=Announcement)
    score: float = 0.0
    level: int = 1  # 시그널 레벨 1~5
    match_reasons: list = field(default_factory=list)
    reject_reasons: list = field(default_factory=list)
    competition_level: int = 0  # 예상 경쟁 강도 1~5 (0=데이터 부족)
    competition_reasons: list = field(default_factory=list)
