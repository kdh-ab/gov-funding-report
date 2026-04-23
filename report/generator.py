"""보고서 생성 모듈 — CEO 관점 맞춤형 추천 보고서."""

import os
import sys
from datetime import datetime

import pandas as pd
from config.settings import OUTPUT_DIR, REPORT_FORMAT
from data.models import CompanyProfile, MatchResult


class ReportGenerator:
    """맞춤형 정부지원사업 추천 보고서 생성."""

    def __init__(self):
        os.makedirs(OUTPUT_DIR, exist_ok=True)

    def generate(self, data, title="정부지원사업 공고 보고서", fmt=None):
        """기존 호환용: 단순 공고 목록 보고서 생성."""
        fmt = fmt or REPORT_FORMAT
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if fmt == "xlsx":
            return self._generate_simple_excel(data, title, timestamp)
        elif fmt == "pdf":
            return self._generate_simple_pdf(data, title, timestamp)
        else:
            raise ValueError(f"지원하지 않는 형식: {fmt}")

    def generate_recommendation(
        self,
        matches: list,
        profile: CompanyProfile,
        all_announcements: list = None,
        fmt: str = None,
    ) -> str:
        """맞춤형 추천 보고서 생성."""
        fmt = fmt or REPORT_FORMAT
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")

        if fmt == "xlsx":
            return self._generate_recommendation_excel(
                matches, profile, all_announcements, timestamp
            )
        elif fmt == "pdf":
            return self._generate_recommendation_pdf(
                matches, profile, timestamp
            )
        else:
            raise ValueError(f"지원하지 않는 형식: {fmt}")

    # ──────────────────────────────────────────────
    #  맞춤형 추천 보고서 (Excel)
    # ──────────────────────────────────────────────

    def _generate_recommendation_excel(self, matches, profile, all_announcements, timestamp):
        filepath = os.path.join(
            OUTPUT_DIR, f"recommendation_{profile.company_name}_{timestamp}.xlsx"
        )

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            # 시트 1: 기업 프로필
            profile_data = {
                "항목": [
                    "기업명", "대표자명", "대표자 생년월일", "대표자 성별",
                    "소재지", "설립연월일", "주업종", "주요산업", "사업아이템",
                    "대표자 나이(만)", "업력(년)",
                ],
                "내용": [
                    profile.company_name, profile.ceo_name,
                    profile.ceo_birth_date, "여성" if profile.ceo_gender == "F" else "남성",
                    profile.address, profile.established_date,
                    profile.main_industry, profile.main_sector,
                    profile.business_item_summary,
                    str(profile.get_ceo_age() or "-"),
                    str(profile.get_biz_years() or "-"),
                ],
            }
            pd.DataFrame(profile_data).to_excel(
                writer, sheet_name="기업 프로필", index=False
            )

            # 시트 2: 추천 공고
            rec_rows = []
            for rank, m in enumerate(matches, 1):
                a = m.announcement
                rec_rows.append({
                    "순위": rank,
                    "적합도": f"{'▐' * m.level}{'·' * (5 - m.level)}",
                    "사업명": a.title,
                    "지원분야": a.supportField,
                    "주관기관": a.supervisionOrg,
                    "접수기간": a.receptionPeriod,
                    "지역": a.region,
                    "대상연령": a.targetAge,
                    "창업업력": a.bizExperience,
                    "추천사유": " / ".join(m.match_reasons),
                    "연락처": a.contact,
                    "상세URL": a.detailUrl,
                })
            pd.DataFrame(rec_rows).to_excel(
                writer, sheet_name="추천 공고", index=False
            )

            # 시트 3: 전체 공고 (있는 경우)
            if all_announcements:
                all_rows = []
                for a in all_announcements:
                    all_rows.append({
                        "출처": a.source,
                        "사업명": a.title,
                        "지원분야": a.supportField,
                        "주관기관": a.supervisionOrg,
                        "접수기간": a.receptionPeriod,
                        "지역": a.region,
                        "대상연령": a.targetAge,
                        "상태": "접수중" if a.receptionPeriod else "",
                        "상세URL": a.detailUrl,
                    })
                pd.DataFrame(all_rows).to_excel(
                    writer, sheet_name="전체 공고", index=False
                )

            # 시트 4: 통계
            if matches:
                stats_data = [m.announcement for m in matches]
                df_stats = pd.DataFrame([{
                    "지원분야": a.supportField or "미분류",
                    "지역": a.region or "미분류",
                    "기관구분": a.orgType or "미분류",
                } for a in stats_data])

                field_counts = df_stats["지원분야"].value_counts()
                region_counts = df_stats["지역"].value_counts()
                org_counts = df_stats["기관구분"].value_counts()

                stats_df = pd.DataFrame({
                    "지원분야": field_counts.index.tolist() + [""] * max(0, len(region_counts) - len(field_counts)),
                    "분야별 건수": field_counts.values.tolist() + [None] * max(0, len(region_counts) - len(field_counts)),
                })

                # 각 통계를 별도 DataFrame으로
                pd.DataFrame({"지원분야": field_counts.index, "건수": field_counts.values}).to_excel(
                    writer, sheet_name="통계", index=False, startrow=0
                )
                start = len(field_counts) + 3
                pd.DataFrame({"지역": region_counts.index, "건수": region_counts.values}).to_excel(
                    writer, sheet_name="통계", index=False, startrow=start
                )
                start += len(region_counts) + 3
                pd.DataFrame({"기관구분": org_counts.index, "건수": org_counts.values}).to_excel(
                    writer, sheet_name="통계", index=False, startrow=start
                )

        print(f"추천 보고서(Excel) 생성 완료: {filepath}", file=sys.stderr)
        return filepath

    # ──────────────────────────────────────────────
    #  맞춤형 추천 보고서 (PDF)
    # ──────────────────────────────────────────────

    def _generate_recommendation_pdf(self, matches, profile, timestamp):
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.units import mm
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.platypus import (
            SimpleDocTemplate, Table, TableStyle,
            Paragraph, Spacer, KeepTogether,
        )
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        filepath = os.path.join(
            OUTPUT_DIR, f"recommendation_{profile.company_name}_{timestamp}.pdf"
        )

        # 한글 폰트 등록
        font_name = self._register_korean_font()

        doc = SimpleDocTemplate(
            filepath, pagesize=A4,
            topMargin=20 * mm, bottomMargin=20 * mm,
            leftMargin=15 * mm, rightMargin=15 * mm,
        )
        elements = []

        # 스타일 정의
        title_style = ParagraphStyle(
            "CustomTitle", fontName=font_name, fontSize=18,
            leading=24, alignment=1, spaceAfter=5 * mm,
        )
        subtitle_style = ParagraphStyle(
            "Subtitle", fontName=font_name, fontSize=10,
            leading=14, alignment=1, textColor=colors.grey, spaceAfter=10 * mm,
        )
        heading_style = ParagraphStyle(
            "Heading", fontName=font_name, fontSize=13,
            leading=18, spaceBefore=8 * mm, spaceAfter=4 * mm,
            textColor=colors.HexColor("#1a1a2e"),
        )
        body_style = ParagraphStyle(
            "Body", fontName=font_name, fontSize=9, leading=13,
        )
        small_style = ParagraphStyle(
            "Small", fontName=font_name, fontSize=8, leading=11,
            textColor=colors.grey,
        )
        card_title_style = ParagraphStyle(
            "CardTitle", fontName=font_name, fontSize=11,
            leading=15, textColor=colors.HexColor("#16213e"),
        )
        reason_style = ParagraphStyle(
            "Reason", fontName=font_name, fontSize=8,
            leading=11, textColor=colors.HexColor("#0f9b58"),
        )

        # ── 표지 ──
        elements.append(Spacer(1, 30 * mm))
        elements.append(Paragraph(
            f"{profile.company_name} 맞춤형<br/>정부지원사업 추천 보고서",
            title_style,
        ))
        gen_date = datetime.now().strftime("%Y년 %m월 %d일")
        elements.append(Paragraph(f"생성일: {gen_date}", subtitle_style))

        # ── 기업 프로필 요약 ──
        elements.append(Paragraph("기업 프로필", heading_style))
        profile_rows = [
            ["기업명", profile.company_name, "대표자", profile.ceo_name],
            ["소재지", profile.address, "설립일", profile.established_date],
            ["주업종", profile.main_industry, "주요산업", profile.main_sector],
            ["사업아이템", profile.business_item_summary, "", ""],
            [
                "대표자 나이",
                f"만 {profile.get_ceo_age()}세" if profile.get_ceo_age() else "-",
                "업력",
                f"{profile.get_biz_years()}년" if profile.get_biz_years() else "-",
            ],
        ]
        profile_table = Table(profile_rows, colWidths=[55, 140, 45, 140])
        profile_table.setStyle(TableStyle([
            ("FONTNAME", (0, 0), (-1, -1), font_name),
            ("FONTSIZE", (0, 0), (-1, -1), 8),
            ("BACKGROUND", (0, 0), (0, -1), colors.HexColor("#f0f0f5")),
            ("BACKGROUND", (2, 0), (2, -1), colors.HexColor("#f0f0f5")),
            ("TEXTCOLOR", (0, 0), (0, -1), colors.HexColor("#555555")),
            ("TEXTCOLOR", (2, 0), (2, -1), colors.HexColor("#555555")),
            ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#dddddd")),
            ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("SPAN", (1, 3), (3, 3)),  # 사업아이템 칸 병합
        ]))
        elements.append(profile_table)

        # ── 추천 요약 ──
        elements.append(Paragraph(
            f"추천 공고 요약 (총 {len(matches)}건)",
            heading_style,
        ))

        # ── 추천 공고 TOP 10 카드 ──
        top_n = matches[:10]
        for rank, m in enumerate(top_n, 1):
            a = m.announcement
            card_elements = []
            card_elements.append(Paragraph(
                f"<b>{rank}.</b> {self._escape_xml(a.title)}",
                card_title_style,
            ))

            info_parts = []
            if a.supportField:
                info_parts.append(f"지원분야: {a.supportField}")
            if a.supervisionOrg:
                info_parts.append(f"주관: {a.supervisionOrg}")
            if a.receptionPeriod:
                info_parts.append(f"접수: {a.receptionPeriod}")
            if a.region:
                info_parts.append(f"지역: {a.region}")
            if a.contact:
                info_parts.append(f"연락처: {a.contact}")
            card_elements.append(Paragraph(
                " | ".join(info_parts), body_style
            ))

            if m.match_reasons:
                card_elements.append(Paragraph(
                    f"추천사유: {', '.join(m.match_reasons)}",
                    reason_style,
                ))
            if a.detailUrl:
                card_elements.append(Paragraph(
                    f"<link href=\"{a.detailUrl}\">{a.detailUrl}</link>",
                    small_style,
                ))
            card_elements.append(Spacer(1, 3 * mm))
            elements.append(KeepTogether(card_elements))

        # ── 전체 추천 목록 테이블 ──
        if len(matches) > 10:
            elements.append(Paragraph("전체 추천 목록", heading_style))
            table_header = ["순위", "사업명", "주관기관", "접수기간", "적합도"]
            table_rows = [table_header]
            for rank, m in enumerate(matches, 1):
                a = m.announcement
                table_rows.append([
                    str(rank),
                    a.title[:35] + ("..." if len(a.title) > 35 else ""),
                    a.supervisionOrg[:15],
                    a.receptionPeriod[:20],
                    f"{'▐' * m.level}{'·' * (5 - m.level)}",
                ])

            full_table = Table(
                table_rows,
                colWidths=[25, 180, 70, 80, 35],
            )
            full_table.setStyle(TableStyle([
                ("FONTNAME", (0, 0), (-1, -1), font_name),
                ("FONTSIZE", (0, 0), (-1, -1), 7),
                ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#1a1a2e")),
                ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
                ("ALIGN", (0, 0), (0, -1), "CENTER"),
                ("ALIGN", (-1, 0), (-1, -1), "CENTER"),
                ("GRID", (0, 0), (-1, -1), 0.3, colors.HexColor("#dddddd")),
                ("ROWBACKGROUNDS", (0, 1), (-1, -1), [
                    colors.white, colors.HexColor("#f8f8fc"),
                ]),
                ("TOPPADDING", (0, 0), (-1, -1), 3),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ]))
            elements.append(full_table)

        doc.build(elements)
        print(f"추천 보고서(PDF) 생성 완료: {filepath}", file=sys.stderr)
        return filepath

    # ──────────────────────────────────────────────
    #  기존 호환용 단순 보고서
    # ──────────────────────────────────────────────

    def _generate_simple_excel(self, data, title, timestamp):
        filepath = os.path.join(OUTPUT_DIR, f"gov_funding_report_{timestamp}.xlsx")
        df = pd.DataFrame(data)
        column_map = {
            "source": "출처", "title": "사업명", "organization": "주관기관",
            "start_date": "접수시작", "end_date": "접수마감",
            "status": "상태", "link": "링크",
        }
        df = df.rename(columns=column_map)

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            df.to_excel(writer, sheet_name="전체 공고", index=False)
            active = df[df.get("상태", pd.Series()) == "접수중"]
            if not active.empty:
                active.to_excel(writer, sheet_name="접수중", index=False)
            if "출처" in df.columns and "상태" in df.columns:
                stats = df.groupby("출처")["상태"].value_counts().unstack(fill_value=0)
                stats.to_excel(writer, sheet_name="통계")

        print(f"Excel 보고서 생성 완료: {filepath}", file=sys.stderr)
        return filepath

    def _generate_simple_pdf(self, data, title, timestamp):
        from reportlab.lib import colors
        from reportlab.lib.pagesizes import A4, landscape
        from reportlab.lib.units import mm
        from reportlab.platypus import SimpleDocTemplate, Table, TableStyle, Paragraph, Spacer
        from reportlab.lib.styles import getSampleStyleSheet

        filepath = os.path.join(OUTPUT_DIR, f"gov_funding_report_{timestamp}.pdf")
        doc = SimpleDocTemplate(filepath, pagesize=landscape(A4))
        styles = getSampleStyleSheet()
        elements = [
            Paragraph(title, styles["Title"]),
            Spacer(1, 10 * mm),
        ]

        headers = ["출처", "사업명", "주관기관", "접수시작", "접수마감", "상태"]
        table_data = [headers]
        for item in data:
            table_data.append([
                item.get("source", ""), item.get("title", "")[:40],
                item.get("organization", ""),
                item.get("start_date", ""), item.get("end_date", ""),
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
        print(f"PDF 보고서 생성 완료: {filepath}", file=sys.stderr)
        return filepath

    # ──────────────────────────────────────────────
    #  유틸리티
    # ──────────────────────────────────────────────

    @staticmethod
    def _register_korean_font() -> str:
        """시스템에서 한글 폰트를 찾아 등록한다. 등록된 폰트 이름을 반환."""
        from reportlab.pdfbase import pdfmetrics
        from reportlab.pdfbase.ttfonts import TTFont

        font_candidates = [
            # macOS
            "/System/Library/Fonts/AppleSDGothicNeo.ttc",
            "/System/Library/Fonts/Supplemental/AppleGothic.ttf",
            # Linux
            "/usr/share/fonts/truetype/nanum/NanumGothic.ttf",
            "/usr/share/fonts/nanum/NanumGothic.ttf",
        ]
        for path in font_candidates:
            if os.path.exists(path):
                try:
                    pdfmetrics.registerFont(TTFont("KoreanFont", path))
                    return "KoreanFont"
                except Exception:
                    continue

        return "Helvetica"  # 폴백

    @staticmethod
    def _escape_xml(text: str) -> str:
        """ReportLab Paragraph용 XML 이스케이프."""
        return (
            text.replace("&", "&amp;")
            .replace("<", "&lt;")
            .replace(">", "&gt;")
        )
