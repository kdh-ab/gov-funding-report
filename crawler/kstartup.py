"""K-Startup 정부지원사업 크롤러 (n8n 워크플로우 기반 재구현)"""

import re
import sys
import time

import requests
from bs4 import BeautifulSoup

from config.settings import (
    KSTARTUP_URL, REQUEST_DELAY, DETAIL_DELAY, MAX_PAGES, TIMEOUT,
)
from data.models import Announcement


class KStartupCrawler:
    """K-Startup(k-startup.go.kr) 정부지원사업 공고 크롤러.

    n8n 워크플로우의 검증된 CSS 선택자를 사용하여
    목록 페이지 + 상세 페이지를 크롤링한다.
    """

    BASE_URL = "https://www.k-startup.go.kr"
    DETAIL_URL_TEMPLATE = (
        "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do"
        "?schM=view&pbancSn={pbanc_sn}"
    )

    def __init__(self):
        self.list_url = KSTARTUP_URL
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/120.0.0.0 Safari/537.36"
            ),
        })

    def crawl(self, max_pages=None, crawl_details=True) -> list[Announcement]:
        """전체 크롤링 파이프라인: 목록 수집 → 상세 크롤링."""
        max_pages = max_pages or MAX_PAGES

        # 1단계: 총 페이지 수 파악
        total_pages = self._get_total_pages()
        actual_pages = min(total_pages, max_pages)
        print(f"[K-Startup] 총 {total_pages}페이지 중 {actual_pages}페이지 크롤링", file=sys.stderr)

        # 2단계: 목록 페이지 수집
        list_items = []
        for page in range(1, actual_pages + 1):
            print(f"[K-Startup] 목록 페이지 {page}/{actual_pages} 수집 중...", file=sys.stderr)
            items = self._crawl_list_page(page)
            list_items.extend(items)
            if page < actual_pages:
                time.sleep(REQUEST_DELAY)

        # 중복 제거
        seen = set()
        unique_items = []
        for item in list_items:
            if item["pbancSn"] not in seen:
                seen.add(item["pbancSn"])
                unique_items.append(item)
        print(f"[K-Startup] 목록에서 {len(unique_items)}건 수집 (중복 제거)", file=sys.stderr)

        if not crawl_details:
            return [self._list_item_to_announcement(item) for item in unique_items]

        # 3단계: 상세 페이지 순차 크롤링
        announcements = []
        for i, item in enumerate(unique_items, 1):
            print(f"[K-Startup] 상세 크롤링 {i}/{len(unique_items)}: {item['title'][:40]}...", file=sys.stderr)
            announcement = self._crawl_detail(item)
            announcements.append(announcement)
            if i < len(unique_items):
                time.sleep(DETAIL_DELAY)

        print(f"[K-Startup] 총 {len(announcements)}건 상세 수집 완료", file=sys.stderr)
        return announcements

    def _get_total_pages(self) -> int:
        """첫 페이지에서 fn_egov_link_page(N) 패턴을 파싱하여 총 페이지 수를 구한다."""
        try:
            resp = self.session.get(
                self.list_url, params={"page": 1}, timeout=TIMEOUT
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[K-Startup] 첫 페이지 요청 실패: {e}", file=sys.stderr)
            return 1

        matches = re.findall(r"fn_egov_link_page\((\d+)\)", resp.text)
        if matches:
            return max(int(m) for m in matches)
        return 1

    def _crawl_list_page(self, page_no: int) -> list[dict]:
        """목록 페이지를 크롤링하여 공고 기본 정보 목록을 반환한다."""
        try:
            resp = self.session.get(
                self.list_url, params={"page": page_no}, timeout=TIMEOUT
            )
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[K-Startup] 목록 페이지 {page_no} 요청 실패: {e}", file=sys.stderr)
            return []

        return self._parse_list(resp.text)

    def _parse_list(self, html: str) -> list[dict]:
        """목록 HTML에서 CSS 선택자로 공고 기본 정보를 추출한다."""
        soup = BeautifulSoup(html, "lxml")
        items = []

        # n8n 워크플로우 검증 선택자
        links = soup.select(".middle a[href*='go_view']")
        titles = soup.select(".middle a[href*='go_view'] p.tit")
        fields = soup.select(".middle li .top .flag:not(.day)")
        ddays = soup.select(".middle li .flag.day")
        agencies = soup.select(".middle li .flag_agency")

        for i, link_el in enumerate(links):
            href = link_el.get("href", "")
            match = re.search(r"go_view\((\d+)\)", href)
            if not match:
                continue

            pbanc_sn = match.group(1)
            title = titles[i].get_text(strip=True) if i < len(titles) else ""
            field = fields[i].get_text(strip=True) if i < len(fields) else ""
            dday = ddays[i].get_text(strip=True) if i < len(ddays) else ""
            agency = agencies[i].get_text(strip=True) if i < len(agencies) else ""

            items.append({
                "pbancSn": pbanc_sn,
                "title": title,
                "field": field,
                "dday": dday,
                "agency": agency,
                "detailUrl": self.DETAIL_URL_TEMPLATE.format(pbanc_sn=pbanc_sn),
            })

        return items

    def _crawl_detail(self, list_item: dict) -> Announcement:
        """상세 페이지를 크롤링하여 Announcement 객체를 반환한다."""
        detail_url = list_item["detailUrl"]
        try:
            resp = self.session.get(detail_url, timeout=TIMEOUT)
            resp.raise_for_status()
        except requests.RequestException as e:
            print(f"[K-Startup] 상세 요청 실패 (pbancSn={list_item['pbancSn']}): {e}", file=sys.stderr)
            return self._list_item_to_announcement(list_item)

        return self._parse_detail(resp.text, list_item)

    def _parse_detail(self, html: str, list_item: dict) -> Announcement:
        """상세 HTML에서 메타정보, 본문, 첨부파일을 추출한다."""
        soup = BeautifulSoup(html, "lxml")

        # 제목
        title_el = soup.select_one(".title h3")
        title = title_el.get_text(strip=True) if title_el else list_item.get("title", "")

        # 메타정보: key-value 쌍 추출
        meta_keys = [el.get_text(strip=True) for el in soup.select(".dot_list .table_inner p.tit")]
        meta_values = [el.get_text(strip=True) for el in soup.select(".dot_list .table_inner p.txt")]
        meta = {}
        for k, v in zip(meta_keys, meta_values):
            if k and v:
                meta[k] = v

        # 본문
        content_el = soup.select_one(".box .box_inner")
        content_text = content_el.get_text(strip=True)[:5000] if content_el else ""

        # 첨부파일
        file_names = [el.get_text(strip=True) for el in soup.select(".board_file li a.file_bg")]
        file_urls = [el.get("href", "") for el in soup.select(".board_file li a.btn_down")]
        attachments = []
        for name, url in zip(file_names, file_urls):
            if name and url:
                if not url.startswith("http"):
                    url = f"{self.BASE_URL}{url}"
                attachments.append({"fileName": name, "downloadUrl": url})

        return Announcement(
            pbancSn=list_item.get("pbancSn", ""),
            source="K-Startup",
            title=title,
            supportField=meta.get("지원분야", list_item.get("field", "")),
            targetAge=meta.get("대상연령", ""),
            orgType=meta.get("기관구분", ""),
            department=meta.get("담당부서", ""),
            region=meta.get("지역", ""),
            receptionPeriod=meta.get("접수기간", ""),
            supervisionOrg=meta.get("주관기관명", ""),
            target=meta.get("대상", ""),
            bizExperience=meta.get("창업업력", ""),
            contact=meta.get("연락처", ""),
            contentText=content_text,
            attachments=attachments,
            detailUrl=list_item.get("detailUrl", ""),
            crawledAt="",
        )

    @staticmethod
    def _list_item_to_announcement(item: dict) -> Announcement:
        """목록 정보만으로 간략한 Announcement를 생성한다 (상세 크롤링 실패시 폴백)."""
        return Announcement(
            pbancSn=item.get("pbancSn", ""),
            source="K-Startup",
            title=item.get("title", ""),
            supportField=item.get("field", ""),
            detailUrl=item.get("detailUrl", ""),
        )
