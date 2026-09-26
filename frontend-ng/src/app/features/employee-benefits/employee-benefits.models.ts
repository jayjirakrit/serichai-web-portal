import { FileAttachment } from '../../shared/models/attachment';

export type ExceptionCategory = 'missingRequiredField' | 'duplicateEmployeeId';

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

export interface CalculateBenefitsResponse {
  summary: CalculationSummary;
  exceptions: ExceptionEntry[];
  employeeBenefitsReport: FileAttachment;
  exceptionReport: FileAttachment;
}
