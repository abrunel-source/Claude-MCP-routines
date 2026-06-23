import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ThemeService } from '../core/theme.service';

type Section = 'home' | 'clients' | 'deals' | 'proposals' | 'services';

// Firm console. Login is disabled for this deployment — the dashboard starts a
// passwordless demo session and then surfaces the live CRM / deals / proposals /
// services data from the API so the whole product is visible without signing in.
@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [FormsModule],
  template: `
    <div class="brandbar">
      <h1>{{ theme.context()?.companyName || 'Cadence' }}</h1>
      <span style="flex:1"></span>
      @if (me()) { <span style="color:#fff;opacity:.85;font-size:13px;margin-right:14px">{{ me()?.email }}</span> }
      <button class="btn btn-ghost btn-sm" style="color:#fff;border-color:rgba(255,255,255,.4)" (click)="logout()">Sign out</button>
    </div>

    @if (booting()) {
      <div class="container"><div class="card"><p class="muted">Starting your workspace…</p>
        @if (error()) { <p class="error">{{ error() }}</p> }</div></div>
    } @else {
    <div class="shell">
      <nav class="sidebar">
        <button class="navitem" [class.active]="section()==='home'" (click)="go('home')">📊 Home</button>
        <button class="navitem" [class.active]="section()==='clients'" (click)="go('clients')">👥 Clients</button>
        <button class="navitem" [class.active]="section()==='deals'" (click)="go('deals')">💼 Deals</button>
        <button class="navitem" [class.active]="section()==='proposals'" (click)="go('proposals')">📄 Proposals</button>
        <button class="navitem" [class.active]="section()==='services'" (click)="go('services')">🧾 Services</button>
      </nav>

      <main class="main">

        @if (section()==='home') {
          <div class="pagehead"><div><h2>Welcome back</h2><p class="muted">Signed in as {{ me()?.email }} ({{ me()?.isPlatformAdmin ? 'platform admin' : 'firm user' }})</p></div></div>
          <div class="stats">
            <div class="stat"><div class="n">{{ contacts().length }}</div><div class="l">Contacts</div></div>
            <div class="stat"><div class="n">{{ orgs().length }}</div><div class="l">Organizations</div></div>
            <div class="stat"><div class="n">{{ deals().length }}</div><div class="l">Open deals</div></div>
            <div class="stat"><div class="n">{{ proposals().length }}</div><div class="l">Proposals</div></div>
            <div class="stat"><div class="n">{{ services().length }}</div><div class="l">Services</div></div>
            <div class="stat"><div class="n">{{ money(pipelineValue()) }}</div><div class="l">Pipeline value</div></div>
          </div>
          <div class="card">
            <h3 style="margin-top:0">Your workspace</h3>
            <p class="muted">This is a live multi-tenant demo of Cadence. Use the menu to browse Clients (CRM), the Deals pipeline, Proposals (engagement letters), and your Services catalogue — all served from the API and database.</p>
          </div>
        }

        @if (section()==='clients') {
          <div class="pagehead"><h2>Clients</h2></div>
          <div class="inline-form">
            <div><label>First name</label><input class="input" [(ngModel)]="cForm.firstName" placeholder="Jane" /></div>
            <div><label>Last name</label><input class="input" [(ngModel)]="cForm.lastName" placeholder="Doe" /></div>
            <div><label>Email</label><input class="input" [(ngModel)]="cForm.email" placeholder="jane@acme.co.za" /></div>
            <div><label>Phone</label><input class="input" [(ngModel)]="cForm.phone" placeholder="+27…" /></div>
            <button class="btn btn-sm" [disabled]="saving()" (click)="addContact()">Add contact</button>
          </div>
          <table class="tbl">
            <thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Organization</th></tr></thead>
            <tbody>
              @for (c of contacts(); track c.id) {
                <tr><td>{{ c.firstName }} {{ c.lastName }}</td><td>{{ c.email }}</td><td>{{ c.phone || '—' }}</td><td>{{ c.organization?.name || '—' }}</td></tr>
              } @empty { <tr><td colspan="4" class="muted">No contacts yet.</td></tr> }
            </tbody>
          </table>
        }

        @if (section()==='deals') {
          <div class="pagehead"><h2>Deals</h2></div>
          <div class="inline-form">
            <div><label>Title</label><input class="input" [(ngModel)]="dForm.title" placeholder="Annual engagement" /></div>
            <div><label>Value (R)</label><input class="input" type="number" [(ngModel)]="dForm.value" placeholder="17000" /></div>
            <div><label>Stage</label>
              <select class="input" [(ngModel)]="dForm.stage">
                <option value="lead">Lead</option><option value="qualified">Qualified</option>
                <option value="proposal_sent">Proposal sent</option><option value="won">Won</option><option value="lost">Lost</option>
              </select>
            </div>
            <button class="btn btn-sm" [disabled]="saving()" (click)="addDeal()">Add deal</button>
          </div>
          <table class="tbl">
            <thead><tr><th>Title</th><th>Stage</th><th>Value</th><th>Organization</th></tr></thead>
            <tbody>
              @for (d of deals(); track d.id) {
                <tr><td>{{ d.title }}</td><td><span class="badge" [class]="stageClass(d.stage)">{{ pretty(d.stage) }}</span></td>
                <td>{{ money(d.valueCents) }}</td><td>{{ d.organization?.name || '—' }}</td></tr>
              } @empty { <tr><td colspan="4" class="muted">No deals yet.</td></tr> }
            </tbody>
          </table>
        }

        @if (section()==='proposals') {
          <div class="pagehead"><h2>Proposals</h2></div>
          <table class="tbl">
            <thead><tr><th>Number</th><th>Prospect</th><th>Status</th><th>Total</th><th></th></tr></thead>
            <tbody>
              @for (p of proposals(); track p.id) {
                <tr>
                  <td>{{ p.number || p.id.slice(0,8) }}</td>
                  <td>{{ p.prospectName }}<br/><span class="muted" style="font-size:12px">{{ p.prospectEmail }}</span></td>
                  <td><span class="badge" [class]="statusClass(p.status)">{{ pretty(p.status) }}</span></td>
                  <td>{{ money(p.totalCents ?? p.upfrontAmountCents ?? 0) }}</td>
                  <td class="right">
                    @if (p.publicToken || p.token) {
                      <a class="btn btn-ghost btn-sm" [href]="'/p/' + (p.publicToken || p.token)" target="_blank">Open link</a>
                    }
                  </td>
                </tr>
              } @empty { <tr><td colspan="5" class="muted">No proposals yet.</td></tr> }
            </tbody>
          </table>
          <p class="muted" style="margin-top:14px">The prospect-facing signing wizard (cover letter → packages → terms → e-signature → payment) is fully functional — open a proposal's public link to try it.</p>
        }

        @if (section()==='services') {
          <div class="pagehead"><h2>Services</h2></div>
          <div class="inline-form">
            <div><label>Name</label><input class="input" [(ngModel)]="sForm.name" placeholder="Monthly Bookkeeping" /></div>
            <div><label>Price (R)</label><input class="input" type="number" [(ngModel)]="sForm.price" placeholder="3500" /></div>
            <div><label>Type</label>
              <select class="input" [(ngModel)]="sForm.pricingType">
                <option value="fixed">Fixed</option><option value="recurring">Recurring</option><option value="usage">Usage</option>
              </select>
            </div>
            <button class="btn btn-sm" [disabled]="saving()" (click)="addService()">Add service</button>
          </div>
          <table class="tbl">
            <thead><tr><th>Service</th><th>Type</th><th>Default price</th></tr></thead>
            <tbody>
              @for (s of services(); track s.id) {
                <tr><td>{{ s.name }}</td><td><span class="badge blue">{{ pretty(s.pricingType) }}</span></td><td>{{ money(s.defaultPriceCents) }}</td></tr>
              } @empty { <tr><td colspan="3" class="muted">No services yet.</td></tr> }
            </tbody>
          </table>
        }

        @if (error()) { <p class="error">{{ error() }}</p> }
      </main>
    </div>
    }
  `,
})
export class DashboardComponent implements OnInit {
  private readonly api = inject(ApiService);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);

  booting = signal(true);
  saving = signal(false);
  error = signal('');
  section = signal<Section>('home');
  me = signal<any>(null);

  contacts = signal<any[]>([]);
  orgs = signal<any[]>([]);
  deals = signal<any[]>([]);
  proposals = signal<any[]>([]);
  services = signal<any[]>([]);

  pipelineValue = computed(() =>
    this.deals().reduce((sum, d) => sum + (d.valueCents || 0), 0),
  );

  cForm: any = { firstName: '', lastName: '', email: '', phone: '' };
  dForm: any = { title: '', value: null, stage: 'lead' };
  sForm: any = { name: '', price: null, pricingType: 'fixed' };

  ngOnInit(): void {
    if (this.api.accessToken()) {
      this.boot();
      return;
    }
    this.api.demoLogin().subscribe({
      next: (res) => {
        this.api.setToken(res.accessToken);
        this.boot();
      },
      error: (err) => {
        this.booting.set(false);
        const status = err?.status ?? 'ERR';
        this.error.set(`Demo session failed (${status}). ${err?.error?.message || err?.message || ''}`);
      },
    });
  }

  private boot(): void {
    this.api.me().subscribe({ next: (u) => this.me.set(u), error: () => {} });
    // Load everything up front so Home stats are populated.
    this.api.listContacts().subscribe({ next: (d) => this.contacts.set(d || []), error: () => {} });
    this.api.listOrganizations().subscribe({ next: (d) => this.orgs.set(d || []), error: () => {} });
    this.api.listDeals().subscribe({ next: (d) => this.deals.set(d || []), error: () => {} });
    this.api.listProposals().subscribe({ next: (d) => this.proposals.set(d || []), error: () => {} });
    this.api.listServices().subscribe({ next: (d) => this.services.set(d || []), error: () => {} });
    this.booting.set(false);
  }

  go(s: Section): void {
    this.section.set(s);
    this.error.set('');
  }

  addContact(): void {
    if (!this.cForm.firstName || !this.cForm.email) return;
    this.saving.set(true);
    this.api.createContact(this.cForm).subscribe({
      next: () => {
        this.cForm = { firstName: '', lastName: '', email: '', phone: '' };
        this.saving.set(false);
        this.api.listContacts().subscribe((d) => this.contacts.set(d || []));
      },
      error: (e) => { this.saving.set(false); this.error.set(this.msg(e)); },
    });
  }

  addDeal(): void {
    if (!this.dForm.title) return;
    this.saving.set(true);
    this.api.createDeal({
      title: this.dForm.title,
      stage: this.dForm.stage,
      valueCents: this.dForm.value ? Math.round(this.dForm.value * 100) : undefined,
    }).subscribe({
      next: () => {
        this.dForm = { title: '', value: null, stage: 'lead' };
        this.saving.set(false);
        this.api.listDeals().subscribe((d) => this.deals.set(d || []));
      },
      error: (e) => { this.saving.set(false); this.error.set(this.msg(e)); },
    });
  }

  addService(): void {
    if (!this.sForm.name || !this.sForm.price) return;
    this.saving.set(true);
    this.api.createService({
      name: this.sForm.name,
      defaultPriceCents: Math.round(this.sForm.price * 100),
      pricingType: this.sForm.pricingType,
    }).subscribe({
      next: () => {
        this.sForm = { name: '', price: null, pricingType: 'fixed' };
        this.saving.set(false);
        this.api.listServices().subscribe((d) => this.services.set(d || []));
      },
      error: (e) => { this.saving.set(false); this.error.set(this.msg(e)); },
    });
  }

  money(cents?: number): string {
    const v = (cents || 0) / 100;
    return 'R' + v.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  }
  pretty(s?: string): string {
    return (s || '').replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
  stageClass(stage?: string): string {
    return stage === 'won' ? 'green' : stage === 'lost' ? 'gray' : stage === 'proposal_sent' ? 'blue' : 'amber';
  }
  statusClass(status?: string): string {
    if (status === 'signed') return 'green';
    if (status === 'declined' || status === 'expired') return 'gray';
    if ((status || '').startsWith('package') || status === 'viewed' || status === 'delivered') return 'blue';
    return 'amber';
  }
  private msg(e: any): string {
    return e?.error?.message || e?.message || 'Something went wrong.';
  }

  logout(): void {
    this.api.setToken(null);
    this.router.navigate(['/app']);
  }
}
