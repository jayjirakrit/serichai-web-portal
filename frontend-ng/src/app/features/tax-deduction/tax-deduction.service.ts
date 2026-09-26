import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-config';
import { CalculateTaxDeductionResponse } from './tax-deduction.models';

@Injectable({ providedIn: 'root' })
export class TaxDeductionService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  /** Sends only `payrollFile`; `referenceDate` is intentionally never sent (FR-010). */
  calculate(payrollFile: File): Observable<CalculateTaxDeductionResponse> {
    const form = new FormData();
    form.append('payrollFile', payrollFile);
    return this.http.post<CalculateTaxDeductionResponse>(
      `${this.baseUrl}/accounts/tax-deduction`,
      form,
    );
  }
}
