import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/config/api-config';
import { TaxDeduction } from './tax-deduction';
import { CalculateTaxDeductionResponse } from './tax-deduction.models';

const URL = 'http://api/accounts/tax-deduction';

const RESPONSE: CalculateTaxDeductionResponse = {
  summary: {
    referenceDate: '2026-01-01',
    totalHeadcount: 2,
    eligibleCount: 2,
    headcountCap: 1,
    selectedCount: 1,
    ageThreshold: 60,
    salaryCapPerMonth: 15000,
    headcountCapPercent: 0.1,
    headcountCapRounding: 'floor',
    beYearOffset: 543,
  },
  employees: [
    {
      seq: 1, idCardNumber: null, prefix: 'Mr.', firstName: 'A', lastName: 'B',
      dateOfBirth: null, age: 65, averageMonthlySalary: 12345.5, eligible: true,
      disabled: false, rank: 1, selected: true, monthlyAmounts: Array(12).fill(100), totalAmount: 1200,
    },
    {
      seq: 2, idCardNumber: null, prefix: '', firstName: 'C', lastName: 'D',
      dateOfBirth: null, age: null, averageMonthlySalary: null, eligible: false,
      disabled: false, rank: null, selected: false, monthlyAmounts: Array(12).fill(0), totalAmount: 0,
    },
  ],
  taxDeductionReport: { filename: 'r.xlsx', contentBase64: '' },
};

describe('TaxDeduction page', () => {
  async function setup() {
    await TestBed.configureTestingModule({
      imports: [TaxDeduction],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api' },
      ],
    }).compileComponents();
    const fixture = TestBed.createComponent(TaxDeduction);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const http = TestBed.inject(HttpTestingController);
    const submit = () => el.querySelector('app-button button') as HTMLButtonElement;
    const pick = async () => {
      const input = el.querySelector('input[type=file]') as HTMLInputElement;
      Object.defineProperty(input, 'files', { value: [new File(['x'], 'p.xlsx')] });
      input.dispatchEvent(new Event('change'));
      await fixture.whenStable();
    };
    return { fixture, el, http, submit, pick };
  }

  it('renders idle state', async () => {
    const { el } = await setup();
    expect(el.textContent).toContain('Awaiting Data');
    expect(el.querySelector('table')).toBeNull();
    expect(el.querySelector('a[href="/Tax_Reduction_Input.xlsx"]')).not.toBeNull();
  });

  it('shows inline message and sends no request without a file', async () => {
    const { el, http, submit, fixture } = await setup();
    submit().click();
    await fixture.whenStable();
    expect(el.querySelector('[role=alert]')?.textContent).toContain('upload the payroll file');
    http.expectNone(URL);
  });

  it('disables submit while pending and renders rows on success', async () => {
    const { el, http, submit, pick, fixture } = await setup();
    await pick();
    submit().click();
    await fixture.whenStable();
    expect(submit().disabled).toBe(true);
    http.expectOne(URL).flush(RESPONSE);
    await fixture.whenStable();
    expect(submit().disabled).toBe(false);
    const rows = el.querySelectorAll('tbody tr');
    expect(rows.length).toBe(2);
    expect(rows[0].textContent).toContain('Selected');
    expect(rows[1].textContent).toContain('Not eligible');
    expect(rows[1].querySelectorAll('td')[2].textContent?.trim()).toBe('-');
    expect(rows[1].querySelectorAll('td')[3].textContent?.trim()).toBe('-');
  });

  it('shows backend error detail', async () => {
    const { el, http, submit, pick, fixture } = await setup();
    await pick();
    submit().click();
    await fixture.whenStable();
    http.expectOne(URL).flush({ detail: 'Bad workbook' }, { status: 422, statusText: 'x' });
    await fixture.whenStable();
    expect(el.querySelector('.alert-error')?.textContent).toContain('Bad workbook');
  });
});
