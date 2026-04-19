import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { AuthService } from '../../core/services/auth.service';
import { ThemeService } from '../../core/services/theme.service';

@Component({
  selector: 'app-production-interventions',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, DialogModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="min-h-screen bg-surface-900 p-4 page-enter" data-testid="production-interventions">
      <!-- Header -->
      <div class="flex items-center justify-between mb-4">
        <div>
          <h1 class="text-xl font-bold text-white">Interventions</h1>
          <p class="text-sm text-surface-400">{{ auth.user?.first_name }} {{ auth.user?.last_name }}</p>
        </div>
        <div class="flex items-center gap-2">
          <button (click)="theme.toggle()" class="theme-toggle" data-testid="production-theme-toggle" [title]="theme.isDark ? 'Mode clair' : 'Mode sombre'">
            <i [class]="theme.isDark ? 'pi pi-sun' : 'pi pi-moon'"></i>
          </button>
          <button (click)="auth.logout()" class="touch-btn" style="background: var(--cdmi-bg-card); color: var(--cdmi-text-secondary); border: 1px solid var(--cdmi-border); min-width: 3rem; min-height: 3rem;" data-testid="production-logout">
            <i class="pi pi-sign-out"></i>
          </button>
        </div>
      </div>

      <!-- Date + MRN + Salle -->
      <div class="flex items-center gap-3 mb-4 flex-wrap">
        <div class="flex items-center rounded-xl shrink-0 h-12 overflow-hidden" style="background: var(--cdmi-bg-card); border: 1px solid var(--cdmi-border);">
          <button (click)="shiftDate(-1)" class="date-nav-btn px-3 h-full" style="color: var(--cdmi-text-muted);" data-testid="date-prev"><i class="pi pi-chevron-left"></i></button>
          <button (click)="goToday()" class="date-today-btn text-sm font-semibold px-3 h-full whitespace-nowrap" style="color: var(--cdmi-accent-blue);" data-testid="date-today">{{ dateLabel }}</button>
          <button (click)="shiftDate(1)" class="date-nav-btn px-3 h-full" style="color: var(--cdmi-text-muted);" data-testid="date-next"><i class="pi pi-chevron-right"></i></button>
        </div>
        <span class="shrink-0 w-40">
          <input pInputText [(ngModel)]="mrnSearch" placeholder="MRN..." class="w-full h-12" maxlength="10" data-testid="mrn-search" />
        </span>
        @for (s of distinctSalles; track s) {
          <button (click)="salleFilter = salleFilter === s ? null : s"
            class="touch-btn shrink-0 px-3 flex-col"
            [style.background]="salleFilter === s ? 'var(--cdmi-accent-purple)' : 'rgba(147, 51, 234, 0.15)'"
            [style.color]="salleFilter === s ? 'white' : 'var(--cdmi-accent-purple)'"
            [style.border]="salleFilter === s ? '1px solid var(--cdmi-accent-purple)' : '1px solid rgba(147, 51, 234, 0.3)'"
            [attr.data-testid]="'salle-filter-' + s">
            <span class="text-8 font-bold uppercase">SALLE</span>
            <span class="text-base font-bold leading-tight">{{ s }}</span>
          </button>
        }
      </div>

      <!-- Action buttons -->
      <div class="grid grid-cols-3 gap-3 mb-6 stagger-children">
        <button (click)="router.navigate(['/production/restock'])" class="touch-btn" style="background: var(--cdmi-accent-emerald); color: white; min-height: 4rem;" data-testid="btn-restock">
          Mise en stock
        </button>
        <button (click)="router.navigate(['/production/picking-libre'])" class="touch-btn" style="background: var(--cdmi-accent-blue); color: white; min-height: 4rem;" data-testid="btn-picking-libre">
          Picking
        </button>
        <button (click)="showCreate = true" class="touch-btn" style="background: var(--cdmi-accent-purple); color: white; min-height: 4rem;" data-testid="btn-new-intervention">
          Intervention
        </button>
      </div>

      <!-- List -->
      @if (loading) {
        <div class="text-center py-12" style="color: var(--cdmi-text-muted);">Chargement...</div>
      } @else if (filtered.length === 0) {
        <div class="text-center py-12" style="color: var(--cdmi-text-muted);">
          <i class="pi pi-calendar text-4xl mb-3 block"></i>Aucune intervention
        </div>
      } @else {
        <div class="stagger-children">
          @for (intv of filtered; track intv.id) {
            <div class="intv-card" (click)="router.navigate(['/production/picking', intv.id])" [attr.data-testid]="'intv-card-' + intv.id" style="padding: 0.5rem 0.75rem;">
              <div class="w-14 h-14 rounded-xl flex flex-col items-center justify-center shrink-0" style="background: rgba(147, 51, 234, 0.12); border: 1px solid rgba(147, 51, 234, 0.25);">
                <span class="text-9 font-bold uppercase" style="color: var(--cdmi-accent-purple);">SALLE</span>
                <span class="text-lg font-bold" style="color: #c084fc;">{{ intv.operating_room || '—' }}</span>
              </div>
              <div class="flex-1 min-w-0">
                <div class="flex items-center gap-4">
                  <span class="text-white font-semibold">{{ intv.patient_file_number ? 'MRN: ' + intv.patient_file_number : 'Intervention planifi\u00e9e' }}</span>
                  @if (intv.birth_date) { <span class="text-surface-400 text-xs">Date de naissance: {{ intv.birth_date }}</span> }
                </div>
                @if (intv.products?.length) { <p class="text-surface-500 text-xs">{{ intv.products.length }} produit(s) requis</p> }
              </div>
              <i class="pi pi-chevron-right" style="color: var(--cdmi-text-muted);"></i>
            </div>
          }
        </div>
      }
    </div>

    <!-- Create dialog -->
    <p-dialog header="Nouvelle intervention" [(visible)]="showCreate" [modal]="true" [style]="{width: '450px'}">
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm mb-1 text-surface-400">Date *</label><input pInputText type="date" [(ngModel)]="form.planned_date" class="w-full" data-testid="create-date" /></div>
          <div><label class="block text-sm mb-1 text-surface-400">Salle</label><input pInputText [(ngModel)]="form.operating_room" placeholder="Ex: 05" maxlength="2" class="w-full" data-testid="create-salle" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm mb-1 text-surface-400">MRN</label><input pInputText [(ngModel)]="form.patient_file_number" class="w-full" data-testid="create-mrn" /></div>
          <div><label class="block text-sm mb-1 text-surface-400">Date naissance</label><input pInputText type="date" [(ngModel)]="form.birth_date" class="w-full" data-testid="create-birth" /></div>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" (onClick)="showCreate = false" data-testid="create-cancel" />
        <p-button label="Creer" (onClick)="create()" data-testid="create-submit" />
      </ng-template>
    </p-dialog>
  `,
})
export class ProductionInterventionsComponent implements OnInit {
  data: any[] = []; loading = true; selectedDate = ''; mrnSearch = ''; salleFilter: string | null = null;
  showCreate = false; form: any = {};

  constructor(public api: ApiService, public auth: AuthService, public router: Router, private msg: MessageService, public theme: ThemeService) {}

  ngOnInit() { this.selectedDate = new Date().toISOString().slice(0, 10); this.load(); }

  get dateLabel() {
    const today = new Date().toISOString().slice(0, 10);
    return this.selectedDate === today ? "Aujourd'hui" : this.selectedDate;
  }
  get distinctSalles() { return [...new Set(this.data.map(i => i.operating_room).filter(Boolean))].sort(); }
  get filtered() {
    return this.data
      .filter(i => !this.mrnSearch || (i.patient_file_number || '').toLowerCase().includes(this.mrnSearch.toLowerCase()))
      .filter(i => !this.salleFilter || i.operating_room === this.salleFilter)
      .sort((a, b) => (a.operating_room || '').localeCompare(b.operating_room || ''));
  }

  shiftDate(days: number) {
    const d = new Date(this.selectedDate + 'T12:00:00');
    d.setDate(d.getDate() + days);
    this.selectedDate = d.toISOString().slice(0, 10);
    this.load();
  }
  goToday() { this.selectedDate = new Date().toISOString().slice(0, 10); this.load(); }

  load() {
    this.loading = true;
    this.api.get<any[]>(`/interventions?date=${this.selectedDate}`).subscribe({
      next: (d) => { this.data = d; this.loading = false; },
      error: () => this.loading = false,
    });
  }

  create() {
    this.api.post<any>('/interventions', {
      planned_datetime: this.form.planned_date + 'T12:00:00',
      operating_room: this.form.operating_room || null,
      patient_file_number: this.form.patient_file_number || null,
      birth_date: this.form.birth_date || null,
    }).subscribe({
      next: (result) => {
        this.showCreate = false; this.form = {}; this.load();
        this.msg.add({ severity: 'success', summary: 'Intervention cr\u00e9\u00e9e' });
        if (result?.id) {
          this.router.navigate(['/production/picking', result.id]);
        }
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }
}
