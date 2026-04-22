"use server";

import Anthropic from "@anthropic-ai/sdk";

export interface OcrResult {
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
}

export interface OcrError {
  success: false;
  error: string;
}

export type OcrResponse = OcrResult | OcrError;

export async function extractFromBusinessLicense(
  formData: FormData
): Promise<OcrResponse> {
  const file = formData.get("file") as File | null;
  if (!file) {
    return { success: false, error: "파일이 선택되지 않았습니다." };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === "your-api-key-here") {
    return {
      success: false,
      error: "ANTHROPIC_API_KEY가 설정되지 않았습니다. .env.local 파일을 확인하세요.",
    };
  }

  // 파일을 base64로 변환
  const bytes = await file.arrayBuffer();
  const base64 = Buffer.from(bytes).toString("base64");

  // 이미지 타입 결정
  const mimeType = file.type as
    | "image/jpeg"
    | "image/png"
    | "image/webp"
    | "image/gif";
  if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(mimeType)) {
    return {
      success: false,
      error: "지원하지 않는 이미지 형식입니다. JPG, PNG, WebP만 가능합니다.",
    };
  }

  const client = new Anthropic({ apiKey });

  try {
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            {
              type: "text",
              text: `이 사업자등록증 이미지에서 아래 정보를 추출해 JSON으로 반환해주세요.
반드시 아래 형식의 JSON만 반환하세요. 다른 텍스트 없이 JSON만 출력하세요.

{
  "company_name": "상호(법인명)",
  "ceo_name": "대표자",
  "address": "사업장 소재지 (전체 주소)",
  "established_date": "개업연월일 (YYYY-MM-DD 형식)",
  "main_industry": "업태",
  "main_sector": "종목",
  "business_number": "사업자등록번호 (000-00-00000 형식)"
}

읽을 수 없는 항목은 빈 문자열("")로 남겨주세요.`,
            },
          ],
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    // JSON 추출 (코드블록 안에 있을 수 있음)
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      return { success: false, error: "OCR 결과를 파싱할 수 없습니다." };
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      success: true,
      data: {
        company_name: parsed.company_name || "",
        ceo_name: parsed.ceo_name || "",
        address: parsed.address || "",
        established_date: parsed.established_date || "",
        main_industry: parsed.main_industry || "",
        main_sector: parsed.main_sector || "",
        business_number: parsed.business_number || "",
      },
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return { success: false, error: `OCR 처리 실패: ${message}` };
  }
}
