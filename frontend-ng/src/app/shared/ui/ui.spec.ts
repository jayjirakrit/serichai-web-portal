import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { Button } from '@shared/ui/button';
import { Card } from '@shared/ui/card';
import { FileField } from '@shared/ui/file-field';
import { ResultPanel, ResultPanelStatus } from '@shared/ui/result-panel';

@Component({
  imports: [Button, Card, FileField, ResultPanel],
  template: `
    <app-button extraClass="w-fit" [disabled]="true">Go</app-button>
    <app-card title="T" description="D" link="/x" />
    <app-file-field label="File" [errorMessage]="err()" (fileChange)="picked = $event" />
    <app-result-panel [status]="status()" [error]="'boom'">
      <span class="ok">OK</span>
      <span idle class="idle">IDLE</span>
    </app-result-panel>
  `,
})
class Host {
  err = signal<string | null>('Select a file');
  status = signal<ResultPanelStatus>('idle');
  picked: File | null | undefined;
}

describe('shared ui', () => {
  async function make() {
    await TestBed.configureTestingModule({
      imports: [Host],
      providers: [provideRouter([])],
    }).compileComponents();
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    return fixture;
  }

  it('renders button, card link and file-field validation', async () => {
    const f = await make();
    const el = f.nativeElement as HTMLElement;
    const btn = el.querySelector('app-button button') as HTMLButtonElement;
    expect(btn.disabled).toBe(true);
    expect(btn.classList.contains('btn-primary')).toBe(true);
    expect(el.querySelector('app-card a')?.getAttribute('href')).toBe('/x');
    expect(el.querySelector('app-file-field [role=alert]')?.textContent).toContain('Select a file');
  });

  it('result panel switches states', async () => {
    const f = await make();
    const el = f.nativeElement as HTMLElement;
    expect(el.querySelector('.idle')).not.toBeNull();
    f.componentInstance.status.set('pending');
    await f.whenStable();
    expect(el.querySelector('[role=status]')).not.toBeNull();
    f.componentInstance.status.set('error');
    await f.whenStable();
    expect(el.querySelector('.alert-error')?.textContent).toContain('boom');
    f.componentInstance.status.set('success');
    await f.whenStable();
    expect(el.querySelector('.ok')).not.toBeNull();
  });
});
