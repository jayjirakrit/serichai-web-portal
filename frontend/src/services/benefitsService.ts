const BACKEND_BASE_URL = "http://127.0.0.1:8000";

export type ExceptionCategory = "missingRequiredField";

export interface ExceptionEntry {
  category: ExceptionCategory;
  employeeId: string | null;
  employeeName: string | null;
  detail: string;
}

export interface CalculationSummary {
  totalEmployeesOut: number;
  computedCount: number;
  resignedFlaggedCount: number;
  exceptionCount: number;
  exceptionsByCategory: Record<string, number>;
}

export interface FileAttachment {
  filename: string;
  contentBase64: string;
}

export interface CalculateBenefitsResponse {
  summary: CalculationSummary;
  exceptions: ExceptionEntry[];
  employeeBenefitsReport: FileAttachment;
  exceptionReport: FileAttachment;
}

export async function calculateBenefits(masterFile: File): Promise<CalculateBenefitsResponse> {
  const formData = new FormData();
  formData.append("masterFile", masterFile);

  const response = await fetch(`${BACKEND_BASE_URL}/accounts/employee-benefits`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}
