import { DecimalPipe } from '@angular/common';
import { Component, inject, signal } from '@angular/core';
import { apiCall } from '../../core/http/api-call';
import { Layout } from '../../core/layout/layout';
import { Button } from '../../shared/ui/button';
import { FileField } from '../../shared/ui/file-field';
import { ResultPanel } from '../../shared/ui/result-panel';
import { downloadAttachment } from '../../shared/utils/download';
import { TaxDeductionService } from './tax-deduction.service';
import { TaxDeductionEmployeeResult } from './tax-deduction.models';

@Component({
  selector: 'app-tax-deduction',
  imports: [DecimalPipe, Layout, Button, FileField, ResultPanel],
  templateUrl: './tax-deduction.html',
})
export class TaxDeduction {
  private readonly service = inject(TaxDeductionService);

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

  getEmployeeStatus(employee: TaxDeductionEmployeeResult): {
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
