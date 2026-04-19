import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Plus, TrendingUp, ArrowUpCircle, ArrowDownCircle, Lock, ShoppingCart, Download, FileSpreadsheet, ChevronDown, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';

const Movements = () => {
  const { permissions } = useUser();
  const { t } = useLanguage();
  const [movements, setMovements] = useState([]);
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  
  // Filters
  const [filterType, setFilterType] = useState('all');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  
  // Column filters
  const [filters, setFilters] = useState({
    product: '',
    batch: '',
    serie: '',
    patient: '',
  });
  
  const [formData, setFormData] = useState({
    batch_id: '',
    type: 'sortie',
    quantite: '',
    patient_id: '',
    intervention_id: '',
    raison: '',
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [movementsRes, batchesRes, productsRes] = await Promise.all([
        api.get('/movements'),
        api.get('/batches'),
        api.get('/products'),
      ]);
      setMovements(movementsRes.data);
      setBatches(batchesRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const submitData = {
        ...formData,
        quantite: parseInt(formData.quantite),
      };
      await api.post('/movements', submitData);
      toast.success('Mouvement enregistré avec succès');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Une erreur est survenue');
    }
  };

  const resetForm = () => {
    setFormData({
      batch_id: '',
      type: 'sortie',
      quantite: '',
      patient_id: '',
      intervention_id: '',
      raison: '',
    });
  };

  const getBatchInfo = (batchId) => {
    const batch = batches.find(b => b.id === batchId);
    if (!batch) return null;
    const product = products.find(p => p.id === batch.product_id);
    return { batch, product };
  };

  // Get unique values for column filters
  const uniqueProducts = useMemo(() => {
    const productNames = movements.map(m => {
      const info = getBatchInfo(m.batch_id);
      return info?.product?.nom || m.product_name || null;
    }).filter(Boolean);
    return [...new Set(productNames)].sort();
  }, [movements, batches, products]);

  const uniqueBatches = useMemo(() => {
    const batchNums = movements.map(m => {
      const info = getBatchInfo(m.batch_id);
      return info?.batch?.numero_lot || null;
    }).filter(Boolean);
    return [...new Set(batchNums)].sort();
  }, [movements, batches]);

  const uniqueSeries = useMemo(() => {
    const serieNums = movements.map(m => {
      const info = getBatchInfo(m.batch_id);
      return info?.batch?.numero_serie || null;
    }).filter(Boolean);
    return [...new Set(serieNums)].sort();
  }, [movements, batches]);

  const uniquePatients = useMemo(() => {
    const patients = movements.map(m => m.patient_id).filter(Boolean);
    return [...new Set(patients)].sort();
  }, [movements]);

  const filtersOn = filterType !== 'all' || dateFrom || dateTo || filters.product || filters.batch || filters.serie || filters.patient;

  const resetAllFilters = () => {
    setFilterType('all');
    setDateFrom('');
    setDateTo('');
    setFilters({ product: '', batch: '', serie: '', patient: '' });
  };

  // Filter movements based on type, date range, and column filters
  const filteredMovements = movements.filter(m => {
    // Type filter
    if (filterType !== 'all' && m.type !== filterType) return false;
    
    // Date filter - compare only the date part (YYYY-MM-DD) to avoid timezone issues
    if (dateFrom || dateTo) {
      const movementDate = new Date(m.timestamp);
      // Get the local date string (YYYY-MM-DD format)
      const movementDateStr = movementDate.toLocaleDateString('sv-SE'); // 'sv-SE' gives ISO format YYYY-MM-DD
      
      if (dateFrom && movementDateStr < dateFrom) return false;
      if (dateTo && movementDateStr > dateTo) return false;
    }
    
    // Column filters
    const info = getBatchInfo(m.batch_id);
    const productName = info?.product?.nom || m.product_name || '';
    const batchNum = info?.batch?.numero_lot || '';
    const serieNum = info?.batch?.numero_serie || '';
    
    if (filters.product && productName !== filters.product) return false;
    if (filters.batch && batchNum !== filters.batch) return false;
    if (filters.serie && serieNum !== filters.serie) return false;
    if (filters.patient && m.patient_id !== filters.patient) return false;
    
    return true;
  });

  // Export to PDF
  const handleExportPDF = async () => {
    if (filteredMovements.length === 0) {
      toast.error('Aucun mouvement à exporter');
      return;
    }
    
    setExporting(true);
    try {
      // Get timezone offset in minutes (e.g., -300 for Montreal UTC-5)
      const timezoneOffset = new Date().getTimezoneOffset();
      
      const response = await api.post('/movements/export/pdf', {
        type: filterType,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        timezone_offset: timezoneOffset
      }, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const typeSuffix = filterType !== 'all' ? `_${filterType}` : '';
      link.setAttribute('download', `Mouvements${typeSuffix}_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.pdf`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('PDF exporté avec succès');
    } catch (error) {
      toast.error('Erreur lors de l\'export PDF');
    } finally {
      setExporting(false);
    }
  };

  // Export to Excel
  const handleExportExcel = async () => {
    if (filteredMovements.length === 0) {
      toast.error('Aucun mouvement à exporter');
      return;
    }
    
    setExporting(true);
    try {
      // Get timezone offset in minutes (e.g., -300 for Montreal UTC-5)
      const timezoneOffset = new Date().getTimezoneOffset();
      
      const response = await api.post('/movements/export/excel', {
        type: filterType,
        date_from: dateFrom || null,
        date_to: dateTo || null,
        timezone_offset: timezoneOffset
      }, { responseType: 'blob' });
      
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const typeSuffix = filterType !== 'all' ? `_${filterType}` : '';
      link.setAttribute('download', `Mouvements${typeSuffix}_${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}.xlsx`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Excel exporté avec succès');
    } catch (error) {
      toast.error('Erreur lors de l\'export Excel');
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="movements-page">
      {/* Read-only banner */}
      {permissions.isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <Lock className="text-yellow-600" size={20} />
          <span className="text-yellow-800 text-sm font-medium">
            {t('readOnlyMode')} - {t('readOnlyMovements')}
          </span>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
            {t('movementsTitle')}
          </h1>
          <p className="text-gray-600">{t('movementsDescription')}</p>
        </div>
        <div className="flex gap-2">
          {permissions.canCreate && (
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="add-movement-button" className="bg-blue-600 hover:bg-blue-700">
                  <Plus size={20} className="mr-2" />
                  {t('recordMovement')}
                </Button>
              </DialogTrigger>
            <DialogContent data-testid="movement-dialog">
              <DialogHeader>
                <DialogTitle>{t('newMovement')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>{t('movementType')}</Label>
                  <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                    <SelectTrigger data-testid="movement-type-select">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="entrée">{t('entry')}</SelectItem>
                      <SelectItem value="sortie">{t('exit')}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>{t('batch')}</Label>
                  <Select value={formData.batch_id} onValueChange={(value) => setFormData({ ...formData, batch_id: value })}>
                    <SelectTrigger data-testid="movement-batch-select">
                      <SelectValue placeholder="Sélectionner un lot" />
                    </SelectTrigger>
                    <SelectContent>
                      {batches.map((batch) => {
                        const product = products.find(p => p.id === batch.product_id);
                        return (
                          <SelectItem key={batch.id} value={batch.id}>
                            {product?.nom} - Lot {batch.numero_lot} ({batch.quantite_actuelle} dispo)
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
              </div>
              <div>
                <Label>{t('quantity')}</Label>
                <Input
                  data-testid="movement-quantite-input"
                  type="number"
                  min="1"
                  value={formData.quantite}
                  onChange={(e) => setFormData({ ...formData, quantite: e.target.value })}
                  required
                />
              </div>
              {formData.type === 'sortie' && (
                <>
                  <div>
                    <Label>{t('patientNumber')} (optionnel)</Label>
                    <Input
                      data-testid="movement-patient-input"
                      value={formData.patient_id}
                      onChange={(e) => setFormData({ ...formData, patient_id: e.target.value })}
                      placeholder="Ex: PAT-12345"
                    />
                  </div>
                  <div>
                    <Label>ID Intervention (optionnel)</Label>
                    <Input
                      data-testid="movement-intervention-input"
                      value={formData.intervention_id}
                      onChange={(e) => setFormData({ ...formData, intervention_id: e.target.value })}
                      placeholder="Ex: INT-67890"
                    />
                  </div>
                </>
              )}
              <div>
                <Label>{t('reason')} (optionnel)</Label>
                <Textarea
                  data-testid="movement-raison-input"
                  value={formData.raison}
                  onChange={(e) => setFormData({ ...formData, raison: e.target.value })}
                  rows={3}
                />
              </div>
              <Button type="submit" data-testid="movement-submit-button" className="w-full">
                {t('save')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
          )}
        </div>
      </div>

      {/* Filters and Export Section */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-end gap-4">
          <div className="relative inline-block">
            <Button variant="outline" size="sm" onClick={resetAllFilters}>Réinitialiser</Button>
            {filtersOn && (
              <span className="absolute -top-1 -right-1 inline-block w-2.5 h-2.5 rounded-full bg-orange-500" title="Filtres actifs" />
            )}
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label className="text-sm text-gray-600 mb-1 block">{t('filterByType') || 'Filtrer par type'}</Label>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger data-testid="filter-type-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('allTypes') || 'Tous les types'}</SelectItem>
                <SelectItem value="entrée">{t('entry')}</SelectItem>
                <SelectItem value="sortie">{t('exit')}</SelectItem>
                <SelectItem value="Réception">{t('reception') || 'Réception'}</SelectItem>
                <SelectItem value="Réappro">{t('replenishmentType') || 'Réappro'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label className="text-sm text-gray-600 mb-1 block">{t('dateFrom') || 'Date début'}</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              data-testid="filter-date-from"
            />
          </div>
          <div className="flex-1 min-w-[150px]">
            <Label className="text-sm text-gray-600 mb-1 block">{t('dateTo') || 'Date fin'}</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              data-testid="filter-date-to"
            />
          </div>
          <div className="flex gap-2">
            <Button
              onClick={handleExportPDF}
              disabled={exporting || filteredMovements.length === 0}
              variant="outline"
              data-testid="export-pdf-button"
            >
              <Download size={18} className="mr-2" />
              {t('exportPdf') || 'Exporter PDF'}
            </Button>
            <Button
              onClick={handleExportExcel}
              disabled={exporting || filteredMovements.length === 0}
              className="bg-green-600 hover:bg-green-700"
              data-testid="export-excel-button"
            >
              <FileSpreadsheet size={18} className="mr-2" />
              {t('exportExcel') || 'Exporter Excel'}
            </Button>
          </div>
        </div>
        <p className="text-sm text-gray-500 mt-3">
          {filteredMovements.length} {t('movementsFound') || 'mouvement(s) trouvé(s)'}
        </p>
      </div>

      {filteredMovements.length === 0 ? (
        <div className="text-center py-16">
          <TrendingUp size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">{t('noData')}</h3>
          <p className="text-gray-500">{t('recordMovement')}</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <table>
            <thead>
              <tr>
                <th>{t('type')}</th>
                {/* Product */}
                <th>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.product ? 'text-blue-600 font-bold' : ''}`}>
                        <span>{t('product')}</span>
                        {filters.product ? (
                          <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, product: ''}); }} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto max-w-xs">
                      <DropdownMenuItem onClick={() => setFilters({...filters, product: ''})} className={!filters.product ? 'bg-blue-50' : ''}>
                        Tous
                      </DropdownMenuItem>
                      {uniqueProducts.map(val => (
                        <DropdownMenuItem key={val} onClick={() => setFilters({...filters, product: val})} className={`${filters.product === val ? 'bg-blue-50' : ''} truncate`} title={val}>
                          {val}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
                {/* Batch */}
                <th>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.batch ? 'text-blue-600 font-bold' : ''}`}>
                        <span>{t('batch')}</span>
                        {filters.batch ? (
                          <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, batch: ''}); }} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">
                      <DropdownMenuItem onClick={() => setFilters({...filters, batch: ''})} className={!filters.batch ? 'bg-blue-50' : ''}>
                        Tous
                      </DropdownMenuItem>
                      {uniqueBatches.map(val => (
                        <DropdownMenuItem key={val} onClick={() => setFilters({...filters, batch: val})} className={filters.batch === val ? 'bg-blue-50' : ''}>
                          {val}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
                {/* Serial Number */}
                <th>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.serie ? 'text-blue-600 font-bold' : ''}`}>
                        <span>N° Série</span>
                        {filters.serie ? (
                          <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, serie: ''}); }} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">
                      <DropdownMenuItem onClick={() => setFilters({...filters, serie: ''})} className={!filters.serie ? 'bg-blue-50' : ''}>
                        Tous
                      </DropdownMenuItem>
                      {uniqueSeries.map(val => (
                        <DropdownMenuItem key={val} onClick={() => setFilters({...filters, serie: val})} className={filters.serie === val ? 'bg-blue-50' : ''}>
                          {val}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
                <th>{t('quantity')}</th>
                {/* Patient */}
                <th>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.patient ? 'text-blue-600 font-bold' : ''}`}>
                        <span>{t('patientNumber')}</span>
                        {filters.patient ? (
                          <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, patient: ''}); }} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">
                      <DropdownMenuItem onClick={() => setFilters({...filters, patient: ''})} className={!filters.patient ? 'bg-blue-50' : ''}>
                        Tous
                      </DropdownMenuItem>
                      {uniquePatients.map(val => (
                        <DropdownMenuItem key={val} onClick={() => setFilters({...filters, patient: val})} className={filters.patient === val ? 'bg-blue-50' : ''}>
                          {val}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
                <th>{t('reason')}</th>
                <th>{t('creationDate')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredMovements.map((movement) => {
                const info = getBatchInfo(movement.batch_id);
                return (
                  <tr key={movement.id} data-testid="movement-row">
                    <td>
                      <div className="flex items-center gap-2">
                        {movement.type === 'entrée' ? (
                          <ArrowUpCircle size={18} className="text-green-600" />
                        ) : movement.type === 'Réception' ? (
                          <ArrowUpCircle size={18} className="text-purple-600" />
                        ) : movement.type === 'Réappro' ? (
                          <ShoppingCart size={18} className="text-orange-600" />
                        ) : (
                          <ArrowDownCircle size={18} className="text-blue-600" />
                        )}
                        <span className={`badge ${
                          movement.type === 'entrée' ? 'badge-success' : 
                          movement.type === 'Réception' ? 'bg-purple-100 text-purple-800' :
                          movement.type === 'Réappro' ? 'bg-orange-100 text-orange-800' : 'badge-info'
                        }`}>
                          {movement.type === 'entrée' ? t('entry') : 
                           movement.type === 'Réception' ? (t('reception') || 'Réception') :
                           movement.type === 'Réappro' ? (t('replenishmentType') || 'Réappro') : t('exit')}
                        </span>
                      </div>
                    </td>
                    <td className="font-medium">{info?.product?.nom || movement.product_name || 'N/A'}</td>
                    <td className="text-gray-600">{info?.batch?.numero_lot || 'N/A'}</td>
                    <td className="text-gray-600 font-mono text-sm">{info?.batch?.numero_serie || '-'}</td>
                    <td className="font-medium">{movement.quantite}</td>
                    <td className="text-gray-600">{movement.patient_id || '-'}</td>
                    <td className="text-gray-600 max-w-xs" style={{whiteSpace: 'normal', lineHeight: '1.4'}}>
                      <span className="line-clamp-2">{movement.raison || '-'}</span>
                    </td>
                    <td className="text-gray-600">
                      {new Date(movement.timestamp).toLocaleString('fr-FR')}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default Movements;