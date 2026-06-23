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

  /** Passwordless demo session (login is disabled for this deployment). */
  demoLogin(): Observable<{ accessToken: string }> {
    return this.http.post<{ accessToken: string }>(
      `${API_BASE}/auth/demo-login`,
      {},
      { withCredentials: true },
    );
  }

  me(): Observable<any> {
    return this.http.get(`${API_BASE}/auth/me`, { headers: this.headers() });
  }

  // --- Generic authed helpers ---------------------------------------------
  private get<T>(path: string): Observable<T> {
    return this.http.get<T>(`${API_BASE}${path}`, { headers: this.headers() });
  }
  private post<T>(path: string, body: unknown): Observable<T> {
    return this.http.post<T>(`${API_BASE}${path}`, body, { headers: this.headers() });
  }

  // --- CRM -----------------------------------------------------------------
  listOrganizations(q = ''): Observable<any[]> {
    return this.get(`/crm/organizations${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }
  createOrganization(body: { name: string; website?: string; vatNumber?: string }): Observable<any> {
    return this.post(`/crm/organizations`, body);
  }
  listContacts(q = ''): Observable<any[]> {
    return this.get(`/crm/contacts${q ? `?q=${encodeURIComponent(q)}` : ''}`);
  }
  createContact(body: {
    firstName: string;
    lastName?: string;
    email: string;
    phone?: string;
    organizationId?: string;
  }): Observable<any> {
    return this.post(`/crm/contacts`, body);
  }
  listDeals(stage = ''): Observable<any[]> {
    return this.get(`/crm/deals${stage ? `?stage=${stage}` : ''}`);
  }
  createDeal(body: {
    title: string;
    stage?: string;
    valueCents?: number;
    organizationId?: string;
    contactId?: string;
  }): Observable<any> {
    return this.post(`/crm/deals`, body);
  }
  moveDeal(id: string, stage: string, position: number): Observable<any> {
    return this.http.patch(`${API_BASE}/crm/deals/${id}/move`, { stage, position }, { headers: this.headers() });
  }
  listActivities(): Observable<any[]> {
    return this.get(`/crm/activities`);
  }
  listTags(): Observable<any[]> {
    return this.get(`/crm/tags`);
  }

  // --- Library -------------------------------------------------------------
  listServices(): Observable<any[]> {
    return this.get(`/library/services`);
  }
  createService(body: {
    name: string;
    pricingType?: string;
    defaultPriceCents?: number;
    recurringInterval?: string;
  }): Observable<any> {
    return this.post(`/library/services`, body);
  }
  listPackages(): Observable<any[]> {
    return this.get(`/library/packages`);
  }

  // --- Proposals -----------------------------------------------------------
  listProposals(): Observable<any[]> {
    return this.get(`/proposals`);
  }
  getProposal(id: string): Observable<any> {
    return this.get(`/proposals/${id}`);
  }
  sendProposal(id: string): Observable<any> {
    return this.post(`/proposals/${id}/send`, {});
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
