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


def progress(step, message):
    """프론트엔드 스트리밍용 구조화된 진행 메시지 출력."""
    print(f"[PROGRESS] {step}|{message}", file=sys.stderr, flush=True)


def crawl_fresh(store, max_pages=5):
    """K-Startup + BizInfo 실시간 크롤링.

    웹 트리거에서는 max_pages를 제한하여 타임아웃을 방지한다.
    """
    all_announcements = []

    try:
        progress("kstartup", "K-Startup 공고를 수집하고 있습니다...")
        kstartup = KStartupCrawler()
        k_items = kstartup.crawl(max_pages=max_pages)
        all_announcements.extend(k_items)
        if k_items:
            store.save(k_items, "K-Startup")
        progress("kstartup_done", f"K-Startup에서 {len(k_items)}건 수집 완료")
    except Exception as e:
        progress("kstartup_error", f"K-Startup 수집 중 오류 발생: {e}")

    try:
        progress("bizinfo", "기업마당 공고를 수집하고 있습니다...")
        bizinfo = BizinfoCrawler()
        b_items = bizinfo.crawl(max_pages=max_pages)
        all_announcements.extend(b_items)
        if b_items:
            store.save(b_items, "BIZINFO")
        progress("bizinfo_done", f"기업마당에서 {len(b_items)}건 수집 완료")
    except Exception as e:
        progress("bizinfo_error", f"기업마당 수집 중 오류 발생: {e}")

    return all_announcements


def run(company_name, refresh=False):
    cm = CompanyManager()
    if not cm.exists(company_name):
        print(json.dumps({"error": f"기업 프로필을 찾을 수 없습니다: {company_name}"}))
        sys.exit(1)

    profile = cm.load(company_name)
    store = AnnouncementStore()

    if refresh:
        progress("start", "최신 공고 데이터를 수집합니다...")
        announcements = crawl_fresh(store)
        if not announcements:
            progress("fallback", "크롤링 결과가 없어 캐시 데이터를 사용합니다")
            announcements = store.get_all(use_seed=True)
    else:
        announcements = store.get_all(use_seed=True)

    if not announcements:
        print(json.dumps({"error": "공고 데이터가 없습니다."}))
        sys.exit(1)

    progress("matching", f"{len(announcements)}건의 공고를 분석하고 있습니다...")
    engine = RecommendationEngine(profile)
    matches = engine.recommend(announcements)
    progress("done", f"분석 완료! {len(matches)}건의 맞춤 공고를 찾았습니다")

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
                "level": m.level,
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
