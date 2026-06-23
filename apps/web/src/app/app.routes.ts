import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./pages/landing.component').then((m) => m.LandingComponent) },
  // Login is disabled for this deployment — redirect straight into the app,
  // which starts a passwordless demo session.
  { path: 'login', redirectTo: 'app', pathMatch: 'full' },
  { path: 'app', loadComponent: () => import('./pages/dashboard.component').then((m) => m.DashboardComponent) },
  { path: 'p/:token', loadComponent: () => import('./pages/proposal-public.component').then((m) => m.ProposalPublicComponent) },
  { path: '**', redirectTo: '' },
];
