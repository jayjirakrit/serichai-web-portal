import { API_BASE_URL } from "./apiConfig";

export type BonusExceptionCategory =
  | "evaluationNotFound"
  | "evaluationAllBlank"
  | "leaveNotFound"
  | "previousBonusNotFound"
  | "otCategoryUnrecognized"
  | "duplicateName"
  | "workingDayDataInvalid";

export interface EmployeeBonusRecord {
  employeeId: string | null;
  matchKey: string;
  prefix: string | null;
  firstName: string;
  lastName: string;
  departmentNotes: string | null;
  otCategoryCode: string | null;
  payRate: number | null;
  startDate: string | null;
  workDays: number | null;
  totalOt: number | null;
  totalNotWorked: number | null;
  sickLeaveDays: number | null;
  personalLeaveDays: number | null;
  specialPersonalLeaveDays: number | null;
  absentDays: number | null;
  vacationDays: number | null;
  currentGradeNumeric: number | null;
  currentGradeLetter: string | null;
  previousGradeLetter: string | null;
  previousBonus: number | null;
  personalLeaveScore: number | null;
  sickLeaveScore: number | null;
  absentScore: number | null;
  vacationScore: number | null;
  workingDaysScore: number | null;
  otScore: number | null;
  totalScore: number | null;
  provisionalDays: number | null;
  provisionalBonus: number | null;
  exceptions: BonusExceptionCategory[];
  exceptionNote: string | null;
}

export interface BonusCalculationSummary {
  totalEmployees: number;
  calculatedCount: number;
  exceptionCount: number;
  exceptionsByCategory: Record<string, number>;
}

export interface FileAttachment {
  filename: string;
  contentBase64: string;
}

export interface CalculateBonusResponse {
  summary: BonusCalculationSummary;
  flaggedEmployees: EmployeeBonusRecord[];
  bonusReport: FileAttachment;
}

export async function calculateBonus(
  currentYearFile: File,
  previousYearSummaryFile: File,
  year: string,
): Promise<CalculateBonusResponse> {
  const formData = new FormData();
  formData.append("currentYearFile", currentYearFile);
  formData.append("previousYearSummaryFile", previousYearSummaryFile);
  formData.append("year", year);

  const response = await fetch(`${API_BASE_URL}/accounts/bonus-calculation`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null);
    throw new Error(errorBody?.detail || `Request failed with status ${response.status}`);
  }

  return response.json();
}
