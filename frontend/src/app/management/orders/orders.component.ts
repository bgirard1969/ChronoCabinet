import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { TagModule } from 'primeng/tag';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { InputNumberModule } from 'primeng/inputnumber';
import { SelectModule } from 'primeng/select';
import { AutoCompleteModule } from 'primeng/autocomplete';
import { ToastModule } from 'primeng/toast';
import { ConfirmDialogModule } from 'primeng/confirmdialog';
import { MessageService, ConfirmationService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { parseGs1, Gs1Parsed } from '../../core/utils/gs1-parser';

@Component({
  selector: 'app-orders',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, TagModule, DialogModule, InputTextModule, InputNumberModule, SelectModule, AutoCompleteModule, ToastModule, ConfirmDialogModule],
  providers: [MessageService, ConfirmationService],
  template: `
    <p-toast />
    <p-confirmDialog />
    <div class="p-6 page-enter" data-testid="management-orders">
      <div class="page-header">
        <div><h1>Commandes</h1><p>Gestion des commandes fournisseurs</p></div>
        <p-button label="Nouvelle commande" icon="pi pi-plus" (onClick)="openCreate()" data-testid="btn-new-order" />
      </div>
      <p-table [value]="orders" [paginator]="true" [rows]="20" [rowHover]="true" styleClass="p-datatable-sm" [sortField]="'creation_date'" [sortOrder]="-1" data-testid="orders-table">
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="creation_date">Cr\u00e9ation</th>
            <th>N\u00b0 commande</th>
            <th>Fournisseur</th>
            <th pSortableColumn="status">Statut</th>
            <th pSortableColumn="order_date">Envoi</th>
            <th>Items</th>
            <th class="text-center" style="width: 8rem;">Actions</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-o>
          <tr class="cursor-pointer" (click)="openDetail(o)">
            <td>{{ o.creation_date | date:'yyyy-MM-dd' }}</td>
            <td class="font-mono text-xs">{{ o.order_number || '\u2014' }}</td>
            <td>{{ o.supplier?.name || '\u2014' }}</td>
            <td><p-tag [value]="statusLabel(o.status)" [severity]="statusSev(o.status)" /></td>
            <td>{{ o.order_date ? (o.order_date | date:'yyyy-MM-dd') : '\u2014' }}</td>
            <td>{{ o.received_items }}/{{ o.total_items }}</td>
            <td class="text-center" (click)="$event.stopPropagation()">
              <div class="flex items-center justify-center gap-1">
                @if (o.status !== 'cancelled' && o.status !== 'received') {
                  <p-button icon="pi pi-ban" [text]="true" size="small" severity="danger" (onClick)="confirmCancel(o)" />
                }
                @if (o.status === 'draft') {
                  <p-button icon="pi pi-trash" [text]="true" size="small" severity="danger" (onClick)="deleteOrder(o)" />
                }
              </div>
            </td>
          </tr>
        </ng-template>
        <ng-template pTemplate="emptymessage">
          <tr><td colspan="7" class="text-center py-8" style="color: var(--cdmi-text-muted);">Aucune commande</td></tr>
        </ng-template>
      </p-table>
    </div>

    <!-- ========== Create Order ========== -->
    <p-dialog header="Nouvelle commande" [(visible)]="showCreate" [modal]="true" [style]="{width: '500px'}">
      <div class="flex flex-col gap-4">
        <div>
          <label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Fournisseur *</label>
          <p-select [(ngModel)]="createForm.supplier_id" [options]="suppliers" optionLabel="name" optionValue="id" placeholder="Choisir un fournisseur" class="w-full" appendTo="body" data-testid="order-supplier" />
        </div>
        <div>
          <label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">N\u00b0 commande</label>
          <input pInputText [(ngModel)]="createForm.order_number" class="w-full" placeholder="Ex : PO-2026-0123" data-testid="order-number" />
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" (onClick)="showCreate = false" />
        <p-button label="Cr\u00e9er la commande" (onClick)="createOrder()" [disabled]="!createForm.supplier_id" data-testid="order-submit" />
      </ng-template>
    </p-dialog>

    <!-- ========== Order Detail ========== -->
    <p-dialog [(visible)]="showDetail" [modal]="true" [style]="{width: '850px'}" [showHeader]="false" [maximizable]="true" data-testid="order-detail-dialog">
      @if (d) {
        <div class="card-enter">
          <!-- Header -->
          <div class="flex items-start justify-between mb-4 pb-4" style="border-bottom: 1px solid var(--cdmi-border);">
            <div class="flex-1 min-w-0 mr-4">
              <h2 class="text-lg font-bold" style="color: var(--cdmi-text-primary);">Commande @if (d.order_number) { <span class="font-mono">#{{ d.order_number }}</span> }</h2>
              <p class="text-sm" style="color: var(--cdmi-text-secondary);">
                {{ d.supplier?.name || '\u2014' }}
                &mdash; Cr\u00e9\u00e9e le {{ d.creation_date | date:'yyyy-MM-dd' }}
                @if (d.grm_number) { &mdash; GRM: {{ d.grm_number }} }
                &mdash; <p-tag [value]="statusLabel(d.status)" [severity]="statusSev(d.status)" />
              </p>
            </div>
            <div class="flex items-center gap-2 shrink-0">
              @if (d.status === 'draft') {
                <p-button label="Envoyer" icon="pi pi-send" size="small" (onClick)="sendOrder()" data-testid="order-send" />
              }
              @if (d.status !== 'cancelled' && d.status !== 'received') {
                <p-button icon="pi pi-ban" [text]="true" severity="danger" (onClick)="confirmCancel(d)" />
              }
              <button (click)="showDetail = false" class="w-8 h-8 flex items-center justify-center cursor-pointer" style="background: none; border: none; color: var(--cdmi-text-secondary);"><i class="pi pi-times"></i></button>
            </div>
          </div>

          <!-- Scanner GS1 reception zone -->
          @if (d.status === 'sent' || d.status === 'partially_received') {
            <div class="rounded-lg p-4 mb-4" style="background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.25);">
              <label class="block text-xs font-bold uppercase mb-2" style="color: var(--cdmi-accent-blue);"><i class="pi pi-qrcode mr-1"></i>Scanner code GS1</label>
              <div class="flex gap-2">
                <input #orderScanInput pInputText [(ngModel)]="orderScanRaw" (input)="onOrderScanInput($event)" (keyup.enter)="submitOrderScan()" placeholder="Scannez le code-barres du produit re\u00e7u..." class="flex-1 font-mono" data-testid="order-scan-input" autofocus />
                <p-button icon="pi pi-check" label="Ajouter" (onClick)="submitOrderScan()" [disabled]="!orderScanRaw || scanningOrder" [loading]="scanningOrder" data-testid="order-scan-submit" />
              </div>
              @if (orderScanParsed) {
                <div class="grid grid-cols-4 gap-2 mt-2 text-xs">
                  <div><span style="color: var(--cdmi-text-muted);">GTIN :</span> <span class="font-mono" style="color: var(--cdmi-text-primary);">{{ orderScanParsed.gtin || '\u2014' }}</span></div>
                  <div><span style="color: var(--cdmi-text-muted);">Exp :</span> <span class="font-mono" style="color: var(--cdmi-text-primary);">{{ orderScanParsed.expiration_date || '\u2014' }}</span></div>
                  <div><span style="color: var(--cdmi-text-muted);">Lot :</span> <span class="font-mono" style="color: var(--cdmi-text-primary);">{{ orderScanParsed.lot_number || '\u2014' }}</span></div>
                  <div><span style="color: var(--cdmi-text-muted);">S\u00e9rie :</span> <span class="font-mono" style="color: var(--cdmi-text-primary);">{{ orderScanParsed.serial_number || '\u2014' }}</span></div>
                </div>
              }
              <p class="text-xs mt-2" style="color: var(--cdmi-text-muted);">{{ d.items?.length || 0 }} article(s) ajout\u00e9(s). Cliquez "Terminer la commande" en bas pour finaliser.</p>
            </div>
          }

          <!-- Add items to draft (legacy) -->
          @if (d.status === 'draft') {
            <div class="flex gap-2 mb-4">
              <p-autoComplete [(ngModel)]="draftAddProductObj" [suggestions]="filteredProducts" (completeMethod)="filterProducts($event)" optionLabel="description" [dropdown]="true" placeholder="Rechercher un produit..." class="flex-1" appendTo="body" data-testid="draft-add-product" />
              <p-inputNumber [(ngModel)]="draftAddQty" [min]="1" [showButtons]="true" class="w-24" />
              <p-button icon="pi pi-plus" label="Ajouter" (onClick)="addItemToDraft()" [disabled]="!draftAddProductObj?.id" data-testid="draft-add-btn" />
            </div>
          }
          <h3 class="text-sm font-bold mb-2" style="color: var(--cdmi-text-primary);">Articles ({{ d.items?.length || 0 }})</h3>
          <div class="rounded-lg overflow-hidden mb-4" style="border: 1px solid var(--cdmi-border);">
            <div class="grid px-4 py-2" style="grid-template-columns: 1.75rem 1fr 8rem 8rem 6rem 5rem 2rem; background: var(--cdmi-bg-elevated); border-bottom: 1px solid var(--cdmi-border);">
              <span></span>
              <span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Produit</span>
              <span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">N\u00b0 S\u00e9rie</span>
              <span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">N\u00b0 Lot</span>
              <span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Exp.</span>
              <span class="text-xs font-bold uppercase" style="color: var(--cdmi-text-muted);">Statut</span>
              <span></span>
            </div>
            <div class="overflow-y-auto" style="max-height: 18rem;">
              @for (item of d.items; track item.id) {
                <div class="grid px-4 py-2 items-center gap-x-2" style="grid-template-columns: 1.75rem 1fr 8rem 8rem 6rem 5rem 2rem; border-bottom: 1px solid var(--cdmi-border);" [style.background]="itemIncomplete(item) ? 'rgba(245, 158, 11, 0.06)' : 'transparent'">
                  <button (click)="openItemEdit(item)" class="w-6 h-6 flex items-center justify-center cursor-pointer shrink-0" style="background: none; border: none;" [style.color]="itemIncomplete(item) ? 'var(--cdmi-accent-amber)' : 'var(--cdmi-text-muted)'" [attr.data-testid]="'order-edit-' + item.id" [title]="itemIncomplete(item) ? 'Compl\u00e9ter le n\u00b0 s\u00e9rie/lot et la date d\u2019expiration' : 'Modifier l\u2019article'"><i class="pi pi-pencil" style="font-size: 0.75rem;"></i></button>
                  <span class="text-sm" style="color: var(--cdmi-text-primary);">{{ item.product?.description || '\u2014' }}</span>
                  <span class="text-sm font-mono" [style.color]="itemIncomplete(item) && !item.serial_number && !item.lot_number ? 'var(--cdmi-accent-amber)' : 'var(--cdmi-text-primary)'">{{ item.serial_number || '\u2014' }}</span>
                  <span class="text-sm font-mono" [style.color]="itemIncomplete(item) && !item.serial_number && !item.lot_number ? 'var(--cdmi-accent-amber)' : 'var(--cdmi-text-secondary)'">{{ item.lot_number || '\u2014' }}</span>
                  <span class="text-sm" [style.color]="itemIncomplete(item) && !item.expiration_date ? 'var(--cdmi-accent-amber)' : 'var(--cdmi-text-secondary)'">{{ item.expiration_date ? (item.expiration_date | date:'yy-MM-dd':'UTC') : '\u2014' }}</span>
                  <p-tag [value]="instStatusLabel(item.status)" [severity]="instStatusSev(item.status)" styleClass="text-xs" />
                  @if ((d.status === 'sent' || d.status === 'partially_received' || d.status === 'draft') && item.status === 1) {
                    <button (click)="removeItemFromOrder(item)" class="w-6 h-6 flex items-center justify-center cursor-pointer shrink-0" style="background: none; border: none; color: var(--cdmi-accent-red);" [attr.data-testid]="'order-remove-' + item.id" title="Retirer cet article"><i class="pi pi-times" style="font-size: 0.75rem;"></i></button>
                  } @else {
                    <span></span>
                  }
                </div>
              }
              @if (!d.items?.length) {
                <div class="text-center py-6 text-sm" style="color: var(--cdmi-text-muted);">Aucun article. Utilisez le scanner GS1 ou l'ajout manuel ci-dessous.</div>
              }
            </div>
          </div>

          <!-- Manual add via 3-step cascade -->
          @if (d.status === 'sent' || d.status === 'partially_received') {
            <div class="rounded-lg p-4" style="background: rgba(139, 92, 246, 0.06); border: 1px solid rgba(139, 92, 246, 0.25);">
              <label class="block text-xs font-bold uppercase mb-3" style="color: #8b5cf6;"><i class="pi pi-plus-circle mr-1"></i>Ajout manuel d'un article</label>

              <!-- Step 1: Cat → Model → Variant -->
              <div class="grid gap-3 mb-3" style="grid-template-columns: 1fr 1fr 1fr;">
                <div>
                  <label class="block text-xs mb-1" style="color: var(--cdmi-text-muted);">Cat\u00e9gorie *</label>
                  <p-select [(ngModel)]="manualCategoryId" [options]="categoryOptions" optionLabel="label" optionValue="value" placeholder="Choisir" class="w-full" appendTo="body" (onChange)="onCategoryChange()" [filter]="true" filterBy="label" data-testid="manual-cat" />
                </div>
                <div>
                  <label class="block text-xs mb-1" style="color: var(--cdmi-text-muted);">Mod\u00e8le *</label>
                  <p-select [(ngModel)]="manualTypeId" [options]="typeOptions" optionLabel="label" optionValue="value" placeholder="Choisir" class="w-full" appendTo="body" (onChange)="onTypeChange()" [disabled]="!manualCategoryId" [filter]="true" filterBy="label" data-testid="manual-type" />
                </div>
                <div>
                  <label class="block text-xs mb-1" style="color: var(--cdmi-text-muted);">Variante *</label>
                  <p-select [(ngModel)]="manualForm.product_id" [options]="productOptions" optionLabel="label" optionValue="value" placeholder="Choisir" class="w-full" appendTo="body" [disabled]="!manualTypeId" [filter]="true" filterBy="label" data-testid="manual-prod" />
                </div>
              </div>

              <!-- Selected product recap -->
              @if (selectedProductLabel()) {
                <div class="rounded-md py-2 mb-3" style="background: var(--cdmi-bg-elevated); border: 1px solid var(--cdmi-border); padding-left: 0.875rem; padding-right: 0.875rem;" data-testid="manual-product-recap">
                  <span class="text-sm font-medium" style="color: var(--cdmi-text-primary);">{{ selectedProductLabel() }}</span>
                </div>
              }

              <!-- Step 2: Serial / Lot / Expiration + Add -->
              <div class="grid gap-3" style="grid-template-columns: 1fr 1fr 1fr auto; align-items: end;">
                <div>
                  <label class="block text-xs mb-1" style="color: var(--cdmi-text-muted);">N\u00b0 S\u00e9rie</label>
                  <input pInputText [(ngModel)]="manualForm.serial_number" class="w-full" placeholder="Unique" data-testid="manual-serial" />
                </div>
                <div>
                  <label class="block text-xs mb-1" style="color: var(--cdmi-text-muted);">N\u00b0 Lot</label>
                  <input pInputText [(ngModel)]="manualForm.lot_number" class="w-full" data-testid="manual-lot" />
                </div>
                <div>
                  <label class="block text-xs mb-1" style="color: var(--cdmi-text-muted);">Expiration</label>
                  <input pInputText type="date" [(ngModel)]="manualForm.expiration_date" class="w-full" data-testid="manual-exp" />
                </div>
                <p-button icon="pi pi-plus" label="Ajouter" (onClick)="addManualItem()" [disabled]="!manualForm.product_id || addingManual" [loading]="addingManual" data-testid="manual-add-btn" />
              </div>
            </div>
          }
        </div>
      }
      <ng-template pTemplate="footer">
        <div class="flex items-center w-full">
          <p-button label="Fermer" severity="secondary" (onClick)="showDetail = false" />
          <div class="flex-1 flex justify-center">
            @if (d && (d.status === 'sent' || d.status === 'partially_received') && incompleteCount() > 0) {
              <span class="text-xs" style="color: var(--cdmi-accent-amber);" data-testid="order-incomplete-warning"><i class="pi pi-exclamation-triangle mr-1"></i>{{ incompleteCount() }} article(s) sans n\u00b0 s\u00e9rie/lot ou date d'expiration</span>
            }
          </div>
          @if (d && (d.status === 'sent' || d.status === 'partially_received')) {
            <p-button label="Terminer la commande" icon="pi pi-check-circle" severity="success" (onClick)="finalizeOrder()" [disabled]="!d.items?.length || finalizingOrder || incompleteCount() > 0" [loading]="finalizingOrder" data-testid="order-finalize" />
          }
        </div>
      </ng-template>
    </p-dialog>

    <!-- ========== Edit item (fill missing serial/lot/exp) ========== -->
    <p-dialog header="Compl\u00e9ter l'article" [(visible)]="showItemEdit" [modal]="true" [style]="{width: '480px'}" [closable]="true">
      @if (editingItem) {
        <p class="text-sm mb-3" style="color: var(--cdmi-text-secondary);">{{ editingItem.product?.description || '\u2014' }}</p>
        <div class="grid grid-cols-2 gap-3 mb-3">
          <div>
            <label class="block text-xs font-semibold mb-1" style="color: var(--cdmi-text-secondary);">N\u00b0 de s\u00e9rie</label>
            <input pInputText [(ngModel)]="editItemForm.serial_number" placeholder="Unique" class="w-full" data-testid="edit-item-serial" />
          </div>
          <div>
            <label class="block text-xs font-semibold mb-1" style="color: var(--cdmi-text-secondary);">N\u00b0 de lot</label>
            <input pInputText [(ngModel)]="editItemForm.lot_number" class="w-full" data-testid="edit-item-lot" />
          </div>
        </div>
        <div class="mb-2">
          <label class="block text-xs font-semibold mb-1" style="color: var(--cdmi-text-secondary);">Date d'expiration *</label>
          <input pInputText type="date" [(ngModel)]="editItemForm.expiration_date" class="w-full" data-testid="edit-item-exp" />
        </div>
        <p class="text-xs" style="color: var(--cdmi-text-muted);">Renseignez au moins un num\u00e9ro (s\u00e9rie ou lot) et la date d'expiration.</p>
      }
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" (onClick)="showItemEdit = false" />
        <p-button label="Enregistrer" icon="pi pi-check" (onClick)="saveItemEdit()" data-testid="edit-item-save" />
      </ng-template>
    </p-dialog>
  `,
})
export class OrdersComponent implements OnInit {
  @ViewChild('orderScanInput') orderScanInput?: ElementRef<HTMLInputElement>;
  orders: any[] = []; suppliers: any[] = []; products: any[] = [];
  showCreate = false; showDetail = false; d: any = null;
  createForm: any = { supplier_id: null, order_number: '', items: [] };
  addProductObj: any = null; addProductQty = 1;
  draftAddProductObj: any = null; draftAddQty = 1;
  filteredProducts: any[] = [];
  receiveQty = 1; receiving = false;
  receiveForms: any[] = [{ serial_number: '', lot_number: '', expiration_date: '', manufacturing_date: '' }];

  // Editing an already-received item that is missing serial/lot or expiration
  showItemEdit = false;
  editingItem: any = null;
  editItemForm: any = { serial_number: '', lot_number: '', expiration_date: '' };

  /** Un article est incomplet s'il n'a ni n\u00b0 s\u00e9rie ni n\u00b0 lot, OU pas de date d'expiration.
   *  On applique la v\u00e9rification peu importe le statut : un article "Command\u00e9" sans infos
   *  deviendrait un "Re\u00e7u" non plaçable lors de la finalisation. */
  itemIncomplete(item: any): boolean {
    if (!item) return false;
    const hasIdentifier = !!item.serial_number || !!item.lot_number;
    return !hasIdentifier || !item.expiration_date;
  }
  incompleteCount(): number {
    return (this.d?.items || []).filter((it: any) => this.itemIncomplete(it)).length;
  }
  openItemEdit(item: any) {
    this.editingItem = item;
    this.editItemForm = {
      serial_number: item.serial_number || '',
      lot_number: item.lot_number || '',
      expiration_date: item.expiration_date ? String(item.expiration_date).slice(0, 10) : '',
    };
    this.showItemEdit = true;
  }
  saveItemEdit() {
    if (!this.editingItem) return;
    if (!this.editItemForm.serial_number && !this.editItemForm.lot_number) {
      this.msg.add({ severity: 'warn', summary: 'N\u00b0 de s\u00e9rie ou n\u00b0 de lot requis' }); return;
    }
    if (!this.editItemForm.expiration_date) {
      this.msg.add({ severity: 'warn', summary: 'Date d\u2019expiration requise' }); return;
    }
    const body = {
      serial_number: this.editItemForm.serial_number || null,
      lot_number: this.editItemForm.lot_number || null,
      expiration_date: this.editItemForm.expiration_date ? this.editItemForm.expiration_date + 'T12:00:00' : null,
    };
    const productId = this.editingItem.product_id || this.editingItem.product?.id;
    if (!productId) { this.msg.add({ severity: 'error', summary: 'Produit introuvable' }); return; }
    this.api.put<any>(`/products/${productId}/instances/${this.editingItem.id}`, body).subscribe({
      next: () => { this.showItemEdit = false; this.editingItem = null; this.reloadOrderDetail(); this.msg.add({ severity: 'success', summary: 'Article mis \u00e0 jour' }); },
      error: (err) => this.msg.add({ severity: 'error', summary: 'Erreur', detail: err?.error?.message || '' }),
    });
  }
  private reloadOrderDetail() {
    if (!this.d?.id) return;
    this.api.get<any>(`/orders/${this.d.id}`).subscribe(d => this.d = d);
  }

  // Order GS1 scan
  orderScanRaw = '';
  orderScanParsed: Gs1Parsed | null = null;
  scanningOrder = false;
  finalizingOrder = false;
  private orderScanTimer: any = null;

  // Manual add via 3-step cascade (Catégorie → Modèle → Produit)
  manualCategoryId: string | null = null;
  manualTypeId: string | null = null;
  categoryOptions: { label: string; value: string }[] = [];
  typeOptions: { label: string; value: string }[] = [];
  productOptions: { label: string; value: string }[] = [];
  private supplierFilteredProducts: any[] = [];
  manualForm: any = { product_id: null, serial_number: '', lot_number: '', expiration_date: '' };
  addingManual = false;

  constructor(private api: ApiService, private msg: MessageService, private confirm: ConfirmationService) {}

  ngOnInit() {
    this.loadOrders();
    this.api.get<any[]>('/suppliers').subscribe(d => this.suppliers = d);
    this.api.get<any[]>('/products').subscribe(d => { this.products = d; });
  }

  /**
   * Rebuild the cascading dropdown chain for the given supplier.
   * Resets downstream selections.
   */
  private refreshCascadeForSupplier(supplierId: string | null) {
    this.supplierFilteredProducts = supplierId
      ? this.products.filter((p: any) => p.supplier_id === supplierId || p.supplier?.id === supplierId)
      : [...this.products];
    this.manualCategoryId = null;
    this.manualTypeId = null;
    this.manualForm.product_id = null;
    this.typeOptions = [];
    this.productOptions = [];
    // Build unique category list from supplier's products
    const catMap = new Map<string, string>();
    for (const p of this.supplierFilteredProducts) {
      if (p.category?.id) catMap.set(p.category.id, p.category.description);
    }
    this.categoryOptions = [...catMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  onCategoryChange() {
    this.manualTypeId = null;
    this.manualForm.product_id = null;
    this.productOptions = [];
    const typeMap = new Map<string, string>();
    for (const p of this.supplierFilteredProducts) {
      if (p.category?.id === this.manualCategoryId && p.type?.id) {
        typeMap.set(p.type.id, p.type.description);
      }
    }
    this.typeOptions = [...typeMap.entries()]
      .map(([value, label]) => ({ value, label }))
      .sort((a, b) => a.label.localeCompare(b.label));
  }

  onTypeChange() {
    this.manualForm.product_id = null;
    this.productOptions = this.supplierFilteredProducts
      .filter((p: any) => p.category?.id === this.manualCategoryId && p.type?.id === this.manualTypeId)
      .map((p: any) => ({
        value: p.id,
        label: p.variant?.description || 'Sans variante',
      }))
      .sort((a: any, b: any) => a.label.localeCompare(b.label));
  }

  /** Description of the currently selected product (shown as recap label). */
  selectedProductLabel(): string | null {
    if (!this.manualForm.product_id) return null;
    const p = this.products.find((x: any) => x.id === this.manualForm.product_id);
    return p ? p.description : null;
  }

  addManualItem() {
    if (!this.d || !this.manualForm.product_id) return;
    this.addingManual = true;
    this.api.post<any>(`/orders/${this.d.id}/manual-add`, {
      product_id: this.manualForm.product_id,
      serial_number: this.manualForm.serial_number || null,
      lot_number: this.manualForm.lot_number || null,
      expiration_date: this.manualForm.expiration_date ? this.manualForm.expiration_date + 'T12:00:00' : null,
    }).subscribe({
      next: (updated) => {
        this.d = updated;
        this.loadOrders();
        // Reset only serial/lot/exp + product, keep category/type for fast consecutive adds
        this.manualForm = { product_id: null, serial_number: '', lot_number: '', expiration_date: '' };
        this.addingManual = false;
        this.msg.add({ severity: 'success', summary: 'Article ajout\u00e9' });
      },
      error: (e) => {
        this.addingManual = false;
        this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' });
      },
    });
  }

  removeItemFromOrder(item: any) {
    if (!this.d) return;
    this.api.delete(`/orders/${this.d.id}/items/${item.id}`).subscribe({
      next: (updated: any) => { this.d = updated; this.loadOrders(); this.msg.add({ severity: 'success', summary: 'Article retir\u00e9' }); },
      error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
    });
  }

  loadOrders() { this.api.get<any[]>('/orders').subscribe(d => this.orders = d); }

  filterProducts(event: any) {
    const query = (event.query || '').toLowerCase();
    const supplierId = this.createForm?.supplier_id || this.d?.supplier_id || null;
    this.filteredProducts = this.products.filter((p: any) =>
      p.description.toLowerCase().includes(query) && (!supplierId || p.supplier_id === supplierId)
    );
  }

  statusLabel(s: string) { return { draft: 'Brouillon', sent: 'Envoy\u00e9e', partially_received: 'Partielle', received: 'Re\u00e7ue', closed: 'Ferm\u00e9e', cancelled: 'Annul\u00e9e' }[s] || s; }
  statusSev(s: string): any { return { draft: 'secondary', sent: 'info', partially_received: 'warn', received: 'success', closed: 'contrast', cancelled: 'danger' }[s] || 'info'; }
  instStatusLabel(s: number): string { return { 1: 'Command\u00e9', 2: 'Re\u00e7u', 3: 'Plac\u00e9', 4: 'Pr\u00e9lev\u00e9', 5: 'Consomm\u00e9', 6: 'Factur\u00e9' }[s] || String(s); }
  instStatusSev(s: number): any { return { 1: 'secondary', 2: 'info', 3: 'success', 4: 'warn', 5: 'danger', 6: 'contrast' }[s] || 'info'; }
  getProductName(id: string): string { return this.products.find(p => p.id === id)?.description || id; }

  get pendingItems() { return (this.d?.items || []).filter((i: any) => i.status === 1); }
  get canReceive(): boolean {
    const forms = this.receiveForms.slice(0, this.receiveQty);
    if (forms.some(f => !f.serial_number || !f.expiration_date)) return false;
    const serials = forms.map(f => f.serial_number).filter(Boolean);
    return new Set(serials).size === serials.length;
  }

  // === Create ===
  openCreate() { this.createForm = { supplier_id: null, order_number: '', items: [] }; this.addProductObj = null; this.addProductQty = 1; this.showCreate = true; }
  addItemToForm() {
    if (!this.addProductObj?.id) return;
    const existing = this.createForm.items.find((i: any) => i.product_id === this.addProductObj.id);
    if (existing) { existing.quantity += this.addProductQty; } else { this.createForm.items.push({ product_id: this.addProductObj.id, quantity: this.addProductQty }); }
    this.addProductObj = null; this.addProductQty = 1;
  }
  removeItemFromForm(item: any) { this.createForm.items = this.createForm.items.filter((i: any) => i !== item); }
  createOrder() {
    this.api.post<any>('/orders', this.createForm).subscribe({
      next: (created) => {
        this.showCreate = false;
        this.loadOrders();
        this.msg.add({ severity: 'success', summary: 'Commande cr\u00e9\u00e9e', detail: 'Pr\u00eate pour la r\u00e9ception par scan' });
        // Open detail directly to scan products into the new order
        this.openDetail(created);
        setTimeout(() => this.orderScanInput?.nativeElement?.focus(), 400);
      },
      error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
    });
  }

  // === Order scan reception ===
  onOrderScanInput(ev: any) {
    const val: string = ev?.target?.value || '';
    if (this.orderScanTimer) clearTimeout(this.orderScanTimer);
    this.orderScanTimer = setTimeout(() => {
      this.orderScanParsed = parseGs1(val);
      // Auto-submit as soon as a valid GTIN is detected in the burst
      if (this.orderScanParsed.gtin) {
        this.submitOrderScan();
      }
    }, 150);
  }

  submitOrderScan() {
    if (this.orderScanTimer) { clearTimeout(this.orderScanTimer); this.orderScanTimer = null; }
    if (!this.orderScanRaw || !this.d) return;
    const parsed = parseGs1(this.orderScanRaw);
    this.orderScanParsed = parsed;
    if (!parsed.gtin) {
      this.msg.add({ severity: 'warn', summary: 'Scan invalide', detail: 'GTIN introuvable' });
      return;
    }
    this.scanningOrder = true;
    this.api.post<any>(`/orders/${this.d.id}/scan-receive`, {
      gtin: parsed.gtin,
      serial_number: parsed.serial_number || null,
      lot_number: parsed.lot_number || null,
      expiration_date: parsed.expiration_date || null,
    }).subscribe({
      next: (updated) => {
        this.d = updated;
        this.loadOrders();
        this.orderScanRaw = '';
        this.orderScanParsed = null;
        this.scanningOrder = false;
        this.msg.add({ severity: 'success', summary: 'Article ajout\u00e9', detail: updated.items?.[updated.items.length - 1]?.product?.description || '' });
        setTimeout(() => this.orderScanInput?.nativeElement?.focus(), 100);
      },
      error: (e) => {
        this.scanningOrder = false;
        this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur scan' });
      },
    });
  }

  finalizeOrder() {
    if (!this.d || this.finalizingOrder) return;
    this.finalizingOrder = true;
    this.api.post<any>(`/orders/${this.d.id}/finalize`, {}).subscribe({
      next: (updated) => {
        this.d = updated;
        this.loadOrders();
        this.finalizingOrder = false;
        this.msg.add({ severity: 'success', summary: 'Commande finalis\u00e9e', detail: `${updated.items?.length || 0} article(s) re\u00e7u(s)` });
      },
      error: (e) => {
        this.finalizingOrder = false;
        this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' });
      },
    });
  }

  // === Detail ===
  openDetail(o: any) {
    this.api.get<any>(`/orders/${o.id}`).subscribe(data => {
      this.d = data;
      this.showDetail = true;
      this.receiveQty = 1;
      this.receiveForms = [{ serial_number: '', lot_number: '', expiration_date: '', manufacturing_date: '' }];
      this.draftAddProductObj = null; this.draftAddQty = 1;
      // Filter cascade to the order's supplier so manual-add only shows that supplier's products
      this.refreshCascadeForSupplier(data.supplier?.id || data.supplier_id || null);
    });
  }
  refreshDetail() { if (this.d) this.openDetail(this.d); }

  // === Draft: add/remove items ===
  addItemToDraft() {
    if (!this.draftAddProductObj?.id || !this.d) return;
    this.api.post(`/orders/${this.d.id}/items`, { items: [{ product_id: this.draftAddProductObj.id, quantity: this.draftAddQty }] }).subscribe({
      next: (res: any) => { this.d = res; this.loadOrders(); this.draftAddProductObj = null; this.draftAddQty = 1; this.msg.add({ severity: 'success', summary: 'Produit ajout\u00e9' }); },
      error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
    });
  }
  removeItemFromDraft(item: any) {
    this.api.delete(`/orders/${this.d.id}/items/${item.id}`).subscribe({
      next: (res: any) => { this.d = res; this.loadOrders(); this.msg.add({ severity: 'success', summary: 'Retir\u00e9' }); },
      error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
    });
  }

  // === Send ===
  sendOrder() {
    this.api.put(`/orders/${this.d.id}/send`, {}).subscribe({
      next: () => { this.loadOrders(); this.refreshDetail(); this.msg.add({ severity: 'success', summary: 'Commande envoy\u00e9e' }); },
      error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
    });
  }

  // === Cancel ===
  confirmCancel(o: any) {
    this.confirm.confirm({
      message: 'Annuler cette commande ? Les articles non re\u00e7us seront supprim\u00e9s. Irr\u00e9versible.',
      header: 'Annuler la commande', icon: 'pi pi-exclamation-triangle', acceptLabel: 'Confirmer', rejectLabel: 'Retour',
      accept: () => this.api.post(`/orders/${o.id}/cancel`, {}).subscribe({
        next: () => { this.loadOrders(); if (this.showDetail) this.refreshDetail(); this.msg.add({ severity: 'success', summary: 'Commande annul\u00e9e' }); },
        error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
      }),
    });
  }

  // === Receive ===
  onReceiveQtyChange() {
    const qty = Math.max(1, Math.min(this.receiveQty, this.pendingItems.length));
    this.receiveQty = qty;
    while (this.receiveForms.length < qty) this.receiveForms.push({ serial_number: '', lot_number: '', expiration_date: '', manufacturing_date: '' });
  }
  receiveItems() {
    this.receiving = true;
    const pending = this.pendingItems;
    const items = this.receiveForms.slice(0, this.receiveQty).map((form, i) => ({
      instance_id: pending[i]?.id,
      serial_number: form.serial_number,
      lot_number: form.lot_number || null,
      expiration_date: form.expiration_date ? form.expiration_date + 'T00:00:00' : null,
    }));
    this.api.put(`/orders/${this.d.id}/receive`, { items }).subscribe({
      next: () => {
        this.msg.add({ severity: 'success', summary: `${this.receiveQty} unit\u00e9(s) re\u00e7ue(s)` });
        this.refreshDetail(); this.loadOrders();
        this.receiveQty = 1; this.receiveForms = [{ serial_number: '', lot_number: '', expiration_date: '', manufacturing_date: '' }];
        this.receiving = false;
      },
      error: (e) => { this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }); this.receiving = false; },
    });
  }

  // === Delete ===
  deleteOrder(o: any) {
    this.api.delete(`/orders/${o.id}`).subscribe({
      next: () => { this.loadOrders(); this.msg.add({ severity: 'success', summary: 'Commande supprim\u00e9e' }); },
      error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
    });
  }
}
