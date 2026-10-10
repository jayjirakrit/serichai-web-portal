import { InjectionToken } from '@angular/core';

/** Base URL prepended to backend calls. Empty = same origin (proxy / nginx). */
export const API_BASE_URL = new InjectionToken<string>('http://127.0.0.1:8000');
