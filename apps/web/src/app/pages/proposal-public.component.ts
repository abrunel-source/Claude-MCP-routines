import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../core/api.service';
import { ThemeService } from '../core/theme.service';

// Strict ordered prospect wizard (spec §10): cover → packages → terms →
// signature → confirmation. Tenant-themed from the proposal's branding payload.
@Component({
  selector: 'app-proposal-public',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (data(); as p) {
      <div class="brandbar">
        @if (p.branding.logoUrl) { <img class="logo" [src]="p.branding.logoUrl" alt="" /> }
        <h1>{{ p.branding.companyName }}</h1>
      </div>
      <div class="container" style="max-width:680px">
        <div class="steps">
          @for (s of stepLabels; track s; let i = $index) {
            <span class="step" [class.active]="step() === i + 1" [class.done]="step() > i + 1">{{ s }}</span>
          }
        </div>

        <div class="card">
          @switch (step()) {
            @case (1) {
              <h2>{{ p.title }}</h2>
              <p style="white-space:pre-wrap">{{ p.coverLetterBody }}</p>
              <div class="right"><button class="btn" (click)="step.set(2)">Next</button></div>
            }
            @case (2) {
              <h2>Choose your package</h2>
              @for (o of p.options; track o.id) {
                <div class="option" [class.selected]="selected() === o.id" (click)="selected.set(o.id)">
                  <strong>{{ o.name }}</strong>
                  @if (o.description) { <p class="muted">{{ o.description }}</p> }
                  @for (li of o.lineItems; track li.name) {
                    <div class="row"><span>{{ li.quantity }}× {{ li.name }}</span><span>{{ money(li.unitPriceCents, p.currency) }}</span></div>
                  }
                </div>
              }
              <div class="right">
                <button class="btn" [disabled]="!selected()" (click)="chooseAndNext()">Next</button>
              </div>
            }
            @case (3) {
              <h2>Terms &amp; conditions</h2>
              <p class="muted" style="white-space:pre-wrap; max-height:240px; overflow:auto">{{ p.termsBody }}</p>
              <label><input type="checkbox" [(ngModel)]="termsAccepted" /> I accept these terms</label>
              <div class="right">
                <button class="btn" [disabled]="!termsAccepted" (click)="acceptAndNext()">Next</button>
              </div>
            }
            @case (4) {
              <h2>Sign</h2>
              @if (p.upfrontAmountCents > 0) {
                <p class="muted">An upfront payment of {{ money(p.upfrontAmountCents, p.currency) }} applies on signing.</p>
              }
              <label>Full name</label>
              <input class="input" [(ngModel)]="signerName" />
              <label>Email</label>
              <input class="input" type="email" [(ngModel)]="signerEmail" />
              <label>Type your signature</label>
              <input class="input" [(ngModel)]="signatureData" style="font-family:cursive; font-size:20px" />
              <label><input type="checkbox" [(ngModel)]="consent" /> I consent to sign electronically (ECTA)</label>
              <div class="right" style="margin-top:14px">
                <button class="btn" [disabled]="!canSign() || signing()" (click)="sign()">
                  {{ signing() ? 'Signing…' : 'Sign &amp; submit' }}
                </button>
              </div>
            }
            @case (5) {
              <h2 class="success">All done 🎉</h2>
              <p>Your signed engagement letter has been emailed to you and {{ p.branding.companyName }}.</p>
              @if (paymentUrl()) {
                <p><a class="btn" [href]="paymentUrl()">Complete your payment</a></p>
              }
              <p class="muted">Document reference: {{ docHash().slice(0, 16) }}…</p>
            }
          }
          @if (error()) { <p class="error">{{ error() }}</p> }
        </div>
      </div>
    } @else if (loadError()) {
      <div class="container"><div class="card"><p class="error">{{ loadError() }}</p></div></div>
    } @else {
      <div class="container"><div class="card"><p class="muted">Loading proposal…</p></div></div>
    }
  `,
})
export class ProposalPublicComponent implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly api = inject(ApiService);
  private readonly theme = inject(ThemeService);

  readonly stepLabels = ['Welcome', 'Packages', 'Terms', 'Sign', 'Done'];
  token = '';
  data = signal<any | null>(null);
  loadError = signal('');
  step = signal(1);
  selected = signal<string>('');
  termsAccepted = false;
  signerName = '';
  signerEmail = '';
  signatureData = '';
  consent = false;
  signing = signal(false);
  error = signal('');
  paymentUrl = signal<string | null>(null);
  docHash = signal('');

  canSign = computed(
    () => !!this.signerName && !!this.signerEmail && !!this.signatureData && this.consent,
  );

  ngOnInit(): void {
    this.token = this.route.snapshot.paramMap.get('token') ?? '';
    this.api.publicProposal(this.token).subscribe({
      next: (p) => {
        this.data.set(p);
        this.theme.applyBranding(p.branding?.primaryColor, p.branding?.secondaryColor);
        if (p.selectedOptionId) this.selected.set(p.selectedOptionId);
        else if (p.options?.length === 1) this.selected.set(p.options[0].id);
      },
      error: () => this.loadError.set('This proposal link is invalid or has expired.'),
    });
  }

  money(cents: number, currency: string): string {
    return new Intl.NumberFormat('en-ZA', { style: 'currency', currency }).format(cents / 100);
  }

  chooseAndNext(): void {
    this.api.selectPackage(this.token, this.selected()).subscribe({
      next: () => this.step.set(3),
      error: () => this.error.set('Could not select package.'),
    });
  }

  acceptAndNext(): void {
    this.api.acceptTerms(this.token).subscribe({
      next: () => this.step.set(4),
      error: () => this.error.set('Could not record acceptance.'),
    });
  }

  sign(): void {
    this.signing.set(true);
    this.error.set('');
    this.api
      .sign(this.token, {
        signerName: this.signerName,
        signerEmail: this.signerEmail,
        method: 'typed',
        signatureData: this.signatureData,
        consent: this.consent,
      })
      .subscribe({
        next: (res) => {
          this.docHash.set(res.documentSha256 ?? '');
          this.paymentUrl.set(res.paymentUrl ?? null);
          this.step.set(5);
        },
        error: (e) => {
          this.signing.set(false);
          this.error.set(e?.error?.message ?? 'Could not sign. Please try again.');
        },
      });
  }
}
