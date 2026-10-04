import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/config/api-config';
import { About } from '@/features/about/about';
import { SystemInfo } from '@/features/about/about.models';

const URL = 'http://api/system/info';

const INFO: SystemInfo = {
  appName: 'Serichai Web Portal',
  appVersion: '1.4.0',
  serverTime: '2026-10-05T14:03:12+07:00',
  status: 'ok',
};

describe('About page', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [About],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api' },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(About);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    return { fixture, el, http };
  }

  it('renders the four labelled values on success, serverTime verbatim', async () => {
    const { fixture, el, http } = await setup();
    const req = http.expectOne(URL);
    expect(req.request.method).toBe('GET');
    req.flush(INFO);
    await fixture.whenStable();

    const labels = Array.from(el.querySelectorAll('dt')).map((d) => d.textContent?.trim());
    const values = Array.from(el.querySelectorAll('dd')).map((d) => d.textContent?.trim());
    expect(labels).toEqual(['Application', 'Version', 'Server time', 'Status']);
    expect(values).toEqual(['Serichai Web Portal', '1.4.0', '2026-10-05T14:03:12+07:00', 'ok']);
    expect(el.querySelector('[role=status]')).toBeNull();
    expect(el.querySelector('[role=alert]')).toBeNull();
    http.verify();
  });

  it('shows the spinner and no values while loading', async () => {
    const { el, http } = await setup();
    http.expectOne(URL);
    expect(el.querySelector('[role=status]')?.textContent).toContain('Loading system information...');
    expect(el.querySelector('dl')).toBeNull();
    expect(el.querySelector('[role=alert]')).toBeNull();
  });

  it('shows a readable error and no values when the request fails', async () => {
    const { fixture, el, http } = await setup();
    http.expectOne(URL).flush('Bad Gateway', { status: 502, statusText: 'Bad Gateway' });
    await fixture.whenStable();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('Request failed with status 502');
    expect(el.querySelector('dl')).toBeNull();
    expect(el.querySelector('[role=status]')).toBeNull();
  });

  it('cancels the request when the page is left before data arrives', async () => {
    const { fixture, el, http } = await setup();
    const req = http.expectOne(URL);
    fixture.destroy();
    expect(req.cancelled).toBe(true);
    expect(el.querySelector('dl')).toBeNull();
    expect(el.querySelector('[role=alert]')).toBeNull();
    http.verify();
  });
});
