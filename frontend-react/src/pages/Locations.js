import React, { useState, useEffect, useMemo, useRef } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Plus, CheckCircle, XCircle, ArrowUpAZ, ArrowDownAZ, Lock, Edit2, CheckSquare, Square, ChevronDown, Filter, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';

const Locations = () => {
  const { permissions } = useUser();
  const { t } = useLanguage();
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formData, setFormData] = useState({ armoire: 'A', rangee: 1, colonne: 1, allowed_product_type: '' });
  const [productTypes, setProductTypes] = useState([]);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState(null);
  const [selectedLocations, setSelectedLocations] = useState([]);
  const [bulkEditDialogOpen, setBulkEditDialogOpen] = useState(false);
  const [bulkProductType, setBulkProductType] = useState('');
  
  // Column filter dropdowns
  const [openFilter, setOpenFilter] = useState(null); // which filter dropdown is open

  // Filters & sorting state (persisted)
  const [search, setSearch] = useState(localStorage.getItem('loc_search') || '');
  const [statusFilter, setStatusFilter] = useState(localStorage.getItem('loc_status') || 'all');
  const [armoireFilter, setArmoireFilter] = useState(localStorage.getItem('loc_armoire') || 'all');
  const [typeFilter, setTypeFilter] = useState(localStorage.getItem('loc_type') || 'all');
  const [produitFilter, setProduitFilter] = useState(localStorage.getItem('loc_produit') || '');
  const [referenceFilter, setReferenceFilter] = useState(localStorage.getItem('loc_reference') || '');
  const [lotFilter, setLotFilter] = useState(localStorage.getItem('loc_lot') || '');
  const [serieFilter, setSerieFilter] = useState(localStorage.getItem('loc_serie') || '');
  const [codeFilter, setCodeFilter] = useState(localStorage.getItem('loc_code') || '');
  const [grmFilter, setGrmFilter] = useState(localStorage.getItem('loc_grm') || '');
  const [sort, setSort] = useState(() => {
    const raw = localStorage.getItem('loc_sort');
    return raw ? JSON.parse(raw) : { key: 'composite', dir: 'asc' };
  });

  const filtersOn = (search?.trim()?.length > 0) || statusFilter !== 'all' || armoireFilter !== 'all' || typeFilter !== 'all' || produitFilter || referenceFilter || lotFilter || serieFilter || codeFilter || grmFilter;

  useEffect(() => {
    localStorage.setItem('loc_search', search);
    localStorage.setItem('loc_status', statusFilter);
    localStorage.setItem('loc_armoire', armoireFilter);
    localStorage.setItem('loc_type', typeFilter);
    localStorage.setItem('loc_produit', produitFilter);
    localStorage.setItem('loc_reference', referenceFilter);
    localStorage.setItem('loc_lot', lotFilter);
    localStorage.setItem('loc_serie', serieFilter);
    localStorage.setItem('loc_code', codeFilter);
    localStorage.setItem('loc_grm', grmFilter);
    localStorage.setItem('loc_sort', JSON.stringify(sort));
  }, [search, statusFilter, armoireFilter, typeFilter, produitFilter, referenceFilter, lotFilter, serieFilter, codeFilter, grmFilter, sort]);

  useEffect(() => {
    fetchLocations();
    fetchProductTypes();
  }, []);

  const fetchLocations = async () => {
    try {
      const response = await api.get('/locations');
      setLocations(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des emplacements');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductTypes = async () => {
    try {
      const response = await api.get('/products/types');
      setProductTypes(response.data.types || []);
    } catch (error) {
      console.error('Error fetching product types:', error);
    }
  };

  const generateCode = (armoire, rangee, colonne) => `${armoire}-R${String(rangee).padStart(2, '0')}-C${String(colonne).padStart(2, '0')}`;
  const generateQRCode = (code) => `${code}-${Date.now()}`;

  // Parse location code to extract numeric parts for proper sorting
  const parseCode = (code) => {
    if (!code) return { armoire: '', rangee: 0, colonne: 0 };
    const parts = code.split('-');
    if (parts.length === 3) {
      const armoire = parts[0];
      const rangee = parseInt(parts[1].replace('R', '')) || 0;
      const colonne = parseInt(parts[2].replace('C', '')) || 0;
      return { armoire, rangee, colonne };
    }
    return { armoire: code, rangee: 0, colonne: 0 };
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.allowed_product_type) {
      toast.error('Veuillez sélectionner un type de produit');
      return;
    }
    const code = generateCode(formData.armoire, formData.rangee, formData.colonne);
    const qr_code = generateQRCode(code);
    try {
      await api.post('/locations', { code, qr_code, ...formData });
      toast.success('Emplacement créé avec succès');
      setDialogOpen(false);
      setFormData({ armoire: 'A', rangee: 1, colonne: 1, allowed_product_type: '' });
      fetchLocations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Une erreur est survenue');
    }
  };

  const handleEditLocation = (location) => {
    setEditingLocation(location);
    setEditDialogOpen(true);
  };

  const handleUpdateLocation = async (e) => {
    e.preventDefault();
    if (!editingLocation) return;
    
    try {
      await api.put(`/locations/${editingLocation.id}`, {
        allowed_product_type: editingLocation.allowed_product_type
      });
      toast.success('Emplacement mis à jour');
      setEditDialogOpen(false);
      setEditingLocation(null);
      fetchLocations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Une erreur est survenue');
    }
  };

  // Selection handlers
  const toggleSelectLocation = (locationId) => {
    setSelectedLocations(prev => 
      prev.includes(locationId) 
        ? prev.filter(id => id !== locationId)
        : [...prev, locationId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedLocations.length === filteredSorted.length) {
      setSelectedLocations([]);
    } else {
      setSelectedLocations(filteredSorted.map(l => l.id));
    }
  };

  const handleBulkUpdate = async (e) => {
    e.preventDefault();
    if (!bulkProductType || selectedLocations.length === 0) return;
    
    try {
      // Update all selected locations
      await Promise.all(
        selectedLocations.map(id => 
          api.put(`/locations/${id}`, { allowed_product_type: bulkProductType })
        )
      );
      toast.success(`${selectedLocations.length} emplacement(s) mis à jour`);
      setBulkEditDialogOpen(false);
      setBulkProductType('');
      setSelectedLocations([]);
      fetchLocations();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Une erreur est survenue');
    }
  };

  // Reset all filters
  const resetAllFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setArmoireFilter('all');
    setTypeFilter('all');
    setProduitFilter('');
    setReferenceFilter('');
    setLotFilter('');
    setSerieFilter('');
    setCodeFilter('');
    setGrmFilter('');
  };

  // Toggle sort for a column
  const toggleSort = (key) => {
    setSort(prev => ({
      key,
      dir: prev.key === key && prev.dir === 'asc' ? 'desc' : 'asc'
    }));
  };

  // Get sort icon for a column
  const getSortIcon = (key) => {
    if (sort.key !== key) return null;
    return sort.dir === 'asc' ? <ArrowUpAZ size={14} className="inline ml-1" /> : <ArrowDownAZ size={14} className="inline ml-1" />;
  };

  // Get unique values for column filters
  const getUniqueValues = (key) => {
    const values = locations
      .map(l => l[key])
      .filter(v => v && v !== '-' && v !== '—' && v.toString().trim() !== '')
      .sort();
    return [...new Set(values)];
  };

  const uniqueCodes = useMemo(() => getUniqueValues('code'), [locations]);
  const uniqueTypes = useMemo(() => getUniqueValues('allowed_product_type'), [locations]);
  const uniqueProduits = useMemo(() => getUniqueValues('product_name'), [locations]);
  const uniqueReferences = useMemo(() => getUniqueValues('product_reference'), [locations]);
  const uniqueGrms = useMemo(() => getUniqueValues('product_numero_grm'), [locations]);
  const uniqueLots = useMemo(() => getUniqueValues('batch_numero_lot'), [locations]);
  const uniqueSeries = useMemo(() => getUniqueValues('batch_numero_serie'), [locations]);

  const availableCount = locations.filter(l => !l.occupied).length;
  const unconfiguredCount = locations.filter(l => !l.allowed_product_type).length;

  // Derived list with filters and sorting
  const filteredSorted = useMemo(() => {
    let list = [...locations];
    // Filter by status
    if (statusFilter === 'available') list = list.filter(l => !l.occupied);
    if (statusFilter === 'occupied') list = list.filter(l => !!l.occupied);
    // Filter by armoire
    if (armoireFilter !== 'all') list = list.filter(l => String(l.armoire) === String(armoireFilter));
    // Search filter
    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter(l => (
        (l.code || '').toLowerCase().includes(q) ||
        (l.product_name || '').toLowerCase().includes(q) ||
        (l.product_reference || '').toLowerCase().includes(q) ||
        (l.product_numero_grm || '').toLowerCase().includes(q) ||
        (l.batch_numero_serie || '').toLowerCase().includes(q) ||
        (l.batch_numero_lot || '').toLowerCase().includes(q) ||
        (l.allowed_product_type || '').toLowerCase().includes(q)
      ));
    }
    
    // Type filter
    if (typeFilter !== 'all') {
      list = list.filter(l => l.allowed_product_type === typeFilter);
    }
    
    // Column filters (exact match from dropdown)
    if (codeFilter) {
      list = list.filter(l => l.code === codeFilter);
    }
    if (produitFilter) {
      list = list.filter(l => l.product_name === produitFilter);
    }
    if (referenceFilter) {
      list = list.filter(l => l.product_reference === referenceFilter);
    }
    if (grmFilter) {
      list = list.filter(l => l.product_numero_grm === grmFilter);
    }
    if (lotFilter) {
      list = list.filter(l => l.batch_numero_lot === lotFilter);
    }
    if (serieFilter) {
      list = list.filter(l => l.batch_numero_serie === serieFilter);
    }
    
    // Sorting with proper numeric comparison
    const dir = sort.dir === 'asc' ? 1 : -1;
    list.sort((a, b) => {
      const key = sort.key;
      const val = (v) => (v ?? '').toString().toLowerCase();
      if (key === 'composite' || key === 'code') {
        // Parse codes for proper numeric sorting
        const pa = parseCode(a.code);
        const pb = parseCode(b.code);
        // Compare armoire first
        if (pa.armoire !== pb.armoire) {
          return (pa.armoire > pb.armoire ? 1 : -1) * dir;
        }
        // Then rangee (numeric)
        if (pa.rangee !== pb.rangee) {
          return (pa.rangee - pb.rangee) * dir;
        }
        // Then colonne (numeric)
        return (pa.colonne - pb.colonne) * dir;
      }
      if (key === 'produit') return (val(a.product_name) > val(b.product_name) ? 1 : val(a.product_name) < val(b.product_name) ? -1 : 0) * dir;
      if (key === 'reference') return (val(a.product_reference) > val(b.product_reference) ? 1 : val(a.product_reference) < val(b.product_reference) ? -1 : 0) * dir;
      if (key === 'grm') return (val(a.product_numero_grm) > val(b.product_numero_grm) ? 1 : val(a.product_numero_grm) < val(b.product_numero_grm) ? -1 : 0) * dir;
      if (key === 'serie') return (val(a.batch_numero_serie) > val(b.batch_numero_serie) ? 1 : val(a.batch_numero_serie) < val(b.batch_numero_serie) ? -1 : 0) * dir;
      if (key === 'lot') return (val(a.batch_numero_lot) > val(b.batch_numero_lot) ? 1 : val(a.batch_numero_lot) < val(b.batch_numero_lot) ? -1 : 0) * dir;
      if (key === 'status') return ((a.occupied ? 1 : 0) - (b.occupied ? 1 : 0)) * dir;
      if (key === 'type') return (val(a.allowed_product_type) > val(b.allowed_product_type) ? 1 : val(a.allowed_product_type) < val(b.allowed_product_type) ? -1 : 0) * dir;
      return 0;
    });
    return list;
  }, [locations, search, statusFilter, armoireFilter, typeFilter, codeFilter, produitFilter, referenceFilter, grmFilter, lotFilter, serieFilter, sort]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="locations-page">
      {/* Read-only banner */}
      {permissions.isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <Lock className="text-yellow-600" size={20} />
          <span className="text-yellow-800 text-sm font-medium">
            {t('readOnlyMode')} - {t('readOnlyLocations')}
          </span>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>{t('locationsTitle')}</h1>
          <p className="text-gray-600">{t('locationsDescription')}</p>
        </div>
        {permissions.canCreate && (
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button data-testid="add-location-button" className="bg-blue-600 hover:bg-blue-700">
                <Plus size={20} className="mr-2" />
                {t('addLocation')}
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{t('newLocation')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <Label>{t('cabinet')}</Label>
                  <Input data-testid="armoire-input" value={formData.armoire}
                    onChange={(e) => setFormData({ ...formData, armoire: e.target.value.toUpperCase() })}
                    placeholder="A, B, C..." maxLength={1} required />
                </div>
                <div>
                  <Label>{t('row')}</Label>
                  <Input data-testid="rangee-input" type="number" min="1" value={formData.rangee}
                    onChange={(e) => setFormData({ ...formData, rangee: parseInt(e.target.value) })} required />
                </div>
                <div>
                  <Label>{t('column')}</Label>
                  <Input data-testid="colonne-input" type="number" min="1" value={formData.colonne}
                    onChange={(e) => setFormData({ ...formData, colonne: parseInt(e.target.value) })} required />
                </div>
                <div>
                  <Label>{t('productType')} *</Label>
                  <select 
                    className="w-full border rounded px-3 py-2 mt-1"
                    value={formData.allowed_product_type}
                    onChange={(e) => setFormData({ ...formData, allowed_product_type: e.target.value })}
                    required
                  >
                    <option value="">{t('selectProductType')}</option>
                    {productTypes.map(type => (
                      <option key={type} value={type}>{type}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">{t('productTypeHelp')}</p>
                </div>
                <div className="p-3 bg-blue-50 rounded-lg">
                  <p className="text-sm text-gray-600">{t('generatedCode')}:</p>
                  <p className="font-medium text-blue-600">{generateCode(formData.armoire, formData.rangee, formData.colonne)}</p>
                </div>
                <Button type="submit" className="w-full">{t('createLocation')}</Button>
              </form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Warning banner for unconfigured locations */}
      {unconfiguredCount > 0 && (
        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-orange-800 font-medium">
            ⚠️ {unconfiguredCount} emplacement(s) sans type de produit configuré
          </p>
          <p className="text-orange-700 text-sm mt-1">
            Ces emplacements ne peuvent pas recevoir de produits. Sélectionnez-les et cliquez sur "Modifier la sélection" pour configurer le type en masse.
          </p>
        </div>
      )}

      {/* Selection action bar */}
      {selectedLocations.length > 0 && (
        <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between">
          <span className="text-blue-800 font-medium">
            {selectedLocations.length} emplacement(s) sélectionné(s)
          </span>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedLocations([])}>
              Désélectionner tout
            </Button>
            <Button size="sm" className="bg-blue-600 hover:bg-blue-700" onClick={() => setBulkEditDialogOpen(true)}>
              <Edit2 size={16} className="mr-2" />
              Modifier la sélection
            </Button>
          </div>
        </div>
      )}

      {/* Edit Location Dialog (single) */}
      <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier l'emplacement {editingLocation?.code}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleUpdateLocation} className="space-y-4">
            <div>
              <Label>{t('productType')} *</Label>
              <select 
                className="w-full border rounded px-3 py-2 mt-1"
                value={editingLocation?.allowed_product_type || ''}
                onChange={(e) => setEditingLocation({ ...editingLocation, allowed_product_type: e.target.value })}
                required
              >
                <option value="">{t('selectProductType')}</option>
                {productTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setEditDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" className="flex-1">{t('save')}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Bulk Edit Dialog */}
      <Dialog open={bulkEditDialogOpen} onOpenChange={setBulkEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Modifier {selectedLocations.length} emplacement(s)</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleBulkUpdate} className="space-y-4">
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600 mb-2">Emplacements sélectionnés :</p>
              <div className="flex flex-wrap gap-1 max-h-24 overflow-y-auto">
                {selectedLocations.map(id => {
                  const loc = locations.find(l => l.id === id);
                  return loc ? (
                    <span key={id} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded">
                      {loc.code}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
            <div>
              <Label>{t('productType')} *</Label>
              <select 
                className="w-full border rounded px-3 py-2 mt-1"
                value={bulkProductType}
                onChange={(e) => setBulkProductType(e.target.value)}
                required
              >
                <option value="">{t('selectProductType')}</option>
                {productTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
              <p className="text-xs text-gray-500 mt-1">
                Ce type sera appliqué à tous les emplacements sélectionnés
              </p>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setBulkEditDialogOpen(false)}>
                {t('cancel')}
              </Button>
              <Button type="submit" className="flex-1 bg-blue-600 hover:bg-blue-700">
                Appliquer à {selectedLocations.length} emplacement(s)
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Filters & sorting */}
      <div className="card mb-6">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative inline-block">
            <Button
              variant="outline"
              onClick={() => {
                resetAllFilters();
                setSort({ key: 'composite', dir: 'asc' });
              }}
            >
              Réinitialiser
            </Button>
            {filtersOn && (
              <span
                className="absolute -top-1 -right-1 inline-block w-2.5 h-2.5 rounded-full bg-orange-500"
                title="Filtres actifs"
              />
            )}
          </div>
          <div className="flex-1 min-w-[200px] max-w-[400px]">
            <Input
              placeholder="Recherche (code, produit, type...)"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label={t('search')}
            />
          </div>
          <div>
            <Label className="text-xs text-gray-500">{t('status')}</Label>
            <select className="ml-2 border rounded px-2 py-1" value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}>
              <option value="all">{t('all')}</option>
              <option value="available">{t('available')}</option>
              <option value="occupied">{t('occupied')}</option>
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">{t('cabinet')}</Label>
            <select className="ml-2 border rounded px-2 py-1" value={armoireFilter}
              onChange={(e) => setArmoireFilter(e.target.value)}>
              <option value="all">{t('allCabinets')}</option>
              {[...new Set(locations.map(l => l.armoire))].map(a => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">Type produit</Label>
            <select className="ml-2 border rounded px-2 py-1" value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}>
              <option value="all">Tous</option>
              {productTypes.map(type => (
                <option key={type} value={type}>{type}</option>
              ))}
            </select>
          </div>
          <div>
            <Label className="text-xs text-gray-500">{t('sortBy')}</Label>
            <select className="ml-2 border rounded px-2 py-1" value={sort.key}
              onChange={(e) => setSort({ ...sort, key: e.target.value })}>
              <option value="composite">{t('code')} (A-R01-C01...)</option>
              <option value="produit">{t('products')}</option>
              <option value="reference">{t('reference')}</option>
              <option value="grm">{t('grmNumber')}</option>
              <option value="lot">{t('lotNumber')}</option>
              <option value="serie">{t('serialNumber')}</option>
              <option value="status">{t('status')}</option>
            </select>
            <Button variant="outline" className="ml-2" onClick={() => setSort({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })}>
              {sort.dir === 'asc' ? <ArrowDownAZ size={16} /> : <ArrowUpAZ size={16} />}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card"><p className="text-sm font-medium text-gray-500 mb-1">{t('totalLocations')}</p><p className="text-3xl font-bold text-gray-900">{locations.length}</p></div>
        <div className="card"><p className="text-sm font-medium text-gray-500 mb-1">{t('availableLocations')}</p><p className="text-3xl font-bold text-green-600">{availableCount}</p></div>
        <div className="card"><p className="text-sm font-medium text-gray-500 mb-1">{t('occupiedLocations')}</p><p className="text-3xl font-bold text-orange-600">{locations.length - availableCount}</p></div>
      </div>

      <div className="card overflow-x-auto table-container">
        <table>
          <thead>
            <tr>
              <th style={{width:'4%'}}>
                <button 
                  onClick={toggleSelectAll}
                  className="p-1 hover:bg-gray-100 rounded"
                  title={selectedLocations.length === filteredSorted.length ? "Désélectionner tout" : "Sélectionner tout"}
                >
                  {selectedLocations.length === filteredSorted.length && filteredSorted.length > 0 ? (
                    <CheckSquare size={18} className="text-blue-600" />
                  ) : (
                    <Square size={18} className="text-gray-400" />
                  )}
                </button>
              </th>
              {/* CODE column - with dropdown filter */}
              <th style={{width:'10%', minWidth:'120px'}}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${codeFilter ? 'text-blue-600 font-bold' : ''}`}>
                      <span>{t('code')}</span>
                      {codeFilter ? (
                        <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setCodeFilter(''); }} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 overflow-y-auto">
                    <DropdownMenuItem onClick={() => setCodeFilter('')} className={!codeFilter ? 'bg-blue-50' : ''}>
                      Tous
                    </DropdownMenuItem>
                    {uniqueCodes.map(val => (
                      <DropdownMenuItem key={val} onClick={() => setCodeFilter(val)} className={codeFilter === val ? 'bg-blue-50' : ''}>
                        {val}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </th>
              {/* TYPE column - with dropdown filter and sorting */}
              <th style={{width:'12%'}}>
                <div className="flex items-center gap-1">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors ${typeFilter !== 'all' ? 'text-blue-600 font-bold' : ''}`}>
                        <span>{t('productType')}</span>
                        {typeFilter !== 'all' ? (
                          <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setTypeFilter('all'); }} />
                        ) : (
                          <ChevronDown size={14} />
                        )}
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent className="max-h-64 overflow-y-auto">
                      <DropdownMenuItem onClick={() => setTypeFilter('all')} className={typeFilter === 'all' ? 'bg-blue-50' : ''}>
                        Tous
                      </DropdownMenuItem>
                      {uniqueTypes.map(val => (
                        <DropdownMenuItem key={val} onClick={() => setTypeFilter(val)} className={typeFilter === val ? 'bg-blue-50' : ''}>
                          {val}
                        </DropdownMenuItem>
                      ))}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <button 
                    onClick={() => toggleSort('type')} 
                    className={`p-1 rounded hover:bg-gray-100 ${sort.key === 'type' ? 'text-blue-600' : 'text-gray-400'}`}
                    title="Trier par type"
                  >
                    {sort.key === 'type' ? (sort.dir === 'asc' ? <ArrowUpAZ size={14} /> : <ArrowDownAZ size={14} />) : <ArrowUpAZ size={14} />}
                  </button>
                </div>
              </th>
              {/* STATUS column - with dropdown filter */}
              <th style={{width:'6%'}}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${statusFilter !== 'all' ? 'text-blue-600 font-bold' : ''}`}>
                      <span>{t('status')}</span>
                      {statusFilter !== 'all' ? (
                        <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setStatusFilter('all'); }} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent>
                    <DropdownMenuItem onClick={() => setStatusFilter('all')} className={statusFilter === 'all' ? 'bg-blue-50' : ''}>
                      {t('all')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('available')} className={statusFilter === 'available' ? 'bg-blue-50' : ''}>
                      <CheckCircle size={14} className="text-green-500 mr-2" /> {t('available')}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setStatusFilter('occupied')} className={statusFilter === 'occupied' ? 'bg-blue-50' : ''}>
                      <XCircle size={14} className="text-orange-500 mr-2" /> {t('occupied')}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </th>
              {/* PRODUIT column - with dropdown filter */}
              <th style={{width:'18%'}}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${produitFilter ? 'text-blue-600 font-bold' : ''}`}>
                      <span>{t('products')}</span>
                      {produitFilter ? (
                        <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setProduitFilter(''); }} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 overflow-y-auto max-w-xs">
                    <DropdownMenuItem onClick={() => setProduitFilter('')} className={!produitFilter ? 'bg-blue-50' : ''}>
                      Tous
                    </DropdownMenuItem>
                    {uniqueProduits.map(val => (
                      <DropdownMenuItem key={val} onClick={() => setProduitFilter(val)} className={`${produitFilter === val ? 'bg-blue-50' : ''} truncate`} title={val}>
                        {val}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </th>
              {/* REFERENCE column - with dropdown filter */}
              <th style={{width:'10%'}}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${referenceFilter ? 'text-blue-600 font-bold' : ''}`}>
                      <span>{t('reference')}</span>
                      {referenceFilter ? (
                        <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setReferenceFilter(''); }} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 overflow-y-auto">
                    <DropdownMenuItem onClick={() => setReferenceFilter('')} className={!referenceFilter ? 'bg-blue-50' : ''}>
                      Tous
                    </DropdownMenuItem>
                    {uniqueReferences.map(val => (
                      <DropdownMenuItem key={val} onClick={() => setReferenceFilter(val)} className={referenceFilter === val ? 'bg-blue-50' : ''}>
                        {val}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </th>
              {/* GRM column - with dropdown filter */}
              <th style={{width:'10%'}}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${grmFilter ? 'text-blue-600 font-bold' : ''}`}>
                      <span>{t('grmNumber')}</span>
                      {grmFilter ? (
                        <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setGrmFilter(''); }} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 overflow-y-auto">
                    <DropdownMenuItem onClick={() => setGrmFilter('')} className={!grmFilter ? 'bg-blue-50' : ''}>
                      Tous
                    </DropdownMenuItem>
                    {uniqueGrms.map(val => (
                      <DropdownMenuItem key={val} onClick={() => setGrmFilter(val)} className={grmFilter === val ? 'bg-blue-50' : ''}>
                        {val}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </th>
              {/* LOT column - with dropdown filter */}
              <th style={{width:'9%'}}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${lotFilter ? 'text-blue-600 font-bold' : ''}`}>
                      <span>{t('lotNumber')}</span>
                      {lotFilter ? (
                        <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setLotFilter(''); }} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 overflow-y-auto">
                    <DropdownMenuItem onClick={() => setLotFilter('')} className={!lotFilter ? 'bg-blue-50' : ''}>
                      Tous
                    </DropdownMenuItem>
                    {uniqueLots.map(val => (
                      <DropdownMenuItem key={val} onClick={() => setLotFilter(val)} className={lotFilter === val ? 'bg-blue-50' : ''}>
                        {val}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </th>
              {/* SERIE column - with dropdown filter */}
              <th style={{width:'9%'}}>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${serieFilter ? 'text-blue-600 font-bold' : ''}`}>
                      <span>{t('serialNumber')}</span>
                      {serieFilter ? (
                        <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setSerieFilter(''); }} />
                      ) : (
                        <ChevronDown size={14} />
                      )}
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent className="max-h-64 overflow-y-auto">
                    <DropdownMenuItem onClick={() => setSerieFilter('')} className={!serieFilter ? 'bg-blue-50' : ''}>
                      Tous
                    </DropdownMenuItem>
                    {uniqueSeries.map(val => (
                      <DropdownMenuItem key={val} onClick={() => setSerieFilter(val)} className={serieFilter === val ? 'bg-blue-50' : ''}>
                        {val}
                      </DropdownMenuItem>
                    ))}
                  </DropdownMenuContent>
                </DropdownMenu>
              </th>
              <th style={{width:'4%'}}></th>
            </tr>
          </thead>
          <tbody>
            {filteredSorted.map((location) => (
              <tr 
                key={location.id} 
                data-testid="location-row"
                className={selectedLocations.includes(location.id) ? 'bg-blue-50' : ''}
              >
                <td>
                  <button 
                    onClick={() => toggleSelectLocation(location.id)}
                    className="p-1 hover:bg-gray-100 rounded"
                  >
                    {selectedLocations.includes(location.id) ? (
                      <CheckSquare size={18} className="text-blue-600" />
                    ) : (
                      <Square size={18} className="text-gray-400" />
                    )}
                  </button>
                </td>
                <td className="font-medium truncate" title={location.code}>{location.code}</td>
                <td>
                  {location.allowed_product_type ? (
                    <span className="badge bg-blue-100 text-blue-800 text-xs">{location.allowed_product_type}</span>
                  ) : (
                    <span className="badge bg-red-100 text-red-800 text-xs">Non configuré</span>
                  )}
                </td>
                <td className="text-center">
                  {location.occupied ? (
                    <XCircle size={18} className="text-orange-500 mx-auto" title={t('occupied')} />
                  ) : (
                    <CheckCircle size={18} className="text-green-500 mx-auto" title={t('available')} />
                  )}
                </td>
                <td className="font-medium max-w-[200px]" title={location.product_name || ''}>
                  {location.occupied && location.product_name && location.product_name !== '—' ? (
                    <span className="text-gray-900 line-clamp-2 text-sm leading-tight">{location.product_name}</span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="truncate" title={location.product_reference || ''}>{location.occupied && location.product_reference && location.product_reference !== '—' ? <span className="badge badge-info">{location.product_reference}</span> : <span className="text-gray-400">-</span>}</td>
                <td className="text-gray-600 text-sm truncate" title={location.product_numero_grm || ''}>{location.occupied && location.product_numero_grm && location.product_numero_grm !== '—' ? <span className="truncate block">{location.product_numero_grm}</span> : <span className="text-gray-400">-</span>}</td>
                <td className="text-gray-600 text-sm truncate" title={location.batch_numero_lot || ''}>{location.occupied && location.batch_numero_lot && location.batch_numero_lot !== '—' ? location.batch_numero_lot : <span className="text-gray-400">-</span>}</td>
                <td className="text-gray-600 text-sm truncate" title={location.batch_numero_serie || ''}>{location.occupied && location.batch_numero_serie && location.batch_numero_serie !== '—' ? location.batch_numero_serie : <span className="text-gray-400">-</span>}</td>
                <td>
                  {permissions.canEdit && (
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={() => handleEditLocation(location)}
                      title="Modifier le type de produit"
                    >
                      <Edit2 size={16} className="text-gray-500 hover:text-blue-600" />
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default Locations;
