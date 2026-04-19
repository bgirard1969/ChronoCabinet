import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Plus, Package, Tag, Truck, Search, Edit2, Trash2, Ruler, X, MapPin } from 'lucide-react';

const INST_STATUS_COLORS = {
  1: 'bg-slate-100 text-slate-600',
  2: 'bg-purple-100 text-purple-700',
  3: 'bg-green-100 text-green-700',
  4: 'bg-amber-100 text-amber-700',
  5: 'bg-teal-100 text-teal-700',
  6: 'bg-blue-100 text-blue-700',
};

export default function Products() {
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [categories, setCategories] = useState([]);
  const [types, setTypes] = useState([]);
  const [specifications, setSpecifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('products');
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [search, setSearch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterSpec, setFilterSpec] = useState('');
  const [filterSupplier, setFilterSupplier] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [instances, setInstances] = useState([]);
  const [loadingInstances, setLoadingInstances] = useState(false);

  // Product form
  const [form, setForm] = useState({
    supplier_id: '', type_id: '', category_id: '', specification_id: '', description: '', grm_number: '',
  });
  // Simple form for suppliers/categories/types/specifications
  const [simpleForm, setSimpleForm] = useState({ name: '', description: '', contact_name: '', contact_phone: '', contact_email: '' });

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [prodRes, supRes, catRes, typeRes, specRes] = await Promise.all([
        api.get('/products'),
        api.get('/suppliers'),
        api.get('/product-categories'),
        api.get('/product-types'),
        api.get('/product-specifications'),
      ]);
      setProducts(prodRes.data);
      setSuppliers(supRes.data);
      setCategories(catRes.data);
      setTypes(typeRes.data);
      setSpecifications(specRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, []);

  const filteredProducts = products.filter(p => {
    if (search && !p.description?.toLowerCase().includes(search.toLowerCase()) &&
      !p.specification?.toLowerCase().includes(search.toLowerCase()) &&
      !p.specification_obj?.description?.toLowerCase().includes(search.toLowerCase()) &&
      !p.grm_number?.toLowerCase().includes(search.toLowerCase())) return false;
    if (filterCategory && p.category_id !== filterCategory) return false;
    if (filterType && p.type_id !== filterType) return false;
    if (filterSpec && p.specification_id !== filterSpec) return false;
    if (filterSupplier && p.supplier_id !== filterSupplier) return false;
    return true;
  });

  // Cascading: types available for selected category
  const availableTypes = filterCategory
    ? types.filter(t => products.some(p => p.category_id === filterCategory && p.type_id === t.id))
    : types;

  // Cascading: specs available for selected category + type
  const availableSpecs = (() => {
    let pool = products;
    if (filterCategory) pool = pool.filter(p => p.category_id === filterCategory);
    if (filterType) pool = pool.filter(p => p.type_id === filterType);
    return specifications.filter(s => pool.some(p => p.specification_id === s.id));
  })();

  // Highlight helper
  const highlight = (text) => {
    if (!search || !text) return text || '—';
    const idx = text.toLowerCase().indexOf(search.toLowerCase());
    if (idx === -1) return text;
    return (
      <>{text.slice(0, idx)}<mark className="bg-yellow-200 text-inherit rounded px-0.5">{text.slice(idx, idx + search.length)}</mark>{text.slice(idx + search.length)}</>
    );
  };

  const handleCreateProduct = async (e) => {
    e.preventDefault();
    try {
      if (editItem) {
        await api.put(`/products/${editItem.id}`, form);
        toast.success('Produit mis à jour');
      } else {
        await api.post('/products', form);
        toast.success('Produit créé');
      }
      setShowForm(false);
      setEditItem(null);
      setForm({ supplier_id: '', type_id: '', category_id: '', specification_id: '', description: '', grm_number: '' });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleCreateSimple = async (e) => {
    e.preventDefault();
    try {
      if (tab === 'suppliers') {
        const payload = { name: simpleForm.name, contact_name: simpleForm.contact_name || null, contact_phone: simpleForm.contact_phone || null, contact_email: simpleForm.contact_email || null };
        if (editItem) await api.put(`/suppliers/${editItem.id}`, payload);
        else await api.post('/suppliers', payload);
      } else if (tab === 'categories') {
        const payload = { description: simpleForm.description };
        if (editItem) await api.put(`/product-categories/${editItem.id}`, payload);
        else await api.post('/product-categories', payload);
      } else if (tab === 'types') {
        const payload = { description: simpleForm.description };
        if (editItem) await api.put(`/product-types/${editItem.id}`, payload);
        else await api.post('/product-types', payload);
      } else if (tab === 'specifications') {
        const payload = { description: simpleForm.description };
        if (editItem) await api.put(`/product-specifications/${editItem.id}`, payload);
        else await api.post('/product-specifications', payload);
      }
      toast.success(editItem ? 'Mis à jour' : 'Créé');
      setShowForm(false);
      setEditItem(null);
      setSimpleForm({ name: '', description: '', contact_name: '', contact_phone: '', contact_email: '' });
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async (type, id) => {
    if (!window.confirm('Confirmer la suppression ?')) return;
    try {
      const endpoints = { products: 'products', suppliers: 'suppliers', categories: 'product-categories', types: 'product-types', specifications: 'product-specifications' };
      await api.delete(`/${endpoints[type]}/${id}`);
      toast.success('Supprimé');
      fetchAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const openEditProduct = (p) => {
    setEditItem(p);
    setForm({
      supplier_id: p.supplier_id,
      type_id: p.type_id,
      category_id: p.category_id,
      specification_id: p.specification_id || '',
      description: p.description,
      grm_number: p.grm_number || '',
    });
    setTab('products');
    setShowForm(true);
  };

  const openEditSimple = (item) => {
    setEditItem(item);
    if (tab === 'suppliers') setSimpleForm({ name: item.name, contact_name: item.contact_name || '', contact_phone: item.contact_phone || '', contact_email: item.contact_email || '', description: '' });
    else setSimpleForm({ name: '', description: item.description, contact_name: '', contact_phone: '', contact_email: '' });
    setShowForm(true);
  };

  const getSpecLabel = (p) => {
    if (p.specification_obj?.description) return p.specification_obj.description;
    if (p.specification) return p.specification;
    return '—';
  };

  const openInstances = async (product) => {
    setSelectedProduct(product);
    setLoadingInstances(true);
    try {
      const res = await api.get(`/products/${product.id}/instances`);
      setInstances(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setLoadingInstances(false);
    }
  };

  const tabLabel = { products: 'Nouveau produit', suppliers: 'Nouveau fournisseur', categories: 'Nouvelle catégorie', types: 'Nouveau modèle', specifications: 'Nouvelle spécification' };

  const tabs = [
    { id: 'products', label: 'Produits', icon: Package },
    { id: 'suppliers', label: 'Fournisseurs', icon: Truck },
    { id: 'categories', label: 'Catégories', icon: Tag },
    { id: 'types', label: 'Modèles', icon: Tag },
    { id: 'specifications', label: 'Spécifications', icon: Ruler },
  ];

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Produits</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestion du catalogue de produits</p>
        </div>
        <button data-testid="create-item-btn" onClick={() => { setEditItem(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> {tabLabel[tab]}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-slate-100 rounded-lg p-1 w-fit">
        {tabs.map(t => (
          <button key={t.id} data-testid={`tab-${t.id}`}
            onClick={() => { setTab(t.id); setShowForm(false); }}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
              tab === t.id ? 'bg-white text-slate-800 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            <t.icon className="w-3.5 h-3.5" />{t.label}
          </button>
        ))}
      </div>

      {/* Products tab */}
      {tab === 'products' && (
        <>
          <div className="flex gap-3 mb-4 flex-wrap items-center">
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
              <input data-testid="search-products" placeholder="Rechercher..." className="w-full pl-9 pr-3 py-2 border rounded-lg text-sm"
                value={search} onChange={e => setSearch(e.target.value)} />
            </div>
            <select data-testid="filter-category"
              className={`rounded-lg px-3 py-2 text-sm ${filterCategory ? 'border-2 border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border'}`}
              value={filterCategory} onChange={e => { setFilterCategory(e.target.value); setFilterType(''); setFilterSpec(''); }}>
              <option value="">Toutes catégories</option>
              {categories.map(c => <option key={c.id} value={c.id}>{c.description}</option>)}
            </select>
            <select data-testid="filter-type"
              className={`rounded-lg px-3 py-2 text-sm ${filterType ? 'border-2 border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border'}`}
              value={filterType} onChange={e => { setFilterType(e.target.value); setFilterSpec(''); }}>
              <option value="">Tous modèles</option>
              {availableTypes.map(t => <option key={t.id} value={t.id}>{t.description}</option>)}
            </select>
            <select data-testid="filter-spec"
              className={`rounded-lg px-3 py-2 text-sm ${filterSpec ? 'border-2 border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border'}`}
              value={filterSpec} onChange={e => setFilterSpec(e.target.value)}>
              <option value="">Toutes spécifications</option>
              {availableSpecs.map(s => <option key={s.id} value={s.id}>{s.description}</option>)}
            </select>
            <select data-testid="filter-supplier"
              className={`rounded-lg px-3 py-2 text-sm ${filterSupplier ? 'border-2 border-blue-500 bg-blue-50 text-blue-700 font-medium' : 'border'}`}
              value={filterSupplier} onChange={e => setFilterSupplier(e.target.value)}>
              <option value="">Tous fournisseurs</option>
              {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            {(filterCategory || filterType || filterSpec || filterSupplier || search) && (
              <button data-testid="clear-all-filters"
                onClick={() => { setFilterCategory(''); setFilterType(''); setFilterSpec(''); setFilterSupplier(''); setSearch(''); }}
                className="flex items-center gap-1 px-2.5 py-2 text-xs text-slate-500 hover:text-red-500 border rounded-lg hover:border-red-300 transition-colors">
                <X className="w-3.5 h-3.5" /> Réinitialiser
              </button>
            )}
          </div>
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50">
                <tr>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[100px]">GRM</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Description</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Catégorie</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[120px]">Modèle</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[160px]">Spécification</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500">Fournisseur</th>
                  <th className="text-left px-4 py-3 font-medium text-slate-500 w-[50px]">En stock</th>
                  <th className="px-4 py-3 w-[60px]"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">Chargement...</td></tr>
                ) : filteredProducts.length === 0 ? (
                  <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">Aucun produit</td></tr>
                ) : filteredProducts.map(p => (
                  <tr key={p.id} data-testid={`product-row-${p.id}`} className="hover:bg-slate-50 cursor-pointer" onClick={() => openInstances(p)}>
                    <td className="px-4 py-3 text-slate-700 font-mono">{highlight(p.grm_number) || '—'}</td>
                    <td className="px-4 py-3 font-medium">{highlight(p.description)}</td>
                    <td className="px-4 py-3"><span className="bg-blue-50 text-blue-700 px-2 py-0.5 rounded text-xs">{p.category?.description || '—'}</span></td>
                    <td className="px-4 py-3"><span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded text-xs">{p.type?.description || '—'}</span></td>
                    <td className="px-4 py-3 text-slate-600">{highlight(getSpecLabel(p))}</td>
                    <td className="px-4 py-3 text-slate-600">{p.supplier?.name || '—'}</td>
                    <td className="px-4 py-3 font-medium">{p.quantity_in_stock}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-1">
                        <button onClick={(e) => { e.stopPropagation(); openEditProduct(p); }} className="p-1 hover:bg-slate-100 rounded"><Edit2 className="w-3.5 h-3.5 text-slate-400" /></button>
                        <button onClick={(e) => { e.stopPropagation(); handleDelete('products', p.id); }} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Suppliers tab */}
      {tab === 'suppliers' && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Nom</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Contact</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Téléphone</th>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Courriel</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.length === 0 ? (
                <tr><td colSpan="5" className="px-4 py-8 text-center text-slate-400">Aucun fournisseur</td></tr>
              ) : suppliers.map(s => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{s.name}</td>
                  <td className="px-4 py-3 text-slate-600">{s.contact_name || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{s.contact_phone || '—'}</td>
                  <td className="px-4 py-3 text-slate-600">{s.contact_email || '—'}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEditSimple(s)} className="p-1 hover:bg-slate-100 rounded"><Edit2 className="w-3.5 h-3.5 text-slate-400" /></button>
                      <button onClick={() => handleDelete('suppliers', s.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Categories / Types / Specifications tabs */}
      {(tab === 'categories' || tab === 'types' || tab === 'specifications') && (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="text-left px-4 py-3 font-medium text-slate-500">Description</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {(tab === 'categories' ? categories : tab === 'types' ? types : specifications).length === 0 ? (
                <tr><td colSpan="2" className="px-4 py-8 text-center text-slate-400">Aucun élément</td></tr>
              ) : (tab === 'categories' ? categories : tab === 'types' ? types : specifications).map(item => (
                <tr key={item.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-medium">{item.description}</td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1">
                      <button onClick={() => openEditSimple(item)} className="p-1 hover:bg-slate-100 rounded"><Edit2 className="w-3.5 h-3.5 text-slate-400" /></button>
                      <button onClick={() => handleDelete(tab, item.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editItem ? 'Modifier' : 'Créer'}</h2>
            {tab === 'products' ? (
              <form onSubmit={handleCreateProduct} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Description *</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" maxLength={80} required
                    value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Fournisseur *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" required
                    value={form.supplier_id} onChange={e => setForm({ ...form, supplier_id: e.target.value })}>
                    <option value="">Sélectionner...</option>
                    {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Catégorie *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" required
                    value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                    <option value="">Sélectionner...</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.description}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Modèle *</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm" required
                    value={form.type_id} onChange={e => setForm({ ...form, type_id: e.target.value })}>
                    <option value="">Sélectionner...</option>
                    {types.map(t => <option key={t.id} value={t.id}>{t.description}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Spécification</label>
                  <select className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.specification_id} onChange={e => setForm({ ...form, specification_id: e.target.value })}>
                    <option value="">Aucune</option>
                    {specifications.map(s => <option key={s.id} value={s.id}>{s.description}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">N° GRM</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.grm_number} onChange={e => setForm({ ...form, grm_number: e.target.value })} />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditItem(null); }}
                    className="flex-1 border rounded-lg py-2 text-sm hover:bg-slate-50">Annuler</button>
                  <button type="submit"
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">{editItem ? 'Mettre à jour' : 'Créer'}</button>
                </div>
              </form>
            ) : tab === 'suppliers' ? (
              <form onSubmit={handleCreateSimple} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Nom *</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" maxLength={50} required
                    value={simpleForm.name} onChange={e => setSimpleForm({ ...simpleForm, name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Personne ressource</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={simpleForm.contact_name} onChange={e => setSimpleForm({ ...simpleForm, contact_name: e.target.value })} />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium mb-1">Téléphone</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm"
                      value={simpleForm.contact_phone} onChange={e => setSimpleForm({ ...simpleForm, contact_phone: e.target.value })} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium mb-1">Courriel</label>
                    <input className="w-full border rounded-lg px-3 py-2 text-sm" type="email"
                      value={simpleForm.contact_email} onChange={e => setSimpleForm({ ...simpleForm, contact_email: e.target.value })} />
                  </div>
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditItem(null); }}
                    className="flex-1 border rounded-lg py-2 text-sm hover:bg-slate-50">Annuler</button>
                  <button type="submit"
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">{editItem ? 'Mettre à jour' : 'Créer'}</button>
                </div>
              </form>
            ) : (
              <form onSubmit={handleCreateSimple} className="space-y-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Description *</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" maxLength={80} required
                    value={simpleForm.description} onChange={e => setSimpleForm({ ...simpleForm, description: e.target.value })} />
                </div>
                <div className="flex gap-2 pt-2">
                  <button type="button" onClick={() => { setShowForm(false); setEditItem(null); }}
                    className="flex-1 border rounded-lg py-2 text-sm hover:bg-slate-50">Annuler</button>
                  <button type="submit"
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">{editItem ? 'Mettre à jour' : 'Créer'}</button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Instances panel */}
      {selectedProduct && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold">{selectedProduct.description}</h2>
                <p className="text-sm text-slate-500">
                  {getSpecLabel(selectedProduct)} — {selectedProduct.supplier?.name || '—'}
                </p>
              </div>
              <button onClick={() => setSelectedProduct(null)} className="p-1.5 hover:bg-slate-100 rounded">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <div className="overflow-y-auto flex-1 p-5">
              {loadingInstances ? (
                <div className="text-center text-slate-400 py-8">Chargement...</div>
              ) : instances.length === 0 ? (
                <div className="text-center text-slate-400 py-8">
                  <Package className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p>Aucune instance pour ce produit</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Statut</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">N° Série</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">N° Lot</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Expiration</th>
                      <th className="text-left px-3 py-2 font-medium text-slate-500">Emplacement</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {instances.map(inst => (
                      <tr key={inst.id} data-testid={`instance-row-${inst.id}`} className="hover:bg-slate-50">
                        <td className="px-3 py-2">
                          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${INST_STATUS_COLORS[inst.status] || 'bg-slate-100'}`}>
                            {inst.status_label}
                          </span>
                        </td>
                        <td className="px-3 py-2 font-mono text-xs">{inst.serial_number || '—'}</td>
                        <td className="px-3 py-2 text-xs">{inst.lot_number || '—'}</td>
                        <td className="px-3 py-2 text-xs">
                          {inst.expiration_date ? new Date(inst.expiration_date).toLocaleDateString('fr-CA') : '—'}
                        </td>
                        <td className="px-3 py-2">
                          {inst.location_code ? (
                            <span className="flex items-center gap-1 text-blue-600 text-xs font-medium">
                              <MapPin className="w-3 h-3" /> {inst.location_code}
                            </span>
                          ) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="border-t px-5 py-3 text-xs text-slate-500">
              {instances.length} instance(s) — {instances.filter(i => i.status === 3).length} en stock
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
