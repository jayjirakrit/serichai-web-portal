import { Component } from '@angular/core';
import { Navbar } from '@shared/ui/navbar';

/** Page shell: navbar + projected page content. Pages wrap their template in <app-layout>. */
@Component({
  selector: 'app-layout',
  imports: [Navbar],
  template: `
    <div class="app-container">
      <app-navbar />
      <main class="main-content">
        <ng-content />
      </main>
    </div>
  `,
})
export class Layout {}
