"""Server Action에서 subprocess로 호출되는 매칭 실행 스크립트.

사용법: python run_match.py <기업명>
출력: JSON (stdout)
"""

import json
import sys

from company.manager import CompanyManager
from data.store import AnnouncementStore
from matcher.engine import RecommendationEngine


def run(company_name: str):
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

    # 크롤링 날짜 추출
    crawled_at = ""
    for a in announcements:
        if a.crawledAt:
            crawled_at = a.crawledAt
            break

    result = {
        "company": profile.to_dict(),
        "total_announcements": len(announcements),
        "recommended_count": len(matches),
        "crawled_at": crawled_at,
        "matches": [
            {
                "rank": i + 1,
                "score": m.score,
                "match_reasons": m.match_reasons,
                "announcement": m.announcement.to_dict(),
            }
            for i, m in enumerate(matches)
        ],
    }
    print(json.dumps(result, ensure_ascii=False))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(json.dumps({"error": "기업명을 지정하세요."}))
        sys.exit(1)
    run(sys.argv[1])
