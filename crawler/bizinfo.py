"""BIZINFO (기업마당) 정부지원사업 크롤러"""

import re
import time

import requests
from bs4 import BeautifulSoup

from config.settings import (
    BIZINFO_URL, REQUEST_DELAY, DETAIL_DELAY, MAX_PAGES, TIMEOUT,
)
from data.models import Announcement


class BizinfoCrawler:
    """기업마당(bizinfo.go.kr) 정부지원사업 공고 크롤러.

    새 URL(selectSIIA200View.do)은 POST 기반 페이지네이션을 사용할 수 있으므로
    GET/POST 양쪽을 시도한다. 상세 페이지도 크롤링하여 풍부한 필드를 수집한다.
    """

    BASE_URL = "https://www.bizinfo.go.kr"

    def __init__(self):
        self.list_url = BIZINFO_URL
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        })

    def crawl(self, max_pages=None, crawl_details=True) -> list[Announcement]:
        """전체 크롤링 파이프라인."""
        max_pages = max_pages or MAX_PAGES
        all_items = []

        for page in range(1, max_pages + 1):
            print(f"[BIZINFO] 목록 페이지 {page}/{max_pages} 수집 중...")
            items = self._crawl_list_page(page)
            if not items:
                print(f"[BIZINFO] 페이지 {page}에서 결과 없음, 수집 종료")
                break
            all_items.extend(items)
            if page < max_pages:
                time.sleep(REQUEST_DELAY)

        # 중복 제거
        seen = set()
        unique = []
        for item in all_items:
            key = item.get("title", "") + item.get("organization", "")
            if key not in seen:
                seen.add(key)
                unique.append(item)

        print(f"[BIZINFO] 목록에서 {len(unique)}건 수집")

        if not crawl_details or not unique:
            return [self._list_item_to_announcement(item) for item in unique]

        # 상세 페이지 크롤링
        announcements = []
        for i, item in enumerate(unique, 1):
            if item.get("link"):
                print(f"[BIZINFO] 상세 크롤링 {i}/{len(unique)}: {item['title'][:40]}...")
                announcement = self._crawl_detail(item)
                announcements.append(announcement)
                if i < len(unique):
                    time.sleep(DETAIL_DELAY)
            else:
                announcements.append(self._list_item_to_announcement(item))

        print(f"[BIZINFO] 총 {len(announcements)}건 상세 수집 완료")
        return announcements

    def _crawl_list_page(self, page_no: int) -> list[dict]:
        """목록 페이지 크롤링. POST 우선, 실패시 GET으로 폴백."""
        # POST 방식 시도
        form_data = {
            "pageIndex": str(page_no),
            "pageUnit": "15",
        }
        try:
            resp = self.session.post(
                self.list_url, data=form_data, timeout=TIMEOUT
            )
            resp.raise_for_status()
            items = self._parse_list(resp.text)
            if items:
                return items
        except requests.RequestException:
            pass

        # GET 방식 폴백
        params = {"rows": 15, "cpage": page_no}
        try:
            resp = self.session.get(self.list_url, params=params, timeout=TIMEOUT)
            resp.raise_for_status()
            return self._parse_list(resp.text)
        except requests.RequestException as e:
            print(f"[BIZINFO] 페이지 {page_no} 요청 실패: {e}")
            return []

    def _parse_list(self, html: str) -> list[dict]:
        """목록 HTML 파싱 — 여러 테이블 구조를 시도한다."""
        soup = BeautifulSoup(html, "lxml")
        items = []

        # 패턴 1: 테이블 기반 목록
        rows = soup.select("table tbody tr")
        for row in rows:
            cols = row.select("td")
            if len(cols) < 5:
                continue
            items.append({
                "source": "BIZINFO",
                "title": cols[1].get_text(strip=True),
                "organization": cols[2].get_text(strip=True),
                "period": cols[3].get_text(strip=True),
                "status": cols[4].get_text(strip=True),
                "link": self._extract_link(cols[1]),
            })

        if items:
            return items

        # 패턴 2: 리스트/카드 기반 목록
        cards = soup.select(".list_wrap li, .bbs_list li, .card-item")
        for card in cards:
            title_el = card.select_one(".tit, .title, a")
            if not title_el:
                continue
            org_el = card.select_one(".org, .agency, .writer")
            period_el = card.select_one(".date, .period")
            status_el = card.select_one(".badge, .status, .state")

            items.append({
                "source": "BIZINFO",
                "title": title_el.get_text(strip=True),
                "organization": org_el.get_text(strip=True) if org_el else "",
                "period": period_el.get_text(strip=True) if period_el else "",
                "status": status_el.get_text(strip=True) if status_el else "",
                "link": self._extract_link_from_element(card),
            })

        return items

    def _crawl_detail(self, list_item: dict) -> Announcement:
        """상세 페이지를 크롤링한다."""
        link = list_item.get("link", "")
        if not link:
            return self._list_item_to_announcement(list_item)

        try:
            resp = self.session.get(link, timeout=TIMEOUT)
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[BIZINFO] 상세 요청 실패: {e}")
            return self._list_item_to_announcement(list_item)

        return self._parse_detail(resp.text, list_item)

    def _parse_detail(self, html: str, list_item: dict) -> Announcement:
        """상세 HTML에서 가능한 한 많은 필드를 추출한다."""
        soup = BeautifulSoup(html, "lxml")

        # 제목
        title_el = soup.select_one("h3.tit, .view_title h3, .subject")
        title = title_el.get_text(strip=True) if title_el else list_item.get("title", "")

        # 메타 테이블에서 key-value 추출
        meta = {}
        # 패턴: th/td 쌍
        for row in soup.select("table.view_table tr, .info_table tr, .detail_info tr"):
            th = row.select_one("th")
            td = row.select_one("td")
            if th and td:
                key = th.get_text(strip=True)
                value = td.get_text(strip=True)
                if key and value:
                    meta[key] = value

        # dl > dt/dd 패턴
        dts = soup.select("dl dt, .info_list dt")
        dds = soup.select("dl dd, .info_list dd")
        for dt, dd in zip(dts, dds):
            key = dt.get_text(strip=True)
            value = dd.get_text(strip=True)
            if key and value:
                meta[key] = value

        # 본문
        content_el = soup.select_one(".view_cont, .content, .board_view")
        content_text = content_el.get_text(strip=True)[:5000] if content_el else ""

        # 첨부파일
        attachments = []
        for file_el in soup.select(".file_list a, .attach a, .board_file a"):
            name = file_el.get_text(strip=True)
            url = file_el.get("href", "")
            if name and url:
                if not url.startswith("http"):
                    url = f"{self.BASE_URL}{url}"
                attachments.append({"fileName": name, "downloadUrl": url})

        # 기업마당 필드 매핑 (K-Startup과 키 이름이 다를 수 있음)
        region = (
            meta.get("지역", "")
            or meta.get("사업지역", "")
            or meta.get("시행지역", "")
        )
        target = (
            meta.get("지원대상", "")
            or meta.get("대상", "")
            or meta.get("신청자격", "")
        )

        return Announcement(
            pbancSn="",
            source="BIZINFO",
            title=title,
            supportField=meta.get("지원분야", meta.get("사업분야", "")),
            targetAge=meta.get("대상연령", ""),
            orgType=meta.get("기관구분", meta.get("기관유형", "")),
            department=meta.get("담당부서", ""),
            region=region,
            receptionPeriod=meta.get("접수기간", meta.get("신청기간", list_item.get("period", ""))),
            supervisionOrg=meta.get("주관기관", meta.get("수행기관", list_item.get("organization", ""))),
            target=target,
            bizExperience=meta.get("창업업력", ""),
            contact=meta.get("연락처", meta.get("문의처", "")),
            contentText=content_text,
            attachments=attachments,
            detailUrl=list_item.get("link", ""),
            crawledAt="",
        )

    def _extract_link(self, td) -> str:
        a_tag = td.select_one("a")
        if a_tag and a_tag.get("href"):
            href = a_tag["href"]
            if href.startswith("http"):
                return href
            if href.startswith("/"):
                return f"{self.BASE_URL}{href}"
        return ""

    def _extract_link_from_element(self, element) -> str:
        a_tag = element.select_one("a[href]")
        if a_tag:
            href = a_tag["href"]
            if href.startswith("http"):
                return href
            if href.startswith("/"):
                return f"{self.BASE_URL}{href}"
        return ""

    @staticmethod
    def _list_item_to_announcement(item: dict) -> Announcement:
        return Announcement(
            source="BIZINFO",
            title=item.get("title", ""),
            supervisionOrg=item.get("organization", ""),
            receptionPeriod=item.get("period", ""),
            detailUrl=item.get("link", ""),
        )
