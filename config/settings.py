import os
from dotenv import load_dotenv

load_dotenv()

# 크롤링 대상 사이트
BIZINFO_URL = "https://www.bizinfo.go.kr/web/lay1/bbs/S1T122C128/AS/74/list.do"
KSTARTUP_URL = "https://www.k-startup.go.kr/web/contents/bizpbanc-ongoing.do"

# 크롤링 설정
REQUEST_DELAY = 2  # 요청 간 대기 시간 (초)
MAX_PAGES = 10  # 최대 크롤링 페이지 수
TIMEOUT = 30  # 요청 타임아웃 (초)

# 출력 설정
OUTPUT_DIR = os.path.join(os.path.dirname(os.path.dirname(__file__)), "output")
REPORT_FORMAT = "xlsx"  # xlsx 또는 pdf
