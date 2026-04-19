import { Component, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

type SidebarMode = 'on' | 'autohide' | 'off';

@Component({
  selector: 'app-management-layout',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="flex h-screen" data-testid="management-layout">
      <!-- Sidebar -->
      <aside class="flex flex-col shrink-0" [class.w-56]="!collapsed()" [class.w-16]="collapsed()" style="background: var(--cdmi-sidebar-bg); transition: width 0.2s ease, background-color 0.3s ease;" (mouseenter)="onMouseEnter()" (mouseleave)="onMouseLeave()">
        <!-- Header -->
        <div class="p-4" style="border-bottom: 1px solid rgba(255,255,255,0.08);">
          @if (!collapsed()) {
            <h1 class="text-sm font-bold" style="color: #fff;">Chrono DMI</h1>
            <p class="text-xs" style="color: rgba(255,255,255,0.4);">Gestion</p>
          } @else {
            <div class="flex items-center justify-center" style="height: 2rem;">
              <i class="pi pi-box" style="color: rgba(255,255,255,0.8); font-size: 1.1rem;"></i>
            </div>
          }
        </div>

        <!-- Nav -->
        <nav class="flex-1 py-2 overflow-y-auto stagger-children">
          @for (item of navItems; track item.route) {
            <a [routerLink]="item.route" routerLinkActive="active" class="sidebar-nav-item" [class.collapsed]="collapsed()" [title]="collapsed() ? item.label : null" [attr.data-testid]="'nav-' + item.key">
              <i [class]="item.icon" style="font-size: 1rem; width: 1.25rem; text-align: center;"></i>
              @if (!collapsed()) { <span>{{ item.label }}</span> }
            </a>
          }
        </nav>

        <!-- Footer: user + logout + theme toggle + sidebar mode -->
        <div class="p-4" style="border-top: 1px solid rgba(255,255,255,0.08);">
          @if (!collapsed()) {
            <!-- Sidebar mode toggle (expanded) -->
            <div class="flex items-center justify-between mb-3">
              <span class="text-xs uppercase font-bold" style="color: rgba(255,255,255,0.4); letter-spacing: 0.05em;">Sidebar</span>
              <button (click)="cycleMode()" class="sidebar-mode-toggle" [title]="'Mode actuel : ' + modeLabel() + ' \u2014 cliquer pour changer'" data-testid="sidebar-mode-toggle">
                <i [class]="'pi ' + modeIcon()"></i>
                <span>{{ modeLabel() }}</span>
              </button>
            </div>

            <div class="flex items-center gap-2 mb-3">
              <div class="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold shrink-0" style="background: var(--cdmi-sidebar-active); color: var(--cdmi-accent-purple);">
                {{ (auth.user?.first_name || '')[0] }}{{ (auth.user?.last_name || '')[0] }}
              </div>
              <div class="flex-1 min-w-0">
                <p class="text-sm font-medium truncate" style="color: #fff;">{{ auth.user?.first_name }} {{ auth.user?.last_name }}</p>
                <p class="text-xs truncate" style="color: rgba(255,255,255,0.4);">{{ auth.user?.role }}</p>
              </div>
            </div>
          } @else {
            <!-- Sidebar mode toggle (collapsed) -->
            <div class="flex justify-center mb-3">
              <button (click)="cycleMode()" class="sidebar-mode-toggle-compact" [title]="'Mode actuel : ' + modeLabel() + ' \u2014 cliquer pour changer'" data-testid="sidebar-mode-toggle">
                <i [class]="'pi ' + modeIcon()"></i>
              </button>
            </div>
          }
          <div class="flex items-center" [class.justify-between]="!collapsed()" [class.justify-center]="collapsed()" [class.flex-col]="collapsed()" [class.gap-2]="collapsed()">
            <button (click)="auth.logout()" class="text-xs transition-colors cursor-pointer" style="background: none; border: none; color: rgba(255,255,255,0.4);" data-testid="logout-btn">
              <i class="pi pi-sign-out mr-1"></i>@if (!collapsed()) { D\u00e9connexion }
            </button>
            <button (click)="toggleTheme($event)" class="theme-toggle-sidebar" [title]="theme.isDark ? 'Mode clair' : 'Mode sombre'" data-testid="theme-toggle">
              <i [class]="theme.isDark ? 'pi pi-sun' : 'pi pi-moon'"></i>
            </button>
          </div>
        </div>
      </aside>
      <main class="flex-1 overflow-y-auto" style="background: var(--cdmi-bg-base); transition: background-color 0.3s ease;">
        <router-outlet />
      </main>
    </div>
  `,
  styles: [`
    .theme-toggle-sidebar {
      width: 2rem;
      height: 2rem;
      border-radius: 0.375rem;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.6);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s, border-color 0.15s;
      font-size: 0.85rem;
    }
    .theme-toggle-sidebar:hover {
      background: rgba(255,255,255,0.1);
      color: var(--cdmi-accent-amber);
      border-color: rgba(255,255,255,0.25);
    }
    .sidebar-mode-switch {
      display: grid;
      grid-template-columns: 1fr 1.4fr 1fr;
      background: rgba(255,255,255,0.06);
      border: 1px solid rgba(255,255,255,0.1);
      border-radius: 0.5rem;
      overflow: hidden;
    }
    .sidebar-mode-switch button {
      background: transparent;
      border: none;
      color: rgba(255,255,255,0.55);
      padding: 0.35rem 0.1rem;
      font-size: 0.7rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s;
    }
    .sidebar-mode-switch button:hover:not(.active) {
      background: rgba(255,255,255,0.05);
      color: #fff;
    }
    .sidebar-mode-switch button.active {
      background: var(--cdmi-accent-purple);
      color: #fff;
    }
    .sidebar-mode-toggle {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.3rem 0.65rem;
      border-radius: 0.375rem;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.7);
      font-size: 0.7rem;
      font-weight: 600;
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s, border-color 0.15s;
    }
    .sidebar-mode-toggle:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border-color: rgba(255,255,255,0.25);
    }
    .sidebar-mode-toggle-compact {
      width: 2rem;
      height: 2rem;
      border-radius: 0.375rem;
      border: 1px solid rgba(255,255,255,0.12);
      background: rgba(255,255,255,0.04);
      color: rgba(255,255,255,0.7);
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s, border-color 0.15s;
      font-size: 0.85rem;
    }
    .sidebar-mode-toggle-compact:hover {
      background: rgba(255,255,255,0.1);
      color: #fff;
      border-color: rgba(255,255,255,0.25);
    }
    :host ::ng-deep .sidebar-nav-item.collapsed {
      justify-content: center;
      padding-left: 0;
      padding-right: 0;
    }
  `],
})
export class ManagementLayoutComponent {
  navItems = [
    { route: '/management/interventions', label: 'Interventions', icon: 'pi pi-calendar', key: 'interventions' },
    { route: '/management/cabinets', label: 'Cabinets', icon: 'pi pi-server', key: 'cabinets' },
    { route: '/management/products', label: 'Produits', icon: 'pi pi-th-large', key: 'products' },
    { route: '/management/consumption', label: 'Consommation', icon: 'pi pi-check-square', key: 'consumption' },
    { route: '/management/orders', label: 'Commandes', icon: 'pi pi-shopping-cart', key: 'orders' },
    { route: '/management/employees', label: 'Employ\u00e9s', icon: 'pi pi-users', key: 'employees' },
    { route: '/management/movements', label: 'Mouvements', icon: 'pi pi-chart-line', key: 'movements' },
  ];

  mode = signal<SidebarMode>((localStorage.getItem('cdmi-sidebar-mode') as SidebarMode) || 'on');
  hovered = signal<boolean>(false);

  // In autohide mode, sidebar expands on hover. On = always expanded. Off = always collapsed.
  collapsed = computed<boolean>(() => {
    const m = this.mode();
    if (m === 'on') return false;
    if (m === 'off') return true;
    return !this.hovered();
  });

  constructor(public auth: AuthService, public theme: ThemeService) {}

  setMode(m: SidebarMode) {
    this.mode.set(m);
    localStorage.setItem('cdmi-sidebar-mode', m);
  }

  cycleMode() {
    const order: SidebarMode[] = ['on', 'autohide', 'off'];
    const next = order[(order.indexOf(this.mode()) + 1) % order.length];
    this.setMode(next);
  }

  modeIcon(): string {
    switch (this.mode()) {
      case 'on': return 'pi-window-maximize';
      case 'autohide': return 'pi-eye';
      case 'off': return 'pi-window-minimize';
    }
  }

  modeLabel(): string {
    switch (this.mode()) {
      case 'on': return 'On';
      case 'autohide': return 'Autohide';
      case 'off': return 'Off';
    }
  }

  onMouseEnter() {
    if (this.mode() === 'autohide') this.hovered.set(true);
  }
  onMouseLeave() {
    if (this.mode() === 'autohide') this.hovered.set(false);
  }

  toggleTheme(ev: Event) {
    ev.stopPropagation();
    ev.preventDefault();
    this.theme.toggle();
  }
}
