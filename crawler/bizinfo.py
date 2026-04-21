"""BIZINFO (기업마당) 정부지원사업 크롤러"""

import time
import requests
from bs4 import BeautifulSoup
from config.settings import BIZINFO_URL, REQUEST_DELAY, MAX_PAGES, TIMEOUT


class BizinfoCrawler:
    """기업마당(bizinfo.go.kr) 정부지원사업 공고 크롤러"""

    def __init__(self):
        self.base_url = BIZINFO_URL
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
            print(f"[BIZINFO] 페이지 {page}/{max_pages} 크롤링 중...")
            items = self._crawl_page(page)
            if not items:
                break
            announcements.extend(items)
            time.sleep(REQUEST_DELAY)

        print(f"[BIZINFO] 총 {len(announcements)}건 수집 완료")
        return announcements

    def _crawl_page(self, page_no):
        """단일 페이지 크롤링"""
        params = {"rows": 15, "cpage": page_no}
        try:
            resp = self.session.get(self.base_url, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[BIZINFO] 페이지 {page_no} 요청 실패: {e}")
            return []

        return self._parse_list(resp.text)

    def _parse_list(self, html):
        """공고 목록 HTML 파싱"""
        soup = BeautifulSoup(html, "lxml")
        items = []

        rows = soup.select("table tbody tr")
        for row in rows:
            cols = row.select("td")
            if len(cols) < 5:
                continue

            item = {
                "source": "BIZINFO",
                "title": cols[1].get_text(strip=True),
                "organization": cols[2].get_text(strip=True),
                "period": cols[3].get_text(strip=True),
                "status": cols[4].get_text(strip=True),
                "link": self._extract_link(cols[1]),
            }
            items.append(item)

        return items

    def _extract_link(self, td):
        """링크 추출"""
        a_tag = td.select_one("a")
        if a_tag and a_tag.get("href"):
            href = a_tag["href"]
            if href.startswith("http"):
                return href
            return f"https://www.bizinfo.go.kr{href}"
        return ""
