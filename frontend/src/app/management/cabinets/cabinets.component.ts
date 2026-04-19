import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { ToastModule } from 'primeng/toast';
import { TagModule } from 'primeng/tag';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { SelectModule } from 'primeng/select';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-cabinets',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, InputTextModule, InputNumberModule, ToastModule, TagModule, ConfirmDialogModule, SelectModule],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />
    <div class="p-6 page-enter" data-testid="management-cabinets">
      <div class="page-header">
        <h1>Cabinets</h1>
        <div class="flex gap-2">
          <p-button label="Export Excel" icon="pi pi-file-excel" severity="success" [outlined]="true" (onClick)="exportCabinets()" data-testid="btn-export-cabinets" />
          <p-button label="Param\u00e8tres" icon="pi pi-cog" severity="secondary" [outlined]="true" (onClick)="openSettings()" data-testid="btn-cabinet-settings" />
          <p-button label="Nouveau cabinet" icon="pi pi-plus" (onClick)="openCreate()" data-testid="btn-new-cabinet" />
        </div>
      </div>

      <!-- Legend -->
      <div class="cabinet-legend" data-testid="cabinet-legend">
        <span class="legend-title">L\u00e9gende :</span>
        <span class="legend-item" style="background: rgba(16, 185, 129, 0.08); border-color: rgba(16, 185, 129, 0.3); color: var(--cdmi-accent-emerald);">
          <i class="pi pi-check-circle"></i> OK (\u2265 {{ settings.expiration_warning_days }}j)
        </span>
        <span class="legend-item" style="background: rgba(245, 158, 11, 0.08); border-color: rgba(245, 158, 11, 0.3); color: var(--cdmi-accent-amber);">
          <i class="pi pi-exclamation-triangle"></i> Critique (\u2264 {{ settings.expiration_warning_days }}j)
        </span>
        <span class="legend-item" style="background: rgba(239, 68, 68, 0.08); border-color: rgba(239, 68, 68, 0.3); color: var(--cdmi-accent-red);">
          <i class="pi pi-times-circle"></i> Expir\u00e9
        </span>
        <span class="legend-item" style="background: rgba(168, 85, 247, 0.08); border-color: rgba(168, 85, 247, 0.3); color: #a855f7;">
          <i class="pi pi-star"></i> Cmd sp\u00e9ciale
        </span>
        <span class="legend-item" style="background: var(--cdmi-bg-elevated); border-color: var(--cdmi-border); color: var(--cdmi-text-muted);">
          <i class="pi pi-minus"></i> Vide
        </span>
      </div>

      <!-- Accordion list of cabinets -->
      <div class="cabinet-list" data-testid="cabinet-list">
        @for (cab of cabinets; track cab.id) {
          <div class="cabinet-row" [attr.data-testid]="'cabinet-row-' + cab.id">
            <!-- Summary line (clickable) -->
            <div class="cabinet-summary" (click)="toggleExpand(cab.id)">
              <div class="flex items-center gap-3">
                <i class="pi" [class.pi-chevron-right]="!isExpanded(cab.id)" [class.pi-chevron-down]="isExpanded(cab.id)" style="width: 1rem; color: var(--cdmi-text-muted);"></i>
                <h3 class="cabinet-name">{{ cab.description }}</h3>
              </div>
              <div class="flex items-center gap-4">
                <span class="cabinet-count"><strong>{{ cab.occupied_locations }}</strong> / {{ cab.total_locations }} occup\u00e9(s)</span>
                @if (cabinetAlerts(cab).warning > 0) {
                  <span class="alert-badge warning" title="Expirations critiques">
                    <i class="pi pi-exclamation-triangle"></i> {{ cabinetAlerts(cab).warning }}
                  </span>
                }
                @if (cabinetAlerts(cab).critical > 0) {
                  <span class="alert-badge critical" title="Produits expir\u00e9s">
                    <i class="pi pi-times-circle"></i> {{ cabinetAlerts(cab).critical }}
                  </span>
                }
                <div class="flex gap-1" (click)="$event.stopPropagation()">
                  <button (click)="openEdit(cab)" class="cabinet-action-btn" title="Modifier" [attr.data-testid]="'edit-cabinet-' + cab.id"><i class="pi pi-pencil"></i></button>
                  <button (click)="confirmDelete(cab)" class="cabinet-action-btn danger" title="Supprimer" [attr.data-testid]="'delete-cabinet-' + cab.id"><i class="pi pi-trash"></i></button>
                </div>
              </div>
            </div>

            <!-- Expanded grid with row/col axis labels -->
            @if (isExpanded(cab.id)) {
              <div class="cabinet-grid-wrapper">
                <div class="cabinet-grid-axes" [style.grid-template-columns]="'2.5rem repeat(' + cab.columns + ', 1fr)'">
                  <!-- Top-left empty corner -->
                  <span></span>
                  <!-- Column headers (A, B, C...) -->
                  @for (c of colNumbers(cab.columns); track c) {
                    <span class="axis-label">{{ colLabel(c) }}</span>
                  }
                  <!-- Rows -->
                  @for (r of rowNumbers(cab.rows); track r) {
                    <!-- Row label (1, 2, 3...) -->
                    <span class="axis-label">{{ r }}</span>
                    <!-- Cells in this row -->
                    @for (loc of locationsForRow(cab, r); track loc.id) {
                      <div class="cabinet-cell-detail" [style.background]="loc.is_special_order_reserved ? 'rgba(168, 85, 247, 0.08)' : cellBg(loc)" [style.border-color]="loc.is_special_order_reserved ? 'rgba(168, 85, 247, 0.3)' : cellBorder(loc)" (click)="openLocationEdit(loc)" [attr.data-testid]="'loc-' + loc.id">
                        <i class="pi cell-icon" [class]="cellIconClass(loc)" [style.color]="loc.is_special_order_reserved ? '#a855f7' : cellTextColor(loc)"></i>
                        <span class="cell-designated">{{ loc.is_special_order_reserved ? 'Cmd sp\u00e9ciale' : (loc.designated_product ? (loc.designated_product.description | slice:0:28) : '') }}</span>
                      </div>
                    }
                  }
                </div>
              </div>
            }
          </div>
        }
        @if (!cabinets.length) {
          <div class="text-center py-12" style="color: var(--cdmi-text-muted);">
            <i class="pi pi-inbox text-4xl mb-3" style="display: block;"></i>
            <p>Aucun cabinet</p>
          </div>
        }
      </div>
    </div>

    <!-- Settings dialog -->
    <p-dialog header="Param\u00e8tres des dates d'expiration" [(visible)]="showSettings" [modal]="true" [style]="{width: '460px'}">
      <div class="flex flex-col gap-3">
        <div>
          <label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Seuil critique (jours)</label>
          <p-inputNumber [(ngModel)]="settingsForm.expiration_critical_days" [min]="1" [max]="365" [showButtons]="true" class="w-full" data-testid="settings-critical" />
          <p class="text-xs mt-1" style="color: var(--cdmi-text-muted);">Sous ce seuil : badge critique accentué (pastille orange foncée).</p>
        </div>
        <div>
          <label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Seuil d'avertissement (jours)</label>
          <p-inputNumber [(ngModel)]="settingsForm.expiration_warning_days" [min]="2" [max]="365" [showButtons]="true" class="w-full" data-testid="settings-warning" />
          <p class="text-xs mt-1" style="color: var(--cdmi-text-muted);">\u00c0 ce seuil ou moins : cellule ambre (critique). Les produits expir\u00e9s (date \u00e9coul\u00e9e) passent en rouge.</p>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" (onClick)="showSettings = false" />
        <p-button label="Enregistrer" (onClick)="saveSettings()" data-testid="settings-save" />
      </ng-template>
    </p-dialog>

    <!-- Create / Edit dialog -->
    <p-dialog [header]="editingId ? 'Modifier cabinet' : 'Nouveau cabinet'" [(visible)]="showForm" [modal]="true" [style]="{width: '600px'}">
      <div class="flex flex-col gap-3">
        <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Description *</label><input pInputText [(ngModel)]="form.description" class="w-full" data-testid="cabinet-desc" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Lignes *</label><p-inputNumber [(ngModel)]="form.rows" [min]="1" class="w-full" data-testid="cabinet-rows" /></div>
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Colonnes *</label><p-inputNumber [(ngModel)]="form.columns" [min]="1" class="w-full" data-testid="cabinet-cols" /></div>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" (onClick)="showForm = false" />
        <p-button [label]="editingId ? 'Enregistrer' : 'Cr\u00e9er'" (onClick)="save()" data-testid="cabinet-submit" />
      </ng-template>
    </p-dialog>

    <!-- Location Edit Dialog -->
    <p-dialog [header]="'Emplacement ' + colLabel(editLoc?.column || 1) + (editLoc?.row || '')" [(visible)]="showLocEdit" [modal]="true" [style]="{width: '720px', 'max-width': '95vw'}" [contentStyle]="{'overflow': 'visible'}" styleClass="loc-edit-dialog">
      @if (editLoc) {
        <div class="flex flex-col gap-4">
          <!-- Current instance info -->
          <div class="rounded-lg p-3" style="background: var(--cdmi-bg-elevated); border: 1px solid var(--cdmi-border);">
            <p class="text-xs uppercase font-bold mb-1" style="color: var(--cdmi-text-muted);">Instance actuelle</p>
            @if (editLoc.serial_number || editLoc.lot_number) {
              <p class="text-sm" style="color: var(--cdmi-text-primary);">{{ editLoc.product_description }}</p>
              <p class="text-xs mt-1" style="color: var(--cdmi-text-secondary);">
                SN: <span class="font-mono">{{ editLoc.serial_number || '\u2014' }}</span>
                &nbsp;&middot;&nbsp; Lot: <span class="font-mono">{{ editLoc.lot_number || '\u2014' }}</span>
              </p>
              <p class="text-xs mt-1" style="color: var(--cdmi-text-secondary);">
                Expiration : <span class="font-mono" [style.color]="cellTextColor(editLoc)">{{ editLoc.expiration_date ? (editLoc.expiration_date | date:'yyyy-MM-dd') : '\u2014' }}</span>
              </p>
            } @else {
              <p class="text-sm" style="color: var(--cdmi-text-muted);">Vide</p>
            }
          </div>
          <!-- Designated product (hidden if special order reserved) -->
          @if (!editLoc.is_special_order_reserved) {
          <div>
            <label class="block text-sm mb-1 font-semibold" style="color: var(--cdmi-text-secondary);">Produit autoris\u00e9 pour cette position</label>
            <div class="grid gap-2" style="grid-template-columns: 1fr 1fr 1fr;">
              <p-select [(ngModel)]="locCategoryId" [options]="locCategoryOptions" optionLabel="label" optionValue="value" placeholder="Cat\u00e9gorie" class="w-full" appendTo="body" (onChange)="onLocCategoryChange()" [filter]="true" filterBy="label" data-testid="loc-cat" />
              <p-select [(ngModel)]="locTypeId" [options]="locTypeOptions" optionLabel="label" optionValue="value" placeholder="Mod\u00e8le" class="w-full" appendTo="body" (onChange)="onLocTypeChange()" [disabled]="!locCategoryId" [filter]="true" filterBy="label" data-testid="loc-type" />
              <p-select [(ngModel)]="editLocProductId" [options]="locProductOptions" optionLabel="label" optionValue="value" placeholder="Variante" class="w-full" appendTo="body" [disabled]="!locTypeId || locTypeHasNoVariant" [filter]="true" filterBy="label" data-testid="loc-designated-product" />
            </div>
            @if (selectedLocProductLabel()) {
              <div class="rounded-md px-4 py-2 mt-2 flex items-center gap-2" style="background: var(--cdmi-bg-elevated); border: 1px solid var(--cdmi-border);">
                <span class="text-sm font-medium flex-1" style="color: var(--cdmi-text-primary);">{{ selectedLocProductLabel() }}</span>
                <button (click)="clearLocProduct()" class="loc-clear-btn" title="Retirer l'assignation" data-testid="loc-clear"><i class="pi pi-times"></i></button>
              </div>
            }
          </div>
          } @else {
            <div class="rounded-lg p-3 text-center" style="background: rgba(168, 85, 247, 0.08); border: 1px solid rgba(168, 85, 247, 0.25);">
              <p class="text-sm font-semibold" style="color: var(--cdmi-accent-purple);">R\u00e9serv\u00e9 pour commande sp\u00e9ciale</p>
              <p class="text-xs" style="color: var(--cdmi-text-muted);">Accepte tout produit en commande sp\u00e9ciale</p>
            </div>
          }
        </div>
      }
      <ng-template pTemplate="footer">
        <div class="flex items-center w-full gap-2">
          <p-button label="Commande sp\u00e9ciale" icon="pi pi-star" [outlined]="!editLoc?.is_special_order_reserved" [severity]="editLoc?.is_special_order_reserved ? 'help' : 'help'" (onClick)="toggleSpecialOrder()" data-testid="toggle-special-order" />
          <div class="flex-1"></div>
          <p-button label="Annuler" severity="secondary" (onClick)="showLocEdit = false" />
          <p-button label="Enregistrer" (onClick)="saveLocation()" data-testid="loc-save" />
        </div>
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .cabinet-legend {
      display: flex;
      flex-wrap: wrap;
      gap: 0.5rem;
      align-items: center;
      padding: 0.75rem 1rem;
      margin-bottom: 1.25rem;
      border-radius: 0.5rem;
      background: var(--cdmi-bg-card);
      border: 1px solid var(--cdmi-border);
    }
    .legend-title {
      font-size: 0.7rem;
      text-transform: uppercase;
      font-weight: 700;
      color: var(--cdmi-text-muted);
      letter-spacing: 0.05em;
      margin-right: 0.5rem;
    }
    .legend-item {
      display: inline-flex;
      align-items: center;
      gap: 0.35rem;
      font-size: 0.75rem;
      font-weight: 600;
      padding: 0.25rem 0.6rem;
      border-radius: 0.375rem;
      border: 1px solid;
    }
    .cabinet-list {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
    }
    .cabinet-row {
      border-radius: 0.75rem;
      border: 1px solid var(--cdmi-border);
      background: var(--cdmi-bg-card);
      overflow: hidden;
      transition: border-color 0.2s;
    }
    .cabinet-row:hover { border-color: var(--cdmi-accent-blue); }
    .cabinet-summary {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.25rem;
      cursor: pointer;
    }
    .cabinet-name {
      font-size: 1rem;
      font-weight: 700;
      color: var(--cdmi-text-primary);
      margin: 0;
    }
    .cabinet-count {
      font-size: 0.85rem;
      color: var(--cdmi-text-secondary);
    }
    .alert-badge {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 0.2rem 0.55rem;
      border-radius: 999px;
      border: 1px solid;
    }
    .alert-badge.warning {
      background: rgba(245, 158, 11, 0.1);
      border-color: rgba(245, 158, 11, 0.3);
      color: var(--cdmi-accent-amber);
    }
    .alert-badge.critical {
      background: rgba(239, 68, 68, 0.1);
      border-color: rgba(239, 68, 68, 0.3);
      color: var(--cdmi-accent-red);
    }
    .cabinet-grid-wrapper {
      padding: 1rem 1.25rem 1.25rem;
      border-top: 1px solid var(--cdmi-border);
      background: var(--cdmi-bg-base);
    }
    .cabinet-grid-axes {
      display: grid;
      gap: 0.375rem;
    }
    .axis-label {
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.75rem;
      font-weight: 700;
      color: var(--cdmi-text-muted);
      letter-spacing: 0.05em;
    }
    .loc-clear-btn {
      width: 1.75rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.375rem;
      border: 1px solid rgba(239, 68, 68, 0.3);
      background: rgba(239, 68, 68, 0.1);
      color: var(--cdmi-accent-red);
      cursor: pointer;
      transition: background-color 0.15s, color 0.15s;
      font-size: 0.8rem;
      flex-shrink: 0;
    }
    .loc-clear-btn:hover {
      background: var(--cdmi-accent-red);
      color: #fff;
    }
    .cabinet-action-btn {
      width: 1.75rem;
      height: 1.75rem;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 0.375rem;
      border: none;
      background: none;
      color: var(--cdmi-text-muted);
      cursor: pointer;
      transition: background 0.15s, color 0.15s;
      font-size: 0.75rem;
    }
    .cabinet-action-btn:hover {
      background: var(--cdmi-bg-elevated);
      color: var(--cdmi-accent-blue);
    }
    .cabinet-action-btn.danger:hover { color: var(--cdmi-accent-red); }
    .cabinet-cell-detail {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 0.15rem;
      padding: 0.5rem 0.3rem;
      border-radius: 0.5rem;
      border-width: 1px;
      border-style: solid;
      cursor: pointer;
      transition: filter 0.15s;
      min-height: 5rem;
      text-align: center;
    }
    .cabinet-cell-detail:hover { filter: brightness(1.1); }
    .cell-icon {
      font-size: 1rem;
      margin-bottom: 0.15rem;
    }
    .cell-serial {
      font-size: 0.8rem;
      font-family: monospace;
      font-weight: 600;
      color: var(--cdmi-text-primary);
    }
    .cell-designated {
      font-size: 0.7rem;
      color: var(--cdmi-text-muted);
      line-height: 1.2;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 100%;
    }
  `],
})
export class CabinetsComponent implements OnInit {
  cabinets: any[] = [];
  expandedIds = new Set<string>();
  showForm = false;
  editingId: string | null = null;
  form = { description: '', rows: 4, columns: 6 };
  showLocEdit = false;
  editLoc: any = null;
  editLocProductId: string | null = null;
  allProducts: any[] = [];
  // 3-step cascade for location product assignment
  locCategoryId: string | null = null;
  locTypeId: string | null = null;
  locCategoryOptions: { label: string; value: string }[] = [];
  locTypeOptions: { label: string; value: string }[] = [];
  locProductOptions: { label: string; value: string }[] = [];
  // Settings
  settings = { expiration_critical_days: 7, expiration_warning_days: 28 };
  settingsForm = { expiration_critical_days: 7, expiration_warning_days: 28 };
  showSettings = false;

  constructor(private api: ApiService, private msg: MessageService, private confirm: ConfirmationService) {}
  ngOnInit() {
    this.loadSettings();
    this.load();
    this.loadProducts();
  }

  // === Expand/collapse ===
  toggleExpand(id: string) {
    if (this.expandedIds.has(id)) this.expandedIds.delete(id);
    else {
      this.expandedIds.add(id);
      // Ensure locations are loaded for this cabinet
      const cab = this.cabinets.find(c => c.id === id);
      if (cab && !cab._locations) {
        this.api.get<any[]>(`/cabinets/${id}/locations`).subscribe(locs => cab._locations = locs);
      }
    }
  }
  isExpanded(id: string): boolean { return this.expandedIds.has(id); }

  // === Axis helpers ===
  rowNumbers(n: number): number[] { return Array.from({ length: n }, (_, i) => i + 1); }
  colNumbers(n: number): number[] { return Array.from({ length: n }, (_, i) => i + 1); }
  colLabel(c: number): string {
    let n = c;
    let s = '';
    while (n > 0) {
      const rem = (n - 1) % 26;
      s = String.fromCharCode(65 + rem) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s;
  }
  locationsForRow(cab: any, row: number): any[] {
    return (cab._locations || []).filter((l: any) => l.row === row).sort((a: any, b: any) => a.column - b.column);
  }

  // === Alerts summary per cabinet ===
  cabinetAlerts(cab: any): { warning: number; critical: number } {
    const locs = cab._locations || [];
    let warning = 0, critical = 0;
    for (const loc of locs) {
      const lvl = this.expirationLevel(loc);
      if (lvl === 'orange') warning++;
      if (lvl === 'red') critical++;
    }
    return { warning, critical };
  }

  // === Excel export ===
  exportCabinets() {
    this.api.getBlob('/cabinets/export').subscribe({
      next: (blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `cabinets_${new Date().toISOString().slice(0, 10)}.xlsx`;
        a.click();
        URL.revokeObjectURL(url);
        this.msg.add({ severity: 'success', summary: 'Export t\u00e9l\u00e9charg\u00e9' });
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur export' }),
    });
  }

  // === Settings ===
  loadSettings() {
    this.api.get<any>('/settings/expiration').subscribe(s => { this.settings = s; });
  }
  openSettings() {
    this.settingsForm = { ...this.settings };
    this.showSettings = true;
  }
  saveSettings() {
    this.api.put<any>('/settings/expiration', this.settingsForm).subscribe({
      next: (s) => {
        this.settings = s;
        this.showSettings = false;
        this.msg.add({ severity: 'success', summary: 'Param\u00e8tres enregistr\u00e9s' });
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }

  // Expiration color logic using configurable thresholds:
  //   green  = OK (>= warning threshold)
  //   amber  = Critique (<= critical threshold OR between critical and warning)
  //   red    = Expir\u00e9 (date < today)
  private expirationLevel(loc: any): 'green' | 'orange' | 'red' | 'grey' {
    if (loc.is_empty || !loc.expiration_date) return 'grey';
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const exp = new Date(loc.expiration_date); exp.setHours(0, 0, 0, 0);
    if (exp < today) return 'red'; // Expir\u00e9
    const days = (exp.getTime() - today.getTime()) / 86400000;
    if (days <= this.settings.expiration_warning_days) return 'orange'; // Critique
    return 'green';
  }

  cellBg(loc: any): string {
    const m: any = { green: 'rgba(16, 185, 129, 0.08)', orange: 'rgba(245, 158, 11, 0.08)', red: 'rgba(239, 68, 68, 0.08)', grey: 'var(--cdmi-bg-elevated)' };
    return m[this.expirationLevel(loc)];
  }
  cellBorder(loc: any): string {
    const m: any = { green: 'rgba(16, 185, 129, 0.3)', orange: 'rgba(245, 158, 11, 0.3)', red: 'rgba(239, 68, 68, 0.3)', grey: 'var(--cdmi-border)' };
    return m[this.expirationLevel(loc)];
  }
  cellTextColor(loc: any): string {
    const m: any = { green: 'var(--cdmi-accent-emerald)', orange: 'var(--cdmi-accent-amber)', red: 'var(--cdmi-accent-red)', grey: 'var(--cdmi-text-muted)' };
    return m[this.expirationLevel(loc)];
  }
  cellIconClass(loc: any): string {
    if (loc.is_special_order_reserved) return 'pi-star';
    const m: any = { green: 'pi-check-circle', orange: 'pi-hourglass', red: 'pi-exclamation-triangle', grey: 'pi-minus' };
    return m[this.expirationLevel(loc)];
  }

  loadProducts() {
    this.api.get<any[]>('/products').subscribe(products => {
      this.allProducts = products;
      // Build unique category options once
      const catMap = new Map<string, string>();
      for (const p of products) {
        if (p.category?.id) catMap.set(p.category.id, p.category.description);
      }
      this.locCategoryOptions = [...catMap.entries()]
        .map(([value, label]) => ({ value, label }))
        .sort((a, b) => a.label.localeCompare(b.label));
    });
  }

  /** Rebuild type + product options from a pre-selected productId (when opening an existing assignment). */
  private prefillLocCascade(productId: string | null) {
    this.locCategoryId = null;
    this.locTypeId = null;
    this.locTypeOptions = [];
    this.locProductOptions = [];
    if (!productId) return;
    const p = this.allProducts.find(x => x.id === productId);
    if (!p) return;
    this.locCategoryId = p.category?.id || null;
    this.onLocCategoryChange();
    this.locTypeId = p.type?.id || null;
    this.onLocTypeChange();
  }

  onLocCategoryChange() {
    this.locTypeId = null;
    this.editLocProductId = null;
    this.locProductOptions = [];
    const typeMap = new Map<string, string>();
    for (const p of this.allProducts) {
      if (p.category?.id === this.locCategoryId && p.type?.id) {
        typeMap.set(p.type.id, p.type.description);
      }
    }
    this.locTypeOptions = [...typeMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  onLocTypeChange() {
    this.editLocProductId = null;
    const matches = this.allProducts.filter(p => p.category?.id === this.locCategoryId && p.type?.id === this.locTypeId);
    // Only show products WITH a variant in the 3rd dropdown (otherwise the concept of "variant" is meaningless).
    this.locProductOptions = matches
      .filter(p => p.variant)
      .map(p => ({ value: p.id, label: p.variant.description }))
      .sort((a, b) => a.label.localeCompare(b.label));
    // If the only matching product has NO variant, auto-select it (no 3rd dropdown needed).
    const unvariantedProducts = matches.filter(p => !p.variant);
    if (matches.length === 1 && unvariantedProducts.length === 1) {
      this.editLocProductId = unvariantedProducts[0].id;
    }
  }

  /** Does the current category+type combination have any product without variant? (to disable the 3rd dropdown cleanly) */
  get locTypeHasNoVariant(): boolean {
    if (!this.locTypeId) return false;
    const matches = this.allProducts.filter(p => p.category?.id === this.locCategoryId && p.type?.id === this.locTypeId);
    return matches.length > 0 && matches.every(p => !p.variant);
  }

  selectedLocProductLabel(): string | null {
    if (!this.editLocProductId) return null;
    const p = this.allProducts.find(x => x.id === this.editLocProductId);
    return p ? p.description : null;
  }

  clearLocProduct() {
    this.editLocProductId = null;
    this.locCategoryId = null;
    this.locTypeId = null;
    this.locTypeOptions = [];
    this.locProductOptions = [];
  }

  load() {
    this.api.get<any[]>('/cabinets').subscribe(cabs => {
      this.cabinets = cabs;
      for (const cab of cabs) {
        this.api.get<any[]>(`/cabinets/${cab.id}/locations`).subscribe(locs => {
          cab._locations = locs;
        });
      }
    });
  }

  openCreate() {
    this.editingId = null;
    this.form = { description: '', rows: 4, columns: 6 };
    this.showForm = true;
  }

  openEdit(cab: any) {
    this.editingId = cab.id;
    this.form = { description: cab.description, rows: cab.rows, columns: cab.columns };
    this.showForm = true;
  }

  save() {
    if (this.editingId) {
      this.api.put(`/cabinets/${this.editingId}`, this.form).subscribe({
        next: () => {
          this.showForm = false;
          this.load();
          this.msg.add({ severity: 'success', summary: 'Cabinet modifi\u00e9' });
        },
        error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
      });
    } else {
      this.api.post('/cabinets', this.form).subscribe({
        next: () => { this.showForm = false; this.load(); this.msg.add({ severity: 'success', summary: 'Cabinet cr\u00e9\u00e9' }); },
        error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
      });
    }
  }

  confirmDelete(cab: any) {
    this.confirm.confirm({
      message: `Supprimer le cabinet "${cab.description}" ? ${cab.occupied_locations > 0 ? '(Attention: ' + cab.occupied_locations + ' emplacement(s) occup\u00e9(s))' : ''}`,
      header: 'Confirmation',
      icon: 'pi pi-exclamation-triangle',
      acceptLabel: 'Supprimer',
      rejectLabel: 'Annuler',
      accept: () => {
        this.api.delete(`/cabinets/${cab.id}`).subscribe({
          next: () => {
            this.expandedIds.delete(cab.id);
            this.load();
            this.msg.add({ severity: 'success', summary: 'Cabinet supprim\u00e9' });
          },
          error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Impossible de supprimer' }),
        });
      },
    });
  }

  openLocationEdit(loc: any) {
    this.editLoc = { ...loc };
    const pid = loc.designated_product?.id || loc.product_id || null;
    this.editLocProductId = pid;
    this.prefillLocCascade(pid);
    this.showLocEdit = true;
  }

  toggleSpecialOrder() {
    this.editLoc.is_special_order_reserved = !this.editLoc.is_special_order_reserved;
    if (this.editLoc.is_special_order_reserved) this.editLocProductId = null;
  }

  saveLocation() {
    if (!this.editLoc) return;
    // Find parent cabinet by location id
    const parent = this.cabinets.find(c => (c._locations || []).some((l: any) => l.id === this.editLoc.id));
    if (!parent) return;
    this.api.put(`/cabinets/${parent.id}/locations/${this.editLoc.id}`, {
      product_id: this.editLoc.is_special_order_reserved ? null : (this.editLocProductId || null),
      is_special_order_reserved: this.editLoc.is_special_order_reserved,
    }).subscribe({
      next: () => {
        this.showLocEdit = false;
        // Reload this cabinet's locations
        this.api.get<any[]>(`/cabinets/${parent.id}/locations`).subscribe(locs => parent._locations = locs);
        this.msg.add({ severity: 'success', summary: 'Produit autoris\u00e9 mis \u00e0 jour' });
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }
}
