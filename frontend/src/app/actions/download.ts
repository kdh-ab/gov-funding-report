"use server";

import { execFile } from "child_process";
import { readFile } from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export type DownloadResult =
  | { success: true; base64: string; filename: string; mimeType: string }
  | { success: false; error: string };

export async function generateReport(
  companyName: string,
  format: "xlsx" | "pdf"
): Promise<DownloadResult> {
  if (!companyName) {
    return { success: false, error: "기업명이 필요합니다." };
  }

  const projectRoot = path.resolve(process.cwd(), "..");

  try {
    const { stdout } = await execFileAsync(
      "python3",
      [path.join(projectRoot, "run_report.py"), companyName, format],
      { cwd: projectRoot, timeout: 60000, maxBuffer: 10 * 1024 * 1024 }
    );

    const result = JSON.parse(stdout);
    if (result.error) {
      return { success: false, error: result.error };
    }

    // 파일을 읽어서 base64로 반환
    const fileBuffer = await readFile(result.filepath);
    const base64 = fileBuffer.toString("base64");
    const filename = path.basename(result.filepath);
    const mimeType =
      format === "xlsx"
        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        : "application/pdf";

    return { success: true, base64, filename, mimeType };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return { success: false, error: `보고서 생성 실패: ${message}` };
  }
}
