from __future__ import annotations
"""BIZINFO (기업마당) 정부지원사업 크롤러"""

import re
import sys
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
            print(f"[BIZINFO] 목록 페이지 {page}/{max_pages} 수집 중...", file=sys.stderr)
            items = self._crawl_list_page(page)
            if not items:
                print(f"[BIZINFO] 페이지 {page}에서 결과 없음, 수집 종료", file=sys.stderr)
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

        print(f"[BIZINFO] 목록에서 {len(unique)}건 수집", file=sys.stderr)

        if not crawl_details or not unique:
            return [self._list_item_to_announcement(item) for item in unique]

        # 상세 페이지 크롤링
        announcements = []
        for i, item in enumerate(unique, 1):
            if item.get("link"):
                print(f"[BIZINFO] 상세 크롤링 {i}/{len(unique)}: {item['title'][:40]}...", file=sys.stderr)
                announcement = self._crawl_detail(item)
                announcements.append(announcement)
                if i < len(unique):
                    time.sleep(DETAIL_DELAY)
            else:
                announcements.append(self._list_item_to_announcement(item))

        print(f"[BIZINFO] 총 {len(announcements)}건 상세 수집 완료", file=sys.stderr)
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
            print(f"[BIZINFO] 페이지 {page_no} 요청 실패: {e}", file=sys.stderr)
            return []

    def _parse_list(self, html: str) -> list[dict]:
        """목록 HTML 파싱 — 여러 테이블 구조를 시도한다."""
        soup = BeautifulSoup(html, "lxml")
        items = []

        # 패턴 1: 테이블 기반 목록
        # 컬럼: 번호(0), 지원분야(1), 지원사업명(2), 신청기간(3),
        #        소관부처·지자체(4), 사업수행기관(5), 등록일(6), 조회수(7)
        rows = soup.select("table tbody tr")
        for row in rows:
            cols = row.select("td")
            if len(cols) < 6:
                continue
            items.append({
                "source": "BIZINFO",
                "title": cols[2].get_text(strip=True),
                "supportField": cols[1].get_text(strip=True),
                "organization": cols[5].get_text(strip=True),
                "department": cols[4].get_text(strip=True),
                "period": cols[3].get_text(strip=True),
                "link": self._extract_link(cols[2]),
                "viewCount": cols[7].get_text(strip=True) if len(cols) > 7 else "",
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
            print(f"[BIZINFO] 상세 요청 실패: {e}", file=sys.stderr)
            return self._list_item_to_announcement(list_item)

        return self._parse_detail(resp.text, list_item)

    def _parse_detail(self, html: str, list_item: dict) -> Announcement:
        """상세 HTML에서 가능한 한 많은 필드를 추출한다."""
        soup = BeautifulSoup(html, "lxml")

        # 제목: 상세 페이지에 별도 제목 요소가 없으므로 목록에서 가져옴
        title = list_item.get("title", "")

        # 메타정보 추출: ul > li > span.s_title + div.txt 구조
        meta = {}
        content_text = ""
        for li in soup.select(".view_cont li"):
            key_el = li.select_one("span.s_title")
            val_el = li.select_one("div.txt")
            if key_el and val_el:
                key = key_el.get_text(strip=True)
                value = " ".join(val_el.get_text(strip=True).split())
                if key and value:
                    if key == "사업개요":
                        content_text = value[:5000]
                    else:
                        meta[key] = value

        # 폴백: th/td 테이블 구조 (구버전 페이지 대응)
        if not meta:
            for row in soup.select("table.view_table tr, .info_table tr, .detail_info tr"):
                th = row.select_one("th")
                td = row.select_one("td")
                if th and td:
                    key = th.get_text(strip=True)
                    value = td.get_text(strip=True)
                    if key and value:
                        meta[key] = value

        # 본문 폴백
        if not content_text:
            content_el = soup.select_one(".view_cont, .content, .board_view")
            content_text = content_el.get_text(strip=True)[:5000] if content_el else ""

        # 첨부파일: .attached_file_list 구조
        attachments = []
        for li in soup.select(".attached_file_list li"):
            name_el = li.select_one(".file_name")
            dl_el = li.select_one("a[href*='fileDown']")
            if name_el and dl_el:
                name = name_el.get_text(strip=True)
                url = dl_el.get("href", "")
                if name and url:
                    if not url.startswith("http"):
                        url = f"{self.BASE_URL}{url}"
                    attachments.append({"fileName": name, "downloadUrl": url})

        # 필드 매핑
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
            supportField=meta.get("지원분야", list_item.get("supportField", "")),
            targetAge=meta.get("대상연령", ""),
            orgType=meta.get("기관구분", meta.get("기관유형", "")),
            department=meta.get("소관부처·지자체", meta.get("담당부서", list_item.get("department", ""))),
            region=region,
            receptionPeriod=meta.get("신청기간", meta.get("접수기간", list_item.get("period", ""))),
            supervisionOrg=meta.get("사업수행기관", meta.get("주관기관", list_item.get("organization", ""))),
            target=target,
            bizExperience=meta.get("창업업력", ""),
            contact=meta.get("문의처", meta.get("연락처", "")),
            contentText=content_text,
            attachments=attachments,
            detailUrl=list_item.get("link", ""),
            crawledAt="",
            viewCount=self._parse_view_count(list_item.get("viewCount", "")),
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
    def _parse_view_count(text: str) -> int:
        """조회수 텍스트에서 숫자를 추출한다."""
        if not text:
            return 0
        digits = re.sub(r"[^\d]", "", text)
        return int(digits) if digits else 0

    def _list_item_to_announcement(self, item: dict) -> Announcement:
        return Announcement(
            source="BIZINFO",
            title=item.get("title", ""),
            supportField=item.get("supportField", ""),
            supervisionOrg=item.get("organization", ""),
            department=item.get("department", ""),
            receptionPeriod=item.get("period", ""),
            detailUrl=item.get("link", ""),
            viewCount=self._parse_view_count(item.get("viewCount", "")),
        )
