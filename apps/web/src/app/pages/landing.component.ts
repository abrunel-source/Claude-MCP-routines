import { Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ThemeService } from '../core/theme.service';

@Component({
  selector: 'app-landing',
  standalone: true,
  imports: [RouterLink],
  template: `
    <div class="brandbar">
      <h1>{{ theme.context()?.companyName || 'Cadence' }}</h1>
    </div>
    <div class="container">
      <div class="card">
        <h2>Sell, sign, bill, get paid.</h2>
        <p class="muted">
          Proposals, e-signed engagement letters and South African payments
          (Stitch) for professional-services firms.
        </p>
        <a class="btn" routerLink="/login">Sign in</a>
      </div>
    </div>
  `,
})
export class LandingComponent {
  readonly theme = inject(ThemeService);
}
