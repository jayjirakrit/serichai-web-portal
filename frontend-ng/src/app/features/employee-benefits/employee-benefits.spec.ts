import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/config/api-config';
import { EmployeeBenefits } from '@/features/employee-benefits/employee-benefits';

describe('EmployeeBenefits page', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [EmployeeBenefits],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(EmployeeBenefits);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    const submit = () => el.querySelector<HTMLButtonElement>('app-button button')!;
    return { fixture, el, http, submit };
  }

  function pickFile(el: HTMLElement, index: number) {
    const input = el.querySelectorAll<HTMLInputElement>('input[type=file]')[index];
    // jsdom has no DataTransfer; stub the read-only `files` property instead.
    Object.defineProperty(input, 'files', { value: [new File(['x'], 'f.xlsx')], configurable: true });
    input.dispatchEvent(new Event('change'));
  }

  it('renders the idle state', async () => {
    const { el } = await setup();
    expect(el.textContent).toContain('Awaiting Data');
    expect(el.textContent).toContain('Submit');
  });

  it('shows an inline message and sends no request without the master file', async () => {
    const { fixture, el, http, submit } = await setup();
    submit().click();
    await fixture.whenStable();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('employee master data');
    http.expectNone(() => true);
  });

  it('shows the error detail from the backend', async () => {
    const { fixture, el, http, submit } = await setup();
    pickFile(el, 0);
    submit().click();
    await fixture.whenStable();
    http
      .expectOne('/accounts/employee-benefits')
      .flush({ detail: 'Bad master file' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(el.textContent).toContain('Bad master file');
  });

  it('disables submit while pending', async () => {
    const { fixture, el, http, submit } = await setup();
    pickFile(el, 0);
    submit().click();
    await fixture.whenStable();
    expect(submit().disabled).toBe(true);
    expect(submit().textContent).toContain('Processing...');
    http.expectOne('/accounts/employee-benefits');
  });
});
