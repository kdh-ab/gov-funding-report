"use server";

export interface MatchedAnnouncement {
  rank: number;
  score: number;
  level: number; // 시그널 레벨 1~5
  match_reasons: string[];
  competition_level?: number; // 예상 경쟁 강도 1~5 (0=데이터 부족)
  competition_reasons?: string[];
  announcement: {
    pbancSn: string;
    source: string;
    title: string;
    supportField: string;
    targetAge: string;
    orgType: string;
    department: string;
    region: string;
    receptionPeriod: string;
    supervisionOrg: string;
    target: string;
    bizExperience: string;
    contact: string;
    contentText: string;
    attachments: { fileName: string; downloadUrl: string; viewUrl?: string }[];
    detailUrl: string;
    crawledAt: string;
    viewCount: number;
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

export async function runRecommendation(
  data: CompanyFormData,
  refresh: boolean = false
): Promise<RecommendResponse> {
  if (!data.company_name) {
    return { success: false, error: "기업명은 필수입니다." };
  }

  const apiUrl = process.env.API_URL || "http://localhost:8000";

  try {
    const resp = await fetch(`${apiUrl}/recommend`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ company: data, refresh }),
    });

    if (!resp.ok) {
      return { success: false, error: `API 오류 (${resp.status})` };
    }

    const result = await resp.json();
    if (result.error) {
      return { success: false, error: result.error };
    }
    if (!result.matches) {
      return { success: false, error: "매칭 결과가 없습니다." };
    }

    return { success: true, ...result };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "알 수 없는 오류";
    return { success: false, error: `매칭 실행 실패: ${message}` };
  }
}
