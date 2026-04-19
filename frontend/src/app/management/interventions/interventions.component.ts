import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { SelectModule } from 'primeng/select';
import { FileUploadModule } from 'primeng/fileupload';
import { ToastModule } from 'primeng/toast';
import { DatePickerModule } from 'primeng/datepicker';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { InputNumberModule } from 'primeng/inputnumber';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-interventions',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, DialogModule, InputTextModule, TagModule, SelectModule, FileUploadModule, ToastModule, DatePickerModule, ConfirmDialogModule, InputNumberModule],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />
    <div class="p-6 page-enter" data-testid="management-interventions">
      <div class="page-header">
        <div>
          <h1>Interventions</h1>
          <p>Planification et suivi des interventions</p>
        </div>
        <div class="flex gap-2">
          <p-button label="Importer CSV" icon="pi pi-upload" severity="secondary" (onClick)="showImport = true; importResult = null" data-testid="btn-import-csv" />
          <p-button label="Nouvelle intervention" icon="pi pi-plus" (onClick)="openCreate()" data-testid="btn-new-intervention" />
        </div>
      </div>

      <!-- Filters -->
      <div class="flex items-center gap-2 mb-4 flex-wrap">
        @for (f of filters; track f.value) {
          <p-button [label]="f.label" [severity]="filter === f.value ? 'primary' : 'secondary'" [outlined]="filter !== f.value" size="small" (onClick)="filter = f.value; dateRange = null; loadData()" [attr.data-testid]="'filter-' + f.value" />
        }
        <p-datepicker [(ngModel)]="dateRange" selectionMode="range" [showIcon]="true" [iconDisplay]="'input'" dateFormat="yy-mm-dd" placeholder="Plage de dates" [showButtonBar]="true" (onSelect)="onDateRangeSelect()" (onClear)="onDateRangeClear()" data-testid="date-range-picker" inputStyleClass="w-48" />
        <span class="mx-2 w-px h-6" style="background: var(--cdmi-border);"></span>
        <span>
          <input pInputText [(ngModel)]="mrnSearch" placeholder="MRN..." class="w-40" size="small" data-testid="mgmt-mrn-search" />
        </span>
        @for (s of distinctSalles; track s) {
          <button (click)="salleFilter = salleFilter === s ? null : s" class="px-3 py-1.5 rounded-lg text-sm font-semibold cursor-pointer transition-colors"
            [style.background]="salleFilter === s ? 'var(--cdmi-accent-purple)' : 'rgba(147, 51, 234, 0.15)'"
            [style.color]="salleFilter === s ? 'white' : 'var(--cdmi-accent-purple)'"
            [style.border]="salleFilter === s ? '1px solid var(--cdmi-accent-purple)' : '1px solid rgba(147, 51, 234, 0.3)'"
            [attr.data-testid]="'mgmt-salle-' + s">Salle {{ s }}</button>
        }
      </div>

      <!-- Table -->
      <p-table [value]="filteredData" [paginator]="true" [rows]="20" [rowHover]="true" styleClass="p-datatable-sm" data-testid="interventions-table">
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="planned_datetime">Date <p-sortIcon field="planned_datetime" /></th>
            <th>Salle</th>
            <th>MRN</th>
            <th>Date naissance</th>
            <th>Produits</th>
            <th>Statut</th>
            <th class="text-center" style="width: 5rem;">Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-intv>
          <tr class="cursor-pointer" (click)="openDetail(intv)">
            <td>{{ intv.planned_datetime | date:'yyyy-MM-dd':'UTC' }}</td>
            <td>@if (intv.operating_room) { <span class="inline-flex items-center justify-center rounded-lg text-sm font-bold" style="background: rgba(147, 51, 234, 0.18); color: rgb(126, 34, 206); min-width: 2.5rem; min-height: 2.5rem; padding: 0.25rem 0.5rem;">{{ intv.operating_room }}</span> } @else { — }</td>
            <td>{{ intv.patient_file_number || '—' }}</td>
            <td>{{ intv.birth_date || '—' }}</td>
            <td>@if (intv.products?.length) { <span class="text-sm font-medium" style="color: var(--cdmi-text-primary);">{{ intv.products.length }} produit(s)</span> } @else { — }</td>
            <td><p-tag [value]="statusLabel(intv.status)" [severity]="statusSeverity(intv.status)" /></td>
            <td class="text-center" (click)="$event.stopPropagation()">
              <div class="flex items-center justify-center gap-1">
                <p-button icon="pi pi-pencil" [text]="true" size="small" severity="info" (onClick)="openEdit(intv)" [attr.data-testid]="'edit-intv-' + intv.id" />
                <p-button icon="pi pi-trash" [text]="true" size="small" severity="danger" (onClick)="confirmDelete(intv)" [attr.data-testid]="'delete-intv-' + intv.id" />
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="7" class="text-center py-8" style="color: var(--cdmi-text-muted);">Aucune intervention</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- ========== DETAIL PANEL ========== -->
    <p-dialog [(visible)]="showDetail" [modal]="true" [style]="{width: '960px'}" [showHeader]="false" [maximizable]="true" data-testid="intervention-detail-dialog">
      @if (detailIntv) {
        <div class="card-enter">
          <!-- Header -->
          <div class="flex items-start justify-between mb-4 pb-4" style="border-bottom: 1px solid var(--cdmi-border);">
            <div class="flex-1 min-w-0 pr-4">
              <span class="text-lg font-bold align-middle" style="color: var(--cdmi-text-primary);">Intervention</span>
              <span class="text-sm align-middle" style="color: var(--cdmi-text-secondary); margin-left: 0.5rem;">
                &mdash; Date: {{ detailIntv.planned_datetime | date:'yyyy-MM-dd':'UTC' }}
                @if (detailIntv.operating_room) { &mdash; Salle: {{ detailIntv.operating_room }} }
                @if (detailIntv.patient_file_number) { &mdash; MRN: {{ detailIntv.patient_file_number }} }
                @if (detailIntv.birth_date) { &mdash; N\u00e9(e): {{ detailIntv.birth_date }} }
              </span>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button (click)="showDetail = false; openEdit(detailIntv)" class="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-text-secondary);"><i class="pi pi-pencil"></i></button>
              <button (click)="showDetail = false; confirmDelete(detailIntv)" class="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-text-secondary);"><i class="pi pi-trash"></i></button>
              <button (click)="showDetail = false" class="w-8 h-8 rounded-lg flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-text-secondary);" data-testid="detail-close"><i class="pi pi-times"></i></button>
            </div>
          </div>

          <!-- Produits requis -->
          <div class="mb-4">
            <h3 class="text-sm font-bold mb-3 flex items-center gap-2" style="color: var(--cdmi-text-primary);"><i class="pi pi-th-large" style="color: var(--cdmi-accent-purple);"></i> Produits requis</h3>
            @if (detailIntv.products?.length) {
              <div class="rounded-lg overflow-hidden" style="border: 1px solid var(--cdmi-border);">
                @for (ip of detailIntv.products; track ip.id) {
                  <div class="flex items-center gap-3 px-4 py-3" style="border-bottom: 1px solid var(--cdmi-border);">
                    <div class="flex-1">
                      <span class="text-sm font-medium" style="color: var(--cdmi-text-primary);">{{ productLabel(ip) }}</span>
                      @if (missingPartsLabel(ip); as miss) {
                        <span class="text-sm" style="color: var(--cdmi-accent-amber);" data-testid="tag-to-specify"> &mdash; {{ miss }}</span>
                      }
                    </div>
                    <div class="flex items-center gap-0 shrink-0">
                      <button (click)="updateQty(ip, -1)" class="w-8 h-8 flex items-center justify-center cursor-pointer" style="background: var(--cdmi-bg-elevated); border: 1px solid var(--cdmi-border); border-radius: 0.375rem 0 0 0.375rem; color: var(--cdmi-text-secondary);" [disabled]="ip.required_quantity <= 1">&minus;</button>
                      <span class="w-8 h-8 flex items-center justify-center text-sm font-bold" style="border-top: 1px solid var(--cdmi-border); border-bottom: 1px solid var(--cdmi-border); color: var(--cdmi-text-primary);">{{ ip.required_quantity }}</span>
                      <button (click)="updateQty(ip, 1)" class="w-8 h-8 flex items-center justify-center cursor-pointer" style="background: var(--cdmi-bg-elevated); border: 1px solid var(--cdmi-border); border-radius: 0 0.375rem 0.375rem 0; color: var(--cdmi-text-secondary);">+</button>
                    </div>
                    <button (click)="removeProduct(ip)" class="w-8 h-8 flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-text-muted);" [attr.data-testid]="'remove-product-' + ip.id"><i class="pi pi-trash"></i></button>
                  </div>
                }
              </div>
            } @else {
              <p class="text-sm py-3 text-center" style="color: var(--cdmi-text-muted);">Aucun produit ajout\u00e9</p>
            }
          </div>

          <!-- Separator -->
          <div style="border-top: 1px solid var(--cdmi-border);"></div>

          <!-- Ajouter un produit -->
          <div class="mb-4">
            <div class="flex items-center justify-between">
              <h3 class="text-sm font-bold my-0" style="color: var(--cdmi-text-primary);">Ajouter un produit</h3>
              <div class="flex items-center gap-2">
                @if (stockCatId || stockTypeId || stockVariantId) {
                  <button (click)="resetStockBrowser()" class="px-3 py-1.5 rounded-lg text-xs font-medium cursor-pointer flex items-center gap-1" style="background: var(--cdmi-bg-elevated); border: 1px solid var(--cdmi-border); color: var(--cdmi-text-secondary);" data-testid="btn-reset-filters">
                    <i class="pi pi-refresh" style="font-size: 0.65rem;"></i> R\u00e9initialiser
                  </button>
                }
              </div>
            </div>

            <!-- Cascading columns -->
            <div class="grid grid-cols-3 gap-0 rounded-lg overflow-hidden mb-4" style="border: 1px solid var(--cdmi-border);">
              <!-- Cat\u00e9gorie column -->
              <div style="border-right: 1px solid var(--cdmi-border);">
                <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Cat\u00e9gorie *</span></div>
                <div class="overflow-y-auto" style="max-height: 10rem;">
                  @for (cat of stockCategories; track cat.id) {
                    <div (click)="selectCat(cat.id)" class="px-4 py-2 text-sm cursor-pointer transition-colors" [style.background]="stockCatId === cat.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="stockCatId === cat.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="stockCatId === cat.id ? '600' : '400'" [attr.data-testid]="'cat-' + cat.id">{{ cat.description }}</div>
                  }
                  @if (!stockCategories.length) { <p class="px-4 py-2 text-xs" style="color: var(--cdmi-text-muted);">Aucune</p> }
                </div>
              </div>
              <!-- Mod\u00e8le column -->
              <div style="border-right: 1px solid var(--cdmi-border);">
                <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Mod\u00e8le <span class="normal-case font-normal">(optionnel)</span></span></div>
                <div class="overflow-y-auto" style="max-height: 10rem;">
                  @for (tp of stockTypesFiltered; track tp.id) {
                    <div (click)="selectType(tp.id)" class="px-4 py-2 text-sm cursor-pointer transition-colors" [style.background]="stockTypeId === tp.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="stockTypeId === tp.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="stockTypeId === tp.id ? '600' : '400'" [attr.data-testid]="'type-' + tp.id">{{ tp.description }}</div>
                  }
                  @if (stockCatId && !stockTypesFiltered.length) { <p class="px-4 py-2 text-xs" style="color: var(--cdmi-text-muted);">Aucun</p> }
                  @if (!stockCatId) { <p class="px-4 py-2 text-xs" style="color: var(--cdmi-text-muted);">Choisir une cat\u00e9gorie</p> }
                </div>
              </div>
              <!-- Variante column -->
              <div>
                <div class="px-3 py-2 text-center" style="border-bottom: 1px solid var(--cdmi-border);"><span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Variante <span class="normal-case font-normal">(optionnel)</span></span></div>
                <div class="overflow-y-auto" style="max-height: 10rem;">
                  @for (sp of stockVariantsFiltered; track sp.id) {
                    <div (click)="selectVariant(sp.id)" class="px-4 py-2 text-sm cursor-pointer transition-colors" [style.background]="stockVariantId === sp.id ? 'rgba(37, 99, 235, 0.08)' : 'transparent'" [style.color]="stockVariantId === sp.id ? 'var(--cdmi-accent-blue)' : 'var(--cdmi-text-primary)'" [style.font-weight]="stockVariantId === sp.id ? '600' : '400'" [attr.data-testid]="'variant-' + sp.id">{{ sp.description }}</div>
                  }
                  @if (stockTypeId && !stockVariantsFiltered.length) { <p class="px-4 py-2 text-xs" style="color: var(--cdmi-text-muted);">Aucune</p> }
                  @if (!stockTypeId) { <p class="px-4 py-2 text-xs" style="color: var(--cdmi-text-muted);">Choisir un mod\u00e8le</p> }
                </div>
              </div>
            </div>

            <!-- Add at filter level button (primary action) -->
            @if (stockCatId) {
              <div class="mb-3">
                <button (click)="addAtFilterLevel()" class="w-full px-3 py-2 rounded-lg text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                  [disabled]="allThreeSelected"
                  [style.cursor]="allThreeSelected ? 'not-allowed' : 'pointer'"
                  [style.opacity]="allThreeSelected ? '0.45' : '1'"
                  [style.background]="'rgba(16, 185, 129, 0.12)'"
                  [style.border]="'1px solid rgba(16, 185, 129, 0.35)'"
                  [style.color]="'var(--cdmi-accent-emerald)'"
                  [title]="allThreeSelected ? 'Choisissez le produit sp\u00e9cifique ci-dessous' : ''"
                  data-testid="btn-add-at-filter">
                  <i class="pi pi-plus" style="font-size: 0.75rem;"></i> Ajouter : {{ selectedFilterLabel }}
                  @if (!stockTypeId) { <span class="text-xs font-normal opacity-75">(mod\u00e8le/variante \u00e0 pr\u00e9ciser)</span> }
                </button>
              </div>
            }

            <!-- Results table (specific products) -->
            @if (stockProducts.length && stockCatId) {
              <div class="mb-2">
                <button (click)="showSpecificProducts = !showSpecificProducts" class="text-sm cursor-pointer px-3 py-2 rounded-lg flex items-center gap-2 transition-colors w-full"
                  [style.background]="allThreeSelected && stockProducts.length === 1 ? 'rgba(16, 185, 129, 0.10)' : 'var(--cdmi-bg-elevated)'"
                  [style.border]="allThreeSelected && stockProducts.length === 1 ? '1px solid rgba(16, 185, 129, 0.35)' : '1px solid var(--cdmi-border)'"
                  [style.color]="allThreeSelected && stockProducts.length === 1 ? 'var(--cdmi-accent-emerald)' : 'var(--cdmi-text-secondary)'"
                  [style.font-weight]="allThreeSelected && stockProducts.length === 1 ? '600' : '500'"
                  data-testid="btn-toggle-specific">
                  <i [class]="showSpecificProducts ? 'pi pi-chevron-down' : 'pi pi-chevron-right'" style="font-size: 0.7rem;"></i>
                  @if (allThreeSelected && stockProducts.length === 1) {
                    Produit correspondant
                  } @else {
                    Ou choisir un produit sp\u00e9cifique
                  }
                  <span class="ml-auto text-xs px-2 py-0.5 rounded-full" [style.background]="allThreeSelected && stockProducts.length === 1 ? 'rgba(16, 185, 129, 0.18)' : 'var(--cdmi-bg-card)'">{{ stockProducts.length }}</span>
                </button>
                @if (showSpecificProducts) {
                <div class="rounded-lg overflow-hidden mt-2" style="border: 1px solid var(--cdmi-border);">
                  <div class="grid px-4 py-2" style="grid-template-columns: 1fr 1fr 5rem 3rem; border-bottom: 1px solid var(--cdmi-border); background: var(--cdmi-bg-elevated);">
                    <span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Description</span>
                    <span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">N\u00b0 GRM</span>
                    <span class="text-xs font-bold uppercase text-right" style="color: var(--cdmi-text-muted);">Stock</span>
                    <span></span>
                  </div>
                  <div class="overflow-y-auto" style="max-height: 10rem;">
                    @for (sp of stockProducts; track sp.product_id) {
                      <div class="grid px-4 py-2 items-center" style="grid-template-columns: 1fr 1fr 5rem 3rem; border-bottom: 1px solid var(--cdmi-border);">
                        <span class="text-sm" style="color: var(--cdmi-text-primary);">{{ sp.description }}</span>
                      <span class="text-sm" style="color: var(--cdmi-text-muted);">{{ sp.grm_number || '\u2014' }}</span>
                      <span class="text-sm text-right" style="color: var(--cdmi-text-primary);">{{ sp.quantity_in_stock }}</span>
                      <div class="text-right">
                        <button (click)="addProduct(sp)" class="w-7 h-7 rounded-full flex items-center justify-center cursor-pointer" style="background: none; border: 1px solid var(--cdmi-accent-blue); color: var(--cdmi-accent-blue); margin-left: auto;" [attr.data-testid]="'add-product-' + (sp.id || sp.product_id)">+</button>
                      </div>
                    </div>
                  }
                </div>
              </div>
                }
              </div>
            }
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <p-button label="Fermer" severity="secondary" (onClick)="showDetail = false" data-testid="detail-close-btn" />
      </ng-template>
    </p-dialog>

    <!-- ========== Create / Edit dialog ========== -->
    <p-dialog [header]="editingId ? 'Modifier intervention' : 'Nouvelle intervention'" [(visible)]="showForm" [modal]="true" [style]="{width: '500px'}">
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Date *</label><input pInputText type="date" [(ngModel)]="form.planned_date" class="w-full" data-testid="form-date" /></div>
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Salle</label><input pInputText [(ngModel)]="form.operating_room" placeholder="Ex: 05" maxlength="2" class="w-full" data-testid="form-salle" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">MRN</label><input pInputText [(ngModel)]="form.patient_file_number" placeholder="Facultatif" class="w-full" data-testid="form-mrn" /></div>
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Date naissance</label><input pInputText type="date" [(ngModel)]="form.birth_date" class="w-full" data-testid="form-birth" /></div>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" (onClick)="showForm = false" />
        <p-button [label]="editingId ? 'Enregistrer' : 'Cr\u00e9er'" (onClick)="saveIntervention()" [loading]="saving" data-testid="form-submit" />
      </ng-template>
    </p-dialog>

    <!-- ========== Import CSV dialog ========== -->
    <p-dialog header="Importer CSV" [(visible)]="showImport" [modal]="true" [style]="{width: '600px'}" [maximizable]="true">
      <p-fileUpload mode="basic" chooseLabel="S\u00e9lectionner un fichier CSV" accept=".csv" [auto]="true" (onUpload)="onCsvUpload($event)" [customUpload]="true" (uploadHandler)="onCsvUpload($event)" [disabled]="importing" data-testid="csv-upload" />
      @if (importing) {
        <div class="flex items-center justify-center gap-2 mt-4 py-4" style="color: var(--cdmi-text-muted);"><i class="pi pi-spin pi-spinner text-xl"></i><span class="text-sm">Import en cours...</span></div>
      }
      @if (importResult) {
        <div class="mt-4 card-enter" data-testid="import-result">
          <div class="flex gap-3 mb-3">
            <div class="flex-1 p-3 rounded-xl text-center" style="background: rgba(16, 185, 129, 0.10); border: 1px solid rgba(16, 185, 129, 0.25);"><p class="text-2xl font-bold" style="color: var(--cdmi-accent-emerald);">{{ importResult.created }}</p><p class="text-xs font-medium" style="color: var(--cdmi-accent-emerald);">Cr\u00e9\u00e9e(s)</p></div>
            <div class="flex-1 p-3 rounded-xl text-center" style="background: rgba(245, 158, 11, 0.10); border: 1px solid rgba(245, 158, 11, 0.25);"><p class="text-2xl font-bold" style="color: var(--cdmi-accent-amber);">{{ importResult.duplicates }}</p><p class="text-xs font-medium" style="color: var(--cdmi-accent-amber);">Doublon(s) ignor\u00e9(s)</p></div>
            @if (importResult.errors?.length) { <div class="flex-1 p-3 rounded-xl text-center" style="background: rgba(239, 68, 68, 0.10); border: 1px solid rgba(239, 68, 68, 0.25);"><p class="text-2xl font-bold" style="color: var(--cdmi-accent-red);">{{ importResult.errors.length }}</p><p class="text-xs font-medium" style="color: var(--cdmi-accent-red);">Erreur(s)</p></div> }
          </div>
          <div class="rounded-full overflow-hidden h-2 flex" style="background: var(--cdmi-bg-elevated);">
            @if (importResult.created) { <div [style.width.%]="importResult.created / importResult.total_lines * 100" style="background: var(--cdmi-accent-emerald);"></div> }
            @if (importResult.duplicates) { <div [style.width.%]="importResult.duplicates / importResult.total_lines * 100" style="background: var(--cdmi-accent-amber);"></div> }
          </div>
          <p class="text-xs mt-2 mb-3" style="color: var(--cdmi-text-muted);">{{ importResult.total_lines }} ligne(s) trait\u00e9e(s)</p>
          @if (importResult.created_lines?.length) {
            <div class="mb-3"><p class="text-xs font-semibold mb-1" style="color: var(--cdmi-accent-emerald);"><i class="pi pi-check-circle mr-1"></i>Cr\u00e9\u00e9es</p>
              <div class="rounded-lg overflow-y-auto" style="background: rgba(16, 185, 129, 0.05); border: 1px solid rgba(16, 185, 129, 0.15); max-height: 8rem;">
                @for (l of importResult.created_lines; track l.line) { <div class="flex items-center gap-3 px-3 py-1.5 text-xs" style="border-bottom: 1px solid rgba(16, 185, 129, 0.08);"><span class="font-mono" style="color: var(--cdmi-text-muted); min-width: 2rem;">L{{ l.line }}</span><span style="min-width: 5.5rem;">{{ l.date }}</span><span style="min-width: 2.5rem;">{{ l.salle || '\u2014' }}</span><span class="font-medium" style="color: var(--cdmi-accent-emerald);">{{ l.mrn || '\u2014' }}</span></div> }
              </div>
            </div>
          }
          @if (importResult.duplicate_lines?.length) {
            <div class="mb-3"><p class="text-xs font-semibold mb-1" style="color: var(--cdmi-accent-amber);"><i class="pi pi-exclamation-circle mr-1"></i>Doublons ignor\u00e9s</p>
              <div class="rounded-lg overflow-y-auto" style="background: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.15); max-height: 8rem;">
                @for (l of importResult.duplicate_lines; track l.line) { <div class="flex items-center gap-3 px-3 py-1.5 text-xs" style="border-bottom: 1px solid rgba(245, 158, 11, 0.08);"><span class="font-mono" style="color: var(--cdmi-text-muted); min-width: 2rem;">L{{ l.line }}</span><span style="min-width: 5.5rem;">{{ l.date }}</span><span style="min-width: 2.5rem;">{{ l.salle || '\u2014' }}</span><span class="font-medium" style="color: var(--cdmi-accent-amber);">{{ l.mrn || '\u2014' }}</span><span class="flex-1 text-right" style="color: var(--cdmi-text-muted);">{{ l.reason }}</span></div> }
              </div>
            </div>
          }
        </div>
      }
      <ng-template pTemplate="footer">
        @if (importResult) { <p-button label="Fermer" severity="secondary" (onClick)="showImport = false; importResult = null" data-testid="import-close" /> }
      </ng-template>
    </p-dialog>
  `,
})
export class InterventionsComponent implements OnInit {
  data: any[] = [];
  filter = 'today';
  mrnSearch = '';
  salleFilter: string | null = null;
  showForm = false;
  showImport = false;
  showDetail = false;
  saving = false;
  importing = false;
  importResult: any = null;
  editingId: string | null = null;
  form: any = {};
  dateRange: Date[] | null = null;
  detailIntv: any = null;

  // Stock browser state
  stockCategories: any[] = [];
  stockTypes: any[] = [];
  stockVariants: any[] = [];
  stockProducts: any[] = [];
  stockCatId: string | null = null;
  stockTypeId: string | null = null;
  stockVariantId: string | null = null;
  allStockProducts: any[] = [];
  showSpecificProducts = false;

  filters = [
    { value: 'today', label: "Aujourd'hui" },
    { value: 'week', label: 'Cette semaine' },
    { value: 'all', label: 'Toutes' },
  ];

  constructor(private api: ApiService, private msg: MessageService, private confirm: ConfirmationService) {}
  ngOnInit() { this.loadData(); }

  get distinctSalles() { return [...new Set(this.data.map(i => i.operating_room).filter(Boolean))].sort(); }
  get filteredData() {
    return this.data
      .filter(i => !this.mrnSearch || (i.patient_file_number || '').toLowerCase().includes(this.mrnSearch.toLowerCase()))
      .filter(i => !this.salleFilter || i.operating_room === this.salleFilter)
      .sort((a, b) => (a.operating_room || '').localeCompare(b.operating_room || ''));
  }

  // Cascading: types filtered by selected category
  get stockTypesFiltered() {
    if (!this.stockCatId) return [];
    const typeIds = new Set(this.allStockProducts.filter(p => p.category?.id === this.stockCatId).map(p => p.type?.id).filter(Boolean));
    return this.stockTypes.filter(t => typeIds.has(t.id));
  }

  // Cascading: specs filtered by selected category + type
  get stockVariantsFiltered() {
    if (!this.stockTypeId) return [];
    let pool = this.allStockProducts.filter(p => p.category?.id === this.stockCatId && p.type?.id === this.stockTypeId);
    const variantIds = new Set(pool.map(p => p.variant?.id).filter(Boolean));
    return this.stockVariants.filter(s => variantIds.has(s.id));
  }

  get allThreeSelected(): boolean {
    return !!(this.stockCatId && this.stockTypeId && this.stockVariantId);
  }

  loadData() {
    let q = '/interventions?';
    if (this.dateRange && this.dateRange[0]) {
      const from = this.formatLocalDate(this.dateRange[0]);
      const to = this.dateRange[1] ? this.formatLocalDate(this.dateRange[1]) : from;
      q += `date_from=${from}&date_to=${to}`;
    } else {
      q += `filter=${this.filter}`;
    }
    this.api.get<any[]>(q).subscribe(d => this.data = d);
  }

  private formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  onDateRangeSelect() { if (this.dateRange && this.dateRange[1]) { this.filter = ''; this.loadData(); } }
  onDateRangeClear() { this.dateRange = null; this.filter = 'today'; this.loadData(); }

  statusLabel(s: string) { return { planned: 'Planifi\u00e9e', in_progress: 'En cours', completed: 'Termin\u00e9e', cancelled: 'Annul\u00e9e' }[s] || s; }
  statusSeverity(s: string): any { return { planned: 'info', in_progress: 'warn', completed: 'success', cancelled: 'danger' }[s] || 'info'; }

  // === Product display helpers ===
  private findFullMatch(ip: any): any | null {
    if (!ip?.category_id || !ip?.type_id || !ip?.variant_id) return null;
    if (!this.allStockProducts?.length) return null;
    return this.allStockProducts.find(p =>
      (p.category?.id || p.category_id) === ip.category_id &&
      (p.type?.id || p.type_id) === ip.type_id &&
      (p.variant?.id || p.variant_id) === ip.variant_id
    ) || null;
  }

  hasFullMatch(ip: any): boolean {
    return !!ip.product_id || !!this.findFullMatch(ip);
  }

  /** Renvoie un libelle contextuel "Variante a preciser" / "Modele et variante a preciser"
   *  selon les champs manquants. Null si produit precis (ou resolution complete). */
  missingPartsLabel(ip: any): string | null {
    if (ip.product_id || this.findFullMatch(ip)) return null;
    if (ip.category_id && ip.type_id && !ip.variant_id) return 'Variante \u00e0 pr\u00e9ciser';
    if (ip.category_id && !ip.type_id) return 'Mod\u00e8le et variante \u00e0 pr\u00e9ciser';
    return null;
  }

  productLabel(ip: any): string {
    if (ip.product?.description) return ip.product.description;
    // 3 critères sélectionnés : afficher directement la description du produit correspondant
    const match = this.findFullMatch(ip);
    if (match) return match.description;
    const parts: string[] = [];
    if (ip.category?.description) parts.push(ip.category.description);
    if (ip.type?.description) parts.push(ip.type.description);
    if (ip.variant?.description) parts.push(ip.variant.description);
    return parts.length ? parts.join(' / ') : 'Produit';
  }

  resolutionTag(ip: any): string {
    if (ip.product_id) return 'Produit';
    if (ip.variant_id) return 'Variante';
    if (ip.type_id) return 'Mod\u00e8le';
    if (ip.category_id) return 'Cat\u00e9gorie';
    return 'Produit';
  }

  // === Detail panel ===
  openDetail(intv: any) {
    this.api.get<any>(`/interventions/${intv.id}`).subscribe(d => {
      this.detailIntv = d;
      this.showDetail = true;
      this.resetStockBrowser();
      this.loadStockFilterOptions();
    });
  }

  refreshDetail() {
    if (!this.detailIntv) return;
    this.api.get<any>(`/interventions/${this.detailIntv.id}`).subscribe(d => { this.detailIntv = d; this.loadData(); });
  }

  // === Stock browser ===
  loadStockFilterOptions() {
    // Load all products with relations for the cascading browser
    this.api.get<any[]>('/products').subscribe(products => {
      this.allStockProducts = products;
      // Extract unique categories, types, specs from products
      const catMap = new Map(); const typeMap = new Map(); const variantMap = new Map();
      for (const p of products) {
        if (p.category) catMap.set(p.category.id, p.category);
        if (p.type) typeMap.set(p.type.id, p.type);
        if (p.variant) variantMap.set(p.variant.id, p.variant);
      }
      this.stockCategories = [...catMap.values()].sort((a, b) => a.description.localeCompare(b.description));
      this.stockTypes = [...typeMap.values()].sort((a, b) => a.description.localeCompare(b.description));
      this.stockVariants = [...variantMap.values()].sort((a, b) => a.description.localeCompare(b.description));
      this.loadStockProducts(); // Show all products immediately
    });
  }

  resetStockBrowser() {
    this.stockCatId = null;
    this.stockTypeId = null;
    this.stockVariantId = null;
    this.showSpecificProducts = false;
    this.loadStockProducts();
  }

  onStockCatChange() {
    this.stockTypeId = null;
    this.stockVariantId = null;
    this.loadStockProducts();
  }

  onStockTypeChange() {
    this.stockVariantId = null;
    this.loadStockProducts();
  }

  selectCat(id: string) {
    this.stockCatId = this.stockCatId === id ? null : id;
    this.stockTypeId = null;
    this.stockVariantId = null;
    this.loadStockProducts();
  }

  selectType(id: string) {
    this.stockTypeId = this.stockTypeId === id ? null : id;
    this.stockVariantId = null;
    this.loadStockProducts();
  }

  selectVariant(id: string) {
    this.stockVariantId = this.stockVariantId === id ? null : id;
    this.loadStockProducts();
  }

  get selectedFilterLabel(): string {
    const parts: string[] = [];
    if (this.stockCatId) { const c = this.stockCategories.find(x => x.id === this.stockCatId); if (c) parts.push(c.description); }
    if (this.stockTypeId) { const t = this.stockTypes.find(x => x.id === this.stockTypeId); if (t) parts.push(t.description); }
    if (this.stockVariantId) { const s = this.stockVariants.find(x => x.id === this.stockVariantId); if (s) parts.push(s.description); }
    return parts.join(' / ');
  }

  addAtFilterLevel() {
    if (!this.detailIntv) return;
    this.api.post(`/interventions/${this.detailIntv.id}/products`, {
      category_id: this.stockCatId || null,
      type_id: this.stockTypeId || null,
      variant_id: this.stockVariantId || null,
      required_quantity: 1,
    }).subscribe({
      next: () => { this.refreshDetail(); this.msg.add({ severity: 'success', summary: 'Produit ajout\u00e9' }); },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }

  loadStockProducts() {
    let pool = this.allStockProducts;
    if (this.stockCatId) pool = pool.filter(p => p.category?.id === this.stockCatId);
    if (this.stockTypeId) pool = pool.filter(p => p.type?.id === this.stockTypeId);
    if (this.stockVariantId) pool = pool.filter(p => p.variant?.id === this.stockVariantId);
    this.stockProducts = pool;
    // Auto-expand specific products panel when exactly 1 match remains
    if (pool.length === 1) this.showSpecificProducts = true;
  }

  addProduct(sp: any) {
    if (!this.detailIntv) return;
    const pid = sp.product_id || sp.id;
    // Check if already in intervention products
    const existing = this.detailIntv.products?.find((ip: any) => ip.product_id === pid);
    if (existing) {
      this.updateQty(existing, 1);
      return;
    }
    this.api.post(`/interventions/${this.detailIntv.id}/products`, {
      product_id: pid,
      required_quantity: 1,
    }).subscribe({
      next: () => { this.refreshDetail(); this.msg.add({ severity: 'success', summary: 'Produit ajout\u00e9' }); },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }

  updateQty(ip: any, delta: number) {
    const newQty = ip.required_quantity + delta;
    if (newQty < 1) return;
    this.api.put(`/interventions/${this.detailIntv.id}/products/${ip.id}`, { required_quantity: newQty }).subscribe({
      next: () => this.refreshDetail(),
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }

  removeProduct(ip: any) {
    this.api.delete(`/interventions/${this.detailIntv.id}/products/${ip.id}`).subscribe({
      next: () => { this.refreshDetail(); this.msg.add({ severity: 'success', summary: 'Produit retir\u00e9' }); },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }

  // === Create / Edit ===
  openCreate() { this.editingId = null; this.form = { planned_date: '', operating_room: '', patient_file_number: '', birth_date: '' }; this.showForm = true; }
  openEdit(intv: any) {
    this.editingId = intv.id;
    const d = intv.planned_datetime ? new Date(intv.planned_datetime) : null;
    const dateStr = d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}` : '';
    this.form = { planned_date: dateStr, operating_room: intv.operating_room || '', patient_file_number: intv.patient_file_number || '', birth_date: intv.birth_date || '' };
    this.showForm = true;
  }

  saveIntervention() {
    this.saving = true;
    const payload: any = { planned_datetime: this.form.planned_date + 'T12:00:00', operating_room: this.form.operating_room || null, patient_file_number: this.form.patient_file_number || null, birth_date: this.form.birth_date || null };
    const isNew = !this.editingId;
    const obs = isNew ? this.api.post('/interventions', payload) : this.api.put(`/interventions/${this.editingId}`, payload);
    obs.subscribe({
      next: (result: any) => {
        this.showForm = false;
        this.loadData();
        this.msg.add({ severity: 'success', summary: isNew ? 'Intervention cr\u00e9\u00e9e' : 'Intervention modifi\u00e9e' });
        this.saving = false;
        if (isNew && result?.id) {
          this.openDetail(result);
        }
      },
      error: () => { this.msg.add({ severity: 'error', summary: 'Erreur' }); this.saving = false; },
    });
  }

  confirmDelete(intv: any) {
    this.confirm.confirm({
      message: `Supprimer l'intervention${intv.patient_file_number ? ' MRN: ' + intv.patient_file_number : ''} ?`,
      header: 'Confirmation', icon: 'pi pi-exclamation-triangle', acceptLabel: 'Supprimer', rejectLabel: 'Annuler',
      accept: () => this.api.delete(`/interventions/${intv.id}`).subscribe({
        next: () => { this.loadData(); this.msg.add({ severity: 'success', summary: 'Intervention supprim\u00e9e' }); },
        error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
      }),
    });
  }

  // === CSV Import ===
  onCsvUpload(event: any) {
    const file = event.files?.[0]; if (!file) return;
    this.importing = true; this.importResult = null;
    this.api.upload<any>('/interventions/import-csv', file).subscribe({
      next: (res) => { this.importResult = res; this.importing = false; this.loadData(); },
      error: () => { this.importing = false; this.msg.add({ severity: 'error', summary: 'Erreur import' }); },
    });
  }
}
