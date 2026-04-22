"""Server Action에서 subprocess로 호출되는 보고서 생성 스크립트.

사용법: python run_report.py <기업명> <format: xlsx|pdf>
출력: JSON (stdout) - { "filepath": "...", "error": "..." }
"""

import json
import sys

from company.manager import CompanyManager
from data.store import AnnouncementStore
from matcher.engine import RecommendationEngine
from report.generator import ReportGenerator
from report.logger import ReportLogger


def run(company_name: str, fmt: str):
    cm = CompanyManager()
    if not cm.exists(company_name):
        print(json.dumps({"error": f"기업 프로필을 찾을 수 없습니다: {company_name}"}))
        sys.exit(1)

    profile = cm.load(company_name)
    store = AnnouncementStore()
    announcements = store.get_all(use_seed=True)

    if not announcements:
        print(json.dumps({"error": "공고 데이터가 없습니다."}))
        sys.exit(1)

    engine = RecommendationEngine(profile)
    matches = engine.recommend(announcements)

    gen = ReportGenerator()
    filepath = gen.generate_recommendation(matches, profile, announcements, fmt=fmt)

    logger = ReportLogger()
    logger.log(
        company_name=profile.company_name,
        total_announcements=len(announcements),
        recommended_count=len(matches),
        top_match_title=matches[0].announcement.title if matches else "",
        top_match_score=matches[0].score if matches else 0,
        report_format=fmt,
        report_path=filepath,
    )

    print(json.dumps({"filepath": filepath}, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) < 3:
        print(json.dumps({"error": "사용법: python run_report.py <기업명> <xlsx|pdf>"}))
        sys.exit(1)
    run(sys.argv[1], sys.argv[2])
