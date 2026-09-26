import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '../../core/config/api-config';
import { ReconcilePayrollResponse } from './payroll-reconcile.models';

@Injectable({ providedIn: 'root' })
export class PayrollReconcileService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  reconcile(payrollFile: File, period: string): Observable<ReconcilePayrollResponse> {
    const formData = new FormData();
    formData.append('payrollFile', payrollFile);
    formData.append('period', period);
    return this.http.post<ReconcilePayrollResponse>(
      `${this.baseUrl}/accounts/payroll-reconcile`,
      formData,
    );
  }
}
