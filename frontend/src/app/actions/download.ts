"use server";

export type DownloadResult =
  | { success: true; base64: string; filename: string; mimeType: string }
  | { success: false; error: string };

export async function generateReport(
  companyName: string,
  format: "xlsx" | "pdf",
  companyData?: Record<string, string>
): Promise<DownloadResult> {
  if (!companyName) {
    return { success: false, error: "기업명이 필요합니다." };
  }

  const apiUrl = process.env.API_URL || "http://localhost:8000";

  try {
    const resp = await fetch(`${apiUrl}/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company: companyData || { company_name: companyName },
        format,
      }),
    });

    const result = await resp.json();
    if (result.error) {
      return { success: false, error: result.error };
    }

    return {
      success: true,
      base64: result.base64,
      filename: result.filename,
      mimeType: result.mime_type,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return { success: false, error: `보고서 생성 실패: ${message}` };
  }
}
