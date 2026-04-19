import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Users, Plus, Edit, Trash2, Key, ShieldCheck, Eye, EyeOff, Lock, CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';

const Employees = () => {
  const { permissions } = useUser();
  const { t } = useLanguage();
  const [employees, setEmployees] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEmployee, setEditingEmployee] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [formData, setFormData] = useState({
    nom: '',
    prenom: '',
    email: '',
    password: '',
    role: 'technicien',
    pin: '',
    employee_card_id: ''
  });

  useEffect(() => {
    fetchEmployees();
    fetchRoles();
  }, []);

  const fetchEmployees = async () => {
    try {
      const response = await api.get('/employees');
      setEmployees(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des employés');
    } finally {
      setLoading(false);
    }
  };

  const fetchRoles = async () => {
    try {
      const response = await api.get('/employees/roles');
      setRoles(response.data);
    } catch (error) {
      console.error('Error fetching roles:', error);
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      prenom: '',
      email: '',
      password: '',
      role: 'technicien',
      pin: '',
      employee_card_id: ''
    });
    setEditingEmployee(null);
    setShowPassword(false);
    setShowPin(false);
  };

  const openCreateDialog = () => {
    resetForm();
    setDialogOpen(true);
  };

  const openEditDialog = (employee) => {
    setEditingEmployee(employee);
    setFormData({
      nom: employee.nom,
      prenom: employee.prenom,
      email: employee.email,
      password: '',
      role: employee.role,
      pin: '',
      employee_card_id: employee.employee_card_id || ''
    });
    setDialogOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    try {
      if (editingEmployee) {
        // Update existing employee
        const updateData = {
          nom: formData.nom,
          prenom: formData.prenom,
          email: formData.email,
          role: formData.role,
          employee_card_id: formData.employee_card_id || null
        };
        
        // Only include password if provided
        if (formData.password) {
          updateData.password = formData.password;
        }
        
        // Only include PIN if provided
        if (formData.pin) {
          updateData.pin = formData.pin;
        }
        
        await api.put(`/employees/${editingEmployee.id}`, updateData);
        toast.success('Employé mis à jour avec succès');
      } else {
        // Create new employee
        if (!formData.password) {
          toast.error('Le mot de passe est requis pour un nouvel employé');
          return;
        }
        
        const createData = {
          ...formData,
          employee_card_id: formData.employee_card_id || null
        };
        
        await api.post('/employees', createData);
        toast.success('Employé créé avec succès');
      }
      
      setDialogOpen(false);
      resetForm();
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la sauvegarde');
    }
  };

  const handleDelete = async (employee) => {
    if (!window.confirm(`Êtes-vous sûr de vouloir supprimer ${employee.prenom} ${employee.nom} ?`)) {
      return;
    }
    
    try {
      await api.delete(`/employees/${employee.id}`);
      toast.success('Employé supprimé avec succès');
      fetchEmployees();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const getRoleBadgeColor = (role) => {
    switch (role) {
      case 'administrateur':
        return 'bg-purple-100 text-purple-800 border-purple-300';
      case 'gestionnaire':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'technicien':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'clinicien':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      case 'lecture':
        return 'bg-gray-100 text-gray-800 border-gray-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  const getRoleLabel = (roleId) => {
    const role = roles.find(r => r.id === roleId);
    return role ? role.nom : roleId;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Read-only banner */}
      {permissions.isReadOnly && (
        <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <Lock className="text-yellow-600" size={20} />
          <span className="text-yellow-800 text-sm font-medium">
            {t('readOnlyMode')} - {t('readOnlyProducts')}
          </span>
        </div>
      )}
      
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>
            {t('employeesTitle')}
          </h1>
          <p className="text-gray-600 mt-1">{t('employeesDescription')}</p>
        </div>
        {permissions.canManageEmployees && (
          <Button onClick={openCreateDialog} className="flex items-center gap-2">
            <Plus size={20} />
            {t('newEmployee')}
          </Button>
        )}
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('totalEmployees')}</p>
              <p className="text-2xl font-bold">{employees.length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-100 rounded-lg">
              <ShieldCheck className="text-purple-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('administrators')}</p>
              <p className="text-2xl font-bold">{employees.filter(e => e.role === 'administrateur').length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <Key className="text-green-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('withPin')}</p>
              <p className="text-2xl font-bold">{employees.filter(e => e.has_pin).length}</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Users className="text-blue-600" size={24} />
            </div>
            <div>
              <p className="text-sm text-gray-500">{t('managers')}</p>
              <p className="text-2xl font-bold">{employees.filter(e => e.role === 'gestionnaire').length}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-white rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t('fullName')}</TableHead>
              <TableHead>{t('email')}</TableHead>
              <TableHead>{t('roleUpper')}</TableHead>
              <TableHead>{t('pin')}</TableHead>
              <TableHead>{t('employeeCardId')}</TableHead>
              <TableHead>{t('creationDate')}</TableHead>
              <TableHead className="text-right">{t('actions')}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {employees.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-8 text-gray-500">
                  {t('noData')}
                </TableCell>
              </TableRow>
            ) : (
              employees.map((employee) => (
                <TableRow key={employee.id}>
                  <TableCell className="font-medium">
                    {employee.prenom} {employee.nom}
                  </TableCell>
                  <TableCell>{employee.email}</TableCell>
                  <TableCell>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getRoleBadgeColor(employee.role)}`}>
                      {getRoleLabel(employee.role)}
                    </span>
                  </TableCell>
                  <TableCell>
                    {employee.has_pin ? (
                      <span className="flex items-center gap-1 text-green-600">
                        <Key size={16} />
                        <span className="text-xs">{t('configured')}</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">{t('notConfigured')}</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {employee.employee_card_id ? (
                      <span className="flex items-center gap-1 text-blue-600">
                        <CreditCard size={16} />
                        <span className="text-xs font-mono">••••••••</span>
                      </span>
                    ) : (
                      <span className="text-gray-400 text-xs">-</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {new Date(employee.created_at).toLocaleDateString('fr-FR')}
                  </TableCell>
                  <TableCell className="text-right">
                    {permissions.canManageEmployees && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(employee)}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => handleDelete(employee)}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-xl flex items-center gap-2">
              {editingEmployee ? (
                <>
                  <Edit size={24} />
                  {t('editEmployee')}
                </>
              ) : (
                <>
                  <Plus size={24} />
                  {t('newEmployee')}
                </>
              )}
            </DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>{t('firstName')} *</Label>
                <Input
                  value={formData.prenom}
                  onChange={(e) => setFormData({ ...formData, prenom: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>{t('lastName')} *</Label>
                <Input
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
              </div>
            </div>
            
            <div>
              <Label>{t('email')} *</Label>
              <Input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                required
              />
            </div>
            
            <div>
              <Label>
                {t('password')} {editingEmployee ? '' : '*'}
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  required={!editingEmployee}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </div>
            </div>
            
            <div>
              <Label>{t('role')} *</Label>
              <Select value={formData.role} onValueChange={(value) => setFormData({ ...formData, role: value })}>
                <SelectTrigger>
                  <SelectValue placeholder={t('role')} />
                </SelectTrigger>
                <SelectContent>
                  {roles.map((role) => (
                    <SelectItem key={role.id} value={role.id}>
                      <div>
                        <span className="font-medium">{role.nom}</span>
                        <span className="text-xs text-gray-500 ml-2">- {role.description}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Employee Card ID Section */}
            <div className="border-t pt-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="text-blue-600" size={20} />
                <Label className="text-blue-800 font-medium">{t('employeeCardId')} ({t('cardLogin')})</Label>
              </div>
              <div className="flex gap-2">
                <Input
                  type="text"
                  value={formData.employee_card_id}
                  onChange={(e) => setFormData({ ...formData, employee_card_id: e.target.value })}
                  placeholder={t('employeeCardIdPlaceholder')}
                  className="flex-1"
                />
                {formData.employee_card_id && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFormData({ ...formData, employee_card_id: '' })}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    Effacer
                  </Button>
                )}
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Permet la connexion rapide par scan de carte. Laissez vide pour désactiver.
              </p>
            </div>
            
            {/* PIN Section - Only for gestionnaire and administrateur */}
            {(formData.role === 'gestionnaire' || formData.role === 'administrateur') && (
              <div className="border-t pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Key className="text-yellow-600" size={20} />
                  <Label className="text-yellow-800 font-medium">{t('pin')} ({t('pinForApproval')})</Label>
                </div>
                <div className="relative">
                  <Input
                    type={showPin ? 'text' : 'password'}
                    value={formData.pin}
                    onChange={(e) => setFormData({ ...formData, pin: e.target.value })}
                    maxLength={10}
                    className="tracking-widest"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPin(!showPin)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {showPin ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {t('pinTraceability')}
                </p>
                {editingEmployee && editingEmployee.has_pin && (
                  <p className="text-xs text-green-600 mt-1 flex items-center gap-1">
                    <Key size={12} />
                    {t('configured')}
                  </p>
                )}
              </div>
            )}
            
            <DialogFooter className="pt-4">
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit">
                {editingEmployee ? t('update') : t('create')}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Employees;
