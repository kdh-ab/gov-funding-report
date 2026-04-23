export interface OcrLocalResult {
  success: true;
  data: {
    company_name: string;
    ceo_name: string;
    address: string;
    established_date: string;
    main_industry: string;
    main_sector: string;
    business_number: string;
  };
  raw_text: string;
}

export interface OcrLocalError {
  success: false;
  error: string;
}

export type OcrLocalResponse = OcrLocalResult | OcrLocalError;

/**
 * 사업자등록증 이미지에서 Tesseract.js(브라우저 OCR)로 텍스트를 추출하고
 * 정규식으로 주요 필드를 파싱합니다.
 */
export async function extractWithTesseract(
  file: File
): Promise<OcrLocalResponse> {
  try {
    // 동적 import — Next.js SSR에서 로딩 방지
    const Tesseract = await import("tesseract.js");
    const recognize = Tesseract.recognize || Tesseract.default?.recognize;
    if (!recognize) {
      return { success: false, error: "Tesseract.js 로딩에 실패했습니다." };
    }

    // PDF인 경우 첫 페이지를 이미지로 변환
    let imageUrl: string;
    if (file.type === "application/pdf") {
      const pdfImage = await pdfToImage(file);
      if (!pdfImage.success) {
        return { success: false, error: pdfImage.error };
      }
      imageUrl = pdfImage.dataUrl;
    } else {
      imageUrl = URL.createObjectURL(file);
    }

    const result = await recognize(imageUrl, "kor+eng", {
      logger: () => {},
    });

    if (!file.type.startsWith("application/pdf")) {
      URL.revokeObjectURL(imageUrl);
    }

    const text = result.data.text;
    if (!text || text.trim().length < 10) {
      return { success: false, error: "이미지에서 텍스트를 인식하지 못했습니다. 더 선명한 이미지를 사용해주세요." };
    }

    const data = parseBusinessLicense(text);

    return { success: true, data, raw_text: text };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return { success: false, error: `OCR 처리 실패: ${message}` };
  }
}

/**
 * 사업자등록증 OCR 텍스트에서 정규식으로 필드를 추출합니다.
 */
function parseBusinessLicense(text: string) {
  // 줄 단위로 분리, 공백 정리
  const lines = text.split("\n").map((l) => l.replace(/\s+/g, " ").trim());
  const fullText = lines.join(" ");

  // 콜론 패턴: 반각(:), 전각(：) 모두 매칭
  const C = "[:\\：]";

  return {
    business_number: extractBusinessNumber(fullText),
    company_name: extractField(lines, fullText, [
      new RegExp(`법\\s*인\\s*명\\s*\\(?\\s*단\\s*체\\s*명\\s*\\)?\\s*${C}\\s*(.+)`),
      new RegExp(`상\\s*호\\s*\\(?\\s*법\\s*인\\s*명\\s*\\)?\\s*${C}\\s*(.+)`),
      new RegExp(`상\\s*호\\s*${C}\\s*(.+)`),
      new RegExp(`법\\s*인\\s*명\\s*${C}\\s*(.+)`),
      new RegExp(`단\\s*체\\s*명\\s*${C}\\s*(.+)`),
    ]),
    ceo_name: extractField(lines, fullText, [
      new RegExp(`대\\s*표\\s*자\\s*${C}\\s*(.+)`),
      new RegExp(`성\\s*명\\s*${C}\\s*(.+)`),
    ]),
    address: extractField(lines, fullText, [
      new RegExp(`사\\s*업\\s*장\\s*소\\s*재\\s*지\\s*${C}\\s*(.+)`),
      new RegExp(`소\\s*재\\s*지\\s*${C}\\s*(.+)`),
      new RegExp(`주\\s*소\\s*${C}\\s*(.+)`),
    ]),
    established_date: extractDate(fullText, [
      new RegExp(`개\\s*업\\s*연\\s*월\\s*일\\s*${C}\\s*(\\d{4}[\\s.\\-/년]*\\d{1,2}[\\s.\\-/월]*\\d{1,2})`),
      new RegExp(`개\\s*업\\s*일\\s*${C}\\s*(\\d{4}[\\s.\\-/년]*\\d{1,2}[\\s.\\-/월]*\\d{1,2})`),
    ]),
    ...extractBusinessType(lines),
  };
}

// 알려진 업태 키워드
const KNOWN_UPTAE = [
  "서비스", "제조업", "도매 및 소매업", "도매업", "소매업",
  "정보통신업", "건설업", "운수업", "숙박 및 음식점업",
  "전문, 과학 및 기술서비스업", "전문, 과학및기술서비스업",
  "교육서비스업", "보건업", "예술, 스포츠 및 여가관련 서비스업",
  "금융 및 보험업", "부동산업", "농업", "임업", "어업", "광업",
];

// 알려진 종목 키워드 (일부)
const KNOWN_JONGMOK = [
  "소프트웨어", "광고", "전자상거래", "포털", "컨설팅",
  "연구개발", "디자인", "촬영", "사진", "미디어", "콘텐츠",
  "제조", "도소매", "유통", "교육", "의료", "건축", "시공",
];

/**
 * 업태/종목을 추출합니다.
 * 사업자등록증의 테이블 형식은 OCR이 컬럼별로 따로 읽기 때문에
 * 키워드 매칭 방식으로 추출합니다.
 */
function extractBusinessType(lines: string[]): {
  main_industry: string;
  main_sector: string;
} {
  const uptaeFound: string[] = [];
  const jongmokFound: string[] = [];

  for (const line of lines) {
    // "업태" 또는 "종목" 헤더 줄 자체는 건너뜀
    if (/^업\s*태\s*종?\s*목?$/.test(line)) continue;
    if (/^사\s*업\s*의\s*종\s*류/.test(line)) continue;

    // 알려진 업태 매칭
    for (const u of KNOWN_UPTAE) {
      if (line.includes(u) && !uptaeFound.includes(u)) {
        uptaeFound.push(u);
      }
    }

    // 종목: "~업" 으로 끝나는 패턴 수집
    const jongmokMatch = line.match(/^(.+업)$/);
    if (jongmokMatch) {
      const val = jongmokMatch[1].trim();
      // 업태에 이미 잡힌 것이면 건너뜀
      if (!KNOWN_UPTAE.some((u) => val === u) && !jongmokFound.includes(val)) {
        jongmokFound.push(val);
      }
    }

    // 종목 키워드 매칭 (끝이 "업"이 아닌 경우)
    for (const j of KNOWN_JONGMOK) {
      if (line.includes(j) && !jongmokFound.some((f) => f.includes(j))) {
        // "~업"으로 끝나는 전체 줄이 있으면 그걸 사용
        if (!jongmokFound.includes(line) && line.length < 30) {
          jongmokFound.push(line);
        }
      }
    }
  }

  return {
    main_industry: uptaeFound.join(", ") || "",
    main_sector: jongmokFound.join(", ") || "",
  };
}

function extractBusinessNumber(text: string): string {
  // 사업자등록번호: 000-00-00000 패턴
  const match = text.match(/(\d{3})\s*[-–]\s*(\d{2})\s*[-–]\s*(\d{5})/);
  return match ? `${match[1]}-${match[2]}-${match[3]}` : "";
}

function extractField(
  lines: string[],
  fullText: string,
  patterns: RegExp[]
): string {
  for (const pattern of patterns) {
    // 줄 단위 매칭
    for (const line of lines) {
      const match = line.match(pattern);
      if (match && match[1]) {
        return cleanValue(match[1]);
      }
    }
    // 전체 텍스트 매칭
    const match = fullText.match(pattern);
    if (match && match[1]) {
      return cleanValue(match[1]);
    }
  }
  return "";
}

function extractDate(text: string, patterns: RegExp[]): string {
  // 패턴 매칭 시도
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const nums = match[1].match(/\d+/g);
      if (nums && nums.length >= 3) {
        const y = nums[0];
        const m = nums[1].padStart(2, "0");
        const d = nums[2].padStart(2, "0");
        return `${y}-${m}-${d}`;
      }
    }
  }

  // fallback: "개업연월일" 근처에서 "YYYY년 MM월 DD일" 패턴 찾기
  const fallback = text.match(
    /개\s*업\s*연?\s*월?\s*일?\s*[:\：]?\s*(\d{4})\s*년?\s*(\d{1,2})\s*월?\s*(\d{1,2})\s*일?/
  );
  if (fallback) {
    const y = fallback[1];
    const m = fallback[2].padStart(2, "0");
    const d = fallback[3].padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  return "";
}

function cleanValue(val: string): string {
  return val
    .replace(/[[\]{}]/g, "")
    .replace(/\(?\s*주\s*\)\s*/g, "") // (주), 주) 제거
    .replace(/주식회사\s*/g, "")
    .replace(/\(\s*\)/g, "") // 빈 괄호 제거
    .replace(/\s{2,}/g, " ")
    .trim()
    .split(/\s{2,}|[,;]/)[0] // 다음 필드 값이 이어붙는 경우 잘라냄
    .trim();
}

/**
 * PDF 첫 페이지를 canvas로 렌더링한 뒤 data URL(PNG)로 변환합니다.
 */
async function pdfToImage(
  file: File
): Promise<{ success: true; dataUrl: string } | { success: false; error: string }> {
  try {
    const pdfjsLib = await import("pdfjs-dist");
    pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
      "pdfjs-dist/build/pdf.worker.min.mjs",
      import.meta.url
    ).toString();

    const arrayBuffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
    const page = await pdf.getPage(1);

    // 고해상도 렌더링 (OCR 정확도 향상)
    const scale = 3;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) {
      return { success: false, error: "Canvas 생성에 실패했습니다." };
    }

    await page.render({ canvas, canvasContext: ctx, viewport }).promise;
    const dataUrl = canvas.toDataURL("image/png");

    return { success: true, dataUrl };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return { success: false, error: `PDF 변환 실패: ${message}` };
  }
}
