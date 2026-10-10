import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { apiCall } from '@core/http/api-call';
import { Layout } from '@shared/ui/layout';
import { Button } from '@shared/ui/button';
import { FileField } from '@shared/ui/file-field';
import { ResultPanel } from '@shared/ui/result-panel';
import { downloadAttachment } from '@shared/utils/download';
import { ElderlyTaxDeductionService } from '@/features/elderly-tax-deduction/elderly-tax-deduction.service';
import { ElderlyTaxDeductionEmployeeResult } from '@/features/elderly-tax-deduction/elderly-tax-deduction.models';

@Component({
  selector: 'app-tax-deduction',
  imports: [DecimalPipe, Layout, Button, FileField, ResultPanel],
  templateUrl: './elderly-tax-deduction.html',
})
export class ElderlyTaxDeduction {
  private readonly service = inject(ElderlyTaxDeductionService);

  protected readonly monthLabels = [
    'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
  ];
  protected readonly templateUrl = '/Tax_Reduction_Input.xlsx';
  protected readonly downloadAttachment = downloadAttachment;

  protected readonly payrollFile = signal<File | null>(null);
  protected readonly fileError = signal<string | null>(null);
  protected readonly call = apiCall((file: File) => this.service.calculate(file));

  protected onFile(file: File | null): void {
    this.payrollFile.set(file);
    if (file) this.fileError.set(null);
  }

  protected onSubmit(): void {
    if (this.call.pending()) return;
    const file = this.payrollFile();
    if (!file) {
      this.fileError.set('Please upload the payroll file before submitting.');
      return;
    }
    this.fileError.set(null);
    this.call.run(file);
  }

  getEmployeeStatus(employee: ElderlyTaxDeductionEmployeeResult): {
    label: string;
    badgeClass: string;
  } {
    if (!employee.eligible) {
      return { label: 'Not eligible', badgeClass: 'badge-neutral' };
    }
    if (!employee.selected) {
      return { label: 'Eligible, not selected', badgeClass: 'badge-warning' };
    }
    if (employee.disabled) {
      return { label: 'Selected (disabled, uncapped)', badgeClass: 'badge-success' };
    }
    return { label: 'Selected', badgeClass: 'badge-success' };
  }
}
