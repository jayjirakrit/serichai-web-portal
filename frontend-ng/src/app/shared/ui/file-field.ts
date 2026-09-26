import { Component, input, output } from '@angular/core';

@Component({
  selector: 'app-file-field',
  template: `
    <fieldset class="fieldset">
      <legend class="fieldset-legend">{{ label() }}@if (required()) {<span class="text-error"> * </span>}</legend>
      <input
        type="file"
        class="file-input w-full max-w-md"
        [class.file-input-error]="errorMessage() !== null"
        [accept]="accept()"
        [attr.aria-invalid]="errorMessage() !== null ? 'true' : null"
        (change)="onChange($event)"
      />
      @if (errorMessage() !== null) {
        <p class="label text-error" role="alert">{{ errorMessage() }}</p>
      }
    </fieldset>
  `,
})
export class FileField {
  readonly label = input.required<string>();
  readonly accept = input('.xlsx,.xls');
  readonly errorMessage = input<string | null>(null);
  readonly fileChange = output<File | null>();
  readonly required = input(false);

  protected onChange(event: Event): void {
    this.fileChange.emit((event.target as HTMLInputElement).files?.[0] ?? null);
  }
}
