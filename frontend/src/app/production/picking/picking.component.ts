import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { DialogModule } from 'primeng/dialog';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-picking',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, TagModule, ToastModule, InputTextModule, DialogModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="min-h-screen p-4 page-enter" style="background: var(--cdmi-bg-main);" data-testid="picking-page">
      <!-- Header -->
      <div class="flex items-center gap-3 mb-4">
        <button (click)="router.navigate(['/production/interventions'])" class="touch-btn" style="background: var(--cdmi-bg-card); color: var(--cdmi-text-secondary); border: 1px solid var(--cdmi-border); min-width: 3rem; min-height: 3rem;" data-testid="picking-back">
          <i class="pi pi-arrow-left"></i>
        </button>
        @if (intervention) {
          <div class="flex-1 grid grid-cols-4 gap-3 cursor-pointer" (click)="openEditHeader()" title="Modifier l'intervention">
            <div><span class="text-10 uppercase font-bold" style="color: var(--cdmi-text-muted);">Date</span><p class="text-sm font-semibold" style="color: var(--cdmi-text-primary);">{{ intervention.planned_datetime | date:'yyyy-MM-dd':'UTC' }}</p></div>
            <div><span class="text-10 uppercase font-bold" style="color: var(--cdmi-text-muted);">MRN</span><p class="text-sm font-semibold" style="color: var(--cdmi-text-primary);">{{ intervention.patient_file_number || '\u2014' }}</p></div>
            <div><span class="text-10 uppercase font-bold" style="color: var(--cdmi-text-muted);">Naissance</span><p class="text-sm font-semibold" style="color: var(--cdmi-text-primary);">{{ intervention.birth_date || '\u2014' }}</p></div>
            <div><span class="text-10 uppercase font-bold" style="color: var(--cdmi-text-muted);">Salle</span><p class="text-sm font-semibold" style="color: var(--cdmi-text-primary);">{{ intervention.operating_room || '\u2014' }}</p></div>
          </div>
          <button (click)="openEditHeader()" class="touch-btn shrink-0" style="background: var(--cdmi-bg-card); color: var(--cdmi-text-secondary); border: 1px solid var(--cdmi-border); min-width: 3rem; min-height: 3rem;" data-testid="pick-edit-header">
            <i class="pi pi-pencil"></i>
          </button>
        }
      </div>

      <!-- Ajouter un produit — Arborescence -->
      <div class="rounded-xl p-4 mb-4" style="background: var(--cdmi-bg-card); border: 1px solid var(--cdmi-border);">
        <div class="flex items-center justify-between mb-3">
          <h2 class="text-sm font-bold" style="color: var(--cdmi-text-primary);">Ajouter un produit</h2>
          @if (catId) {
            <button (click)="resetBrowser()" class="text-xs cursor-pointer flex items-center gap-1" style="background: none; border: none; color: var(--cdmi-text-muted);" data-testid="pick-reset"><i class="pi pi-refresh" style="font-size: 0.6rem;"></i> R\u00e9initialiser</button>
          }
        </div>
        <div class="grid grid-cols-3 gap-0 rounded-lg overflow-hidden mb-3" style="border: 1px solid var(--cdmi-border);">
          <div style="border-right: 1px solid var(--cdmi-border);">
            <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Cat\u00e9gorie *</span></div>
            <div class="overflow-y-auto" style="max-height: 10rem;">
              @for (cat of categories; track cat.id) {
                <div (click)="selectCat(cat.id)" class="px-4 py-2 text-sm cursor-pointer transition-colors" [style.background]="catId === cat.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="catId === cat.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="catId === cat.id ? '600' : '400'" [attr.data-testid]="'pick-cat-' + cat.id">{{ cat.description }}</div>
              }
            </div>
          </div>
          <div style="border-right: 1px solid var(--cdmi-border);">
            <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Mod\u00e8le <span class="normal-case font-normal">(optionnel)</span></span></div>
            <div class="overflow-y-auto" style="max-height: 10rem;">
              @for (tp of typesFiltered; track tp.id) {
                <div (click)="selectType(tp.id)" class="px-4 py-2 text-sm cursor-pointer transition-colors" [style.background]="typeId === tp.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="typeId === tp.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="typeId === tp.id ? '600' : '400'" [attr.data-testid]="'pick-type-' + tp.id">{{ tp.description }}</div>
              }
              @if (catId && !typesFiltered.length) { <p class="px-4 py-2 text-xs" style="color: var(--cdmi-text-muted);">Aucun</p> }
              @if (!catId) { <p class="px-4 py-2 text-xs" style="color: var(--cdmi-text-muted);">Choisir une cat\u00e9gorie</p> }
            </div>
          </div>
          <div>
            <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Variante <span class="normal-case font-normal">(optionnel)</span></span></div>
            <div class="overflow-y-auto" style="max-height: 10rem;">
              @for (sp of specsFiltered; track sp.id) {
                <div (click)="selectSpec(sp.id)" class="px-4 py-2 text-sm cursor-pointer transition-colors" [style.background]="specId === sp.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="specId === sp.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="specId === sp.id ? '600' : '400'" [attr.data-testid]="'pick-spec-' + sp.id">{{ sp.description }}</div>
              }
              @if (typeId && !specsFiltered.length) { <p class="px-4 py-2 text-xs" style="color: var(--cdmi-text-muted);">Aucune</p> }
              @if (!typeId) { <p class="px-4 py-2 text-xs" style="color: var(--cdmi-text-muted);">Choisir un mod\u00e8le</p> }
            </div>
          </div>
        </div>
        @if (catId) {
          <button (click)="addProduct()" class="w-full px-3 py-2 rounded-lg text-sm font-semibold cursor-pointer flex items-center justify-center gap-2 transition-colors" style="background: rgba(16, 185, 129, 0.12); border: 1px solid rgba(16, 185, 129, 0.35); color: var(--cdmi-accent-emerald);" data-testid="pick-add-product">
            <i class="pi pi-plus" style="font-size: 0.75rem;"></i> Ajouter : {{ selectedFilterLabel }}
          </button>
        }
      </div>

      <!-- Produits requis + FIFO suggestions -->
      <div class="stagger-children">
        @for (s of suggestions; track s.intervention_product.id) {
          @if (s.instances.length > 0; as hasInstances) {
            @let currentInst = s.instances[instanceIndex(s.intervention_product.id) % s.instances.length];
            <div class="flex items-center rounded-xl mb-2 overflow-hidden" style="background: var(--cdmi-bg-card); border: 1px solid var(--cdmi-border);" [attr.data-testid]="'suggestion-' + s.intervention_product.id">
              <button (click)="removeProduct(s.intervention_product)" class="shrink-0 flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-accent-red); width: 2.5rem; align-self: stretch;" [attr.data-testid]="'remove-ip-' + s.intervention_product.id" title="Retirer"><i class="pi pi-times" style="font-size: 0.75rem;"></i></button>
              <div class="flex items-center gap-4 flex-1 py-3">
                <span class="font-bold" style="color: var(--cdmi-text-primary);">{{ s.product_description || s.label }}</span>
                <span class="text-sm font-semibold" [style.color]="expirationColor(currentInst.expiration_date)">{{ currentInst.expiration_date ? (currentInst.expiration_date | date:'yyyy-MM-dd':'UTC') : '\u2014' }}</span>
                <span class="text-sm" style="color: var(--cdmi-accent-blue);">{{ currentInst.location_display || '\u2014' }}</span>
                <span class="text-xs" style="color: var(--cdmi-text-muted);">{{ s.remaining }}/{{ s.intervention_product.required_quantity }}</span>
                @if (s.instances.length > 1) {
                  <span class="text-xs px-2 py-0.5 rounded-full" style="background: var(--cdmi-bg-elevated); color: var(--cdmi-text-muted);" [title]="'Emplacement ' + ((instanceIndex(s.intervention_product.id) % s.instances.length) + 1) + ' / ' + s.instances.length">{{ (instanceIndex(s.intervention_product.id) % s.instances.length) + 1 }}/{{ s.instances.length }}</span>
                }
              </div>
              <button (click)="openEditProduct(s)" class="shrink-0 flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-text-muted); width: 2.5rem; align-self: stretch;" title="Modifier la s\u00e9lection"><i class="pi pi-pencil" style="font-size: 0.75rem;"></i></button>
              @if (s.instances.length > 1) {
                <button (click)="cycleInstance(s.intervention_product.id, s.instances.length)" class="shrink-0 flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-accent-blue); width: 2.75rem; align-self: stretch;" title="Emplacement suivant (FIFO)" [attr.data-testid]="'cycle-instance-' + s.intervention_product.id"><i class="pi pi-refresh" style="font-size: 0.95rem;"></i></button>
              }
              <button (click)="pick(currentInst)" class="shrink-0 flex items-center gap-2 px-6 cursor-pointer" style="background: var(--cdmi-accent-emerald); color: white; border: none; align-self: stretch; font-weight: 600; font-size: 0.9rem; min-height: 3.5rem;" [attr.data-testid]="'pick-btn-' + currentInst.id"><i class="pi pi-check"></i> Pr\u00e9lever</button>
            </div>
          } @else {
            <div class="flex items-center rounded-xl mb-2 overflow-hidden" style="background: var(--cdmi-bg-card); border: 1px solid var(--cdmi-border);">
              <button (click)="removeProduct(s.intervention_product)" class="shrink-0 flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-accent-red); width: 2.5rem; align-self: stretch;" [attr.data-testid]="'remove-ip-' + s.intervention_product.id" title="Retirer"><i class="pi pi-times" style="font-size: 0.75rem;"></i></button>
              <span class="font-bold flex-1 py-3" style="color: var(--cdmi-text-primary);">
                {{ s.product_description || s.label }}
                @if (missingPartsLabel(s.intervention_product); as miss) {
                  <span class="text-sm font-normal" style="color: var(--cdmi-accent-amber);"> &mdash; {{ miss }}</span>
                }
              </span>
              <button (click)="openEditProduct(s)" class="shrink-0 flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-accent-blue); width: 2.5rem; align-self: stretch;" title="Compl\u00e9ter la s\u00e9lection"><i class="pi pi-pencil" style="font-size: 0.75rem;"></i></button>
              <span class="text-sm px-4" style="color: var(--cdmi-text-muted);">Aucune instance disponible</span>
            </div>
          }
        }
      </div>
      @if (suggestions.length === 0 && intervention) {
        <div class="text-center py-8" style="color: var(--cdmi-text-muted);">Aucun produit requis — utilisez l'arborescence ci-dessus pour ajouter des produits</div>
      }
    </div>

    <!-- Edit Header Dialog -->
    <p-dialog header="Modifier l'intervention" [(visible)]="showEditHeader" [modal]="true" [style]="{width: '450px'}">
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Date *</label><input pInputText type="date" [(ngModel)]="headerForm.planned_date" class="w-full" data-testid="edit-header-date" /></div>
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Salle</label><input pInputText [(ngModel)]="headerForm.operating_room" placeholder="Ex: 05" maxlength="2" class="w-full" data-testid="edit-header-salle" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">MRN</label><input pInputText [(ngModel)]="headerForm.patient_file_number" class="w-full" data-testid="edit-header-mrn" /></div>
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Date naissance</label><input pInputText type="date" [(ngModel)]="headerForm.birth_date" class="w-full" data-testid="edit-header-birth" /></div>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" (onClick)="showEditHeader = false" />
        <p-button label="Enregistrer" (onClick)="saveHeader()" data-testid="edit-header-submit" />
      </ng-template>
    </p-dialog>

    <!-- Edit Product Selection Dialog -->
    <p-dialog header="Modifier la s\u00e9lection" [(visible)]="showEditProduct" [modal]="true" [style]="{width: '750px'}">
      @if (editingIp) {
        <p class="text-sm mb-3" style="color: var(--cdmi-text-muted);">S\u00e9lection actuelle : <strong style="color: var(--cdmi-text-primary);">{{ editingIpLabel }}</strong></p>
        <div class="grid grid-cols-3 gap-0 rounded-lg overflow-hidden mb-3" style="border: 1px solid var(--cdmi-border);">
          <div style="border-right: 1px solid var(--cdmi-border);">
            <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Cat\u00e9gorie *</span></div>
            <div class="overflow-y-auto" style="max-height: 12rem;">
              @for (cat of categories; track cat.id) {
                <div (click)="editCatId = editCatId === cat.id ? null : cat.id; editTypeId = null; editSpecId = null" class="px-4 py-2 text-sm cursor-pointer transition-colors" [style.background]="editCatId === cat.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="editCatId === cat.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="editCatId === cat.id ? '600' : '400'">{{ cat.description }}</div>
              }
            </div>
          </div>
          <div style="border-right: 1px solid var(--cdmi-border);">
            <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Mod\u00e8le <span class="normal-case font-normal">(optionnel)</span></span></div>
            <div class="overflow-y-auto" style="max-height: 12rem;">
              @for (tp of editTypesFiltered; track tp.id) {
                <div (click)="editTypeId = editTypeId === tp.id ? null : tp.id; editSpecId = null" class="px-4 py-2 text-sm cursor-pointer transition-colors" [style.background]="editTypeId === tp.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="editTypeId === tp.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="editTypeId === tp.id ? '600' : '400'">{{ tp.description }}</div>
              }
              @if (!editCatId) { <p class="px-4 py-2 text-xs" style="color: var(--cdmi-text-muted);">Choisir une cat\u00e9gorie</p> }
            </div>
          </div>
          <div>
            <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Variante <span class="normal-case font-normal">(optionnel)</span></span></div>
            <div class="overflow-y-auto" style="max-height: 12rem;">
              @for (sp of editSpecsFiltered; track sp.id) {
                <div (click)="editSpecId = editSpecId === sp.id ? null : sp.id" class="px-4 py-2 text-sm cursor-pointer transition-colors" [style.background]="editSpecId === sp.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="editSpecId === sp.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="editSpecId === sp.id ? '600' : '400'">{{ sp.description }}</div>
              }
              @if (!editTypeId) { <p class="px-4 py-2 text-xs" style="color: var(--cdmi-text-muted);">Choisir un mod\u00e8le</p> }
            </div>
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" (onClick)="showEditProduct = false" />
        <p-button label="Enregistrer" (onClick)="saveEditProduct()" [disabled]="!editCatId" data-testid="edit-product-submit" />
      </ng-template>
    </p-dialog>
  `,
})
export class PickingComponent implements OnInit {
  intervention: any = null;
  suggestions: any[] = [];
  interventionId: string | null = null;

  // Arborescence
  allProducts: any[] = [];
  categories: any[] = [];
  types: any[] = [];
  specs: any[] = [];
  catId: string | null = null;
  typeId: string | null = null;
  specId: string | null = null;
  showEditHeader = false;
  headerForm: any = {};
  showEditProduct = false;
  editingIp: any = null;
  editingIpLabel = '';
  editCatId: string | null = null;
  editTypeId: string | null = null;
  editSpecId: string | null = null;

  /** Per-suggestion index into `s.instances` — allows cycling through FIFO alternates. */
  private cycleIndexes = new Map<string, number>();
  instanceIndex(ipId: string): number { return this.cycleIndexes.get(ipId) || 0; }
  cycleInstance(ipId: string, total: number) {
    const current = this.cycleIndexes.get(ipId) || 0;
    this.cycleIndexes.set(ipId, (current + 1) % total);
  }

  /** Libelle contextuel pour une ligne partiellement specifiee (sans product_id). */
  missingPartsLabel(ip: any): string | null {
    if (!ip || ip.product_id) return null;
    if (ip.category_id && ip.type_id && !ip.variant_id) return 'Variante \u00e0 pr\u00e9ciser';
    if (ip.category_id && !ip.type_id) return 'Mod\u00e8le et variante \u00e0 pr\u00e9ciser';
    return null;
  }

  constructor(private api: ApiService, private route: ActivatedRoute, public router: Router, private msg: MessageService) {}

  ngOnInit() {
    this.interventionId = this.route.snapshot.paramMap.get('interventionId');
    if (this.interventionId) {
      this.api.get<any>(`/interventions/${this.interventionId}`).subscribe(d => this.intervention = d);
      this.loadSuggestions();
    }
    this.loadProductTree();
    this.loadExpirationSettings();
  }

  loadSuggestions() {
    if (!this.interventionId) return;
    this.api.get<any[]>(`/interventions/${this.interventionId}/fifo-suggestions`).subscribe(d => {
      // Filter out expired instances — they can't be used by clinicians.
      this.suggestions = (d || []).map(s => ({
        ...s,
        instances: (s.instances || []).filter((i: any) => !this.isExpired(i.expiration_date)),
      }));
    });
  }

  private expirationThresholds = { warning: 28, critical: 7 };
  loadExpirationSettings() {
    this.api.get<{ expiration_warning_days: number; expiration_critical_days: number }>('/settings/expiration').subscribe(s => {
      if (s) { this.expirationThresholds = { warning: s.expiration_warning_days, critical: s.expiration_critical_days }; }
    });
  }

  /** Retourne 'ok' | 'warning' | 'critical' | 'expired' en comparant des dates calendaires (pas des timestamps). */
  expirationStatus(date: string | null | undefined): 'ok' | 'warning' | 'critical' | 'expired' | 'none' {
    if (!date) return 'none';
    const expStr = String(date).slice(0, 10); // YYYY-MM-DD du payload serveur (midi UTC)
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

  loadProductTree() {
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
    const ids = new Set(this.allProducts.filter(p => p.category?.id === this.catId).map(p => p.type?.id).filter(Boolean));
    return this.types.filter(t => ids.has(t.id));
  }

  get specsFiltered() {
    if (!this.typeId) return [];
    const ids = new Set(this.allProducts.filter(p => p.type?.id === this.typeId).map(p => p.variant?.id).filter(Boolean));
    return this.specs.filter(s => ids.has(s.id));
  }

  get selectedFilterLabel(): string {
    const parts: string[] = [];
    if (this.catId) { const c = this.categories.find(x => x.id === this.catId); if (c) parts.push(c.description); }
    if (this.typeId) { const t = this.types.find(x => x.id === this.typeId); if (t) parts.push(t.description); }
    if (this.specId) { const s = this.specs.find(x => x.id === this.specId); if (s) parts.push(s.description); }
    return parts.join(' / ');
  }

  selectCat(id: string) { this.catId = this.catId === id ? null : id; this.typeId = null; this.specId = null; }
  selectType(id: string) { this.typeId = this.typeId === id ? null : id; this.specId = null; }
  selectSpec(id: string) { this.specId = this.specId === id ? null : id; }
  resetBrowser() { this.catId = null; this.typeId = null; this.specId = null; }

  addProduct() {
    if (!this.interventionId || !this.catId) return;
    this.api.post(`/interventions/${this.interventionId}/products`, {
      category_id: this.catId, type_id: this.typeId || null, variant_id: this.specId || null, required_quantity: 1,
    }).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Produit ajout\u00e9' });
        this.loadSuggestions();
        this.api.get<any>(`/interventions/${this.interventionId}`).subscribe(d => this.intervention = d);
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }

  pick(instance: any) {
    this.api.post(`/interventions/${this.interventionId}/pick`, { instance_id: instance.id }).subscribe({
      next: (res: any) => {
        if (res.mismatch) { this.msg.add({ severity: 'warn', summary: res.message }); return; }
        this.msg.add({ severity: 'success', summary: 'Pr\u00e9lev\u00e9' });
        this.loadSuggestions();
      },
      error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
    });
  }

  isExpiringSoon(date: string | null): boolean {
    // Kept for compat but superseded by expirationStatus(). Considered "soon" if within warning days.
    return this.expirationStatus(date) !== 'ok' && this.expirationStatus(date) !== 'none';
  }

  removeProduct(ip: any) {
    if (!this.interventionId) return;
    this.api.delete(`/interventions/${this.interventionId}/products/${ip.id}`).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: 'Produit retir\u00e9' });
        this.loadSuggestions();
        this.api.get<any>(`/interventions/${this.interventionId}`).subscribe(d => this.intervention = d);
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }

  openEditHeader() {
    if (!this.intervention) return;
    const d = this.intervention.planned_datetime ? new Date(this.intervention.planned_datetime) : null;
    const dateStr = d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` : '';
    this.headerForm = {
      planned_date: dateStr,
      operating_room: this.intervention.operating_room || '',
      patient_file_number: this.intervention.patient_file_number || '',
      birth_date: this.intervention.birth_date || '',
    };
    this.showEditHeader = true;
  }

  saveHeader() {
    if (!this.interventionId) return;
    this.api.put(`/interventions/${this.interventionId}`, {
      planned_datetime: this.headerForm.planned_date + 'T12:00:00',
      operating_room: this.headerForm.operating_room || null,
      patient_file_number: this.headerForm.patient_file_number || null,
      birth_date: this.headerForm.birth_date || null,
    }).subscribe({
      next: () => {
        this.showEditHeader = false;
        this.api.get<any>(`/interventions/${this.interventionId}`).subscribe(d => this.intervention = d);
        this.msg.add({ severity: 'success', summary: 'Intervention modifi\u00e9e' });
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }

  // Edit product selection
  get editTypesFiltered() {
    if (!this.editCatId) return [];
    const ids = new Set(this.allProducts.filter(p => p.category?.id === this.editCatId).map(p => p.type?.id).filter(Boolean));
    return this.types.filter(t => ids.has(t.id));
  }
  get editSpecsFiltered() {
    if (!this.editTypeId) return [];
    const ids = new Set(this.allProducts.filter(p => p.type?.id === this.editTypeId).map(p => p.variant?.id).filter(Boolean));
    return this.specs.filter(s => ids.has(s.id));
  }

  openEditProduct(s: any) {
    this.editingIp = s.intervention_product;
    this.editingIpLabel = s.label;
    this.editCatId = s.intervention_product.category_id || null;
    this.editTypeId = s.intervention_product.type_id || null;
    this.editSpecId = s.intervention_product.variant_id || null;
    this.showEditProduct = true;
  }

  saveEditProduct() {
    if (!this.interventionId || !this.editingIp) return;
    this.api.put(`/interventions/${this.interventionId}/products/${this.editingIp.id}`, {
      category_id: this.editCatId, type_id: this.editTypeId || null, variant_id: this.editSpecId || null,
    }).subscribe({
      next: () => {
        this.showEditProduct = false;
        this.loadSuggestions();
        this.msg.add({ severity: 'success', summary: 'S\u00e9lection modifi\u00e9e' });
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }
}
