import { Component, inject, signal, OnInit } from '@angular/core';
import { JsonPipe } from '@angular/common';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ThemeService } from '../core/theme.service';

// Firm console shell. The full Material-themed console (Home, Clients, Deals,
// Proposals, Services, Library, Invoices, Billing, Forms, Settings — spec §11)
// builds on this scaffold; see docs/HANDOFF.md.
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [JsonPipe],
  template: `
    <div class="brandbar">
      <h1>{{ theme.context()?.companyName || 'Cadence' }}</h1>
      <span style="flex:1"></span>
      <button class="btn btn-ghost" style="color:#fff;border-color:rgba(255,255,255,.4)" (click)="logout()">
        Sign out
      </button>
    </div>
    <div class="container">
      <div class="card">
        <h2>Welcome back</h2>
        @if (me()) {
          <p class="muted">Signed in as:</p>
          <pre>{{ me() | json }}</pre>
        } @else if (error()) {
          <p class="error">{{ error() }}</p>
        } @else {
          <p class="muted">Loading…</p>
        }
      </div>
    </div>
  `,
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  me = signal<unknown>(null);
  error = signal('');

  ngOnInit(): void {
    if (this.api.accessToken()) {
      this.loadMe();
      return;
    }
    // Login is disabled for this deployment — start a passwordless demo session.
    this.api.demoLogin().subscribe({
      next: (res) => {
        this.api.setToken(res.accessToken);
        this.loadMe();
      },
      error: () => this.error.set('Could not start demo session.'),
    });
  }

  private loadMe(): void {
    this.api.me().subscribe({
      next: (u) => this.me.set(u),
      error: () => this.error.set('Session error — could not load your profile.'),
    });
  }

  logout(): void {
    this.api.setToken(null);
    this.router.navigate(['/app']);
  }
}
