import { Routes } from '@angular/router';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'login',
    loadComponent: () => import('./features/auth/login').then((m) => m.Login),
  },
  {
    path: 'employee-benefits',
    loadComponent: () =>
      import('./features/employee-benefits/employee-benefits').then((m) => m.EmployeeBenefits),
  },
  {
    path: 'bonus-calculation',
    loadComponent: () =>
      import('./features/bonus-calculation/bonus-calculation').then((m) => m.BonusCalculation),
  },
  {
    path: 'payroll-reconciliation',
    loadComponent: () =>
      import('./features/payroll-reconcile/payroll-reconcile').then((m) => m.PayrollReconcile),
  },
  {
    path: 'tax-deduction',
    loadComponent: () =>
      import('./features/tax-deduction/tax-deduction').then((m) => m.TaxDeduction),
  },
  { path: '**', redirectTo: '' },
];
