import { useState } from "react";
import {
  extractWithTesseract,
  type OcrLocalResponse,
} from "../utils/ocr-local";
import type { CompanyFormData } from "../actions/recommend";

export function useOcr(
  onExtracted: (patch: Partial<CompanyFormData>) => void
) {
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [rawText, setRawText] = useState("");

  async function handleOcr(file: File) {
    setPending(true);
    setError("");
    try {
      const res: OcrLocalResponse = await extractWithTesseract(file);
      setPending(false);

      if (!res.success) {
        setError(res.error);
        return;
      }

      setRawText(res.raw_text);
      console.log("=== OCR Raw Text ===\n", res.raw_text);

      onExtracted({
        company_name: res.data.company_name || undefined,
        ceo_name: res.data.ceo_name || undefined,
        address: res.data.address || undefined,
        established_date: res.data.established_date || undefined,
        main_industry: res.data.main_industry || undefined,
        main_sector: res.data.main_sector || undefined,
      });
      setDone(true);
    } catch (err) {
      setPending(false);
      const message = err instanceof Error ? err.message : "알 수 없는 오류";
      setError(`OCR 오류: ${message}`);
      console.error("OCR error:", err);
    }
  }

  return { done, pending, error, rawText, handleOcr };
}
