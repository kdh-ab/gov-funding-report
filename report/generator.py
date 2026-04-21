"""보고서 생성 모듈"""

import os
from datetime import datetime

import pandas as pd
from config.settings import OUTPUT_DIR, REPORT_FORMAT


class ReportGenerator:
    """크롤링 데이터를 기반으로 보고서 생성"""

    def __init__(self):
        os.makedirs(OUTPUT_DIR, exist_ok=True)

    def generate(self, data, title="정부지원사업 공고 보고서", fmt=None):
        """보고서 생성 (xlsx 또는 pdf)"""
        fmt = fmt or REPORT_FORMAT
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if fmt == "xlsx":
            return self._generate_excel(data, title, timestamp)
        elif fmt == "pdf":
            return self._generate_pdf(data, title, timestamp)
        else:
            raise ValueError(f"지원하지 않는 형식: {fmt}")

    def _generate_excel(self, data, title, timestamp):
        """Excel 보고서 생성"""
        filepath = os.path.join(OUTPUT_DIR, f"gov_funding_report_{timestamp}.xlsx")

        df = pd.DataFrame(data)
        column_map = {
            "source": "출처",
            "title": "사업명",
            "organization": "주관기관",
            "start_date": "접수시작",
            "end_date": "접수마감",
            "status": "상태",
            "link": "링크",
        }
        df = df.rename(columns=column_map)

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="전체 공고", index=False)

            active = df[df["상태"] == "접수중"]
            if not active.empty:
                active.to_excel(writer, sheet_name="접수중", index=False)

            # 출처별 통계
            stats = df.groupby("출처")["상태"].value_counts().unstack(fill_value=0)
            stats.to_excel(writer, sheet_name="통계")

        print(f"Excel 보고서 생성 완료: {filepath}")
        return filepath

    def _generate_pdf(self, data, title, timestamp):
        """PDF 보고서 생성"""
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet

        filepath = os.path.join(OUTPUT_DIR, f"gov_funding_report_{timestamp}.pdf")

        doc = SimpleDocTemplate(filepath, pagesize=landscape(A4))
        styles = getSampleStyleSheet()
        elements = []

        # 제목
        elements.append(Paragraph(title, styles["Title"]))
        elements.append(Spacer(1, 10 * mm))

        # 테이블 데이터
        headers = ["출처", "사업명", "주관기관", "접수시작", "접수마감", "상태"]
        table_data = [headers]
        for item in data:
            table_data.append([
                item.get("source", ""),
                item.get("title", "")[:40],
                item.get("organization", ""),
                item.get("start_date", ""),
                item.get("end_date", ""),
                item.get("status", ""),
            ])

        table = Table(table_data)
        table.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, 0), colors.grey),
            ("TEXTCOLOR", (0, 0), (-1, 0), colors.whitesmoke),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("GRID", (0, 0), (-1, -1), 0.5, colors.black),
            ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.lightgrey]),
        ]))
        elements.append(table)

        doc.build(elements)
        print(f"PDF 보고서 생성 완료: {filepath}")
        return filepath
