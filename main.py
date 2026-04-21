"""정부지원사업 크롤링 보고서 생성 모듈 - 진입점"""

from crawler import BizinfoCrawler, KStartupCrawler
from parser import AnnouncementParser
from report import ReportGenerator


def main():
    print("=== 정부지원사업 크롤링 시작 ===\n")

    # 1. 크롤링
    all_items = []

    bizinfo = BizinfoCrawler()
    all_items.extend(bizinfo.crawl())

    kstartup = KStartupCrawler()
    all_items.extend(kstartup.crawl())

    if not all_items:
        print("수집된 공고가 없습니다.")
        return

    # 2. 파싱 및 정제
    parser = AnnouncementParser()
    parsed = parser.parse(all_items)
    print(f"\n총 {len(parsed)}건 파싱 완료")

    active = parser.filter_active(parsed)
    print(f"접수중: {len(active)}건")

    # 3. 보고서 생성
    generator = ReportGenerator()
    filepath = generator.generate(parsed)
    print(f"\n=== 보고서 생성 완료: {filepath} ===")


if __name__ == "__main__":
    main()
