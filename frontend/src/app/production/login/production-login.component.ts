import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-production-login',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, RouterModule],
  template: `
    <div class="min-h-screen bg-surface-900 flex flex-col items-center justify-center p-4" data-testid="production-login-page">
      <div class="text-center mb-8 card-enter">
        <h1 class="text-3xl font-bold text-white">Chrono DMI</h1>
        <p class="text-surface-400 mt-1">Production</p>
      </div>
      <div class="login-card w-full max-w-xs">
        <div class="text-center mb-4">
          <p class="text-surface-400 text-sm">Entrez votre NIP</p>
          <p class="text-3xl font-mono text-white tracking-widest h-10 mt-2" data-testid="pin-display">{{ display }}</p>
        </div>
        <div class="grid grid-cols-3 gap-2 mb-4">
          @for (n of [1,2,3,4,5,6,7,8,9]; track n) {
            <button (click)="addDigit(n.toString())" class="pin-btn" [attr.data-testid]="'pin-' + n">{{ n }}</button>
          }
          <button (click)="pin = ''" class="pin-btn" style="color: var(--cdmi-accent-red);" data-testid="pin-clear">C</button>
          <button (click)="addDigit('0')" class="pin-btn" data-testid="pin-0">0</button>
          <button (click)="pin = pin.slice(0, -1)" class="pin-btn" style="color: var(--cdmi-text-muted);" data-testid="pin-backspace">&#8592;</button>
        </div>
        <button (click)="submit()" class="w-full h-12 rounded-xl font-bold transition-all" style="background: var(--cdmi-accent-blue); color: white;" data-testid="pin-confirm">Confirmer</button>
        @if (error) { <p class="text-red-400 text-sm text-center mt-2" data-testid="pin-error">{{ error }}</p> }
        <button (click)="submit()" class="w-full h-10 rounded-xl font-bold transition-all mt-3" style="background: var(--cdmi-accent-red); color: white;" data-testid="pin-emergency">URGENCE</button>
      </div>
      <a routerLink="/" class="text-surface-500 text-sm mt-6 hover:underline" data-testid="goto-management">&#8592; Gestion</a>
    </div>
  `,
})
export class ProductionLoginComponent {
  pin = '';
  error = '';
  constructor(private auth: AuthService, private router: Router) {}

  get display() { return this.pin.replace(/./g, '\u25CF'); }
  addDigit(d: string) { if (this.pin.length < 6) this.pin += d; }

  submit() {
    this.error = '';
    this.auth.loginPin(this.pin).subscribe({
      next: () => this.router.navigate(['/production/interventions']),
      error: () => { this.error = 'NIP invalide'; this.pin = ''; },
    });
  }
}
