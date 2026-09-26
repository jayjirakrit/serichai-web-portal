import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/config/api-config';
import { BenefitsService } from '@/features/employee-benefits/employee-benefits.service';

describe('BenefitsService', () => {
  let service: BenefitsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api.test' },
      ],
    });
    service = TestBed.inject(BenefitsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('posts masterFile only when no previous file', () => {
    const master = new File(['a'], 'master.xlsx');
    service.calculate(master).subscribe();
    const req = http.expectOne('http://api.test/accounts/employee-benefits');
    expect(req.request.method).toBe('POST');
    const body = req.request.body as FormData;
    expect([...body.keys()]).toEqual(['masterFile']);
    expect((body.get('masterFile') as File).name).toBe('master.xlsx');
    expect(req.request.headers.has('Content-Type')).toBe(false);
    req.flush({});
  });

  it('appends previousBenefitsFile when provided', () => {
    service.calculate(new File(['a'], 'm.xlsx'), new File(['b'], 'p.xlsx')).subscribe();
    const req = http.expectOne('http://api.test/accounts/employee-benefits');
    const body = req.request.body as FormData;
    expect([...body.keys()]).toEqual(['masterFile', 'previousBenefitsFile']);
    expect((body.get('previousBenefitsFile') as File).name).toBe('p.xlsx');
    req.flush({});
  });
});
