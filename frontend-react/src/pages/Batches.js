import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Layers, MapPin, AlertTriangle, Lock, ChevronDown, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';

const Batches = () => {
  const { permissions } = useUser();
  const { t } = useLanguage();
  const [batches, setBatches] = useState([]);
  const [products, setProducts] = useState([]);
  const [filteredBatches, setFilteredBatches] = useState([]);
  const [loading, setLoading] = useState(true);

  // Edit batch dialog
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState(null);
  const [editForm, setEditForm] = useState({
    numero_lot: '',
    numero_serie: '',
    code_barre: ''
  });

  // Filters & sorting
  const [filters, setFilters] = useState({ 
    search: '',
    reference: '',
    product: '',
    numero_lot: '',
    numero_serie: '',
    localisation: ''
  });
  const [sortConfig, setSortConfig] = useState({ key: 'date_expiration', direction: 'asc' });
  const filtersOn = Boolean(filters.search || filters.reference || filters.product || filters.numero_lot || filters.numero_serie || filters.localisation);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    filterAndSortBatches();
  }, [batches, products, filters, sortConfig]);

  const fetchData = async () => {
    try {
      const [batchesRes, productsRes] = await Promise.all([
        api.get('/batches'),
        api.get('/products'),
      ]);
      setBatches(batchesRes.data);
      setProducts(productsRes.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
    }
  };

  const getProduct = (productId) => {
    return products.find(p => p.id === productId) || {};
  };

  const filterAndSortBatches = () => {
    // Filter only active batches (quantite_actuelle > 0)
    let activeBatches = batches.filter(b => b.quantite_actuelle > 0);

    // Enrich with product info
    activeBatches = activeBatches.map(batch => {
      const product = getProduct(batch.product_id);
      return {
        ...batch,
        product_name: product.nom || 'Inconnu',
        product_reference: product.reference || '',
      };
    });

    // Apply search filter
    if (filters.search) {
      const q = filters.search.toLowerCase();
      activeBatches = activeBatches.filter(b => {
        return (
          (b.product_name || '').toLowerCase().includes(q) ||
          (b.product_reference || '').toLowerCase().includes(q) ||
          (b.numero_lot || '').toLowerCase().includes(q) ||
          (b.numero_serie || '').toLowerCase().includes(q) ||
          (b.localisation || '').toLowerCase().includes(q)
        );
      });
    }

    // Column filters (exact match)
    if (filters.reference) {
      activeBatches = activeBatches.filter(b => b.product_reference === filters.reference);
    }
    if (filters.product) {
      activeBatches = activeBatches.filter(b => b.product_name === filters.product);
    }
    if (filters.numero_lot) {
      activeBatches = activeBatches.filter(b => b.numero_lot === filters.numero_lot);
    }
    if (filters.numero_serie) {
      activeBatches = activeBatches.filter(b => b.numero_serie === filters.numero_serie);
    }
    if (filters.localisation) {
      activeBatches = activeBatches.filter(b => b.localisation === filters.localisation);
    }

    // Sort
    const dir = sortConfig.direction === 'asc' ? 1 : -1;
    activeBatches.sort((a, b) => {
      const key = sortConfig.key;
      if (key === 'date_expiration') return (new Date(a.date_expiration) - new Date(b.date_expiration)) * dir;
      if (key === 'product') return (a.product_name > b.product_name ? 1 : -1) * dir;
      if (key === 'reference') return (a.product_reference > b.product_reference ? 1 : -1) * dir;
      if (key === 'numero_lot') return ((a.numero_lot || '') > (b.numero_lot || '') ? 1 : -1) * dir;
      if (key === 'numero_serie') return ((a.numero_serie || '') > (b.numero_serie || '') ? 1 : -1) * dir;
      if (key === 'localisation') return ((a.localisation || '') > (b.localisation || '') ? 1 : -1) * dir;
      return 0;
    });

    setFilteredBatches(activeBatches);
  };

  const handleSort = (key) => {
    setSortConfig(prev => ({ key, direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc' }));
  };

  const getSortIcon = (key) => {
    if (sortConfig.key !== key) return '⇅';
    return sortConfig.direction === 'asc' ? '↑' : '↓';
  };

  const resetFilters = () => {
    setFilters({ search: '', reference: '', product: '', numero_lot: '', numero_serie: '', localisation: '' });
    setSortConfig({ key: 'date_expiration', direction: 'asc' });
  };

  // Get unique values for column filters from enriched batches
  const enrichedBatches = useMemo(() => {
    return batches.filter(b => b.quantite_actuelle > 0).map(batch => {
      const product = getProduct(batch.product_id);
      return {
        ...batch,
        product_name: product.nom || 'Inconnu',
        product_reference: product.reference || '',
      };
    });
  }, [batches, products]);

  const uniqueReferences = useMemo(() => [...new Set(enrichedBatches.map(b => b.product_reference).filter(Boolean))].sort(), [enrichedBatches]);
  const uniqueProducts = useMemo(() => [...new Set(enrichedBatches.map(b => b.product_name).filter(Boolean))].sort(), [enrichedBatches]);
  const uniqueLots = useMemo(() => [...new Set(enrichedBatches.map(b => b.numero_lot).filter(Boolean))].sort(), [enrichedBatches]);
  const uniqueSeries = useMemo(() => [...new Set(enrichedBatches.map(b => b.numero_serie).filter(Boolean))].sort(), [enrichedBatches]);
  const uniqueLocalisations = useMemo(() => [...new Set(enrichedBatches.map(b => b.localisation).filter(Boolean))].sort(), [enrichedBatches]);

  const getDaysUntilExpiration = (expirationDate) => {
    const now = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const getExpirationBadge = (daysUntilExp) => {
    if (daysUntilExp <= 0) return 'badge-danger';
    if (daysUntilExp <= 30) return 'badge-warning';
    if (daysUntilExp <= 90) return 'badge-info';
    return 'badge-success';
  };

  const openEditDialog = (batch) => {
    setEditingBatch(batch);
    setEditForm({
      numero_lot: batch.numero_lot || '',
      numero_serie: batch.numero_serie || '',
      code_barre: batch.code_barre || ''
    });
    setEditDialogOpen(true);
  };

  const handleSaveBatch = async () => {
    if (!editingBatch) return;
    
    try {
      await api.put(`/batches/${editingBatch.id}`, {
        ...editingBatch,
        numero_lot: editForm.numero_lot,
        numero_serie: editForm.numero_serie,
        code_barre: editForm.code_barre
      });

      toast.success('Lot/Série mis à jour avec succès');
      setEditDialogOpen(false);
      fetchData();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
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
    <div className="p-8" data-testid="batches-page">
      {/* Read-only banner */}
      {permissions.isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <Lock className="text-yellow-600" size={20} />
          <span className="text-yellow-800 text-sm font-medium">
            {t('readOnlyMode')} - {t('readOnlyProducts')}
          </span>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
            {t('batchManagement')}
          </h1>
          <p className="text-gray-600">Une ligne par numéro de série unique</p>
        </div>
      </div>

      {/* Filters */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative inline-block">
            <Button variant="outline" size="sm" onClick={resetFilters}>{t('reset')}</Button>
            {filtersOn && (
              <span className="absolute -top-1 -right-1 inline-block w-2.5 h-2.5 rounded-full bg-orange-500" title="Filtres actifs" />
            )}
          </div>
          <div className="flex-1 min-w-[200px] max-w-[400px]">
            <Input
              placeholder={t('search')}
              value={filters.search}
              onChange={(e) => setFilters({ ...filters, search: e.target.value })}
              aria-label={t('search')}
            />
          </div>
          <div className="text-sm text-gray-500">
            {filteredBatches.length} unité(s) en stock
          </div>
        </div>
      </div>

      {filteredBatches.length === 0 ? (
        <div className="text-center py-16">
          <Layers size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">{t('noData')}</h3>
          <p className="text-gray-500">{t('noData')}</p>
          {filtersOn && (
            <div className="mt-4">
              <Button variant="outline" onClick={resetFilters}>{t('reset')}</Button>
            </div>
          )}
        </div>
      ) : (
        <div className="card overflow-x-auto">
          <table>
            <thead>
              <tr>
                {/* Reference */}
                <th style={{width: '10%'}}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.reference ? 'text-blue-600 font-bold' : ''}`}>
                        <span>{t('catalogNumber')}</span>
                        {filters.reference ? (
                          <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, reference: ''}); }} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">
                      <DropdownMenuItem onClick={() => setFilters({...filters, reference: ''})} className={!filters.reference ? 'bg-blue-50' : ''}>
                        Tous
                      </DropdownMenuItem>
                      {uniqueReferences.map(val => (
                        <DropdownMenuItem key={val} onClick={() => setFilters({...filters, reference: val})} className={filters.reference === val ? 'bg-blue-50' : ''}>
                          {val}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
                {/* Product */}
                <th style={{width: '25%'}}>
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
                {/* Lot Number */}
                <th style={{width: '10%'}}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.numero_lot ? 'text-blue-600 font-bold' : ''}`}>
                        <span>{t('lotNumber')}</span>
                        {filters.numero_lot ? (
                          <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, numero_lot: ''}); }} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">
                      <DropdownMenuItem onClick={() => setFilters({...filters, numero_lot: ''})} className={!filters.numero_lot ? 'bg-blue-50' : ''}>
                        Tous
                      </DropdownMenuItem>
                      {uniqueLots.map(val => (
                        <DropdownMenuItem key={val} onClick={() => setFilters({...filters, numero_lot: val})} className={filters.numero_lot === val ? 'bg-blue-50' : ''}>
                          {val}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
                {/* Serial Number */}
                <th style={{width: '12%'}}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.numero_serie ? 'text-blue-600 font-bold' : ''}`}>
                        <span>{t('serialNumber')}</span>
                        {filters.numero_serie ? (
                          <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, numero_serie: ''}); }} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">
                      <DropdownMenuItem onClick={() => setFilters({...filters, numero_serie: ''})} className={!filters.numero_serie ? 'bg-blue-50' : ''}>
                        Tous
                      </DropdownMenuItem>
                      {uniqueSeries.map(val => (
                        <DropdownMenuItem key={val} onClick={() => setFilters({...filters, numero_serie: val})} className={filters.numero_serie === val ? 'bg-blue-50' : ''}>
                          {val}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
                {/* Location */}
                <th style={{width: '10%'}}>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.localisation ? 'text-blue-600 font-bold' : ''}`}>
                        <span>{t('location')}</span>
                        {filters.localisation ? (
                          <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, localisation: ''}); }} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">
                      <DropdownMenuItem onClick={() => setFilters({...filters, localisation: ''})} className={!filters.localisation ? 'bg-blue-50' : ''}>
                        Tous
                      </DropdownMenuItem>
                      {uniqueLocalisations.map(val => (
                        <DropdownMenuItem key={val} onClick={() => setFilters({...filters, localisation: val})} className={filters.localisation === val ? 'bg-blue-50' : ''}>
                          {val}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </th>
                <th style={{width: '15%'}} onClick={() => handleSort('date_expiration')} className="cursor-pointer hover:bg-gray-100">
                  {t('expirationDate')} {getSortIcon('date_expiration')}
                </th>
                <th style={{width: '10%'}} className="text-center">{t('actions')}</th>
              </tr>
            </thead>
            <tbody>
              {filteredBatches.map((batch) => {
                const daysUntilExp = getDaysUntilExpiration(batch.date_expiration);
                const isExpired = daysUntilExp <= 0;
                const isCritical = daysUntilExp > 0 && daysUntilExp < 10;
                const isExpiringSoon = daysUntilExp >= 10 && daysUntilExp <= 30;
                
                // Determine row background color
                let rowColor = '';
                if (isExpired || isCritical) {
                  rowColor = 'bg-red-50';
                } else if (isExpiringSoon) {
                  rowColor = 'bg-yellow-50';
                }
                
                return (
                  <tr key={batch.id} data-testid="batch-row" className={rowColor}>
                    <td className="text-gray-600 text-sm">{batch.product_reference}</td>
                    <td className="font-medium">{batch.product_name}</td>
                    <td className="text-gray-600">{batch.numero_lot || '-'}</td>
                    <td className="font-mono text-sm font-medium text-blue-700">{batch.numero_serie || '-'}</td>
                    <td className="font-mono text-sm">{batch.localisation || '-'}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <span className={`badge ${getExpirationBadge(daysUntilExp)}`}>
                          {batch.date_expiration ? new Date(batch.date_expiration).toLocaleDateString('fr-FR') : '-'}
                        </span>
                        {isExpired && (
                          <AlertTriangle size={16} className="text-red-600" />
                        )}
                        {isCritical && (
                          <span className="text-red-600 text-xs font-bold">({daysUntilExp}j)</span>
                        )}
                        {isExpiringSoon && (
                          <span className="text-orange-600 text-xs">({daysUntilExp}j)</span>
                        )}
                      </div>
                    </td>
                    <td className="text-center">
                      {permissions.canEdit && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => openEditDialog(batch)}
                          className="text-green-600 hover:text-green-700"
                        >
                          {t('edit')}
                        </Button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Edit Batch Dialog */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('edit')} {t('batch')}</DialogTitle>
          </DialogHeader>
          {editingBatch && (
            <div className="space-y-4">
              <div className="bg-blue-50 p-3 rounded-lg">
                <p className="text-sm font-medium text-blue-900">
                  {editingBatch.product_name || t('product')}
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  📍 {editingBatch.localisation || '-'}
                </p>
              </div>

              <div>
                <Label htmlFor="numero_lot">{t('lotNumber')}</Label>
                <Input
                  id="numero_lot"
                  value={editForm.numero_lot}
                  onChange={(e) => setEditForm({ ...editForm, numero_lot: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="numero_serie">{t('serialNumber')}</Label>
                <Input
                  id="numero_serie"
                  value={editForm.numero_serie}
                  onChange={(e) => setEditForm({ ...editForm, numero_serie: e.target.value })}
                />
              </div>

              <div>
                <Label htmlFor="code_barre">{t('barcode')}</Label>
                <Input
                  id="code_barre"
                  value={editForm.code_barre}
                  onChange={(e) => setEditForm({ ...editForm, code_barre: e.target.value })}
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  variant="outline"
                  onClick={() => setEditDialogOpen(false)}
                >
                  {t('cancel')}
                </Button>
                <Button
                  onClick={handleSaveBatch}
                  className="bg-green-600 hover:bg-green-700"
                >
                  {t('save')}
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Batches;
