import { API_BASE_URL } from "./apiConfig";

export interface TaxDeductionEmployeeResult {
  seq: number;
  idCardNumber: string | null;
  prefix: string;
  firstName: string;
  lastName: string;
  dateOfBirth: string | null;
  age: number | null;
  averageMonthlySalary: number | null;
  eligible: boolean;
  disabled: boolean;
  rank: number | null;
  selected: boolean;
  monthlyAmounts: number[];
  totalAmount: number;
}

export interface TaxDeductionSummary {
  referenceDate: string;
  totalHeadcount: number;
  eligibleCount: number;
  headcountCap: number;
  selectedCount: number;
  ageThreshold: number;
  salaryCapPerMonth: number;
  headcountCapPercent: number;
  headcountCapRounding: "floor";
  beYearOffset: number;
}

export interface FileAttachment {
  filename: string;
  contentBase64: string;
}

export interface CalculateTaxDeductionResponse {
  summary: TaxDeductionSummary;
  employees: TaxDeductionEmployeeResult[];
  taxDeductionReport: FileAttachment;
}

export async function calculateTaxDeduction(
  payrollFile: File,
  referenceDate?: string,
): Promise<CalculateTaxDeductionResponse> {
  const formData = new FormData();
  formData.append("payrollFile", payrollFile);
  if (referenceDate) {
    formData.append("referenceDate", referenceDate);
  }

  const response = await fetch(`${API_BASE_URL}/accounts/tax-deduction`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}

export async function checkHealth(): Promise<{ status: string }> {
  const response = await fetch(`${API_BASE_URL}/health`);

  if (!response.ok) {
    throw new Error(`Health check failed with status ${response.status}`);
  }

  return response.json();
}
