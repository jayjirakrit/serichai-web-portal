import { FileAttachment } from '../../shared/models/attachment';

export type BonusExceptionCategory =
  | 'evaluationNotFound'
  | 'evaluationAllBlank'
  | 'leaveNotFound'
  | 'previousBonusNotFound'
  | 'otCategoryUnrecognized'
  | 'duplicateName'
  | 'workingDayDataInvalid';

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

export interface CalculateBonusResponse {
  summary: BonusCalculationSummary;
  flaggedEmployees: EmployeeBonusRecord[];
  bonusReport: FileAttachment;
}
