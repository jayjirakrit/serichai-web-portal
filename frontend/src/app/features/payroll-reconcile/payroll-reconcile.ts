import { Component, inject, signal } from '@angular/core';
import { apiCall } from '@core/http/api-call';
import { Layout } from '@shared/ui/layout';
import { Button } from '@shared/ui/button';
import { FileField } from '@shared/ui/file-field';
import { ResultPanel } from '@shared/ui/result-panel';
import { downloadAttachment } from '@shared/utils/download';
import { PayrollReconcileService } from '@/features/payroll-reconcile/payroll-reconcile.service';

@Component({
  selector: 'app-payroll-reconcile',
  imports: [Layout, Button, FileField, ResultPanel],
  templateUrl: './payroll-reconcile.html',
})
export class PayrollReconcile {
  private readonly service = inject(PayrollReconcileService);

  protected readonly payrollFile = signal<File | null>(null);
  protected readonly period = signal('');
  protected readonly fileError = signal<string | null>(null);
  protected readonly periodError = signal<string | null>(null);

  protected readonly call = apiCall((file: File, period: string) =>
    this.service.reconcile(file, period),
  );
  protected readonly download = downloadAttachment;
  protected readonly templateUrl = '';


  protected onFileChange(file: File | null): void {
    this.payrollFile.set(file);
    if (file) this.fileError.set(null);
  }

  protected onPeriodInput(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    this.period.set(value);
    if (value) this.periodError.set(null);
  }

  protected onSubmit(): void {
    if (this.call.pending()) return;
    const file = this.payrollFile();
    const period = this.period();
    this.fileError.set(file ? null : 'Please upload the payroll working file before submitting.');
    this.periodError.set(
      period ? null : 'Please select the pay period to reconcile before submitting.',
    );
    if (!file || !period) return;
    this.call.run(file, period);
  }
}
