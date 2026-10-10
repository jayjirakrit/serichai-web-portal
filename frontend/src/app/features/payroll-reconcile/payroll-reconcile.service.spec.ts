import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { API_BASE_URL } from '@core/config/api-config';
import { PayrollReconcileService } from '@/features/payroll-reconcile/payroll-reconcile.service';

describe('PayrollReconcileService', () => {
  it('posts multipart payrollFile and period to the endpoint', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    const service = TestBed.inject(PayrollReconcileService);
    const http = TestBed.inject(HttpTestingController);
    const file = new File(['x'], 'payroll.xlsx');

    service.reconcile(file, '2025-03').subscribe();

    const req = http.expectOne('http://api.test/accounts/payroll-reconcile');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(body instanceof FormData).toBe(true);
    expect(Array.from(body.keys()).sort()).toEqual(['payrollFile', 'period']);
    expect((body.get('payrollFile') as File).name).toBe('payroll.xlsx');
    expect(body.get('period')).toBe('2025-03');
    expect(req.request.headers.has('Content-Type')).toBe(false);
    http.verify();
  });
});
