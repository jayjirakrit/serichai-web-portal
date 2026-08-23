const BACKEND_BASE_URL = "http://127.0.0.1:8000";

export type ReconciliationStatus = "discrepancy" | "unrecognizedDepartment" | "dataError";

export interface ReconciliationEntry {
  department: string;
  employeeId: string | null;
  employeeName: string | null;
  statedAmount: number | null;
  recalculatedAmount: number | null;
  variance: number | null;
  status: ReconciliationStatus;
  detail: string;
}

export interface ReconciliationSummary {
  totalEmployeesReconciled: number;
  matchedCount: number;
  discrepancyCount: number;
  discrepanciesByDepartment: Record<string, number>;
}

export interface FileAttachment {
  filename: string;
  contentBase64: string;
}

export interface ReconcilePayrollResponse {
  summary: ReconciliationSummary;
  discrepancies: ReconciliationEntry[];
  reconciliationReport: FileAttachment;
  discrepancyReport: FileAttachment | null;
}

export async function reconcilePayroll(payrollFile: File, period: string): Promise<ReconcilePayrollResponse> {
  const formData = new FormData();
  formData.append("payrollFile", payrollFile);
  formData.append("period", period);

  const response = await fetch(`${BACKEND_BASE_URL}/accounts/payroll-reconcile`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}
