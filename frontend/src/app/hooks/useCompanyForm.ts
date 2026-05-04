import { useState, useEffect } from "react";
import type { CompanyFormData } from "../actions/recommend";

const INITIAL_FORM_DATA: CompanyFormData = {
  company_name: "",
  ceo_name: "",
  ceo_birth_date: "",
  ceo_gender: "",
  address: "",
  established_date: "",
  main_industry: "",
  main_sector: "",
  business_item_summary: "",
};

const STORAGE_KEY = "gov-funding-company-form";

function readStoredFormData(): CompanyFormData {
  if (typeof window === "undefined") return INITIAL_FORM_DATA;

  const saved = localStorage.getItem(STORAGE_KEY);
  if (!saved) return INITIAL_FORM_DATA;

  try {
    return { ...INITIAL_FORM_DATA, ...JSON.parse(saved) };
  } catch (err) {
    console.warn("Failed to restore company form data:", err);
    return INITIAL_FORM_DATA;
  }
}

export function useCompanyForm() {
  const [formData, setFormData] = useState<CompanyFormData>(readStoredFormData);
  const isHydrated = typeof window !== "undefined";

  // 변경 감지: formData 변경 시 localStorage에 저장
  useEffect(() => {
    if (isHydrated) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(formData));
    }
  }, [formData, isHydrated]);

  function updateField(field: keyof CompanyFormData, value: string) {
    setFormData((prev) => ({ ...prev, [field]: value }));
  }

  function patchFields(patch: Partial<CompanyFormData>) {
    setFormData((prev) => {
      const next = { ...prev };
      for (const [key, val] of Object.entries(patch)) {
        if (val) next[key as keyof CompanyFormData] = val;
      }
      return next;
    });
  }

  function clearForm() {
    setFormData(INITIAL_FORM_DATA);
    localStorage.removeItem(STORAGE_KEY);
  }

  function getSavedData() {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return null;
    try {
      return JSON.parse(saved);
    } catch {
      return null;
    }
  }

  return { formData, updateField, patchFields, clearForm, getSavedData, isHydrated };
}
