import { Injectable, signal } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface TenantContext {
  tenantId?: string;
  slug?: string;
  companyName?: string;
  brandingPrimaryColor?: string;
  brandingSecondaryColor?: string;
  logoUrl?: string | null;
  platform?: boolean;
}

// API base: same origin in production behind a proxy; configurable for dev.
const API_BASE = (window as unknown as { __API_BASE__?: string }).__API_BASE__ ?? '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  readonly accessToken = signal<string | null>(localStorage.getItem('cadence_at'));

  constructor(private readonly http: HttpClient) {}

  private headers(): Record<string, string> {
    const t = this.accessToken();
    return t ? { Authorization: `Bearer ${t}` } : {};
  }

  setToken(token: string | null): void {
    this.accessToken.set(token);
    if (token) localStorage.setItem('cadence_at', token);
    else localStorage.removeItem('cadence_at');
  }

  tenantContext(): Observable<TenantContext> {
    return this.http.get<TenantContext>(`${API_BASE}/tenant/context`);
  }

  login(email: string, password: string): Observable<{ accessToken: string }> {
    return this.http.post<{ accessToken: string }>(
      `${API_BASE}/auth/login`,
      { email, password },
      { withCredentials: true },
    );
  }

  me(): Observable<unknown> {
    return this.http.get(`${API_BASE}/auth/me`, { headers: this.headers() });
  }

  publicProposal(token: string): Observable<any> {
    return this.http.get(`${API_BASE}/public/proposals/${token}`);
  }

  selectPackage(token: string, optionId: string): Observable<any> {
    return this.http.post(`${API_BASE}/public/proposals/${token}/select-package`, { optionId });
  }

  acceptTerms(token: string): Observable<any> {
    return this.http.post(`${API_BASE}/public/proposals/${token}/accept-terms`, {});
  }

  sign(token: string, body: unknown): Observable<any> {
    return this.http.post(`${API_BASE}/public/proposals/${token}/sign`, body);
  }
}
