import { Component, inject, signal } from '@angular/core';
import { apiCall } from '@core/http/api-call';
import { Layout } from '@shared/ui/layout';
import { Button } from '@shared/ui/button';
import { FileField } from '@shared/ui/file-field';
import { ResultPanel } from '@shared/ui/result-panel';
import { downloadAttachment } from '@shared/utils/download';
import { BonusCalculationService } from '@/features/bonus-calculation/bonus-calculation.service';

@Component({
  selector: 'app-bonus-calculation',
  imports: [Layout, Button, FileField, ResultPanel],
  templateUrl: './bonus-calculation.html',
})
export class BonusCalculation {
  private readonly service = inject(BonusCalculationService);

  protected readonly tab = signal<'cal' | 'config'>('cal');
  protected readonly currentYearFile = signal<File | null>(null);
  protected readonly previousYearSummaryFile = signal<File | null>(null);
  protected readonly year = signal('');
  protected readonly submitted = signal(false);
  protected readonly templateUrl = '';

  protected readonly calculation = apiCall((current: File, previous: File | null, year: string) =>
    this.service.calculate(current, previous, year),
  );

  protected readonly download = downloadAttachment;

  protected onYearInput(event: Event): void {
    this.year.set((event.target as HTMLInputElement).value);
  }

  protected submit(): void {
    if (this.calculation.pending()) return;
    this.submitted.set(true);
    const current = this.currentYearFile();
    const previous = this.previousYearSummaryFile();
    const year = this.year();
    if (!current || !year) return;
    this.calculation.run(current, previous, year);
  }
}
