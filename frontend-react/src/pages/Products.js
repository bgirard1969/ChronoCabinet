import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Plus, Edit, Package, Trash2, Copy, ArrowDownAZ, ArrowUpAZ, Lock, ChevronDown, X } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from '@/components/ui/dropdown-menu';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';

const Products = () => {
  const { permissions } = useUser();
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [filteredProducts, setFilteredProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [copyDialogOpen, setCopyDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [productToDelete, setProductToDelete] = useState(null);
  const [productToCopy, setProductToCopy] = useState(null);
  const [copyFormData, setCopyFormData] = useState({
    nom: '',
    type: '',
    fabricant: '',
    reference: '',
    numero_grm: '',
    stock_minimum: 5,
    stock_maximum: 50,
  });
  const [editingProduct, setEditingProduct] = useState(null);
  const [formData, setFormData] = useState({
    nom: '',
    type: '',
    fabricant: '',
    reference: '',
    numero_grm: '',
    stock_minimum: 5,
    stock_maximum: 50,
  });
  
  // Options for dropdowns (from existing products)
  const [productOptions, setProductOptions] = useState({ fabricants: [], types: [] });
  
  // Filter and sort states
  const [filters, setFilters] = useState({
    search: '',
    type: '',
    fabricant: '',
    nom: '',
    reference: '',
    numero_grm: '',
  });
  const [sortConfig, setSortConfig] = useState({
    key: 'created_at',
    direction: 'desc'
  });

  const filtersOn = Boolean(filters.search || filters.type || filters.fabricant || filters.nom || filters.reference || filters.numero_grm);

  // Get unique values for column filters
  const uniqueNoms = useMemo(() => [...new Set(products.map(p => p.nom).filter(Boolean))].sort(), [products]);
  const uniqueReferences = useMemo(() => [...new Set(products.map(p => p.reference).filter(Boolean))].sort(), [products]);
  const uniqueGrms = useMemo(() => [...new Set(products.map(p => p.numero_grm).filter(Boolean))].sort(), [products]);
  const uniqueTypes = useMemo(() => [...new Set(products.map(p => p.type).filter(Boolean))].sort(), [products]);
  const uniqueFabricants = useMemo(() => [...new Set(products.map(p => p.fabricant).filter(Boolean))].sort(), [products]);

  useEffect(() => {
    fetchProducts();
    fetchProductOptions();
  }, []);

  useEffect(() => {
    applyFiltersAndSort();
  }, [products, filters, sortConfig]);

  const fetchProducts = async () => {
    try {
      const response = await api.get('/products');
      setProducts(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des produits');
    } finally {
      setLoading(false);
    }
  };

  const fetchProductOptions = async () => {
    try {
      const response = await api.get('/products/options/distinct');
      setProductOptions(response.data);
    } catch (error) {
      console.warn('Could not fetch product options', error);
    }
  };

  const applyFiltersAndSort = () => {
    let filtered = [...products];

    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(product =>
        product.nom.toLowerCase().includes(searchLower) ||
        product.reference.toLowerCase().includes(searchLower) ||
        (product.numero_grm && product.numero_grm.toLowerCase().includes(searchLower))
      );
    }

    if (filters.type) {
      filtered = filtered.filter(product => product.type === filters.type);
    }

    if (filters.fabricant) {
      filtered = filtered.filter(product => product.fabricant === filters.fabricant);
    }

    if (filters.nom) {
      filtered = filtered.filter(product => product.nom === filters.nom);
    }

    if (filters.reference) {
      filtered = filtered.filter(product => product.reference === filters.reference);
    }

    if (filters.numero_grm) {
      filtered = filtered.filter(product => product.numero_grm === filters.numero_grm);
    }

    // Apply sorting
    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const key = sortConfig.key;
        const dir = sortConfig.direction === 'asc' ? 1 : -1;
        if (key === 'created_at') {
          const av = new Date(a.created_at).getTime();
          const bv = new Date(b.created_at).getTime();
          return (av - bv) * dir;
        }
        let aValue = a[key];
        let bValue = b[key];
        if (!aValue) aValue = '';
        if (!bValue) bValue = '';
        aValue = String(aValue).toLowerCase();
        bValue = String(bValue).toLowerCase();
        if (aValue < bValue) return -1 * dir;
        if (aValue > bValue) return 1 * dir;
        return 0;
      });
    }

    setFilteredProducts(filtered);
  };

  const resetFilters = () => {
    setFilters({ search: '', type: '', fabricant: '', nom: '', reference: '', numero_grm: '' });
    setSortConfig({ key: 'created_at', direction: 'desc' });
  };
  // CRUD handlers
  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingProduct) {
        await api.put(`/products/${editingProduct.id}`, formData);
        toast.success('Produit modifié avec succès');
      } else {
        await api.post('/products', formData);
        toast.success('Produit créé avec succès');
      }
      setDialogOpen(false);
      resetForm();
      fetchProducts();
      fetchProductOptions(); // Reload options to include new type/fabricant
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Une erreur est survenue');
    }
  };

  const resetForm = () => {
    setFormData({
      nom: '',
      type: '',
      fabricant: '',
      reference: '',
      numero_grm: '',
      stock_minimum: 5,
      stock_maximum: 50,
    });
    setEditingProduct(null);
  };

  const handleEdit = (product) => {
    setEditingProduct(product);
    setFormData({
      nom: product.nom,
      type: product.type,
      fabricant: product.fabricant,
      reference: product.reference,
      numero_grm: product.numero_grm || '',
      stock_minimum: product.stock_minimum || 5,
      stock_maximum: product.stock_maximum || 50,
    });
    setDialogOpen(true);
  };

  const handleDeleteClick = (product) => {
    setProductToDelete(product);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    try {
      await api.delete(`/products/${productToDelete.id}`);
      toast.success('Produit supprimé avec succès');
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const handleCopyClick = (product) => {
    setProductToCopy(product);
    setCopyFormData({
      nom: product.nom,
      type: product.type || '',
      fabricant: product.fabricant || '',
      reference: product.reference + '-COPY',
      numero_grm: '', // Empty by default - user must enter a new unique GRM
      stock_minimum: product.stock_minimum || 5,
      stock_maximum: product.stock_maximum || 50,
    });
    setCopyDialogOpen(true);
  };

  const handleCopyConfirm = async () => {
    try {
      const copyData = {
        nom: copyFormData.nom,
        type: copyFormData.type,
        fabricant: copyFormData.fabricant,
        reference: copyFormData.reference,
        numero_grm: copyFormData.numero_grm || '', // Use the manually entered GRM
        stock_minimum: copyFormData.stock_minimum,
        stock_maximum: copyFormData.stock_maximum,
      };
      await api.post('/products', copyData);
      toast.success('Produit copié avec succès');
      setCopyDialogOpen(false);
      setProductToCopy(null);
      setCopyFormData({ nom: '', reference: '', numero_grm: '' });
      fetchProducts();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la copie');
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
    <div className="p-8" data-testid="products-page">
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
            {t('products')}
          </h1>
          <p className="text-gray-600">{t('manageProducts')}</p>
        </div>
        {permissions.canCreate && (
          <Dialog open={dialogOpen} onOpenChange={(open) => {
            setDialogOpen(open);
            if (!open) resetForm();
          }}>
            <DialogTrigger asChild>
              <Button data-testid="add-product-button" className="bg-blue-600 hover:bg-blue-700">
                <Plus size={20} className="mr-2" />
                {t('addProduct')}
              </Button>
            </DialogTrigger>
            <DialogContent data-testid="product-dialog">
              <DialogHeader>
                <DialogTitle>{editingProduct ? t('editProduct') : t('newProduct')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label>{t('productName')}</Label>
                <Input
                  data-testid="product-nom-input"
                  value={formData.nom}
                  onChange={(e) => setFormData({ ...formData, nom: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>{t('type')}</Label>
                {productOptions.types.length > 0 ? (
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={formData.type}
                    onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                    required
                  >
                    <option value="">-- Sélectionner un type --</option>
                    {productOptions.types.map((t, idx) => (
                      <option key={idx} value={t}>{t}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                    Aucun type disponible. <a href="/types-produit" className="underline font-medium">Créer un type</a>
                  </div>
                )}
              </div>
              <div>
                <Label>{t('manufacturer')}</Label>
                {productOptions.fabricants.length > 0 ? (
                  <select
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    value={formData.fabricant}
                    onChange={(e) => setFormData({ ...formData, fabricant: e.target.value })}
                    required
                  >
                    <option value="">-- Sélectionner un fabricant --</option>
                    {productOptions.fabricants.map((f, idx) => (
                      <option key={idx} value={f}>{f}</option>
                    ))}
                  </select>
                ) : (
                  <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                    Aucun fournisseur disponible. <a href="/fabricants" className="underline font-medium">Créer un fournisseur</a>
                  </div>
                )}
              </div>
              <div>
                <Label>N° Catalogue fournisseur</Label>
                <Input
                  data-testid="product-reference-input"
                  value={formData.reference}
                  onChange={(e) => setFormData({ ...formData, reference: e.target.value })}
                  required
                />
              </div>
              <div>
                <Label>N° GRM</Label>
                <Textarea
                  data-testid="product-numero-grm-input"
                  value={formData.numero_grm}
                  onChange={(e) => setFormData({ ...formData, numero_grm: e.target.value })}
                  rows={3}
                  placeholder="Numéro GRM du produit"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>{t('minStock')}</Label>
                  <Input
                    data-testid="product-stock-min-input"
                    type="number"
                    min="1"
                    value={formData.stock_minimum}
                    onChange={(e) => setFormData({ ...formData, stock_minimum: parseInt(e.target.value) })}
                    required
                  />
                </div>
                <div>
                  <Label>{t('maxStock')}</Label>
                  <Input
                    data-testid="product-stock-max-input"
                    type="number"
                    min="1"
                    value={formData.stock_maximum}
                    onChange={(e) => setFormData({ ...formData, stock_maximum: parseInt(e.target.value) })}
                    required
                  />
                </div>
              </div>
              <Button type="submit" data-testid="product-submit-button" className="w-full">
                {editingProduct ? t('edit') : t('create')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        )}
      </div>

      {products.length === 0 ? (
        <div className="text-center py-16">
          <Package size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">{t('noData')}</h3>
          <p className="text-gray-500">{t('addProduct')}</p>
        </div>
      ) : (
        <>
          <div className="card mb-6">
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative inline-block">
                <Button variant="outline" size="sm" onClick={resetFilters}>{t('reset')}</Button>
                {filtersOn && (
                  <span className="absolute -top-1 -right-1 inline-block w-2.5 h-2.5 rounded-full bg-orange-500" title="Filtres actifs" />
                )}
              </div>
              <div className="flex-1 min-w-[200px] max-w-[360px]">
                <Input
                  placeholder={t('search')}
                  value={filters.search}
                  onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                  data-testid="search-filter"
                  aria-label={t('search')}
                />
              </div>
              <div className="flex items-center">
                <Label className="text-xs text-gray-500 mr-2">{t('sortBy')}</Label>
                <select
                  className="border rounded px-2 py-1"
                  value={sortConfig.key}
                  onChange={(e) => setSortConfig({ ...sortConfig, key: e.target.value })}
                >
                  <option value="created_at">{t('creationDate')}</option>
                  <option value="nom">{t('name')}</option>
                  <option value="reference">{t('catalogNumber')}</option>
                  <option value="type">{t('type')}</option>
                  <option value="fabricant">{t('manufacturer')}</option>
                </select>
                <Button
                  variant="outline"
                  className="ml-2"
                  onClick={() => setSortConfig({ ...sortConfig, direction: sortConfig.direction === 'asc' ? 'desc' : 'asc' })}
                >
                  {sortConfig.direction === 'asc' ? <ArrowDownAZ size={16} /> : <ArrowUpAZ size={16} />}
                </Button>
              </div>
              <div className="text-sm text-gray-500">
                {filteredProducts.length} produit(s)
              </div>
            </div>
          </div>

          <div className="card overflow-hidden">
            <table>
              <thead>
                <tr>
                  {/* GRM Number */}
                  <th>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.numero_grm ? 'text-blue-600 font-bold' : ''}`}>
                          <span>{t('grmNumber')}</span>
                          {filters.numero_grm ? (
                            <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, numero_grm: ''}); }} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 overflow-y-auto">
                        <DropdownMenuItem onClick={() => setFilters({...filters, numero_grm: ''})} className={!filters.numero_grm ? 'bg-blue-50' : ''}>
                          Tous
                        </DropdownMenuItem>
                        {uniqueGrms.map(val => (
                          <DropdownMenuItem key={val} onClick={() => setFilters({...filters, numero_grm: val})} className={`${filters.numero_grm === val ? 'bg-blue-50' : ''} truncate max-w-xs`} title={val}>
                            {val}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                  {/* Catalog Number */}
                  <th>
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
                  {/* Name */}
                  <th>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.nom ? 'text-blue-600 font-bold' : ''}`}>
                          <span>{t('name')}</span>
                          {filters.nom ? (
                            <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, nom: ''}); }} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 overflow-y-auto max-w-xs">
                        <DropdownMenuItem onClick={() => setFilters({...filters, nom: ''})} className={!filters.nom ? 'bg-blue-50' : ''}>
                          Tous
                        </DropdownMenuItem>
                        {uniqueNoms.map(val => (
                          <DropdownMenuItem key={val} onClick={() => setFilters({...filters, nom: val})} className={`${filters.nom === val ? 'bg-blue-50' : ''} truncate`} title={val}>
                            {val}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                  {/* Manufacturer */}
                  <th>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.fabricant ? 'text-blue-600 font-bold' : ''}`}>
                          <span>{t('manufacturer')}</span>
                          {filters.fabricant ? (
                            <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, fabricant: ''}); }} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 overflow-y-auto">
                        <DropdownMenuItem onClick={() => setFilters({...filters, fabricant: ''})} className={!filters.fabricant ? 'bg-blue-50' : ''}>
                          Tous
                        </DropdownMenuItem>
                        {uniqueFabricants.map(val => (
                          <DropdownMenuItem key={val} onClick={() => setFilters({...filters, fabricant: val})} className={filters.fabricant === val ? 'bg-blue-50' : ''}>
                            {val}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                  {/* Type */}
                  <th>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className={`flex items-center gap-1 hover:text-blue-600 transition-colors w-full justify-between ${filters.type ? 'text-blue-600 font-bold' : ''}`}>
                          <span>{t('type')}</span>
                          {filters.type ? (
                            <X size={14} className="text-blue-600" onClick={(e) => { e.stopPropagation(); setFilters({...filters, type: ''}); }} />
                          ) : (
                            <ChevronDown size={14} />
                          )}
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent className="max-h-64 overflow-y-auto">
                        <DropdownMenuItem onClick={() => setFilters({...filters, type: ''})} className={!filters.type ? 'bg-blue-50' : ''}>
                          Tous
                        </DropdownMenuItem>
                        {uniqueTypes.map(val => (
                          <DropdownMenuItem key={val} onClick={() => setFilters({...filters, type: val})} className={filters.type === val ? 'bg-blue-50' : ''}>
                            {val}
                          </DropdownMenuItem>
                        ))}
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </th>
                  <th>{t('creationDate')}</th>
                  <th>{t('actions')}</th>
                </tr>
              </thead>
              <tbody>
                {filteredProducts.map((product) => (
                  <tr key={product.id} data-testid="product-row">
                    <td className="text-gray-600 text-sm max-w-xs truncate" title={product.numero_grm}>
                      {product.numero_grm || '-'}
                    </td>
                    <td className="text-gray-500">{product.reference}</td>
                    <td className="font-medium">{product.nom}</td>
                    <td>{product.fabricant}</td>
                    <td><span className="badge badge-info">{product.type}</span></td>
                    <td className="text-gray-500">
                      {new Date(product.created_at).toLocaleDateString('fr-FR')}
                    </td>
                    <td>
                      <div className="flex gap-2">
                        <Button
                          data-testid="copy-product-button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyClick(product)}
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          title="Copier le produit"
                          disabled={!permissions.canCreate}
                        >
                          <Copy size={16} />
                        </Button>
                        <Button
                          data-testid="edit-product-button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(product)}
                          disabled={!permissions.canEdit}
                        >
                          <Edit size={16} />
                        </Button>
                        <Button
                          data-testid="delete-product-button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClick(product)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          disabled={!permissions.canDelete}
                        >
                          <Trash2 size={16} />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmer la suppression</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir supprimer le produit <strong>{productToDelete?.nom}</strong> ?
              Cette action est irréversible.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-red-600 hover:bg-red-700"
            >
              Supprimer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={copyDialogOpen} onOpenChange={setCopyDialogOpen}>
        <AlertDialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <AlertDialogHeader>
            <AlertDialogTitle>Copier le produit</AlertDialogTitle>
            <AlertDialogDescription>
              Créer une copie de <strong>{productToCopy?.nom}</strong>. Modifiez les informations :
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-4 my-4">
            <div>
              <Label>Nom du produit</Label>
              <Input
                data-testid="copy-nom-input"
                value={copyFormData.nom}
                onChange={(e) => setCopyFormData({ ...copyFormData, nom: e.target.value })}
                placeholder="Nom du produit"
              />
            </div>
            <div>
              <Label>Type</Label>
              {productOptions.types.length > 0 ? (
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={copyFormData.type}
                  onChange={(e) => setCopyFormData({ ...copyFormData, type: e.target.value })}
                >
                  <option value="">-- Sélectionner un type --</option>
                  {productOptions.types.map((t, idx) => (
                    <option key={idx} value={t}>{t}</option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                  Aucun type disponible. <a href="/types-produit" className="underline font-medium">Créer un type</a>
                </div>
              )}
            </div>
            <div>
              <Label>Fabricant</Label>
              {productOptions.fabricants.length > 0 ? (
                <select
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  value={copyFormData.fabricant}
                  onChange={(e) => setCopyFormData({ ...copyFormData, fabricant: e.target.value })}
                >
                  <option value="">-- Sélectionner un fabricant --</option>
                  {productOptions.fabricants.map((f, idx) => (
                    <option key={idx} value={f}>{f}</option>
                  ))}
                </select>
              ) : (
                <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-yellow-800 text-sm">
                  Aucun fournisseur disponible. <a href="/fabricants" className="underline font-medium">Créer un fournisseur</a>
                </div>
              )}
            </div>
            <div>
              <Label>N° Catalogue fournisseur</Label>
              <Input
                data-testid="copy-reference-input"
                value={copyFormData.reference}
                onChange={(e) => setCopyFormData({ ...copyFormData, reference: e.target.value })}
                placeholder="Ex: REF-2024-NEW"
              />
            </div>
            <div>
              <Label>N° GRM (nouveau numéro unique)</Label>
              <Input
                data-testid="copy-numero-grm-input"
                value={copyFormData.numero_grm}
                onChange={(e) => setCopyFormData({ ...copyFormData, numero_grm: e.target.value })}
                placeholder="Entrez un nouveau numéro GRM unique"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Stock Minimum</Label>
                <Input
                  type="number"
                  min="1"
                  value={copyFormData.stock_minimum}
                  onChange={(e) => setCopyFormData({ ...copyFormData, stock_minimum: parseInt(e.target.value) || 5 })}
                />
              </div>
              <div>
                <Label>Stock Maximum</Label>
                <Input
                  type="number"
                  min="1"
                  value={copyFormData.stock_maximum}
                  onChange={(e) => setCopyFormData({ ...copyFormData, stock_maximum: parseInt(e.target.value) || 50 })}
                />
              </div>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCopyConfirm}
              disabled={!copyFormData.nom.trim() || !copyFormData.reference.trim() || !copyFormData.type.trim() || !copyFormData.fabricant.trim()}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Copy size={16} className="mr-2" />
              Copier
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Products;
