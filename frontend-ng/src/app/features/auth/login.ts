import { Component } from '@angular/core';
import { Button } from '../../shared/ui/button';

/** Login stub (matches the React page: no auth wiring yet). */
@Component({
  selector: 'app-login',
  imports: [Button],
  templateUrl: './login.html',
})
export class Login {}
