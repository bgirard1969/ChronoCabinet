import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { FileUploadModule } from 'primeng/fileupload';
import { TableModule } from 'primeng/table';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { InputTextModule } from 'primeng/inputtext';
import { CheckboxModule } from 'primeng/checkbox';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-consumption',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, DialogModule, FileUploadModule, TableModule, TagModule, ToastModule, InputTextModule, CheckboxModule, ConfirmDialogModule],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />
    <div class="p-6 page-enter" data-testid="management-consumption">
      <div class="page-header">
        <div>
          <h1>Consommation</h1>
          <p>Suivi des produits pr\u00e9lev\u00e9s et consomm\u00e9s</p>
        </div>
        <div class="flex gap-2">
          <p-button label="Importer CSV" icon="pi pi-upload" severity="secondary" (onClick)="showImport = true; preview = null; importing = false" data-testid="btn-import-consumption" />
          @if (selectedIds.size > 0) {
            <p-button [label]="'Envoyer \u00e0 GRM (' + selectedIds.size + ')'" icon="pi pi-send" severity="success" (onClick)="confirmSendToGrm()" data-testid="btn-send-grm" />
          }
        </div>
      </div>

      <!-- Status filter buttons -->
      <div class="flex gap-2 mb-4">
        @for (f of statusFilters; track f.value) {
          <p-button [label]="f.label" [severity]="statusFilter === f.value ? 'primary' : 'secondary'" [outlined]="statusFilter !== f.value" size="small" (onClick)="statusFilter = f.value; loadInstances()" [attr.data-testid]="'filter-' + f.value" />
        }
        <div class="flex-1"></div>
        <span>
          <input pInputText [(ngModel)]="search" placeholder="Rechercher..." class="w-48" data-testid="consumption-search" />
        </span>
      </div>

      <!-- Instances table -->
      <p-table [value]="filteredInstances" [paginator]="true" [rows]="25" [rowHover]="true" styleClass="p-datatable-sm" [sortField]="'usage_date'" [sortOrder]="-1" data-testid="consumption-table">
        <ng-template pTemplate="header">
          <tr>
            <th style="width: 3rem;" class="text-center">
              <input type="checkbox" [checked]="allSelected" (change)="toggleSelectAll()" data-testid="select-all" />
            </th>
            <th pSortableColumn="product_description">Produit</th>
            <th>Cat\u00e9gorie</th>
            <th>N\u00b0 GRM</th>
            <th pSortableColumn="serial_number">N\u00b0 S\u00e9rie</th>
            <th>N\u00b0 Lot</th>
            <th pSortableColumn="usage_date">Date utilisation</th>
            <th>Emplacement</th>
            <th pSortableColumn="status" class="text-center">Statut</th>
            <th class="text-center" style="width: 6rem;">Consomm\u00e9</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-inst>
          <tr>
            <td class="text-center">
              <input type="checkbox" [checked]="selectedIds.has(inst.id)" (change)="toggleSelect(inst.id)" [attr.data-testid]="'select-' + inst.id" />
            </td>
            <td class="font-medium">{{ inst.product_description || '\u2014' }}</td>
            <td><span class="text-xs" style="color: var(--cdmi-text-muted);">{{ inst.category || '\u2014' }}</span></td>
            <td class="font-mono text-xs">{{ inst.grm_number || '\u2014' }}</td>
            <td class="font-mono text-xs">{{ inst.serial_number || '\u2014' }}</td>
            <td class="font-mono text-xs">{{ inst.lot_number || '\u2014' }}</td>
            <td>{{ inst.usage_date ? (inst.usage_date | date:'yyyy-MM-dd HH:mm') : '\u2014' }}</td>
            <td class="text-xs">{{ inst.location || '\u2014' }}</td>
            <td class="text-center">
              <p-tag [value]="inst.status === 4 ? 'Pr\u00e9lev\u00e9' : 'Consomm\u00e9'" [severity]="inst.status === 4 ? 'warn' : 'success'" />
            </td>
            <td class="text-center">
              <button (click)="toggleStatus(inst)" class="toggle-btn" [class.active]="inst.status === 5" [attr.data-testid]="'toggle-' + inst.id" [title]="inst.status === 4 ? 'Marquer consomm\u00e9' : 'Remettre en pr\u00e9lev\u00e9'">
                <span class="toggle-track"><span class="toggle-thumb"></span></span>
              </button>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="10" class="text-center py-8" style="color: var(--cdmi-text-muted);">Aucune instance pr\u00e9lev\u00e9e ou consomm\u00e9e</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- GRM Result dialog -->
    <p-dialog header="Envoi GRM termin\u00e9" [(visible)]="showGrmResult" [modal]="true" [style]="{width: '550px'}">
      @if (grmResult) {
        <div class="card-enter">
          <div class="flex gap-3 mb-4">
            <div class="flex-1 p-3 rounded-xl text-center" style="background: rgba(16, 185, 129, 0.10); border: 1px solid rgba(16, 185, 129, 0.25);">
              <p class="text-2xl font-bold" style="color: var(--cdmi-accent-emerald);">{{ grmResult.processed }}</p>
              <p class="text-xs font-medium" style="color: var(--cdmi-accent-emerald);">Envoy\u00e9(s)</p>
            </div>
            <div class="flex-1 p-3 rounded-xl text-center" style="background: rgba(37, 99, 235, 0.10); border: 1px solid rgba(37, 99, 235, 0.25);">
              <p class="text-2xl font-bold" style="color: var(--cdmi-accent-blue);">{{ grmResult.orders_created?.length || 0 }}</p>
              <p class="text-xs font-medium" style="color: var(--cdmi-accent-blue);">Commande(s) brouillon</p>
            </div>
          </div>
          @if (grmResult.orders_created?.length) {
            <div class="mb-3">
              <p class="text-xs font-semibold mb-2" style="color: var(--cdmi-text-primary);">Commandes cr\u00e9\u00e9es par fournisseur :</p>
              <div class="rounded-lg overflow-hidden" style="border: 1px solid var(--cdmi-border);">
                @for (o of grmResult.orders_created; track o.order_id) {
                  <div class="flex items-center justify-between px-3 py-2 text-sm" style="border-bottom: 1px solid var(--cdmi-border);">
                    <span style="color: var(--cdmi-text-primary);">{{ o.supplier_name }}</span>
                    <p-tag [value]="o.item_count + ' produit(s)'" severity="info" />
                  </div>
                }
              </div>
            </div>
          }
          <p class="text-xs" style="color: var(--cdmi-text-muted);">Fichier GRM t\u00e9l\u00e9charg\u00e9 : {{ grmResult.filename }}</p>
        </div>
      }
      <ng-template pTemplate="footer">
        <p-button label="Fermer" severity="secondary" (onClick)="showGrmResult = false" />
      </ng-template>
    </p-dialog>

    <!-- Import CSV dialog -->
    <p-dialog header="Importer CSV — Consommation" [(visible)]="showImport" [modal]="true" [style]="{width: '700px'}" [maximizable]="true">
      <p-fileUpload mode="basic" chooseLabel="S\u00e9lectionner un fichier CSV" accept=".csv" [auto]="true" [customUpload]="true" (uploadHandler)="onUpload($event)" [disabled]="importing" data-testid="consumption-upload" />
      @if (importing) {
        <div class="flex items-center justify-center gap-2 mt-4 py-4" style="color: var(--cdmi-text-muted);"><i class="pi pi-spin pi-spinner text-xl"></i><span class="text-sm">Analyse en cours...</span></div>
      }
      @if (preview) {
        <div class="mt-4 card-enter" data-testid="consumption-preview">
          <div class="flex gap-3 mb-4">
            <div class="flex-1 p-3 rounded-xl text-center" style="background: rgba(16, 185, 129, 0.10); border: 1px solid rgba(16, 185, 129, 0.25);">
              <p class="text-2xl font-bold" style="color: var(--cdmi-accent-emerald);">{{ preview.matched?.length || 0 }}</p>
              <p class="text-xs font-medium" style="color: var(--cdmi-accent-emerald);">Correspondance(s)</p>
            </div>
            <div class="flex-1 p-3 rounded-xl text-center" style="background: rgba(239, 68, 68, 0.10); border: 1px solid rgba(239, 68, 68, 0.25);">
              <p class="text-2xl font-bold" style="color: var(--cdmi-accent-red);">{{ preview.unmatched?.length || 0 }}</p>
              <p class="text-xs font-medium" style="color: var(--cdmi-accent-red);">Non trouv\u00e9(s)</p>
            </div>
            <div class="flex-1 p-3 rounded-xl text-center" style="background: rgba(156, 163, 175, 0.10); border: 1px solid rgba(156, 163, 175, 0.25);">
              <p class="text-2xl font-bold" style="color: var(--cdmi-text-muted);">{{ preview.manual?.length || 0 }}</p>
              <p class="text-xs font-medium" style="color: var(--cdmi-text-muted);">Sans N\u00b0</p>
            </div>
          </div>
          @if (preview.matched?.length) {
            <div class="mb-3">
              <p class="text-xs font-semibold mb-2" style="color: var(--cdmi-accent-emerald);"><i class="pi pi-check-circle mr-1"></i>Produits trouv\u00e9s — seront marqu\u00e9s consomm\u00e9s</p>
              <div class="rounded-lg overflow-hidden overflow-y-auto" style="background: rgba(16, 185, 129, 0.03); border: 1px solid rgba(16, 185, 129, 0.15); max-height: 12rem;">
                <div class="grid px-3 py-1.5 text-xs font-bold" style="grid-template-columns: 7rem 7rem 1fr; border-bottom: 1px solid rgba(16, 185, 129, 0.12); color: var(--cdmi-text-muted);">
                  <span>N\u00b0 S\u00e9rie</span><span>N\u00b0 Lot</span><span>Produit</span>
                </div>
                @for (m of preview.matched; track m.instance_id) {
                  <div class="grid px-3 py-1.5 text-xs items-center" style="grid-template-columns: 7rem 7rem 1fr; border-bottom: 1px solid rgba(16, 185, 129, 0.06);">
                    <span class="font-mono" style="color: var(--cdmi-text-primary);">{{ m.serial_number || '\u2014' }}</span>
                    <span class="font-mono" style="color: var(--cdmi-text-primary);">{{ m.lot_number || '\u2014' }}</span>
                    <span style="color: var(--cdmi-text-secondary);">{{ m.product_description || m.description }}</span>
                  </div>
                }
              </div>
            </div>
          }
          @if (preview.unmatched?.length) {
            <div class="mb-3">
              <p class="text-xs font-semibold mb-1" style="color: var(--cdmi-accent-red);"><i class="pi pi-times-circle mr-1"></i>Aucune instance correspondante</p>
              <div class="rounded-lg overflow-y-auto" style="background: rgba(239, 68, 68, 0.03); border: 1px solid rgba(239, 68, 68, 0.15); max-height: 8rem;">
                @for (m of preview.unmatched; track $index) {
                  <div class="flex items-center gap-3 px-3 py-1.5 text-xs" style="border-bottom: 1px solid rgba(239, 68, 68, 0.06);">
                    <span class="font-mono" style="color: var(--cdmi-text-primary);">{{ m.serial_number || m.lot_number }}</span>
                    <span class="flex-1" style="color: var(--cdmi-text-secondary);">{{ m.description }}</span>
                  </div>
                }
              </div>
            </div>
          }
        </div>
      }
      <ng-template pTemplate="footer">
        @if (preview?.matched?.length) {
          <p-button [label]="'Confirmer ' + preview.matched.length + ' consommation(s)'" icon="pi pi-check" (onClick)="confirmImport()" data-testid="consumption-confirm" />
        }
        <p-button label="Fermer" severity="secondary" (onClick)="showImport = false; preview = null" />
      </ng-template>
    </p-dialog>
  `,
  styles: [`
    .toggle-btn {
      background: none; border: none; cursor: pointer; padding: 0; display: inline-flex; align-items: center;
    }
    .toggle-track {
      display: inline-block; width: 2.5rem; height: 1.35rem; border-radius: 0.75rem;
      background: var(--cdmi-bg-elevated); border: 1px solid var(--cdmi-border);
      position: relative; transition: background 0.2s, border-color 0.2s;
    }
    .toggle-thumb {
      display: block; width: 1rem; height: 1rem; border-radius: 50%;
      background: var(--cdmi-text-muted); position: absolute; top: 50%; left: 2px;
      transform: translateY(-50%); transition: left 0.2s, background 0.2s;
    }
    .toggle-btn.active .toggle-track { background: var(--cdmi-accent-emerald); border-color: var(--cdmi-accent-emerald); }
    .toggle-btn.active .toggle-thumb { left: calc(100% - 1rem - 2px); background: white; }
  `],
})
export class ConsumptionComponent implements OnInit {
  instances: any[] = [];
  preview: any = null;
  showImport = false;
  importing = false;
  search = '';
  statusFilter = 'all';
  selectedIds = new Set<string>();
  showGrmResult = false;
  grmResult: any = null;

  statusFilters = [
    { value: 'all', label: 'Tous' },
    { value: 'picked', label: 'Pr\u00e9lev\u00e9s' },
    { value: 'consumed', label: 'Consomm\u00e9s' },
  ];

  constructor(private api: ApiService, private msg: MessageService, private confirm: ConfirmationService) {}

  ngOnInit() { this.loadInstances(); }

  loadInstances() {
    this.api.get<any[]>(`/consumption/instances?status=${this.statusFilter}`).subscribe(d => {
      this.instances = d;
      this.selectedIds.clear();
    });
  }

  get filteredInstances() {
    if (!this.search) return this.instances;
    const s = this.search.toLowerCase();
    return this.instances.filter(i =>
      (i.product_description || '').toLowerCase().includes(s) ||
      (i.serial_number || '').toLowerCase().includes(s) ||
      (i.lot_number || '').toLowerCase().includes(s) ||
      (i.grm_number || '').toLowerCase().includes(s) ||
      (i.category || '').toLowerCase().includes(s)
    );
  }

  get allSelected(): boolean {
    return this.filteredInstances.length > 0 && this.filteredInstances.every(i => this.selectedIds.has(i.id));
  }

  toggleSelect(id: string) {
    if (this.selectedIds.has(id)) this.selectedIds.delete(id);
    else this.selectedIds.add(id);
  }

  toggleSelectAll() {
    if (this.allSelected) {
      this.filteredInstances.forEach(i => this.selectedIds.delete(i.id));
    } else {
      this.filteredInstances.forEach(i => this.selectedIds.add(i.id));
    }
  }

  toggleStatus(inst: any) {
    // Toggle locally only, no backend call
    inst.status = inst.status === 4 ? 5 : 4;
  }

  confirmSendToGrm() {
    this.confirm.confirm({
      message: `Envoyer ${this.selectedIds.size} produit(s) \u00e0 GRM ? Cette action est irr\u00e9versible. Un fichier GRM sera g\u00e9n\u00e9r\u00e9 et des commandes brouillon seront cr\u00e9\u00e9es par fournisseur.`,
      header: 'Confirmer l\'envoi \u00e0 GRM',
      icon: 'pi pi-send',
      acceptLabel: 'Envoyer',
      rejectLabel: 'Annuler',
      accept: () => this.sendToGrm(),
    });
  }

  sendToGrm() {
    const ids = Array.from(this.selectedIds);
    this.api.post<any>('/consumption/send-to-grm', { instance_ids: ids }).subscribe({
      next: (res) => {
        // Download GRM file
        const blob = new Blob([res.grm_content], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url; a.download = res.filename; a.click();
        URL.revokeObjectURL(url);

        this.grmResult = res;
        this.showGrmResult = true;
        this.selectedIds.clear();
        this.loadInstances();
        this.msg.add({ severity: 'success', summary: `${res.processed} produit(s) envoy\u00e9(s) \u00e0 GRM` });
      },
      error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
    });
  }

  onUpload(event: any) {
    const file = event.files?.[0]; if (!file) return;
    this.importing = true;
    this.api.upload<any>('/consumption/import/preview', file).subscribe({
      next: (res) => { this.preview = res; this.importing = false; },
      error: () => { this.importing = false; this.msg.add({ severity: 'error', summary: 'Erreur import' }); },
    });
  }

  confirmImport() {
    const ids = this.preview.matched.map((m: any) => m.instance_id);
    this.api.post('/consumption/import/confirm', { matched_ids: ids }).subscribe({
      next: (res: any) => {
        this.msg.add({ severity: 'success', summary: `${res.confirmed} confirm\u00e9(s)` });
        this.preview = null; this.showImport = false; this.loadInstances();
      },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }
}
