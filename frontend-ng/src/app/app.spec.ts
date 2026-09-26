import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { App } from './app';
import { routes } from './app.routes';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    }).compileComponents();
  });

  it('should create the app with a router outlet', () => {
    const fixture = TestBed.createComponent(App);
    expect(fixture.componentInstance).toBeTruthy();
    expect((fixture.nativeElement as HTMLElement).querySelector('router-outlet')).not.toBeNull();
  });

  it('defines lazy routes and a catch-all redirect to home', () => {
    const paths = routes.map((r) => r.path);
    expect(paths).toEqual([
      '',
      'login',
      'employee-benefits',
      'bonus-calculation',
      'payroll-reconciliation',
      'tax-deduction',
      '**',
    ]);
    expect(routes.at(-1)?.redirectTo).toBe('');
  });
});
