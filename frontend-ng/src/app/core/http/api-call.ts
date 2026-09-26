import { DestroyRef, computed, inject, signal } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable, Subscription } from 'rxjs';

export type ApiCallStatus = 'idle' | 'pending' | 'error' | 'success';

/**
 * Signal-based mutation helper (replaces TanStack `useMutation`).
 * Must be called in an injection context (field initializer / constructor);
 * the in-flight request is cancelled when the owning component is destroyed.
 */
export function apiCall<TArgs extends unknown[], TRes>(fn: (...args: TArgs) => Observable<TRes>) {
  const destroyRef = inject(DestroyRef);
  const data = signal<TRes | null>(null);
  const error = signal<string | null>(null);
  const pending = signal(false);
  let sub: Subscription | null = null;
  let destroyed = false;
  destroyRef.onDestroy(() => {
    destroyed = true;
    sub?.unsubscribe();
  });

  const run = (...args: TArgs): void => {
    if (destroyed) return;
    sub?.unsubscribe();
    pending.set(true);
    error.set(null);
    data.set(null);
    sub = fn(...args).subscribe({
      next: (res) => {
        data.set(res);
        pending.set(false);
      },
      error: (e: HttpErrorResponse) => {
        const detail = (e.error as { detail?: unknown } | null)?.detail;
        error.set(
          typeof detail === 'string' && detail ? detail : `Request failed with status ${e.status}`,
        );
        pending.set(false);
      },
    });
  };

  const reset = (): void => {
    sub?.unsubscribe();
    data.set(null);
    error.set(null);
    pending.set(false);
  };

  const status = computed<ApiCallStatus>(() =>
    pending() ? 'pending' : error() !== null ? 'error' : data() !== null ? 'success' : 'idle',
  );

  return {
    data: data.asReadonly(),
    error: error.asReadonly(),
    pending: pending.asReadonly(),
    status,
    run,
    reset,
  };
}
