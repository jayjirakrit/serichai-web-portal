import { Component, input } from '@angular/core';

export type ResultPanelStatus = 'idle' | 'pending' | 'error' | 'success';

/**
 * Idle/pending/error/success shell. Success content is projected via the
 * default slot; an optional `[idle]` slot is shown while idle.
 */
@Component({
  selector: 'app-result-panel',
  template: `
    @switch (status()) {
      @case ('pending') {
        <div class="flex items-center gap-2" role="status">
          <span class="loading loading-spinner loading-sm"></span>
          <span>{{ pendingText() }}</span>
        </div>
      }
      @case ('error') {
        <div class="alert alert-error" role="alert">
          <span>{{ error() }}</span>
        </div>
      }
      @case ('success') {
        <ng-content />
      }
      @default {
        <ng-content select="[idle]" />
      }
    }
  `,
})
export class ResultPanel {
  readonly status = input.required<ResultPanelStatus>();
  readonly error = input<string | null>(null);
  readonly pendingText = input('Processing...');
}
