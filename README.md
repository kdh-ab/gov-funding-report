# 정부지원사업 크롤링 보고서 생성 모듈

정부지원사업 공고를 크롤링하여 분석 보고서를 자동 생성하는 모듈입니다.

## 주요 기능

- 정부지원사업 공고 크롤링 (BIZINFO, K-Startup 등)
- 공고 데이터 파싱 및 정제
- 보고서 자동 생성 (PDF/Excel)

## 설치

```bash
pip install -r requirements.txt
```

## 사용법

```bash
python main.py
```

## 프로젝트 구조

```
gov-funding-report/
├── main.py              # 진입점
├── crawler/             # 크롤러 모듈
│   ├── __init__.py
│   ├── bizinfo.py       # BIZINFO 크롤러
│   └── kstartup.py      # K-Startup 크롤러
├── parser/              # 데이터 파싱 모듈
│   ├── __init__.py
│   └── announcement.py  # 공고 파서
├── report/              # 보고서 생성 모듈
│   ├── __init__.py
│   └── generator.py     # 보고서 생성기
├── config/              # 설정
│   └── settings.py
├── requirements.txt
└── README.md
```
