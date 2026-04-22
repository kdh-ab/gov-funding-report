import os
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.dirname(__file__))

# 크롤링 대상 사이트
BIZINFO_URL = "https://www.bizinfo.go.kr/sii/siia/selectSIIA200View.do"
KSTARTUP_URL = "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do"

# 크롤링 설정
REQUEST_DELAY = 2  # 목록 페이지 요청 간 대기 시간 (초)
DETAIL_DELAY = 1  # 상세 페이지 요청 간 대기 시간 (초)
MAX_PAGES = 10  # 최대 크롤링 페이지 수
TIMEOUT = 30  # 요청 타임아웃 (초)

# 데이터 경로
DATA_DIR = os.path.join(BASE_DIR, "data")
CACHE_DIR = os.path.join(DATA_DIR, "cache")
COMPANY_DIR = os.path.join(DATA_DIR, "companies")

# 출력 설정
OUTPUT_DIR = os.path.join(BASE_DIR, "output")
REPORT_FORMAT = "xlsx"  # xlsx 또는 pdf

# 로그 설정
LOG_DIR = os.path.join(BASE_DIR, "logs")
REPORT_LOG_FILE = os.path.join(LOG_DIR, "report_history.jsonl")
