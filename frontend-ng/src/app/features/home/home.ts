import { Component } from '@angular/core';
import { Layout } from '@shared/ui/layout';
import { Card } from '@shared/ui/card';

interface Feature {
  title: string;
  description: string;
  link: string;
}

@Component({
  selector: 'app-home',
  imports: [Layout, Card],
  templateUrl: './home.html',
})
export class Home {
  protected readonly features: Feature[] = [
    {
      title: 'Employee Benefits',
      description: 'Comprehensive benefits package for all employees.',
      link: '/employee-benefits',
    },
    {
      title: 'Bonus Calculation',
      description: 'Calculate your bonus based on performance metrics.',
      link: '/bonus-calculation',
    },
    {
      title: 'Payroll Reconciliation',
      description: 'Reconcile payroll data with employee records.',
      link: '/payroll-reconciliation',
    },
    {
      title: 'Tax Deduction',
      description: 'Calculate and manage tax deduction for employees.',
      link: '/tax-deduction',
    },
  ];
}
