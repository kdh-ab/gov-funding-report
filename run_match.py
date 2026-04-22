"""Server Action에서 subprocess로 호출되는 매칭 실행 스크립트.

사용법: python run_match.py <기업명> [--refresh]
출력: JSON (stdout)
"""

import json
import sys

from company.manager import CompanyManager
from crawler import KStartupCrawler, BizinfoCrawler
from data.store import AnnouncementStore
from matcher.engine import RecommendationEngine


def crawl_fresh(store):
    """K-Startup + BizInfo 실시간 크롤링."""
    all_announcements = []

    try:
        print("[K-Startup] 크롤링 시작...", file=sys.stderr)
        kstartup = KStartupCrawler()
        k_items = kstartup.crawl()
        all_announcements.extend(k_items)
        if k_items:
            store.save(k_items, "K-Startup")
        print(f"[K-Startup] {len(k_items)}건 수집 완료", file=sys.stderr)
    except Exception as e:
        print(f"[K-Startup] 크롤링 오류: {e}", file=sys.stderr)

    try:
        print("[BIZINFO] 크롤링 시작...", file=sys.stderr)
        bizinfo = BizinfoCrawler()
        b_items = bizinfo.crawl()
        all_announcements.extend(b_items)
        if b_items:
            store.save(b_items, "BIZINFO")
        print(f"[BIZINFO] {len(b_items)}건 수집 완료", file=sys.stderr)
    except Exception as e:
        print(f"[BIZINFO] 크롤링 오류: {e}", file=sys.stderr)

    return all_announcements


def run(company_name, refresh=False):
    cm = CompanyManager()
    if not cm.exists(company_name):
        print(json.dumps({"error": f"기업 프로필을 찾을 수 없습니다: {company_name}"}))
        sys.exit(1)

    profile = cm.load(company_name)
    store = AnnouncementStore()

    if refresh:
        print("[크롤링] 실시간 크롤링 시작...", file=sys.stderr)
        announcements = crawl_fresh(store)
        if not announcements:
            # 크롤링 실패 시 캐시/시드 데이터 폴백
            announcements = store.get_all(use_seed=True)
    else:
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
        "cache_info": store.get_cache_info(),
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
    args = sys.argv[1:]
    refresh = "--refresh" in args
    args = [a for a in args if a != "--refresh"]
    if not args:
        print(json.dumps({"error": "기업명을 지정하세요."}))
        sys.exit(1)
    run(args[0], refresh=refresh)
