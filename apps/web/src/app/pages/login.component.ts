import { Component, inject, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="container" style="max-width:420px">
      <div class="card">
        <h2>Sign in</h2>
        <label>Email</label>
        <input class="input" type="email" [(ngModel)]="email" placeholder="you@firm.co.za" />
        <label>Password</label>
        <input class="input" type="password" [(ngModel)]="password" (keyup.enter)="submit()" />
        <div style="margin-top:18px">
          <button class="btn" [disabled]="loading()" (click)="submit()">
            {{ loading() ? 'Signing in…' : 'Sign in' }}
          </button>
        </div>
        @if (error()) { <p class="error">{{ error() }}</p> }
      </div>
    </div>
  `,
})
export class LoginComponent {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  email = '';
  password = '';
  loading = signal(false);
  error = signal('');

  submit(): void {
    this.error.set('');
    this.loading.set(true);
    this.api.login(this.email, this.password).subscribe({
      next: (res) => {
        this.api.setToken(res.accessToken);
        this.router.navigate(['/app']);
      },
      error: () => {
        this.loading.set(false);
        this.error.set('Invalid credentials.');
      },
    });
  }
}
