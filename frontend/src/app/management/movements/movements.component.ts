import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { DatePickerModule } from 'primeng/datepicker';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-movements',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, InputTextModule, TagModule, DatePickerModule],
  template: `
    <div class="p-6 page-enter" data-testid="management-movements">
      <div class="page-header">
        <h1>Mouvements</h1>
        <div class="flex gap-2">
          <p-button label="Excel" icon="pi pi-file-excel" severity="success" size="small" (onClick)="exportExcel()" data-testid="btn-export-excel" />
          <p-button label="PDF" icon="pi pi-file-pdf" severity="danger" size="small" (onClick)="exportPdf()" data-testid="btn-export-pdf" />
        </div>
      </div>

      <!-- Status filter buttons -->
      <div class="flex gap-2 mb-3 flex-wrap">
        @for (f of typeFilters; track f.value) {
          <p-button [label]="f.label" [severity]="typeFilter === f.value ? 'primary' : 'secondary'" [outlined]="typeFilter !== f.value" size="small" (onClick)="toggleTypeFilter(f.value)" [attr.data-testid]="'filter-type-' + f.value" />
        }
      </div>

      <div class="flex gap-3 mb-4 flex-wrap items-center">
        <span>
          <input pInputText [(ngModel)]="searchSN" placeholder="N\u00b0 S\u00e9rie" class="w-36" data-testid="mvt-search-sn" />
        </span>
        <span>
          <input pInputText [(ngModel)]="searchLot" placeholder="N\u00b0 Lot" class="w-36" data-testid="mvt-search-lot" />
        </span>
        <p-datepicker [(ngModel)]="dateRange" selectionMode="range" [showIcon]="true" [iconDisplay]="'input'" dateFormat="yy-mm-dd" placeholder="Plage de dates" [showButtonBar]="true" (onSelect)="onDateRangeSelect()" (onClear)="onDateRangeClear()" data-testid="mvt-date-range" inputStyleClass="w-48" />
        <p-button label="Filtrer" icon="pi pi-filter" size="small" (onClick)="load()" data-testid="mvt-filter-btn" />
      </div>
      <p-table [value]="movements" [paginator]="true" [rows]="25" styleClass="p-datatable-sm" [sortField]="'timestamp'" [sortOrder]="-1" data-testid="movements-table">
        <ng-template pTemplate="header">
          <tr>
            <th pSortableColumn="timestamp">Date</th>
            <th pSortableColumn="type">Type</th>
            <th>Produit</th>
            <th>N\u00b0 S\u00e9rie</th>
            <th>N\u00b0 Lot</th>
            <th>Emplacement</th>
            <th>Utilisateur</th>
            <th>D\u00e9tail</th>
          </tr>
        </ng-template>
        <ng-template pTemplate="body" let-m>
          <tr>
            <td>{{ m.timestamp | date:'yyyy-MM-dd' }}</td>
            <td><p-tag [value]="typeLabel(m.type)" [severity]="typeSeverity(m.type)" /></td>
            <td>{{ m.product_description || '\u2014' }}</td>
            <td class="font-mono text-xs">{{ m.serial_number || '\u2014' }}</td>
            <td class="font-mono text-xs">{{ m.lot_number || '\u2014' }}</td>
            <td>{{ m.location_display || '\u2014' }}</td>
            <td>{{ m.user_name || '\u2014' }}</td>
            <td class="text-xs">{{ m.reason || '\u2014' }}</td>
          </tr>
        </ng-template>
      </p-table>
    </div>
  `,
})
export class MovementsComponent implements OnInit {
  movements: any[] = [];
  searchSN = ''; searchLot = '';
  dateRange: Date[] | null = null;
  typeFilter: string | null = null;

  typeFilters = [
    { value: 'all', label: 'Tous' },
    { value: 'prelevement', label: 'Pr\u00e9l\u00e8vement' },
    { value: 'reception', label: 'R\u00e9ception' },
    { value: 'placement', label: 'Plac\u00e9' },
    { value: 'consommation', label: 'Consomm\u00e9' },
    { value: 'facturation', label: 'Factur\u00e9' },
    { value: 'retour', label: 'Retour' },
  ];

  constructor(private api: ApiService) {}
  ngOnInit() { this.load(); }

  toggleTypeFilter(value: string) {
    this.typeFilter = (value === 'all' || this.typeFilter === value) ? null : value;
    this.load();
  }

  onDateRangeSelect() { if (this.dateRange && this.dateRange[1]) this.load(); }
  onDateRangeClear() { this.dateRange = null; this.load(); }

  get dateFrom(): string { return this.dateRange?.[0] ? this.formatLocalDate(this.dateRange[0]) : ''; }
  get dateTo(): string { return this.dateRange?.[1] ? this.formatLocalDate(this.dateRange[1]) : ''; }

  private formatLocalDate(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  load() {
    let q = '/movements?';
    const from = this.dateFrom;
    const to = this.dateTo || from;
    if (from) q += `date_from=${from}&date_to=${to}&`;
    if (this.typeFilter) q += `type=${this.typeFilter}&`;
    if (this.searchSN) q += `serial_number=${this.searchSN}&`;
    if (this.searchLot) q += `lot_number=${this.searchLot}&`;
    this.api.get<any[]>(q).subscribe(d => this.movements = d);
  }

  typeLabel(t: string): string {
    const labels: any = { prelevement: 'Pr\u00e9l\u00e8vement', reception: 'R\u00e9ception', placement: 'Plac\u00e9', consommation: 'Consomm\u00e9', facturation: 'Factur\u00e9', retour: 'Retour' };
    return labels[t] || t;
  }

  typeSeverity(t: string): any {
    const m: any = { prelevement: 'warn', placement: 'success', reception: 'info', consommation: 'danger', facturation: 'contrast', retour: 'secondary' };
    return m[t] || 'info';
  }

  exportExcel() {
    const from = this.dateFrom;
    const to = this.dateTo || from;
    let q = `/movements/export/excel?date_from=${from}&date_to=${to}`;
    if (this.typeFilter) q += `&type=${this.typeFilter}`;
    if (this.searchSN) q += `&serial_number=${this.searchSN}`;
    if (this.searchLot) q += `&lot_number=${this.searchLot}`;
    this.api.getBlob(q).subscribe(b => this.download(b, 'mouvements.xlsx'));
  }

  exportPdf() {
    const from = this.dateFrom;
    const to = this.dateTo || from;
    let q = `/movements/export/pdf?date_from=${from}&date_to=${to}`;
    if (this.typeFilter) q += `&type=${this.typeFilter}`;
    if (this.searchSN) q += `&serial_number=${this.searchSN}`;
    if (this.searchLot) q += `&lot_number=${this.searchLot}`;
    this.api.getBlob(q).subscribe(b => this.download(b, 'mouvements.pdf'));
  }

  private download(blob: Blob, name: string) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = name; a.click(); URL.revokeObjectURL(url);
  }
}
