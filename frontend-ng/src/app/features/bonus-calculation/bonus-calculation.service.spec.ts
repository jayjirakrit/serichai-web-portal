import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/config/api-config';
import { BonusCalculationService } from './bonus-calculation.service';

describe('BonusCalculationService', () => {
  it('POSTs multipart form with exact field names', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api' },
      ],
    });
    const service = TestBed.inject(BonusCalculationService);
    const http = TestBed.inject(HttpTestingController);
    const a = new File(['a'], 'a.xlsx');
    const b = new File(['b'], 'b.xlsx');

    service.calculate(a, b, '2568').subscribe();

    const req = http.expectOne('http://api/accounts/bonus-calculation');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect([...body.keys()].sort()).toEqual(['currentYearFile', 'previousYearSummaryFile', 'year']);
    expect(body.get('currentYearFile')).toBe(a);
    expect(body.get('previousYearSummaryFile')).toBe(b);
    expect(body.get('year')).toBe('2568');
    expect(req.request.headers.has('Content-Type')).toBe(false);
    http.verify();
  });
});
