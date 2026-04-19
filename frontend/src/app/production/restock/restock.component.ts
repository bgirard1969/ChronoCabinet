import { Component, AfterViewInit, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';
import { parseGs1 } from '../../core/utils/gs1-parser';

@Component({
  selector: 'app-restock',
  standalone: true,
  imports: [CommonModule, FormsModule, ButtonModule, InputTextModule, TagModule, ToastModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="min-h-screen bg-surface-900 p-4 page-enter" data-testid="restock-page">
      <div class="flex items-center gap-3 mb-6">
        <button (click)="router.navigate(['/production/interventions'])" class="touch-btn" style="background: var(--cdmi-bg-card); color: var(--cdmi-text-secondary); border: 1px solid var(--cdmi-border); min-width: 3rem; min-height: 3rem;" data-testid="restock-back">
          <i class="pi pi-arrow-left"></i>
        </button>
        <h1 class="text-xl font-bold" style="color: var(--cdmi-text-primary);">Mise en stock</h1>
      </div>

      <!-- Scan input -->
      <div class="flex gap-2 mb-6">
        <input #scanInput pInputText [(ngModel)]="serialNumber" placeholder="Scanner N\u00b0 s\u00e9rie ou lot..." class="flex-1 h-14 text-lg" (input)="onScanInput($event)" (keydown.enter)="forceParseAndScan($event)" [disabled]="scanning" data-testid="restock-scan-input" />
        @if (scanType === 'lot' && serialNumber) {
          <span class="self-center px-3 py-1 rounded text-xs font-bold" style="background: rgba(245, 158, 11, 0.12); color: #f59e0b; border: 1px solid rgba(245, 158, 11, 0.3);">LOT</span>
        }
        <button (click)="scan()" class="touch-btn" style="background: var(--cdmi-accent-blue); color: white; padding: 0 1.5rem; min-height: 3.5rem;" [disabled]="scanning || !serialNumber" data-testid="restock-scan-btn">
          Scanner
        </button>
      </div>

      <!-- Scan result -->
      @if (scanResult) {
        <div class="card-enter" style="background: var(--cdmi-bg-card); border: 1px solid var(--cdmi-border); border-radius: 0.75rem; padding: 1.5rem;" data-testid="scan-result">

          <!-- PLACE: product from order, ready for placement -->
          @if (scanResult.action === 'place') {
            <div class="flex items-center gap-3 mb-4">
              <div class="flex-1">
                <p class="font-bold text-lg" style="color: var(--cdmi-text-primary);">{{ scanResult.product?.description }} <span class="font-mono text-sm font-normal" style="color: var(--cdmi-text-secondary);">SN: {{ scanResult.instance.serial_number }}{{ scanResult.instance.lot_number ? ' / Lot: ' + scanResult.instance.lot_number : '' }}</span></p>
              </div>
              <p-tag value="Nouveau placement" severity="success" />
            </div>
            @if (scanResult.suggested_location) {
              <div class="flex items-center justify-center py-4 mb-4 rounded-lg" style="background: rgba(16, 185, 129, 0.06); border: 1px solid rgba(16, 185, 129, 0.15);">
                <p class="text-xl font-bold" style="color: var(--cdmi-accent-emerald);">
                  {{ scanResult.suggested_location.cabinet_name || 'Cabinet' }}: {{ cellLabel(scanResult.suggested_location.row, scanResult.suggested_location.column) }}
                </p>
              </div>
            } @else {
              <div class="p-3 rounded-lg mb-4" style="background: rgba(245, 158, 11, 0.06); border: 1px solid rgba(245, 158, 11, 0.15);">
                <p class="text-sm font-medium" style="color: var(--cdmi-accent-amber);">Aucun emplacement disponible pour ce produit</p>
              </div>
            }
            <button (click)="autoPlace()" class="touch-btn w-full" style="background: var(--cdmi-accent-emerald); color: white; min-height: 4rem;" [disabled]="placing || !scanResult.suggested_location" data-testid="auto-place-btn">
              @if (placing) { <i class="pi pi-spin pi-spinner mr-2"></i> }
              Placer en stock
            </button>
          }

          <!-- RETURN: picked but not used, put back -->
          @if (scanResult.action === 'return_to_stock') {
            <div class="flex items-center gap-3 mb-4">
              <div class="flex-1">
                <p class="font-bold text-lg" style="color: var(--cdmi-text-primary);">{{ scanResult.product?.description }} <span class="font-mono text-sm font-normal" style="color: var(--cdmi-text-secondary);">SN: {{ scanResult.instance.serial_number }}{{ scanResult.instance.lot_number ? ' / Lot: ' + scanResult.instance.lot_number : '' }}</span></p>
              </div>
              <p-tag value="Retour" severity="info" />
            </div>
            @if (scanResult.suggested_location) {
              <div class="flex items-center justify-center py-4 mb-4 rounded-lg" style="background: rgba(59, 130, 246, 0.06); border: 1px solid rgba(59, 130, 246, 0.15);">
                <p class="text-xl font-bold" style="color: var(--cdmi-accent-blue);">
                  {{ scanResult.suggested_location.cabinet_name || 'Cabinet' }}: R{{ scanResult.suggested_location.row }}-C{{ scanResult.suggested_location.column }}
                </p>
              </div>
            }
            <button (click)="autoPlace()" class="touch-btn w-full" style="background: var(--cdmi-accent-blue); color: white; min-height: 4rem;" [disabled]="placing || !scanResult.suggested_location" data-testid="return-place-btn">
              @if (placing) { <i class="pi pi-spin pi-spinner mr-2"></i> }
              Replacer en stock
            </button>
          }

          <!-- ALREADY PLACED -->
          @if (scanResult.action === 'already_placed') {
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: rgba(245, 158, 11, 0.12);"><i class="pi pi-info-circle text-xl" style="color: var(--cdmi-accent-amber);"></i></div>
              <div class="flex-1">
                <p class="font-bold text-lg" style="color: var(--cdmi-text-primary);">{{ scanResult.product?.description }}</p>
                <p class="text-sm" style="color: var(--cdmi-text-secondary);">SN: {{ scanResult.instance.serial_number }} &mdash; D\u00e9j\u00e0 en stock</p>
              </div>
              <p-tag value="D\u00e9j\u00e0 plac\u00e9" severity="warn" />
            </div>
          }

          <!-- UNKNOWN -->
          @if (scanResult.action === 'unknown') {
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: rgba(239, 68, 68, 0.12);"><i class="pi pi-times-circle text-xl" style="color: var(--cdmi-accent-red);"></i></div>
              <div>
                <p class="font-bold text-lg" style="color: var(--cdmi-text-primary);">N\u00b0 de s\u00e9rie inconnu</p>
                <p class="text-sm" style="color: var(--cdmi-text-secondary);">Ce N\u00b0 de s\u00e9rie ne correspond \u00e0 aucun produit en base</p>
              </div>
              <p-tag value="Inconnu" severity="danger" />
            </div>
          }

          <!-- UNAVAILABLE -->
          @if (scanResult.action === 'unavailable') {
            <div class="flex items-center gap-3">
              <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: rgba(239, 68, 68, 0.12);"><i class="pi pi-ban text-xl" style="color: var(--cdmi-accent-red);"></i></div>
              <div>
                <p class="font-bold text-lg" style="color: var(--cdmi-text-primary);">{{ scanResult.product?.description }}</p>
                <p class="text-sm" style="color: var(--cdmi-text-secondary);">Produit non pla\u00e7able ({{ scanResult.message }})</p>
              </div>
              <p-tag value="Non disponible" severity="danger" />
            </div>
          }
        </div>
      }

      <!-- Placement success -->
      @if (placementResult) {
        <div class="card-enter mt-4 p-4 rounded-lg" style="background: rgba(16, 185, 129, 0.08); border: 1px solid rgba(16, 185, 129, 0.2);">
          <div class="flex items-center gap-3">
            <div class="w-12 h-12 rounded-xl flex items-center justify-center" style="background: rgba(16, 185, 129, 0.15);"><i class="pi pi-check-circle text-xl" style="color: var(--cdmi-accent-emerald);"></i></div>
            <div>
              <p class="font-bold" style="color: var(--cdmi-accent-emerald);">Plac\u00e9 avec succ\u00e8s</p>
              <p class="text-sm" style="color: var(--cdmi-text-secondary);">
                {{ placementResult.product?.description }} &rarr; <strong>{{ placementResult.location?.cabinet_name || 'Cabinet' }}: R{{ placementResult.location?.row }}-C{{ placementResult.location?.column }}</strong>
              </p>
            </div>
          </div>
        </div>
      }
    </div>
  `,
})
export class RestockComponent implements AfterViewInit {
  @ViewChild('scanInput') scanInput!: ElementRef;
  serialNumber = '';
  scanResult: any = null;
  placementResult: any = null;
  scanning = false;
  placing = false;

  constructor(private api: ApiService, public router: Router, private msg: MessageService) {}

  cellLabel(row: number, column: number): string {
    if (!column || !row) return '';
    const col = column > 0 && column <= 26 ? String.fromCharCode('A'.charCodeAt(0) + column - 1) : `C${column}`;
    return `${col}${row}`;
  }

  ngAfterViewInit() { setTimeout(() => this.scanInput?.nativeElement?.focus(), 100); }

  // Debounced GS1 parsing: if scan contains AI 21 (serial) or AI 10 (lot), extract and keep only that value
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
    if (this.serialNumber) this.scan();
  }

  private applyScanParse(val: string) {
    if (!val) return;
    if (val.length <= 20 && /^[\w-]+$/.test(val)) {
      this.scanType = 'serial';
      return;
    }
    const parsed = parseGs1(val);
    if (parsed.serial_number) {
      this.serialNumber = parsed.serial_number;
      this.scanType = 'serial';
    } else if (parsed.lot_number) {
      this.serialNumber = parsed.lot_number;
      this.scanType = 'lot';
    }
    if (this.scanInput?.nativeElement) {
      this.scanInput.nativeElement.value = this.serialNumber;
    }
  }

  scan() {
    if (this.scanParseTimer) { clearTimeout(this.scanParseTimer); this.scanParseTimer = null; }
    if (this.serialNumber) this.applyScanParse(this.serialNumber);
    if (!this.serialNumber) return;
    this.scanning = true;
    this.scanResult = null;
    this.placementResult = null;
    const payload: any = this.scanType === 'lot'
      ? { lot_number: this.serialNumber }
      : { serial_number: this.serialNumber };
    this.api.post<any>('/instances/scan', payload).subscribe({
      next: (res) => { this.scanResult = res; this.scanning = false; },
      error: () => { this.msg.add({ severity: 'error', summary: 'Erreur scan' }); this.scanning = false; },
    });
  }

  autoPlace() {
    if (!this.scanResult?.instance) return;
    this.placing = true;
    this.api.post<any>(`/instances/${this.scanResult.instance.id}/auto-place`, {}).subscribe({
      next: (res) => {
        this.placementResult = res;
        this.scanResult = null;
        this.serialNumber = '';
        this.scanType = 'serial';
        this.placing = false;
        this.msg.add({ severity: 'success', summary: `Plac\u00e9 en R${res.location?.row}-C${res.location?.column}` });
      },
      error: (e) => {
        this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur placement' });
        this.placing = false;
      },
    });
  }
}
