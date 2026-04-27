from __future__ import annotations
import os
import tempfile
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(__file__))
IS_VERCEL = os.environ.get("VERCEL") == "1"

# DB 연결 (Vercel Postgres / Neon)
DATABASE_URL = os.environ.get("DATABASE_URL") or os.environ.get("POSTGRES_URL")

# 크롤링 대상 사이트
BIZINFO_URL = "https://www.bizinfo.go.kr/sii/siia/selectSIIA200View.do"
KSTARTUP_URL = "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do"

# 크롤링 설정
REQUEST_DELAY = 2  # 목록 페이지 요청 간 대기 시간 (초)
DETAIL_DELAY = 1  # 상세 페이지 요청 간 대기 시간 (초)
MAX_PAGES = 10  # 최대 크롤링 페이지 수
TIMEOUT = 30  # 요청 타임아웃 (초)

# 시드 데이터 경로 (번들에 포함)
SEED_DATA_PATH = os.path.join(BASE_DIR, "data", "seed", "result.json")

# 데이터 ���로 — Vercel은 /tmp 사용 (stateless)
if IS_VERCEL:
    _tmp = tempfile.gettempdir()
    DATA_DIR = os.path.join(_tmp, "data")
    CACHE_DIR = os.path.join(_tmp, "cache")
    COMPANY_DIR = os.path.join(_tmp, "companies")
    OUTPUT_DIR = os.path.join(_tmp, "output")
    LOG_DIR = os.path.join(_tmp, "logs")
else:
    DATA_DIR = os.path.join(BASE_DIR, "data")
    CACHE_DIR = os.path.join(DATA_DIR, "cache")
    COMPANY_DIR = os.path.join(DATA_DIR, "companies")
    OUTPUT_DIR = os.path.join(BASE_DIR, "output")
    LOG_DIR = os.path.join(BASE_DIR, "logs")

REPORT_FORMAT = "xlsx"  # xlsx 또는 pdf
REPORT_LOG_FILE = os.path.join(LOG_DIR, "report_history.jsonl")
