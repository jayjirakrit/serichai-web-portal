import { Location } from '@angular/common';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { routes } from './app.routes';
import { Navbar } from './core/layout/navbar';

describe('app routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter(routes)] });
  });

  it('every non-wildcard route lazy-loads a component', async () => {
    for (const r of routes.filter((x) => x.path !== '**')) {
      expect(r.loadComponent, r.path).toBeDefined();
      expect(await r.loadComponent!(), r.path).toBeTruthy();
    }
  });

  it('renders Home at / and Login at /login', async () => {
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/');
    expect(h.routeNativeElement?.querySelectorAll('app-card').length).toBe(4);
    expect(h.routeNativeElement?.textContent).toContain('Welcome to Serichai Web Portal');
    await h.navigateByUrl('/login');
    expect(h.routeNativeElement?.querySelector('#username')).not.toBeNull();
    expect(h.routeNativeElement?.querySelector('app-button')?.textContent).toContain('Sign in');
  });

  it('unknown path lands on Home', async () => {
    const h = await RouterTestingHarness.create();
    await h.navigateByUrl('/no-such-page');
    expect(TestBed.inject(Location).path()).toBe('');
    expect(h.routeNativeElement?.querySelector('app-card')).not.toBeNull();
  });

  it('navbar brand links Home and has no button nested in a link', async () => {
    const fixture = TestBed.createComponent(Navbar);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('a[href="/"]')?.textContent).toContain('Serichai Web Portal');
    expect(el.querySelector('a button')).toBeNull();
  });
});
