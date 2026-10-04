import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '@core/config/api-config';
import { AboutService } from '@/features/about/about.service';

describe('AboutService', () => {
  it('GETs /system/info with no body', () => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api' },
      ],
    });
    const svc = TestBed.inject(AboutService);
    const http = TestBed.inject(HttpTestingController);

    svc.getSystemInfo().subscribe();

    const req = http.expectOne('http://api/system/info');
    expect(req.request.method).toBe('GET');
    expect(req.request.body).toBeNull();
    http.verify();
  });
});
