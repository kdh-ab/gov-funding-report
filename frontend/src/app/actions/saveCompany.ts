"use server";

import { writeFile, mkdir } from "fs/promises";
import path from "path";

export interface CompanyData {
  company_name: string;
  ceo_name: string;
  ceo_birth_date: string;
  ceo_gender: string;
  address: string;
  region: string;
  established_date: string;
  main_industry: string;
  main_sector: string;
  business_item_summary: string;
}

const REGION_MAP: Record<string, string> = {
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

function extractRegion(address: string): string {
  for (const [short, full] of Object.entries(REGION_MAP)) {
    if (address.includes(full) || address.startsWith(short)) {
      return full;
    }
  }
  return "";
}

export type SaveResult =
  | { success: true; filepath: string; company_name: string }
  | { success: false; error: string };

export async function saveCompany(formData: FormData): Promise<SaveResult> {
  const data: CompanyData = {
    company_name: (formData.get("company_name") as string)?.trim() || "",
    ceo_name: (formData.get("ceo_name") as string)?.trim() || "",
    ceo_birth_date: (formData.get("ceo_birth_date") as string)?.trim() || "",
    ceo_gender: (formData.get("ceo_gender") as string)?.trim() || "",
    address: (formData.get("address") as string)?.trim() || "",
    region: "",
    established_date:
      (formData.get("established_date") as string)?.trim() || "",
    main_industry: (formData.get("main_industry") as string)?.trim() || "",
    main_sector: (formData.get("main_sector") as string)?.trim() || "",
    business_item_summary:
      (formData.get("business_item_summary") as string)?.trim() || "",
  };

  if (!data.company_name) {
    return { success: false, error: "기업명은 필수 입력입니다." };
  }

  data.region = extractRegion(data.address);

  // 프로젝트 루트의 data/companies/ 디렉토리에 저장
  const projectRoot = path.resolve(process.cwd(), "..");
  const companiesDir = path.join(projectRoot, "data", "companies");
  await mkdir(companiesDir, { recursive: true });

  const safeName = data.company_name.replace(/[^\w가-힣]/g, "_");
  const filepath = path.join(companiesDir, `${safeName}.json`);

  await writeFile(filepath, JSON.stringify(data, null, 2), "utf-8");

  return { success: true, filepath, company_name: data.company_name };
}
