import { Component, input } from '@angular/core';

@Component({
  selector: 'app-button',
  template: `
    <button type="button" class="btn btn-primary" [class]="extraClass()" [disabled]="disabled()">
      <ng-content />
    </button>
  `,
})
export class Button {
  readonly extraClass = input('');
  readonly disabled = input(false);
}
