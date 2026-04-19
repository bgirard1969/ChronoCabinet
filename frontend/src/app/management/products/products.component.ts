import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { parseGs1 } from '../../core/utils/gs1-parser';

@Component({
  selector: 'app-products',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, DialogModule, InputTextModule, InputNumberModule, SelectModule, TagModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="p-6 page-enter" data-testid="management-products">
      <div class="page-header">
        <h1>Produits</h1>
        <div class="flex gap-2">
          @if (activeTab === 'products') {
            <p-button label="Scanner GS1" icon="pi pi-qrcode" severity="secondary" (onClick)="openScanner()" data-testid="btn-open-scanner" />
          }
          <p-button [label]="addButtonLabel" icon="pi pi-plus" (onClick)="openAdd()" data-testid="btn-add-entity" />
        </div>
      </div>

      <!-- Tabs -->
      <div class="flex gap-2 mb-4">
        @for (tab of tabs; track tab.key) {
          <p-button [label]="tab.label" [severity]="activeTab === tab.key ? 'primary' : 'secondary'" [outlined]="activeTab !== tab.key" size="small" (onClick)="activeTab = tab.key" [attr.data-testid]="'tab-' + tab.key" />
        }
      </div>

      <!-- Products tab -->
      @if (activeTab === 'products') {
        <div class="flex gap-3 mb-4 flex-wrap items-center">
          <span>
            <input pInputText [(ngModel)]="search" placeholder="Rechercher..." data-testid="product-search" />
          </span>
          <p-select [(ngModel)]="filterCat" [options]="categories" optionLabel="description" optionValue="id" placeholder="Toutes cat\u00e9gories" [showClear]="true" (onChange)="filterType = null; filterVariant = null" />
          <p-select [(ngModel)]="filterType" [options]="availableTypes" optionLabel="description" optionValue="id" placeholder="Tous mod\u00e8les" [showClear]="true" (onChange)="filterVariant = null" />
          <p-select [(ngModel)]="filterVariant" [options]="availableVariants" optionLabel="description" optionValue="id" placeholder="Toutes variantes" [showClear]="true" />
        </div>
        <p-table [value]="filteredProducts" [paginator]="true" [rows]="20" [rowHover]="true" styleClass="p-datatable-sm" data-testid="products-table">
          <ng-template pTemplate="header">
            <tr>
              <th pSortableColumn="grm_number">N\u00b0 GRM</th>
              <th pSortableColumn="description">Description</th>
              <th>Cat\u00e9gorie</th>
              <th>Mod\u00e8le</th>
              <th>Variante</th>
              <th>Fournisseur</th>
              <th>Catalogue Fournisseur</th>
              <th>GTIN</th>
              <th pSortableColumn="quantity_in_stock">Stock</th>
              <th class="text-center" style="width: 5rem;">Actions</th>
            </tr>
          </ng-template>
          <ng-template pTemplate="body" let-p>
            <tr class="cursor-pointer" (click)="openInstances(p)">
              <td class="font-mono">{{ p.grm_number || '\u2014' }}</td>
              <td class="font-medium">{{ p.description }}</td>
              <td>{{ p.category?.description || '\u2014' }}</td>
              <td>{{ p.type?.description || '\u2014' }}</td>
              <td>{{ p.variant?.description || '\u2014' }}</td>
              <td>{{ p.supplier?.name || '\u2014' }}</td>
              <td>{{ p.supplier_catalog_number || '\u2014' }}</td>
              <td class="font-mono text-xs">{{ p.gtin || '\u2014' }}</td>
              <td class="font-bold">{{ p.quantity_in_stock }}</td>
              <td class="text-center" (click)="$event.stopPropagation()">
                <div class="flex items-center justify-center gap-1">
                  <p-button icon="pi pi-pencil" [text]="true" size="small" severity="info" (onClick)="openEditProduct(p)" [attr.data-testid]="'edit-product-' + p.id" />
                  <p-button icon="pi pi-trash" [text]="true" size="small" severity="danger" (onClick)="deleteProduct(p)" [attr.data-testid]="'delete-product-' + p.id" />
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      }

      <!-- Simple CRUD -->
      @if (activeTab !== 'products') {
        <p-table [value]="currentSimpleData" styleClass="p-datatable-sm">
          <ng-template pTemplate="header">
            <tr><th>{{ activeTab === 'suppliers' ? 'Nom' : 'Description' }}</th><th class="text-center" style="width: 5rem;">Actions</th></tr>
          </ng-template>
          <ng-template pTemplate="body" let-item>
            <tr>
              <td>{{ item.description || item.name }}</td>
              <td class="text-center">
                <div class="flex items-center justify-center gap-1">
                  <p-button icon="pi pi-pencil" [text]="true" size="small" severity="info" (onClick)="openEditSimple(item)" />
                  <p-button icon="pi pi-trash" severity="danger" [text]="true" size="small" (onClick)="deleteSimple(item)" />
                </div>
              </td>
            </tr>
          </ng-template>
        </p-table>
      }
    </div>

    <!-- ========== Instances Panel ========== -->
    <p-dialog [(visible)]="showInstances" [modal]="true" [style]="{width: '800px'}" [showHeader]="false" [maximizable]="true" data-testid="instances-dialog">
      @if (selectedProduct) {
        <div class="card-enter">
          <!-- Header -->
          <div class="flex items-start justify-between mb-4 pb-4" style="border-bottom: 1px solid var(--cdmi-border);">
            <div>
              <h2 class="text-lg font-bold" style="color: var(--cdmi-text-primary);">{{ selectedProduct.description }}</h2>
              <p class="text-sm" style="color: var(--cdmi-text-secondary);">
                @if (selectedProduct.category) { {{ selectedProduct.category.description }} }
                @if (selectedProduct.type) { &middot; {{ selectedProduct.type.description }} }
                @if (selectedProduct.variant) { &middot; {{ selectedProduct.variant.description }} }
                @if (selectedProduct.grm_number) { &mdash; N\u00b0 GRM: {{ selectedProduct.grm_number }} }
              </p>
            </div>
            <div class="flex items-center gap-1 shrink-0">
              <button (click)="openEditProduct(selectedProduct); showInstances = false" class="w-8 h-8 flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-text-secondary);"><i class="pi pi-pencil"></i></button>
              <button (click)="showInstances = false" class="w-8 h-8 flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-text-secondary);"><i class="pi pi-times"></i></button>
            </div>
          </div>

          <!-- Instances list -->
          <div class="flex items-center justify-between mb-3">
            <h3 class="text-sm font-bold" style="color: var(--cdmi-text-primary);">Instances ({{ instances.length }})</h3>
          </div>

          <div class="rounded-lg overflow-hidden" style="border: 1px solid var(--cdmi-border);">
            <div class="grid px-4 py-2" style="grid-template-columns: 1fr 1fr 8rem 6rem; background: var(--cdmi-bg-elevated); border-bottom: 1px solid var(--cdmi-border);">
              <span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">N\u00b0 S\u00e9rie</span>
              <span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">N\u00b0 Lot</span>
              <span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Expiration</span>
              <span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Statut</span>
            </div>
            <div class="overflow-y-auto" style="max-height: 20rem;">
              @for (inst of instances; track inst.id) {
                <div class="grid px-4 py-2 items-center" style="grid-template-columns: 1fr 1fr 8rem 6rem; border-bottom: 1px solid var(--cdmi-border);">
                  <span class="text-sm font-mono" style="color: var(--cdmi-text-primary);">{{ inst.serial_number || '\u2014' }}</span>
                  <span class="text-sm font-mono" style="color: var(--cdmi-text-primary);">{{ inst.lot_number || '\u2014' }}</span>
                  <span class="text-sm" style="color: var(--cdmi-text-secondary);">{{ inst.expiration_date ? (inst.expiration_date | date:'yyyy-MM-dd':'UTC') : '\u2014' }}</span>
                  <span><p-tag [value]="statusLabel(inst.status)" [severity]="statusSev(inst.status)" /></span>
                </div>
              }
              @if (!instances.length) {
                <div class="px-4 py-6 text-center text-sm" style="color: var(--cdmi-text-muted);">Aucune instance</div>
              }
            </div>
          </div>
        </div>
      }
      <ng-template pTemplate="footer">
        <p-button label="Fermer" severity="secondary" (onClick)="showInstances = false" />
      </ng-template>
    </p-dialog>


    <!-- ========== Product Form ========== -->
    <p-dialog [header]="editingProductId ? 'Modifier produit' : 'Nouveau produit'" [(visible)]="showProductForm" [modal]="true" [style]="{width: '500px'}">
      <div class="flex flex-col gap-3">
        <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Description *</label><input pInputText [(ngModel)]="prodForm.description" class="w-full" data-testid="prod-description" /></div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Cat\u00e9gorie</label><p-select [(ngModel)]="prodForm.category_id" [options]="categories" optionLabel="description" optionValue="id" placeholder="Choisir" class="w-full" appendTo="body" /></div>
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Mod\u00e8le</label><p-select [(ngModel)]="prodForm.type_id" [options]="types" optionLabel="description" optionValue="id" placeholder="Choisir" class="w-full" appendTo="body" /></div>
        </div>
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Variante</label><p-select [(ngModel)]="prodForm.variant_id" [options]="variants" optionLabel="description" optionValue="id" placeholder="Choisir" class="w-full" appendTo="body" /></div>
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">N\u00b0 GRM</label><input pInputText [(ngModel)]="prodForm.grm_number" class="w-full" /></div>
        </div>
        <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Fournisseur</label><p-select [(ngModel)]="prodForm.supplier_id" [options]="suppliers" optionLabel="name" optionValue="id" placeholder="Choisir" class="w-full" appendTo="body" /></div>
        <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Catalogue Fournisseur</label><input pInputText [(ngModel)]="prodForm.supplier_catalog_number" class="w-full" placeholder="R\u00e9f\u00e9rence catalogue" data-testid="prod-supplier-catalog" /></div>
        <div>
          <label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">GTIN (code-barres)</label>
          <input pInputText [(ngModel)]="prodForm.gtin" (input)="onGtinInput($event)" (keyup.enter)="forceParseGtin($event)" class="w-full font-mono" placeholder="Scannez ou saisissez 14 chiffres" maxlength="50" data-testid="prod-gtin" />
          <p class="text-xs mt-1" style="color: var(--cdmi-text-muted);">Le scanner GS1 sera automatiquement nettoy\u00e9 pour ne garder que le GTIN</p>
        </div>
        <div class="flex items-center gap-2">
          <input type="checkbox" [(ngModel)]="prodForm.is_special_order" id="special-order" data-testid="prod-special-order" />
          <label for="special-order" class="text-sm" style="color: var(--cdmi-text-secondary);">Commande sp\u00e9ciale (ne pas recommander apr\u00e8s consommation)</label>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" (onClick)="showProductForm = false" />
        <p-button [label]="editingProductId ? 'Enregistrer' : 'Cr\u00e9er'" (onClick)="saveProduct()" data-testid="prod-submit" />
      </ng-template>
    </p-dialog>

    <!-- Simple entity form -->
    <p-dialog [header]="editingSimpleId ? simpleEditHeader : simpleDialogHeader" [(visible)]="showSimpleForm" [modal]="true" [style]="{width: '400px'}">
      <div class="flex flex-col gap-3">
        <div>
          <label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">{{ activeTab === 'suppliers' ? 'Nom' : 'Description' }}</label>
          <input pInputText [(ngModel)]="simpleForm" class="w-full" />
        </div>
        @if (activeTab === 'suppliers') {
          <div>
            <label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">No Fournisseur</label>
            <input pInputText [(ngModel)]="supplierNumberForm" class="w-full" maxlength="8" placeholder="8 caract\u00e8res max" data-testid="supplier-number" />
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" (onClick)="showSimpleForm = false" />
        <p-button [label]="editingSimpleId ? 'Enregistrer' : 'Cr\u00e9er'" (onClick)="saveSimple()" />
      </ng-template>
    </p-dialog>

    <!-- ========== Scanner GS1 ========== -->
    <p-dialog header="Scanner GS1" [(visible)]="showScanner" [modal]="true" [style]="{width: '560px'}" (onShow)="focusScanInput()" (onHide)="resetScanner()" data-testid="scanner-dialog">
      <div class="flex flex-col gap-4">
        <div>
          <label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Scan du code-barres</label>
          <input #scanInput pInputText [(ngModel)]="scanRaw" (input)="onScannerDialogInput($event)" (keyup.enter)="submitScan()" placeholder="Scannez ou collez le code GS1..." class="w-full font-mono" data-testid="scanner-input" autofocus />
          <p class="text-xs mt-1" style="color: var(--cdmi-text-muted);">Validation automatique d\u00e8s qu'un GTIN est d\u00e9tect\u00e9</p>
        </div>

        @if (scanParsed) {
          <div class="rounded-lg p-3" style="background: var(--cdmi-bg-elevated); border: 1px solid var(--cdmi-border);">
            <div class="text-xs uppercase mb-2" style="color: var(--cdmi-text-muted);">Donn\u00e9es extraites</div>
            <div class="grid grid-cols-2 gap-2 text-sm">
              <div><span style="color: var(--cdmi-text-muted);">GTIN :</span> <span class="font-mono" style="color: var(--cdmi-text-primary);">{{ scanParsed.gtin || '\u2014' }}</span></div>
              <div><span style="color: var(--cdmi-text-muted);">Expiration :</span> <span class="font-mono" style="color: var(--cdmi-text-primary);">{{ scanParsed.expiration_date || '\u2014' }}</span></div>
              <div><span style="color: var(--cdmi-text-muted);">N\u00b0 Lot :</span> <span class="font-mono" style="color: var(--cdmi-text-primary);">{{ scanParsed.lot_number || '\u2014' }}</span></div>
              <div><span style="color: var(--cdmi-text-muted);">N\u00b0 S\u00e9rie :</span> <span class="font-mono" style="color: var(--cdmi-text-primary);">{{ scanParsed.serial_number || '\u2014' }}</span></div>
            </div>
          </div>
        }

        @if (scanProduct) {
          <div class="rounded-lg p-4 flex items-start gap-3" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.3);" data-testid="scan-product-found">
            <i class="pi pi-check-circle text-xl" style="color: #10b981;"></i>
            <div class="flex-1">
              <div class="text-xs uppercase mb-1" style="color: #10b981;">Produit reconnu</div>
              <h3 class="font-bold" style="color: var(--cdmi-text-primary);">{{ scanProduct.description }}</h3>
              <p class="text-sm mt-1" style="color: var(--cdmi-text-secondary);">
                @if (scanProduct.category) { {{ scanProduct.category.description }} }
                @if (scanProduct.type) { &middot; {{ scanProduct.type.description }} }
                @if (scanProduct.variant) { &middot; {{ scanProduct.variant.description }} }
              </p>
              <p class="text-xs mt-1" style="color: var(--cdmi-text-muted);">
                @if (scanProduct.grm_number) { N\u00b0 GRM: {{ scanProduct.grm_number }} &middot; }
                Stock: <span class="font-bold" style="color: var(--cdmi-text-primary);">{{ scanProduct.quantity_in_stock }}</span>
                @if (scanProduct.supplier) { &middot; {{ scanProduct.supplier.name }} }
              </p>
            </div>
          </div>
        }

        @if (scanNotFound) {
          <div class="rounded-lg p-4 flex items-start gap-3" style="background: rgba(245, 158, 11, 0.08); border: 1px solid rgba(245, 158, 11, 0.3);" data-testid="scan-not-found">
            <i class="pi pi-exclamation-triangle text-xl" style="color: #f59e0b;"></i>
            <div class="flex-1">
              <div class="font-semibold" style="color: var(--cdmi-text-primary);">Produit non reconnu</div>
              <p class="text-sm mt-1" style="color: var(--cdmi-text-secondary);">GTIN : <span class="font-mono font-bold">{{ scanParsed?.gtin || '\u2014' }}</span></p>
            </div>
          </div>
        }

        @if (scanError) {
          <div class="rounded-lg p-3 text-sm" style="background: rgba(239, 68, 68, 0.08); border: 1px solid rgba(239, 68, 68, 0.3); color: #ef4444;">
            {{ scanError }}
          </div>
        }
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Nouveau scan" icon="pi pi-refresh" severity="secondary" (onClick)="resetScanner(); focusScanInput()" data-testid="btn-scan-reset" />
        <p-button label="Fermer" (onClick)="showScanner = false" />
      </ng-template>
    </p-dialog>
  `,
})
export class ProductsComponent implements OnInit {
  products: any[] = []; categories: any[] = []; types: any[] = []; variants: any[] = []; suppliers: any[] = [];
  search = ''; filterCat: string | null = null; filterType: string | null = null; filterVariant: string | null = null;
  activeTab = 'products';
  showProductForm = false; editingProductId: string | null = null; prodForm: any = {};
  showSimpleForm = false; editingSimpleId: string | null = null; simpleForm = ''; supplierNumberForm = '';
  // Instances
  showInstances = false; selectedProduct: any = null; instances: any[] = [];

  // Scanner GS1
  @ViewChild('scanInput') scanInputRef?: ElementRef<HTMLInputElement>;
  showScanner = false;
  scanRaw = '';
  scanParsed: { gtin: string | null; expiration_date: string | null; lot_number: string | null; serial_number: string | null } | null = null;
  scanProduct: any = null;
  scanNotFound = false;
  scanError = '';

  tabs = [
    { key: 'products', label: 'Produits' },
    { key: 'suppliers', label: 'Fournisseurs' },
    { key: 'categories', label: 'Cat\u00e9gories' },
    { key: 'types', label: 'Mod\u00e8les' },
    { key: 'variants', label: 'Variantes' },
  ];

  private addLabels: any = { products: 'Nouveau produit', suppliers: 'Nouveau fournisseur', categories: 'Nouvelle cat\u00e9gorie', types: 'Nouveau mod\u00e8le', variants: 'Nouvelle variante' };
  private dialogHeaders: any = { suppliers: 'Nouveau fournisseur', categories: 'Nouvelle cat\u00e9gorie', types: 'Nouveau mod\u00e8le', variants: 'Nouvelle variante' };
  private editHeaders: any = { suppliers: 'Modifier fournisseur', categories: 'Modifier cat\u00e9gorie', types: 'Modifier mod\u00e8le', variants: 'Modifier variante' };

  get addButtonLabel() { return this.addLabels[this.activeTab] || 'Ajouter'; }
  get simpleDialogHeader() { return this.dialogHeaders[this.activeTab] || 'Ajouter'; }
  get simpleEditHeader() { return this.editHeaders[this.activeTab] || 'Modifier'; }

  constructor(private api: ApiService, private msg: MessageService) {}
  ngOnInit() { this.loadAll(); }

  loadAll() {
    this.api.get<any[]>('/products').subscribe(d => this.products = d);
    this.api.get<any[]>('/product-categories').subscribe(d => this.categories = d);
    this.api.get<any[]>('/product-types').subscribe(d => this.types = d);
    this.api.get<any[]>('/product-variants').subscribe(d => this.variants = d);
    this.api.get<any[]>('/suppliers').subscribe(d => this.suppliers = d);
  }

  openAdd() {
    if (this.activeTab === 'products') { this.editingProductId = null; this.prodForm = {}; this.showProductForm = true; }
    else { this.editingSimpleId = null; this.simpleForm = ''; this.showSimpleForm = true; }
  }

  // === Instance status ===
  statusLabel(s: number): string {
    return { 1: 'Command\u00e9', 2: 'Re\u00e7u', 3: 'Plac\u00e9', 4: 'Pr\u00e9lev\u00e9', 5: 'Consomm\u00e9', 6: 'Factur\u00e9' }[s] || String(s);
  }
  statusSev(s: number): any {
    return { 1: 'secondary', 2: 'info', 3: 'success', 4: 'warn', 5: 'danger', 6: 'contrast' }[s] || 'info';
  }

  // === Instances ===
  openInstances(p: any) {
    this.selectedProduct = p;
    this.showInstances = true;
    this.loadInstances();
  }

  loadInstances() {
    if (!this.selectedProduct) return;
    this.api.get<any[]>(`/products/${this.selectedProduct.id}/instances`).subscribe(d => this.instances = d);
  }

  // === Products ===
  openEditProduct(p: any) {
    this.editingProductId = p.id;
    this.prodForm = {
      description: p.description, grm_number: p.grm_number || '',
      category_id: p.category_id || p.category?.id || null, type_id: p.type_id || p.type?.id || null,
      variant_id: p.variant_id || p.variant?.id || null, supplier_id: p.supplier_id || p.supplier?.id || null,
      supplier_catalog_number: p.supplier_catalog_number || '',
      gtin: p.gtin || '',
      is_special_order: p.is_special_order || false,
    };
    this.showProductForm = true;
  }

  saveProduct() {
    if (this.editingProductId) {
      this.api.put(`/products/${this.editingProductId}`, this.prodForm).subscribe({
        next: () => { this.showProductForm = false; this.loadAll(); this.msg.add({ severity: 'success', summary: 'Produit modifi\u00e9' }); },
        error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
      });
    } else {
      this.api.post('/products', this.prodForm).subscribe({
        next: () => { this.showProductForm = false; this.loadAll(); this.msg.add({ severity: 'success', summary: 'Produit cr\u00e9\u00e9' }); },
        error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
      });
    }
  }

  deleteProduct(p: any) {
    this.api.delete(`/products/${p.id}`).subscribe({
      next: () => { this.loadAll(); this.msg.add({ severity: 'success', summary: 'Produit supprim\u00e9' }); },
      error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Impossible de supprimer' }),
    });
  }

  // === Simple entities ===
  openEditSimple(item: any) { this.editingSimpleId = item.id; this.simpleForm = item.description || item.name || ''; this.supplierNumberForm = item.supplier_number || ''; this.showSimpleForm = true; }
  saveSimple() {
    const pathMap: any = { suppliers: '/suppliers', categories: '/product-categories', types: '/product-types', variants: '/product-variants' };
    const body = this.activeTab === 'suppliers' ? { name: this.simpleForm, supplier_number: this.supplierNumberForm || null } : { description: this.simpleForm };
    const obs = this.editingSimpleId ? this.api.put(`${pathMap[this.activeTab]}/${this.editingSimpleId}`, body) : this.api.post(pathMap[this.activeTab], body);
    obs.subscribe({
      next: () => { this.showSimpleForm = false; this.editingSimpleId = null; this.simpleForm = ''; this.loadAll(); this.msg.add({ severity: 'success', summary: this.editingSimpleId ? 'Modifi\u00e9' : 'Cr\u00e9\u00e9' }); },
      error: () => this.msg.add({ severity: 'error', summary: 'Erreur' }),
    });
  }
  deleteSimple(item: any) {
    const pathMap: any = { suppliers: '/suppliers', categories: '/product-categories', types: '/product-types', variants: '/product-variants' };
    this.api.delete(`${pathMap[this.activeTab]}/${item.id}`).subscribe({ next: () => this.loadAll(), error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Impossible de supprimer' }) });
  }

  // === Filters ===
  get availableTypes() { return this.filterCat ? this.types.filter(t => this.products.some(p => p.category_id === this.filterCat && p.type_id === t.id)) : this.types; }
  get availableVariants() {
    let pool = this.products;
    if (this.filterCat) pool = pool.filter(p => p.category_id === this.filterCat);
    if (this.filterType) pool = pool.filter(p => p.type_id === this.filterType);
    return this.variants.filter(v => pool.some(p => p.variant_id === v.id));
  }
  get filteredProducts() {
    return this.products.filter(p => {
      if (this.search && !p.description?.toLowerCase().includes(this.search.toLowerCase()) && !p.grm_number?.toLowerCase().includes(this.search.toLowerCase())) return false;
      if (this.filterCat && p.category_id !== this.filterCat) return false;
      if (this.filterType && p.type_id !== this.filterType) return false;
      if (this.filterVariant && p.variant_id !== this.filterVariant) return false;
      return true;
    });
  }
  get currentSimpleData() { return ({ suppliers: this.suppliers, categories: this.categories, types: this.types, variants: this.variants } as any)[this.activeTab] || []; }

  // === Scanner GS1 ===
  openScanner() {
    this.resetScanner();
    this.showScanner = true;
  }

  // Auto-submit on scanner burst when a full GTIN is detected (no need for Enter)
  private scannerDialogTimer: any = null;
  onScannerDialogInput(ev: any) {
    const val: string = ev?.target?.value || '';
    if (this.scannerDialogTimer) clearTimeout(this.scannerDialogTimer);
    this.scannerDialogTimer = setTimeout(() => {
      // Match a GTIN-14 anywhere in the stripped value, after an optional "01" AI marker
      const stripped = val.replace(/^[^0-9]+/, '');
      const match = stripped.match(/(?:^|01)(\d{14})/);
      if (match && stripped.length >= 14) {
        this.submitScan();
      }
    }, 150);
  }

  /**
   * Auto-parse GS1 scan in the product form GTIN field.
   * Uses a short debounce so that a full scan burst is parsed once at the end,
   * then only the 14-digit GTIN is kept in the field.
   */
  private gtinParseTimer: any = null;
  onGtinInput(ev: any) {
    const val: string = ev?.target?.value || '';
    if (this.gtinParseTimer) clearTimeout(this.gtinParseTimer);
    // Wait 120ms of silence (scanner burst is typically <30ms, user typing 200ms+)
    this.gtinParseTimer = setTimeout(() => this.applyGtinParse(val), 120);
  }

  forceParseGtin(ev: any) {
    if (this.gtinParseTimer) clearTimeout(this.gtinParseTimer);
    this.applyGtinParse(ev?.target?.value || '');
  }

  private applyGtinParse(val: string) {
    if (!val) return;
    // Only reduce if value is longer than a bare GTIN or contains non-digits
    if (val.length <= 14 && /^\d+$/.test(val)) return;
    const parsed = parseGs1(val);
    if (parsed.gtin) {
      this.prodForm.gtin = parsed.gtin;
    }
  }

  resetScanner() {
    this.scanRaw = '';
    this.scanParsed = null;
    this.scanProduct = null;
    this.scanNotFound = false;
    this.scanError = '';
  }

  focusScanInput() {
    setTimeout(() => this.scanInputRef?.nativeElement?.focus(), 100);
  }

  submitScan() {
    const raw = (this.scanRaw || '').trim();
    if (!raw) return;
    this.scanProduct = null;
    this.scanNotFound = false;
    this.scanError = '';

    this.api.post<{ parsed: any; product: any }>('/products/scan', { raw }).subscribe({
      next: (res) => {
        this.scanParsed = res.parsed;
        if (!res.parsed?.gtin) {
          this.scanError = 'Scan invalide : GTIN introuvable dans le code-barres';
          this.msg.add({ severity: 'warn', summary: 'Scan invalide', detail: 'GTIN introuvable dans le code' });
          return;
        }
        if (res.product) {
          this.scanProduct = res.product;
          this.msg.add({ severity: 'success', summary: 'Produit reconnu', detail: res.product.description });
        } else {
          this.scanNotFound = true;
          this.msg.add({ severity: 'warn', summary: 'Produit non reconnu', detail: `GTIN : ${res.parsed.gtin}` });
        }
      },
      error: () => {
        this.scanError = 'Erreur lors du scan';
        this.msg.add({ severity: 'error', summary: 'Erreur lors du scan' });
      },
    });
  }
}
