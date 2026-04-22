"""정부지원사업 맞춤형 추천 시스템 �� 진입점"""

import argparse
import sys
from datetime import datetime

from company.manager import CompanyManager
from crawler import BizinfoCrawler, KStartupCrawler
from data.models import CompanyProfile
from data.store import AnnouncementStore
from matcher.engine import RecommendationEngine
from report.generator import ReportGenerator
from report.logger import ReportLogger


def main():
    args = parse_args()

    if args.history:
        return show_history(args.company)

    if args.create_company:
        return create_company_interactive()

    if args.list_companies:
        return list_companies()

    # 기업 프��필 로드
    cm = CompanyManager()
    if args.company:
        if not cm.exists(args.company):
            print(f"기업 프로필을 찾을 수 없습니다: {args.company}")
            print(f"등록된 기업: {cm.list_companies()}")
            print("--create-company 옵션으로 먼저 기업을 등록하세요.")
            return
        profile = cm.load(args.company)
    else:
        companies = cm.list_companies()
        if not companies:
            print("등록된 기업이 없습니다. --create-company로 먼저 등록하세요.")
            return
        if len(companies) == 1:
            profile = cm.load(companies[0])
        else:
            print("등록된 기업 목록:")
            for i, name in enumerate(companies, 1):
                print(f"  {i}. {name}")
            print("\n--company 옵션으로 기��을 지정하세요.")
            return

    print(f"\n{'='*50}")
    print(f"  {profile.company_name} 맞춤형 정부지원사업 추천")
    print(f"{'='*50}\n")

    # 공고 데이터 로드
    store = AnnouncementStore()
    if args.refresh:
        print("[크롤링] 실시간 크롤링 시작...\n")
        announcements = crawl_fresh(store)
    else:
        announcements = store.get_all(use_seed=True)
        if announcements:
            print(f"[캐시] {len(announcements)}건의 공고 데이터 로드\n")
        else:
            print("[캐시] 캐시 데이터 없음, 실시간 크롤링 시작...\n")
            announcements = crawl_fresh(store)

    if not announcements:
        print("수집된 공고가 없습니다.")
        return

    # 매칭
    engine = RecommendationEngine(profile)
    matches = engine.recommend(announcements)

    print(f"[매칭] 전체 {len(announcements)}건 중 {len(matches)}건 추천\n")

    # 상위 5개 미리보기
    for i, m in enumerate(matches[:5], 1):
        a = m.announcement
        print(f"  {i}. [{m.score:.0f}점] {a.title[:55]}")
        if m.match_reasons:
            print(f"     -> {', '.join(m.match_reasons[:3])}")

    if len(matches) > 5:
        print(f"  ... 외 {len(matches) - 5}건")

    # 보고서 생성
    fmt = args.format or "xlsx"
    gen = ReportGenerator()
    filepath = gen.generate_recommendation(
        matches, profile, announcements, fmt=fmt
    )

    # 로그 기록
    logger = ReportLogger()
    logger.log(
        company_name=profile.company_name,
        total_announcements=len(announcements),
        recommended_count=len(matches),
        top_match_title=matches[0].announcement.title if matches else "",
        top_match_score=matches[0].score if matches else 0,
        report_format=fmt,
        report_path=filepath,
        crawl_source="refresh" if args.refresh else "cache",
    )

    print(f"\n{'='*50}")
    print(f"  보고서 생성 완료: {filepath}")
    print(f"{'='*50}")


def crawl_fresh(store: AnnouncementStore):
    """K-Startup + BizInfo 실시간 크롤링."""
    all_announcements = []

    try:
        kstartup = KStartupCrawler()
        k_items = kstartup.crawl()
        all_announcements.extend(k_items)
        if k_items:
            store.save(k_items, "K-Startup")
    except Exception as e:
        print(f"[K-Startup] 크롤링 오류: {e}")

    try:
        bizinfo = BizinfoCrawler()
        b_items = bizinfo.crawl()
        all_announcements.extend(b_items)
        if b_items:
            store.save(b_items, "BIZINFO")
    except Exception as e:
        print(f"[BIZINFO] 크롤링 오류: {e}")

    return all_announcements


def create_company_interactive():
    """CLI에서 기업 프로필을 대화형으로 생성한다."""
    print("\n=== 기업 프로필 등록 ===\n")
    cm = CompanyManager()

    profile = CompanyProfile(
        company_name=input("기업명: ").strip(),
        ceo_name=input("대표자명: ").strip(),
        ceo_birth_date=input("대표자 생년월일 (YYYY-MM-DD): ").strip(),
        ceo_gender=input("대표자 성별 (M/F): ").strip().upper(),
        address=input("소재지 (전체 주소): ").strip(),
        established_date=input("설립연월일 (YYYY-MM-DD): ").strip(),
        main_industry=input("주업종: ").strip(),
        main_sector=input("주요산업: ").strip(),
        business_item_summary=input("사업아이템 한줄 정리: ").strip(),
    )

    filepath = cm.save(profile)
    print(f"\n기업 프로필 저장 완료: {filepath}")
    print(f"  - 지역: {profile.region}")
    print(f"  - 대표자 나이: 만 {profile.get_ceo_age()}세")
    print(f"  - 업력: {profile.get_biz_years()}년")


def list_companies():
    """등록된 기업 목록을 출력한다."""
    cm = CompanyManager()
    companies = cm.list_companies()
    if not companies:
        print("등록된 기업이 없습니다.")
        return
    print("\n등록된 기업 목록:")
    for i, name in enumerate(companies, 1):
        print(f"  {i}. {name}")


def show_history(company_name=None):
    """보고서 생성 이력을 출력한다."""
    logger = ReportLogger()
    history = logger.get_history(company_name)
    if not history:
        print("보고서 생성 이력이 없습니다.")
        return

    print(f"\n=== 보고서 생성 이력 ({len(history)}건) ===\n")
    for entry in history:
        gen_at = entry.get("generated_at", "")[:19]
        company = entry.get("company_name", "")
        rec = entry.get("recommended_count", 0)
        total = entry.get("total_announcements", 0)
        fmt = entry.get("report_format", "")
        path = entry.get("report_path", "")
        print(f"  [{gen_at}] {company} — 추천 {rec}/{total}건 ({fmt})")
        print(f"    {path}")


def parse_args():
    parser = argparse.ArgumentParser(
        description="정부지원사업 맞춤형 추천 보고서 생성기"
    )
    parser.add_argument(
        "--company", "-c", type=str, default=None,
        help="기업명 (등록된 프로필 사용)",
    )
    parser.add_argument(
        "--refresh", "-r", action="store_true",
        help="실시간 크롤링 실행 (캐시 대신 새로 수집)",
    )
    parser.add_argument(
        "--create-company", action="store_true",
        help="새 기업 프로필 등록 (대화형)",
    )
    parser.add_argument(
        "--list-companies", action="store_true",
        help="등록된 기업 목록 조회",
    )
    parser.add_argument(
        "--format", "-f", choices=["xlsx", "pdf"], default=None,
        help="보고서 출력 형식 (기본: xlsx)",
    )
    parser.add_argument(
        "--history", action="store_true",
        help="보고서 생성 이력 조회",
    )
    return parser.parse_args()


if __name__ == "__main__":
    main()
