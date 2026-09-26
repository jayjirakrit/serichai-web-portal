import { FileAttachment } from '../../shared/models/attachment';

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
  headcountCapRounding: 'floor';
  beYearOffset: number;
}

export interface CalculateTaxDeductionResponse {
  summary: TaxDeductionSummary;
  employees: TaxDeductionEmployeeResult[];
  taxDeductionReport: FileAttachment;
}
