import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from '@core/config/api-config';
import { SystemInfo } from '@/features/about/about.models';

@Injectable({ providedIn: 'root' })
export class AboutService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = inject(API_BASE_URL);

  getSystemInfo(): Observable<SystemInfo> {
    return this.http.get<SystemInfo>(`${this.baseUrl}/system/info`);
  }
}
