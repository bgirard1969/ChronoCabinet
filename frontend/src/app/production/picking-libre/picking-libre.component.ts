import { Component, OnInit, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { parseGs1 } from '../../core/utils/gs1-parser';

@Component({
  selector: 'app-picking-libre',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, ToastModule, TagModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="min-h-screen p-4 page-enter" style="background: var(--cdmi-bg-main);" data-testid="picking-libre-page">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-4">
        <button (click)="router.navigate(['/production/interventions'])" class="touch-btn" style="background: var(--cdmi-bg-card); color: var(--cdmi-text-secondary); border: 1px solid var(--cdmi-border); min-width: 3rem; min-height: 3rem;" data-testid="picking-libre-back">
          <i class="pi pi-arrow-left"></i>
        </button>
        <h1 class="text-xl font-bold" style="color: var(--cdmi-text-primary);">Picking Libre</h1>
      </div>

      <!-- Scanner -->
      <div class="flex gap-2 mb-4">
        <input #scanInput pInputText [(ngModel)]="scanSN" placeholder="Scanner N\u00b0 s\u00e9rie ou lot..." class="flex-1 h-12" (input)="onScanInput($event)" (keydown.enter)="forceParseAndScan($event)" data-testid="pl-scan-input" />
        @if (scanType === 'lot' && scanSN) {
          <span class="self-center px-3 py-1 rounded text-xs font-bold" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);">LOT</span>
        }
        <button (click)="scan()" class="touch-btn" style="background: var(--cdmi-accent-blue); color: white; padding: 0 1.5rem; min-height: 3rem;" data-testid="pl-scan-btn">OK</button>
      </div>

      <!-- Arborescence pleine largeur -->
      <div class="rounded-xl p-4 mb-4" style="background: var(--cdmi-bg-card); border: 1px solid var(--cdmi-border);">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-bold" style="color: var(--cdmi-text-primary);">S\u00e9lectionner un produit</h2>
          @if (catId) {
            <button (click)="resetBrowser()" class="text-xs cursor-pointer flex items-center gap-1" style="background: none; border: none; color: var(--cdmi-text-muted);" data-testid="pl-reset">
              <i class="pi pi-refresh" style="font-size: 0.6rem;"></i> R\u00e9initialiser
            </button>
          }
        </div>
        <div class="grid grid-cols-3 gap-0 rounded-lg overflow-hidden" style="border: 1px solid var(--cdmi-border);">
          <!-- Cat\u00e9gorie -->
          <div style="border-right: 1px solid var(--cdmi-border);">
            <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Cat\u00e9gorie *</span></div>
            <div class="overflow-y-auto" style="max-height: 14rem;">
              @for (cat of categories; track cat.id) {
                <div (click)="selectCat(cat.id)" class="px-4 py-2.5 text-sm cursor-pointer transition-colors" [style.background]="catId === cat.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="catId === cat.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="catId === cat.id ? '600' : '400'" [attr.data-testid]="'pl-cat-' + cat.id">{{ cat.description }}</div>
              }
            </div>
          </div>
          <!-- Mod\u00e8le -->
          <div style="border-right: 1px solid var(--cdmi-border);">
            <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Mod\u00e8le <span class="normal-case font-normal">(optionnel)</span></span></div>
            <div class="overflow-y-auto" style="max-height: 14rem;">
              @for (tp of typesFiltered; track tp.id) {
                <div (click)="selectType(tp.id)" class="px-4 py-2.5 text-sm cursor-pointer transition-colors" [style.background]="typeId === tp.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="typeId === tp.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="typeId === tp.id ? '600' : '400'" [attr.data-testid]="'pl-type-' + tp.id">{{ tp.description }}</div>
              }
              @if (catId && !typesFiltered.length) { <p class="px-4 py-2.5 text-xs" style="color: var(--cdmi-text-muted);">Aucun</p> }
              @if (!catId) { <p class="px-4 py-2.5 text-xs" style="color: var(--cdmi-text-muted);">Choisir une cat\u00e9gorie</p> }
            </div>
          </div>
          <!-- Variante -->
          <div>
            <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Variante <span class="normal-case font-normal">(optionnel)</span></span></div>
            <div class="overflow-y-auto" style="max-height: 14rem;">
              @for (sp of specsFiltered; track sp.id) {
                <div (click)="selectSpec(sp.id)" class="px-4 py-2.5 text-sm cursor-pointer transition-colors" [style.background]="specId === sp.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="specId === sp.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="specId === sp.id ? '600' : '400'" [attr.data-testid]="'pl-spec-' + sp.id">{{ sp.description }}</div>
              }
              @if (typeId && !specsFiltered.length) { <p class="px-4 py-2.5 text-xs" style="color: var(--cdmi-text-muted);">Aucune</p> }
              @if (!typeId) { <p class="px-4 py-2.5 text-xs" style="color: var(--cdmi-text-muted);">Choisir un mod\u00e8le</p> }
            </div>
          </div>
        </div>
      </div>

      <!-- Produit sugg\u00e9r\u00e9 (FIFO) — une seule ligne -->
      @if (catId && loading) {
        <div class="flex items-center justify-center py-4" style="color: var(--cdmi-text-muted);"><i class="pi pi-spin pi-spinner text-xl mr-2"></i><span class="text-sm">Recherche...</span></div>
      }
      @if (catId && !loading && !suggestion) {
        <div class="rounded-xl px-4 py-3 text-center text-sm" style="background: var(--cdmi-bg-card); border: 1px solid var(--cdmi-border); color: var(--cdmi-text-muted);">Aucune instance disponible pour cette s\u00e9lection</div>
      }
      @if (suggestion) {
        <div class="rounded-xl px-4 py-3 flex items-center gap-4 card-enter" style="background: var(--cdmi-bg-card); border: 1px solid var(--cdmi-border);">
          <div class="flex-1 font-medium" style="color: var(--cdmi-text-primary);">{{ suggestion.product_description }}</div>
          <div class="text-sm shrink-0" [style.color]="expirationColor(suggestion.expiration_date)">
            {{ suggestion.expiration_date ? (suggestion.expiration_date | date:'yyyy-MM-dd':'UTC') : '\u2014' }}
          </div>
          <div class="text-sm shrink-0" style="color: var(--cdmi-text-secondary);">{{ suggestion.location || '\u2014' }}</div>
          <span class="text-xs shrink-0" style="color: var(--cdmi-text-muted);">{{ currentIndex + 1 }}/{{ totalAvailable }}</span>
          @if (totalAvailable > 1) {
            <button (click)="nextSuggestion()" class="touch-btn shrink-0" style="background: var(--cdmi-bg-elevated); color: var(--cdmi-text-secondary); border: 1px solid var(--cdmi-border); min-height: 2.5rem; min-width: 2.5rem; border-radius: 0.5rem;" data-testid="pl-next-suggestion" title="Autre choix">
              <i class="pi pi-refresh"></i>
            </button>
          }
          <button (click)="pickSuggestion()" class="touch-btn shrink-0" style="background: var(--cdmi-accent-emerald); color: white; min-height: 2.5rem; padding: 0 1.25rem; border-radius: 0.5rem; font-weight: 600;" data-testid="pl-pick-suggestion">
            <i class="pi pi-check mr-1"></i> Pr\u00e9lever
          </button>
        </div>
      }
    </div>
  `,
})
export class PickingLibreComponent implements OnInit, AfterViewInit {
  @ViewChild('scanInput') scanInput!: ElementRef;
  scanSN = '';

  // Arborescence
  allProducts: any[] = [];
  categories: any[] = [];
  types: any[] = [];
  specs: any[] = [];
  catId: string | null = null;
  typeId: string | null = null;
  specId: string | null = null;

  // FIFO suggestion
  suggestion: any = null;
  totalAvailable = 0;
  currentIndex = 0;
  loading = false;

  constructor(private api: ApiService, public router: Router, private msg: MessageService) {}

  ngOnInit() { this.loadProducts(); }
  ngAfterViewInit() { setTimeout(() => this.scanInput?.nativeElement?.focus(), 100); }

  loadProducts() {
    this.api.get<any[]>('/products').subscribe(products => {
      this.allProducts = products;
      const catMap = new Map(); const typeMap = new Map(); const specMap = new Map();
      for (const p of products) {
        if (p.category) catMap.set(p.category.id, p.category);
        if (p.type) typeMap.set(p.type.id, p.type);
        if (p.variant) specMap.set(p.variant.id, p.variant);
      }
      this.categories = [...catMap.values()].sort((a, b) => a.description.localeCompare(b.description));
      this.types = [...typeMap.values()].sort((a, b) => a.description.localeCompare(b.description));
      this.specs = [...specMap.values()].sort((a, b) => a.description.localeCompare(b.description));
    });
  }

  get typesFiltered() {
    if (!this.catId) return [];
    const typeIds = new Set(this.allProducts.filter(p => p.category?.id === this.catId).map(p => p.type?.id).filter(Boolean));
    return this.types.filter(t => typeIds.has(t.id));
  }

  get specsFiltered() {
    if (!this.typeId) return [];
    const specIds = new Set(this.allProducts.filter(p => p.type?.id === this.typeId).map(p => p.variant?.id).filter(Boolean));
    return this.specs.filter(s => specIds.has(s.id));
  }

  selectCat(id: string) {
    this.catId = this.catId === id ? null : id;
    this.typeId = null;
    this.specId = null;
    this.currentIndex = 0;
    this.loadFifo();
  }

  selectType(id: string) {
    this.typeId = this.typeId === id ? null : id;
    this.specId = null;
    this.currentIndex = 0;
    this.loadFifo();
  }

  selectSpec(id: string) {
    this.specId = this.specId === id ? null : id;
    this.currentIndex = 0;
    this.loadFifo();
  }

  resetBrowser() {
    this.catId = null; this.typeId = null; this.specId = null;
    this.suggestion = null; this.totalAvailable = 0; this.currentIndex = 0;
  }

  loadFifo() {
    if (!this.catId) { this.suggestion = null; return; }
    this.loading = true;
    let q = `/instances/fifo-suggestion?category_id=${this.catId}&skip=${this.currentIndex}`;
    if (this.typeId) q += `&type_id=${this.typeId}`;
    if (this.specId) q += `&variant_id=${this.specId}`;
    this.api.get<any>(q).subscribe({
      next: (res) => {
        this.suggestion = res.suggestion;
        this.totalAvailable = res.total_available;
        this.currentIndex = res.current_index ?? this.currentIndex;
        this.loading = false;
      },
      error: () => { this.loading = false; },
    });
  }

  nextSuggestion() {
    this.currentIndex = (this.currentIndex + 1) % this.totalAvailable;
    this.loadFifo();
  }

  pickSuggestion() {
    if (!this.suggestion) return;
    this.api.post('/instances/pick-libre', { instance_id: this.suggestion.id }).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Pr\u00e9lev\u00e9' });
        this.currentIndex = 0;
        this.loadFifo();
      },
      error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
    });
  }

  scan() {
    // Always try to parse the current value before sending (handles clicks on OK button before debounce fires)
    if (this.scanParseTimer) { clearTimeout(this.scanParseTimer); this.scanParseTimer = null; }
    if (this.scanSN) this.applyScanParse(this.scanSN);
    if (!this.scanSN) return;
    const payload: any = this.scanType === 'lot'
      ? { lot_number: this.scanSN }
      : { serial_number: this.scanSN };
    this.api.post<any>('/instances/scan', payload).subscribe({
      next: (res) => {
        if (res.action === 'unknown') { this.msg.add({ severity: 'warn', summary: 'N\u00b0 s\u00e9rie ou lot inconnu' }); return; }
        if (res.instance) {
          this.api.post('/instances/pick-libre', { instance_id: res.instance.id }).subscribe({
            next: () => { this.msg.add({ severity: 'success', summary: 'Pr\u00e9lev\u00e9' }); this.scanSN = ''; this.scanType = 'serial'; this.loadFifo(); },
            error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
          });
        }
      },
    });
  }

  // Debounced GS1 parsing for scanner inputs: keep only serial (AI 21) or lot (AI 10)
  private scanParseTimer: any = null;
  scanType: 'serial' | 'lot' = 'serial';
  onScanInput(ev: any) {
    const val: string = ev?.target?.value || '';
    if (this.scanParseTimer) clearTimeout(this.scanParseTimer);
    this.scanParseTimer = setTimeout(() => this.applyScanParse(val), 120);
  }

  forceParseAndScan(ev: any) {
    if (this.scanParseTimer) clearTimeout(this.scanParseTimer);
    this.applyScanParse(ev?.target?.value || '');
    if (this.scanSN) this.scan();
  }

  private applyScanParse(val: string) {
    if (!val) return;
    if (val.length <= 20 && /^[\w-]+$/.test(val)) {
      this.scanType = 'serial';
      return;
    }
    const parsed = parseGs1(val);
    if (parsed.serial_number) {
      this.scanSN = parsed.serial_number;
      this.scanType = 'serial';
    } else if (parsed.lot_number) {
      this.scanSN = parsed.lot_number;
      this.scanType = 'lot';
    }
    if (this.scanInput?.nativeElement) {
      this.scanInput.nativeElement.value = this.scanSN;
    }
  }

  private expirationThresholds = { warning: 28, critical: 7 };
  loadExpirationSettings() {
    this.api.get<{ expiration_warning_days: number; expiration_critical_days: number }>('/settings/expiration').subscribe(s => {
      if (s) this.expirationThresholds = { warning: s.expiration_warning_days, critical: s.expiration_critical_days };
    });
  }
  expirationStatus(date: string | null | undefined): 'ok' | 'warning' | 'critical' | 'expired' | 'none' {
    if (!date) return 'none';
    const expStr = String(date).slice(0, 10);
    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
    if (expStr < todayStr) return 'expired';
    const expMs = new Date(expStr + 'T12:00:00Z').getTime();
    const todayMs = new Date(todayStr + 'T12:00:00Z').getTime();
    const diffDays = Math.round((expMs - todayMs) / 86400000);
    if (diffDays <= this.expirationThresholds.critical) return 'critical';
    if (diffDays <= this.expirationThresholds.warning) return 'warning';
    return 'ok';
  }
  isExpired(date: string | null | undefined): boolean { return this.expirationStatus(date) === 'expired'; }
  expirationColor(date: string | null | undefined): string {
    const s = this.expirationStatus(date);
    if (s === 'expired') return 'var(--cdmi-accent-red)';
    if (s === 'critical') return 'var(--cdmi-accent-amber)';
    if (s === 'warning') return 'var(--cdmi-accent-amber)';
    if (s === 'ok') return 'var(--cdmi-accent-emerald)';
    return 'var(--cdmi-text-secondary)';
  }

  isExpiringSoon(date: string | null): boolean {
    const s = this.expirationStatus(date);
    return s !== 'ok' && s !== 'none';
  }
}
