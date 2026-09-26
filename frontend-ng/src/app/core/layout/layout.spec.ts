import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Layout } from './layout';

@Component({ imports: [Layout], template: '<app-layout><p class="page">hi</p></app-layout>' })
class Host {}

describe('Layout', () => {
  it('renders navbar with home link and projects content', async () => {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    }).compileComponents();
    const f = TestBed.createComponent(Host);
    await f.whenStable();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('app-navbar')).not.toBeNull();
    expect(el.querySelector('main .page')?.textContent).toBe('hi');
    expect(el.querySelector('a[href="/"]')).not.toBeNull();
    expect(el.querySelector('a button, button a')).toBeNull();
  });
});
