import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/config/api-config';
import { CalculateBenefitsResponse } from '@/features/employee-benefits/employee-benefits.models';

@Injectable({ providedIn: 'root' })
export class BenefitsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  calculate(
    masterFile: File,
    previousBenefitsFile?: File | null,
  ): Observable<CalculateBenefitsResponse> {
    const formData = new FormData();
    formData.append('masterFile', masterFile);
    if (previousBenefitsFile) {
      formData.append('previousBenefitsFile', previousBenefitsFile);
    }
    // No Content-Type header: the browser sets the multipart boundary.
    return this.http.post<CalculateBenefitsResponse>(
      `${this.baseUrl}/accounts/employee-benefits`,
      formData,
    );
  }
}
