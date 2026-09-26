import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/config/api-config';
import { TaxDeductionService } from './tax-deduction.service';

describe('TaxDeductionService', () => {
  it('POSTs only payrollFile as multipart', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api' },
      ],
    });
    const svc = TestBed.inject(TaxDeductionService);
    const http = TestBed.inject(HttpTestingController);
    const file = new File(['x'], 'p.xlsx');

    svc.calculate(file).subscribe();

    const req = http.expectOne('http://api/accounts/tax-deduction');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect(Array.from(body.keys())).toEqual(['payrollFile']);
    expect(body.get('payrollFile')).toBeInstanceOf(File);
    expect(body.has('referenceDate')).toBe(false);
    expect(req.request.headers.has('Content-Type')).toBe(false);
    http.verify();
  });
});
