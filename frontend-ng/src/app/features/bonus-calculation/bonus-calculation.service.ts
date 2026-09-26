import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-config';
import { CalculateBonusResponse } from './bonus-calculation.models';

@Injectable({ providedIn: 'root' })
export class BonusCalculationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  calculate(
    currentYearFile: File,
    previousYearSummaryFile: File | null,
    year: string,
  ): Observable<CalculateBonusResponse> {
    const formData = new FormData();
    formData.append('currentYearFile', currentYearFile);
    if (previousYearSummaryFile) {
      formData.append('previousYearSummaryFile', previousYearSummaryFile);
    }
    formData.append('year', year);
    // No Content-Type header: the browser sets the multipart boundary.
    return this.http.post<CalculateBonusResponse>(`${this.baseUrl}/accounts/bonus-calculation`, formData);
  }
}
