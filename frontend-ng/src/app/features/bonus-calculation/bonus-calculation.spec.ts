import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/config/api-config';
import { BonusCalculation } from './bonus-calculation';

describe('BonusCalculation page', () => {
  let fixture: ComponentFixture<BonusCalculation>;
  let el: HTMLElement;
  let http: HttpTestingController;

  const URL = 'http://api/accounts/bonus-calculation';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [BonusCalculation],
      providers: [
        provideRouter([]),
        provideHttpClient(),
        provideHttpClientTesting(),
        { provide: API_BASE_URL, useValue: 'http://api' },
      ],
    }).compileComponents();
    fixture = TestBed.createComponent(BonusCalculation);
    el = fixture.nativeElement as HTMLElement;
    http = TestBed.inject(HttpTestingController);
    await fixture.whenStable();
  });

  function pickFiles(): void {
    const inputs = el.querySelectorAll<HTMLInputElement>('input[type=file]');
    inputs.forEach((input, i) => {
      Object.defineProperty(input, 'files', { value: [new File(['x'], `f${i}.xlsx`)], configurable: true });
      input.dispatchEvent(new Event('change'));
    });
    const year = el.querySelector<HTMLInputElement>('input[type=number]')!;
    year.value = '2568';
    year.dispatchEvent(new Event('input'));
  }

  async function submit(): Promise<void> {
    (el.querySelector('app-button') as HTMLElement).click();
    await fixture.whenStable();
  }

  it('renders idle state', () => {
    expect(el.textContent).toContain('Awaiting Data');
    expect(el.textContent).toContain('Calculate Bonus');
  });

  it('shows inline messages and sends no request when input is missing', async () => {
    await submit();
    expect(el.textContent).toContain('Please upload the current-year data file.');
    expect(el.textContent).not.toContain('previous-year summary file.');
    expect(el.textContent).toContain('Please enter the year to calculate.');
    http.expectNone(URL);
  });

  it('disables submit while pending and shows summary on success', async () => {
    pickFiles();
    await submit();
    const req = http.expectOne(URL);
    await fixture.whenStable();
    expect(el.querySelector<HTMLButtonElement>('app-button button')!.disabled).toBe(true);
    expect(el.textContent).toContain('Calculating bonus...');

    req.flush({
      summary: { totalEmployees: 5, calculatedCount: 4, exceptionCount: 1, exceptionsByCategory: {} },
      flaggedEmployees: [{ firstName: 'A', lastName: 'B', exceptionNote: 'note-x' }],
      bonusReport: { filename: 'r.xlsx', contentBase64: '' },
    });
    await fixture.whenStable();
    expect(el.textContent).toContain('Flagged Employees');
    expect(el.textContent).toContain('note-x');
    expect(el.textContent).toContain('Download Bonus Report');
    expect(el.querySelector<HTMLButtonElement>('app-button button')!.disabled).toBe(false);
  });

  it('shows backend error detail', async () => {
    pickFiles();
    await submit();
    http.expectOne(URL).flush({ detail: 'Bad workbook' }, { status: 400, statusText: 'Bad Request' });
    await fixture.whenStable();
    expect(el.querySelector('.alert-error')?.textContent).toContain('Bad workbook');
  });

  it('switches tabs', async () => {
    const tabs = el.querySelectorAll<HTMLButtonElement>('[role=tab]');
    tabs[1].click();
    await fixture.whenStable();
    expect(el.querySelector('input[type=file]')).toBeNull();
    expect(tabs[1].classList.contains('tab-active')).toBe(true);
    tabs[0].click();
    await fixture.whenStable();
    expect(el.querySelector('input[type=file]')).not.toBeNull();
  });
});
