"use server";

import { execFile } from "child_process";
import { writeFile, mkdir } from "fs/promises";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);

export interface MatchedAnnouncement {
  rank: number;
  score: number;
  match_reasons: string[];
  announcement: {
    pbancSn: string;
    source: string;
    title: string;
    supportField: string;
    targetAge: string;
    orgType: string;
    region: string;
    receptionPeriod: string;
    supervisionOrg: string;
    target: string;
    bizExperience: string;
    contact: string;
    contentText: string;
    detailUrl: string;
  };
}

export interface CacheInfo {
  crawled_at: string;
  source: string;
  count: number;
}

export interface RecommendResult {
  success: true;
  company: Record<string, string>;
  total_announcements: number;
  recommended_count: number;
  crawled_at: string;
  cache_info?: CacheInfo | null;
  matches: MatchedAnnouncement[];
}

export interface RecommendError {
  success: false;
  error: string;
}

export type RecommendResponse = RecommendResult | RecommendError;

export interface CompanyFormData {
  company_name: string;
  ceo_name: string;
  ceo_birth_date: string;
  ceo_gender: string;
  address: string;
  established_date: string;
  main_industry: string;
  main_sector: string;
  business_item_summary: string;
}

function extractRegion(address: string): string {
  const map: Record<string, string> = {
    서울: "서울특별시",
    부산: "부산광역시",
    대구: "대구광역시",
    인천: "인천광역시",
    광주: "광주광역시",
    대전: "대전광역시",
    울산: "울산광역시",
    세종: "세종특별자치시",
    경기: "경기도",
    강원: "강원특별자치도",
    충북: "충청북도",
    충남: "충청남도",
    전북: "전북특별자치도",
    전남: "전라남도",
    경북: "경상북도",
    경남: "경상남도",
    제주: "제주특별자치도",
  };
  for (const [short, full] of Object.entries(map)) {
    if (address.includes(full) || address.startsWith(short)) return full;
  }
  return "";
}

export async function runRecommendation(
  data: CompanyFormData,
  refresh: boolean = false
): Promise<RecommendResponse> {
  if (!data.company_name) {
    return { success: false, error: "기업명은 필수입니다." };
  }

  const projectRoot = path.resolve(process.cwd(), "..");
  const companiesDir = path.join(projectRoot, "data", "companies");
  await mkdir(companiesDir, { recursive: true });

  // 기업 프로필 JSON 저장
  const profile = {
    ...data,
    region: extractRegion(data.address),
  };
  const safeName = data.company_name.replace(/[^\w가-힣]/g, "_");
  const profilePath = path.join(companiesDir, `${safeName}.json`);
  await writeFile(profilePath, JSON.stringify(profile, null, 2), "utf-8");

  // Python 매칭 스크립트 실행
  const args = [path.join(projectRoot, "run_match.py"), data.company_name];
  if (refresh) args.push("--refresh");

  try {
    const { stdout } = await execFileAsync("python3", args, {
      cwd: projectRoot,
      timeout: refresh ? 300000 : 30000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const result = JSON.parse(stdout);
    if (result.error) {
      return { success: false, error: result.error };
    }

    return { success: true, ...result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    if (refresh && message.includes("TIMEOUT")) {
      return {
        success: false,
        error: "크롤링 시간이 초과되었습니다. 네트워크 상태를 확인해주세요.",
      };
    }
    return { success: false, error: `매칭 실행 실패: ${message}` };
  }
}
