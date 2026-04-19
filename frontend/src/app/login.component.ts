import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { PasswordModule } from 'primeng/password';
import { MessageModule } from 'primeng/message';
import { AuthService } from './core/services/auth.service';
import { ThemeService } from './core/services/theme.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, ButtonModule, InputTextModule, PasswordModule, MessageModule],
  template: `
    <div class="min-h-screen flex items-center justify-center bg-surface-900" style="position: relative;" data-testid="login-page">
      <button (click)="theme.toggle()" class="theme-toggle" style="position: absolute; top: 1.5rem; right: 1.5rem;" data-testid="login-theme-toggle" [title]="theme.isDark ? 'Mode clair' : 'Mode sombre'">
        <i [class]="theme.isDark ? 'pi pi-sun' : 'pi pi-moon'"></i>
      </button>
      <div class="login-card w-full max-w-md">
        <div class="text-center mb-6">
          <h1 class="text-3xl font-bold text-white">Chrono DMI</h1>
          <p class="text-surface-400 mt-1">Gestion des dispositifs medicaux</p>
        </div>
        @if (error) {
          <p-message severity="error" [text]="error" styleClass="w-full mb-4" />
        }
        <div class="flex flex-col gap-4">
          <div>
            <label class="block text-sm font-medium text-surface-400 mb-1">Email</label>
            <input pInputText [(ngModel)]="email" class="w-full" placeholder="votre@email.com" data-testid="login-email" />
          </div>
          <div>
            <label class="block text-sm font-medium text-surface-400 mb-1">Mot de passe</label>
            <p-password [(ngModel)]="password" [feedback]="false" [toggleMask]="true" styleClass="w-full" inputStyleClass="w-full" (keydown.enter)="onLogin()" data-testid="login-password" />
          </div>
          <p-button label="Se connecter" (onClick)="onLogin()" [loading]="loading" styleClass="w-full" data-testid="login-submit" />
        </div>
        <div class="text-center mt-6">
          <a routerLink="/production/login" class="text-sm text-purple-400 hover:underline" data-testid="goto-production">Acceder a Production</a>
        </div>
      </div>
    </div>
  `,
})
export class LoginComponent {
  private auth = inject(AuthService);
  private router = inject(Router);
  theme = inject(ThemeService);
  email = '';
  password = '';
  loading = false;
  error = '';

  onLogin() {
    this.loading = true;
    this.error = '';
    this.auth.login(this.email, this.password).subscribe({
      next: () => { this.router.navigate(['/management/interventions']); },
      error: (err: any) => { this.error = err.error?.message || 'Identifiants invalides'; this.loading = false; },
    });
  }
}
