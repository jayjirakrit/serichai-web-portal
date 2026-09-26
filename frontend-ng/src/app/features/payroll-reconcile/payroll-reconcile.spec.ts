import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '@core/config/api-config';
import { PayrollReconcile } from '@/features/payroll-reconcile/payroll-reconcile';

describe('PayrollReconcile page', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [PayrollReconcile],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: '' },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(PayrollReconcile);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    const submit = () => el.querySelector<HTMLElement>('app-button')!;
    const fileInput = () => el.querySelector<HTMLInputElement>('input[type=file]')!;
    const monthInput = () => el.querySelector<HTMLInputElement>('input[type=month]')!;
    const pickFile = () => {
      Object.defineProperty(fileInput(), 'files', { value: [new File(['x'], 'p.xlsx')] });
      fileInput().dispatchEvent(new Event('change'));
    };
    const pickPeriod = (v: string) => {
      monthInput().value = v;
      monthInput().dispatchEvent(new Event('input'));
    };
    return { fixture, el, http, submit, pickFile, pickPeriod };
  }

  it('renders idle state', async () => {
    const { el } = await setup();
    expect(el.textContent).toContain('Awaiting Data');
    expect(el.textContent).toContain('Submit');
  });

  it('shows inline messages and sends no request when inputs are missing', async () => {
    const { fixture, el, http, submit } = await setup();
    submit().click();
    fixture.detectChanges();
    expect(el.textContent).toContain('Please upload the payroll working file');
    expect(el.textContent).toContain('Please select the pay period');
    http.expectNone('/accounts/payroll-reconcile');
  });

  it('shows the error detail from the backend', async () => {
    const { fixture, el, http, submit, pickFile, pickPeriod } = await setup();
    pickFile();
    pickPeriod('2025-03');
    submit().click();
    fixture.detectChanges();
    http
      .expectOne('/accounts/payroll-reconcile')
      .flush({ detail: 'Bad workbook' }, { status: 400, statusText: 'Bad Request' });
    fixture.detectChanges();
    expect(el.textContent).toContain('Bad workbook');
  });

  it('disables submit and blocks duplicate requests while pending', async () => {
    const { fixture, el, http, submit, pickFile, pickPeriod } = await setup();
    pickFile();
    pickPeriod('2025-03');
    submit().click();
    fixture.detectChanges();
    expect(submit().querySelector('button')!.disabled).toBe(true);
    expect(el.textContent).toContain('Processing...');
    submit().click();
    http.expectOne('/accounts/payroll-reconcile');
    http.expectNone('/accounts/payroll-reconcile');
  });
});
