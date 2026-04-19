import { Routes } from '@angular/router';
import { managementGuard, productionGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  // Login Gestion
  {
    path: '',
    loadComponent: () => import('./login.component').then(m => m.LoginComponent),
  },
  // Production Login
  {
    path: 'production/login',
    loadComponent: () => import('./production/login/production-login.component').then(m => m.ProductionLoginComponent),
  },
  // Production routes
  {
    path: 'production/interventions',
    canActivate: [productionGuard],
    loadComponent: () => import('./production/interventions/production-interventions.component').then(m => m.ProductionInterventionsComponent),
  },
  {
    path: 'production/picking/:interventionId',
    canActivate: [productionGuard],
    loadComponent: () => import('./production/picking/picking.component').then(m => m.PickingComponent),
  },
  {
    path: 'production/picking-libre',
    canActivate: [productionGuard],
    loadComponent: () => import('./production/picking-libre/picking-libre.component').then(m => m.PickingLibreComponent),
  },
  {
    path: 'production/restock',
    canActivate: [productionGuard],
    loadComponent: () => import('./production/restock/restock.component').then(m => m.RestockComponent),
  },
  // Management routes
  {
    path: 'management',
    canActivate: [managementGuard],
    loadComponent: () => import('./management/layout/management-layout.component').then(m => m.ManagementLayoutComponent),
    children: [
      { path: 'interventions', loadComponent: () => import('./management/interventions/interventions.component').then(m => m.InterventionsComponent) },
      { path: 'cabinets', loadComponent: () => import('./management/cabinets/cabinets.component').then(m => m.CabinetsComponent) },
      { path: 'products', loadComponent: () => import('./management/products/products.component').then(m => m.ProductsComponent) },
      { path: 'orders', loadComponent: () => import('./management/orders/orders.component').then(m => m.OrdersComponent) },
      { path: 'consumption', loadComponent: () => import('./management/consumption/consumption.component').then(m => m.ConsumptionComponent) },
      { path: 'employees', loadComponent: () => import('./management/employees/employees.component').then(m => m.EmployeesComponent) },
      { path: 'movements', loadComponent: () => import('./management/movements/movements.component').then(m => m.MovementsComponent) },
      { path: '', redirectTo: 'interventions', pathMatch: 'full' },
    ],
  },
  { path: '**', redirectTo: '' },
];
