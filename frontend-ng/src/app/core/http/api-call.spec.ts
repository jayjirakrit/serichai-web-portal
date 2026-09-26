import { Injector, runInInjectionContext } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { Subject } from 'rxjs';
import { apiCall } from './api-call';

function setup() {
  const subject = new Subject<string>();
  const injector = TestBed.inject(Injector);
  const call = runInInjectionContext(injector, () => apiCall((n: number) => (n >= 0 ? subject : subject)));
  return { subject, call };
}

describe('apiCall', () => {
  it('starts idle', () => {
    const { call } = setup();
    expect(call.status()).toBe('idle');
    expect(call.data()).toBeNull();
    expect(call.error()).toBeNull();
  });

  it('goes pending then success', () => {
    const { call, subject } = setup();
    call.run(1);
    expect(call.status()).toBe('pending');
    expect(call.pending()).toBe(true);
    subject.next('ok');
    expect(call.status()).toBe('success');
    expect(call.data()).toBe('ok');
    expect(call.pending()).toBe(false);
  });

  it('maps error.detail', () => {
    const { call, subject } = setup();
    call.run(1);
    subject.error(new HttpErrorResponse({ status: 400, error: { detail: 'bad file' } }));
    expect(call.status()).toBe('error');
    expect(call.error()).toBe('bad file');
  });

  it('falls back to status message, including status 0', () => {
    const { call, subject } = setup();
    call.run(1);
    subject.error(new HttpErrorResponse({ status: 0 }));
    expect(call.error()).toBe('Request failed with status 0');
  });

  it('reset returns to idle', () => {
    const { call, subject } = setup();
    call.run(1);
    subject.next('ok');
    call.reset();
    expect(call.status()).toBe('idle');
  });

  it('does not update after the owner is destroyed', () => {
    const { call, subject } = setup();
    call.run(1);
    TestBed.resetTestingModule();
    subject.next('late');
    expect(call.data()).toBeNull();
  });
});
