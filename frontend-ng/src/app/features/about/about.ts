import { Component, inject } from '@angular/core';
import { apiCall } from '@core/http/api-call';
import { Layout } from '@shared/ui/layout';
import { ResultPanel } from '@shared/ui/result-panel';
import { AboutService } from '@/features/about/about.service';

@Component({
  selector: 'app-about',
  imports: [Layout, ResultPanel],
  templateUrl: './about.html',
})
export class About {
  private readonly service = inject(AboutService);
  protected readonly call = apiCall(() => this.service.getSystemInfo());

  constructor() {
    // No user input: fetch on open; apiCall cancels the request if the page is left early.
    this.call.run();
  }
}
