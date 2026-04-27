import { useState } from "react";
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

export function useCompanyForm() {
  const [formData, setFormData] = useState<CompanyFormData>(INITIAL_FORM_DATA);

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

  return { formData, updateField, patchFields };
}
