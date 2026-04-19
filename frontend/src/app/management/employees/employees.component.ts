import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { TableModule } from 'primeng/table';
import { ButtonModule } from 'primeng/button';
import { DialogModule } from 'primeng/dialog';
import { InputTextModule } from 'primeng/inputtext';
import { TagModule } from 'primeng/tag';
import { ToastModule } from 'primeng/toast';
import { SelectModule } from 'primeng/select';
import { MessageService } from 'primeng/api';
import { ApiService } from '../../core/services/api.service';

@Component({
  selector: 'app-employees',
  standalone: true,
  imports: [CommonModule, FormsModule, TableModule, ButtonModule, DialogModule, InputTextModule, TagModule, ToastModule, SelectModule],
  providers: [MessageService],
  template: `
    <p-toast />
    <div class="p-6 page-enter" data-testid="management-employees">
      <div class="page-header">
        <h1>Employ\u00e9s</h1>
        <p-button label="Nouvel employ\u00e9" icon="pi pi-plus" (onClick)="openCreate()" data-testid="btn-new-employee" />
      </div>
      <p-table [value]="employees" styleClass="p-datatable-sm" data-testid="employees-table">
        <ng-template pTemplate="header">
          <tr><th>Pr\u00e9nom</th><th>Nom</th><th>Email</th><th>R\u00f4le</th><th class="text-center" style="width: 5rem;">Actions</th></tr>
        </ng-template>
        <ng-template pTemplate="body" let-e>
          <tr>
            <td>{{ e.first_name }}</td><td>{{ e.last_name }}</td><td>{{ e.email }}</td>
            <td><p-tag [value]="e.role" /></td>
            <td class="text-center">
              <div class="flex items-center justify-center gap-1">
                <p-button icon="pi pi-pencil" [text]="true" size="small" severity="info" (onClick)="openEdit(e)" [attr.data-testid]="'edit-employee-' + e.id" />
                <p-button icon="pi pi-trash" [text]="true" size="small" severity="danger" (onClick)="deleteEmployee(e)" [attr.data-testid]="'delete-employee-' + e.id" />
              </div>
            </td>
          </tr>
        </ng-template>
      </p-table>
    </div>
    <p-dialog [header]="editingId ? 'Modifier employ\u00e9' : 'Nouvel employ\u00e9'" [(visible)]="showForm" [modal]="true" [style]="{width: '450px'}">
      <div class="flex flex-col gap-3">
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Pr\u00e9nom *</label><input pInputText [(ngModel)]="form.first_name" class="w-full" data-testid="emp-firstname" /></div>
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Nom *</label><input pInputText [(ngModel)]="form.last_name" class="w-full" data-testid="emp-lastname" /></div>
        </div>
        <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Email *</label><input pInputText [(ngModel)]="form.email" class="w-full" data-testid="emp-email" /></div>
        @if (!editingId) {
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">Mot de passe *</label><input pInputText type="password" [(ngModel)]="form.password" class="w-full" data-testid="emp-password" /></div>
        }
        <div class="grid grid-cols-2 gap-3">
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">R\u00f4le *</label><p-select [(ngModel)]="form.role" [options]="roleOptions" optionLabel="label" optionValue="value" placeholder="Choisir un r\u00f4le" class="w-full" appendTo="body" data-testid="emp-role" /></div>
          <div><label class="block text-sm mb-1" style="color: var(--cdmi-text-secondary);">NIP</label><input pInputText [(ngModel)]="form.pin" class="w-full" data-testid="emp-pin" /></div>
        </div>
      </div>
      <ng-template pTemplate="footer">
        <p-button label="Annuler" severity="secondary" (onClick)="showForm = false" />
        <p-button [label]="editingId ? 'Enregistrer' : 'Cr\u00e9er'" (onClick)="save()" data-testid="emp-submit" />
      </ng-template>
    </p-dialog>
  `,
})
export class EmployeesComponent implements OnInit {
  employees: any[] = [];
  showForm = false;
  editingId: string | null = null;
  form: any = {};
  roleOptions = [
    { value: 'administrateur', label: 'Administrateur' },
    { value: 'clinicien', label: 'Clinicien' },
    { value: 'technicien', label: 'Technicien' },
    { value: 'infirmier', label: 'Infirmier' },
    { value: 'gestionnaire', label: 'Gestionnaire' },
  ];
  constructor(private api: ApiService, private msg: MessageService) {}
  ngOnInit() { this.load(); }
  load() { this.api.get<any[]>('/employees').subscribe(d => this.employees = d); }

  openCreate() { this.editingId = null; this.form = {}; this.showForm = true; }
  openEdit(e: any) {
    this.editingId = e.id;
    this.form = { first_name: e.first_name, last_name: e.last_name, email: e.email, role: e.role, pin: e.pin || '' };
    this.showForm = true;
  }

  save() {
    if (this.editingId) {
      this.api.put(`/employees/${this.editingId}`, this.form).subscribe({
        next: () => { this.showForm = false; this.form = {}; this.load(); this.msg.add({ severity: 'success', summary: 'Employ\u00e9 modifi\u00e9' }); },
        error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
      });
    } else {
      this.api.post('/employees', this.form).subscribe({
        next: () => { this.showForm = false; this.form = {}; this.load(); this.msg.add({ severity: 'success', summary: 'Employ\u00e9 cr\u00e9\u00e9' }); },
        error: (e) => this.msg.add({ severity: 'error', summary: e.error?.message || 'Erreur' }),
      });
    }
  }

  deleteEmployee(e: any) {
    this.api.delete(`/employees/${e.id}`).subscribe({ next: () => this.load(), error: (err) => this.msg.add({ severity: 'error', summary: err.error?.message || 'Erreur' }) });
  }
}
