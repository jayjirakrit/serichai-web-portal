import { Component, inject, signal } from '@angular/core';
import { apiCall } from '../../core/http/api-call';
import { Layout } from '../../shared/ui/layout';
import { FileAttachment } from '../../shared/models/attachment';
import { Button } from '../../shared/ui/button';
import { FileField } from '../../shared/ui/file-field';
import { ResultPanel } from '../../shared/ui/result-panel';
import { downloadAttachment } from '../../shared/utils/download';
import { BenefitsService } from './employee-benefits.service';

@Component({
  selector: 'app-employee-benefits',
  imports: [Layout, Button, FileField, ResultPanel],
  templateUrl: './employee-benefits.html',
})
export class EmployeeBenefits {
  private readonly benefitService = inject(BenefitsService);

  protected readonly masterFile = signal<File | null>(null);
  protected readonly previousBenefitsFile = signal<File | null>(null);
  protected readonly masterError = signal<string | null>(null);
  protected readonly templateUrl = '';

  protected readonly call = apiCall((master: File, previous: File | null) =>
    this.benefitService.calculate(master, previous),
  );

  protected onMasterChange(file: File | null): void {
    this.masterFile.set(file);
    if (file) this.masterError.set(null);
  }

  protected onSubmit(): void {
    if (this.call.pending()) return;
    const master = this.masterFile();
    if (!master) {
      this.masterError.set('Please upload the employee master data file before submitting.');
      return;
    }
    this.masterError.set(null);
    this.call.run(master, this.previousBenefitsFile());
  }

  protected download(attachment: FileAttachment): void {
    downloadAttachment(attachment);
  }
}
