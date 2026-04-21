"""K-Startup 정부지원사업 크롤러"""

import time
import requests
from bs4 import BeautifulSoup
from config.settings import KSTARTUP_URL, REQUEST_DELAY, MAX_PAGES, TIMEOUT


class KStartupCrawler:
    """K-Startup(k-startup.go.kr) 정부지원사업 공고 크롤러"""

    def __init__(self):
        self.base_url = KSTARTUP_URL
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                          "AppleWebKit/537.36 (KHTML, like Gecko) "
                          "Chrome/120.0.0.0 Safari/537.36",
        })

    def crawl(self, max_pages=None):
        """공고 목록을 크롤링하여 반환"""
        max_pages = max_pages or MAX_PAGES
        announcements = []

        for page in range(1, max_pages + 1):
            print(f"[K-Startup] 페이지 {page}/{max_pages} 크롤링 중...")
            items = self._crawl_page(page)
            if not items:
                break
            announcements.extend(items)
            time.sleep(REQUEST_DELAY)

        print(f"[K-Startup] 총 {len(announcements)}건 수집 완료")
        return announcements

    def _crawl_page(self, page_no):
        """단일 페이지 크롤링"""
        params = {"page": page_no}
        try:
            resp = self.session.get(self.base_url, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[K-Startup] 페이지 {page_no} 요청 실패: {e}")
            return []

        return self._parse_list(resp.text)

    def _parse_list(self, html):
        """공고 목록 HTML 파싱"""
        soup = BeautifulSoup(html, "lxml")
        items = []

        cards = soup.select(".card-item, .biz-list li, table tbody tr")
        for card in cards:
            title_el = card.select_one(".tit, .title, td:nth-of-type(2)")
            org_el = card.select_one(".org, .agency, td:nth-of-type(3)")
            period_el = card.select_one(".date, .period, td:nth-of-type(4)")
            status_el = card.select_one(".badge, .status, td:nth-of-type(5)")

            if not title_el:
                continue

            item = {
                "source": "K-Startup",
                "title": title_el.get_text(strip=True),
                "organization": org_el.get_text(strip=True) if org_el else "",
                "period": period_el.get_text(strip=True) if period_el else "",
                "status": status_el.get_text(strip=True) if status_el else "",
                "link": self._extract_link(card),
            }
            items.append(item)

        return items

    def _extract_link(self, element):
        """링크 추출"""
        a_tag = element.select_one("a")
        if a_tag and a_tag.get("href"):
            href = a_tag["href"]
            if href.startswith("http"):
                return href
            return f"https://www.k-startup.go.kr{href}"
        return ""
