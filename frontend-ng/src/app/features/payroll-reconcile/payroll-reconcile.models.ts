import { FileAttachment } from '@shared/models/attachment';

export type { FileAttachment };

export type ReconciliationStatus = 'discrepancy' | 'unrecognizedDepartment' | 'dataError';

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

export interface ReconcilePayrollResponse {
  summary: ReconciliationSummary;
  discrepancies: ReconciliationEntry[];
  reconciliationReport: FileAttachment;
  discrepancyReport: FileAttachment | null;
}
