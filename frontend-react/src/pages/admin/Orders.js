import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Plus, Send, PackageCheck, ShoppingCart, Trash2, Check, ArrowUp, ArrowDown } from 'lucide-react';

const STATUS_LABELS = { draft: 'Brouillon', sent: 'Envoyée', partially_received: 'Partiel', received: 'Reçue', closed: 'Fermée', cancelled: 'Annulée' };
const STATUS_COLORS = { draft: 'bg-slate-100 text-slate-700', sent: 'bg-blue-100 text-blue-700', partially_received: 'bg-amber-100 text-amber-700', received: 'bg-green-100 text-green-700', closed: 'bg-slate-100 text-slate-500', cancelled: 'bg-red-100 text-red-700' };

export default function Orders() {
  const [orders, setOrders] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [showReceive, setShowReceive] = useState(null); // order id
  const [orderDetail, setOrderDetail] = useState(null);
  const [sortKey, setSortKey] = useState('order_date');
  const [sortDir, setSortDir] = useState('desc');

  const [createForm, setCreateForm] = useState({ supplier_id: '', grm_number: '', items: [] });
  const [receiveItems, setReceiveItems] = useState([]);
  const [productSearch, setProductSearch] = useState('');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [grmLooking, setGrmLooking] = useState(false);

  // Close product dropdown on outside click
  useEffect(() => {
    const handler = () => setShowProductDropdown(false);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [ordRes, supRes, prodRes] = await Promise.all([
        api.get('/orders'),
        api.get('/suppliers'),
        api.get('/products'),
      ]);
      setOrders(ordRes.data);
      setSuppliers(supRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const supplierProducts = createForm.supplier_id
    ? products.filter(p => p.supplier_id === createForm.supplier_id)
    : [];

  const filteredSupplierProducts = productSearch.trim()
    ? supplierProducts.filter(p =>
        p.description?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.grm_number?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.specification_obj?.description?.toLowerCase().includes(productSearch.toLowerCase()) ||
        p.specification?.toLowerCase().includes(productSearch.toLowerCase())
      )
    : supplierProducts;

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'order_date' || key === 'created_at' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ArrowDown className="w-3 h-3 text-slate-300 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-500 ml-1 inline" />
      : <ArrowDown className="w-3 h-3 text-blue-500 ml-1 inline" />;
  };

  const sortedOrders = [...orders].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    let va, vb;
    switch (sortKey) {
      case 'supplier':
        va = (a.supplier?.name || '').toLowerCase();
        vb = (b.supplier?.name || '').toLowerCase();
        return va < vb ? -dir : va > vb ? dir : 0;
      case 'grm_number':
        va = (a.grm_number || '').toLowerCase();
        vb = (b.grm_number || '').toLowerCase();
        return va < vb ? -dir : va > vb ? dir : 0;
      case 'created_at':
        va = a.creation_date || a.created_at || '';
        vb = b.creation_date || b.created_at || '';
        return va < vb ? -dir : va > vb ? dir : 0;
      case 'order_date':
        va = a.order_date || '';
        vb = b.order_date || '';
        return va < vb ? -dir : va > vb ? dir : 0;
      case 'items':
        va = a.total_items || 0;
        vb = b.total_items || 0;
        return (va - vb) * dir;
      case 'status':
        va = (STATUS_LABELS[a.status] || a.status || '').toLowerCase();
        vb = (STATUS_LABELS[b.status] || b.status || '').toLowerCase();
        return va < vb ? -dir : va > vb ? dir : 0;
      default:
        return 0;
    }
  });

  const handleGrmLookup = (grmValue) => {
    setCreateForm(prev => ({ ...prev, grm_number: grmValue }));
    if (!grmValue.trim()) return;
    const found = products.find(p => p.grm_number === grmValue.trim());
    if (found) {
      // Auto-set supplier if not set
      if (!createForm.supplier_id && found.supplier_id) {
        setCreateForm(prev => ({ ...prev, grm_number: grmValue, supplier_id: found.supplier_id }));
      }
      // Auto-add product
      const existing = createForm.items.find(i => i.product_id === found.id);
      if (!existing) {
        setCreateForm(prev => ({
          ...prev,
          grm_number: grmValue,
          supplier_id: prev.supplier_id || found.supplier_id,
          items: [...prev.items, { product_id: found.id, quantity: 1 }],
        }));
        toast.success(`Produit trouvé: ${found.description}`);
      }
    }
  };

  const addItem = (productId) => {
    if (!productId) return;
    const existing = createForm.items.find(i => i.product_id === productId);
    if (existing) {
      setCreateForm({ ...createForm, items: createForm.items.map(i => i.product_id === productId ? { ...i, quantity: i.quantity + 1 } : i) });
    } else {
      setCreateForm({ ...createForm, items: [...createForm.items, { product_id: productId, quantity: 1 }] });
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    if (createForm.items.length === 0) { toast.error('Ajoutez au moins un produit'); return; }
    try {
      await api.post('/orders', createForm);
      toast.success('Commande créée');
      setShowCreate(false);
      setCreateForm({ supplier_id: '', grm_number: '', items: [] });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleSend = async (orderId) => {
    try {
      await api.put(`/orders/${orderId}/send`);
      toast.success('Commande envoyée');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleCancel = async (orderId) => {
    if (!window.confirm('Annuler cette commande ?')) return;
    try {
      await api.delete(`/orders/${orderId}`);
      toast.success('Commande annulée');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const openReceive = async (orderId) => {
    try {
      const res = await api.get(`/orders/${orderId}`);
      setOrderDetail(res.data);
      const pendingItems = (res.data.items || []).filter(i => i.status === 1); // ORDERED
      setReceiveItems(pendingItems.map(i => ({ instance_id: i.id, product: i.product, serial_number: '', lot_number: '', expiration_date: '' })));
      setShowReceive(orderId);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleReceive = async () => {
    const items = receiveItems.filter(i => i.serial_number.trim());
    if (items.length === 0) { toast.error('Saisissez au moins un numéro de série'); return; }
    try {
      const res = await api.put(`/orders/${showReceive}/receive`, { items });
      toast.success(`${res.data.received} produit(s) réceptionné(s)`);
      setShowReceive(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Commandes</h1>
          <p className="text-sm text-slate-500 mt-0.5">Créer, envoyer et réceptionner des commandes</p>
        </div>
        <button data-testid="create-order-btn" onClick={() => { setCreateForm({ supplier_id: '', grm_number: '', items: [] }); setProductSearch(''); setShowCreate(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nouvelle commande
        </button>
      </div>

      {/* Pending reception section */}
      {orders.filter(o => o.status === 'sent' || o.status === 'partially_received').length > 0 && (
        <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-xl">
          <h3 className="font-semibold text-amber-800 mb-2 flex items-center gap-2">
            <PackageCheck className="w-4 h-4" /> En attente de réception
          </h3>
          <div className="space-y-2">
            {orders.filter(o => o.status === 'sent' || o.status === 'partially_received').map(o => (
              <div key={o.id} className="flex items-center justify-between bg-white rounded-lg p-3 border border-amber-100">
                <div>
                  <span className="font-medium text-sm">{o.supplier?.name || '—'}</span>
                  {o.grm_number && <span className="text-xs text-slate-500 ml-2">GRM: {o.grm_number}</span>}
                  <span className="text-xs text-slate-400 ml-2">{o.received_items}/{o.total_items} reçus</span>
                </div>
                <button data-testid={`receive-btn-${o.id}`} onClick={() => openReceive(o.id)}
                  className="text-xs bg-amber-600 text-white px-3 py-1.5 rounded-lg hover:bg-amber-700">
                  Réceptionner
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Orders table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('supplier')}>
                Fournisseur <SortIcon col="supplier" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('grm_number')}>
                N° GRM <SortIcon col="grm_number" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('created_at')}>
                Date création <SortIcon col="created_at" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('order_date')}>
                Date envoi <SortIcon col="order_date" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('items')}>
                Articles <SortIcon col="items" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('status')}>
                Statut <SortIcon col="status" />
              </th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-400">Chargement...</td></tr>
            ) : orders.length === 0 ? (
              <tr><td colSpan="7" className="px-4 py-8 text-center text-slate-400">Aucune commande</td></tr>
            ) : sortedOrders.map(o => (
              <tr key={o.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{o.supplier?.name || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">{o.grm_number || '—'}</td>
                <td className="px-4 py-3 text-slate-600">{new Date(o.creation_date || o.created_at).toLocaleDateString('fr-CA')}</td>
                <td className="px-4 py-3 text-slate-600">{o.order_date ? new Date(o.order_date).toLocaleDateString('fr-CA') : '—'}</td>
                <td className="px-4 py-3">{o.received_items}/{o.total_items}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${STATUS_COLORS[o.status] || 'bg-slate-100'}`}>
                    {STATUS_LABELS[o.status] || o.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    {o.status === 'draft' && (
                      <>
                        <button onClick={() => handleSend(o.id)} className="p-1 hover:bg-blue-50 rounded" title="Envoyer">
                          <Send className="w-3.5 h-3.5 text-blue-500" />
                        </button>
                        <button onClick={() => handleCancel(o.id)} className="p-1 hover:bg-red-50 rounded" title="Annuler">
                          <Trash2 className="w-3.5 h-3.5 text-red-400" />
                        </button>
                      </>
                    )}
                    {(o.status === 'sent' || o.status === 'partially_received') && (
                      <button onClick={() => openReceive(o.id)} className="p-1 hover:bg-green-50 rounded" title="Réceptionner">
                        <PackageCheck className="w-3.5 h-3.5 text-green-600" />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create Order Modal */}
      {showCreate && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-2xl h-[80vh] overflow-y-auto">
            <h2 className="text-lg font-bold mb-4">Nouvelle commande</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Fournisseur *</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" required
                  value={createForm.supplier_id} onChange={e => setCreateForm({ ...createForm, supplier_id: e.target.value, items: [] })}>
                  <option value="">Sélectionner...</option>
                  {suppliers.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">N° GRM</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Entrez le N° GRM pour trouver le produit automatiquement"
                  value={createForm.grm_number} onChange={e => handleGrmLookup(e.target.value)} />
              </div>
              {createForm.supplier_id && (
                <div className="relative">
                  <label className="block text-sm font-medium mb-1">Ajouter des produits</label>
                  <input
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                    placeholder="Tapez pour rechercher un produit..."
                    value={productSearch}
                    onChange={e => { setProductSearch(e.target.value); setShowProductDropdown(true); }}
                    onFocus={() => setShowProductDropdown(true)}
                    onClick={e => e.stopPropagation()}
                  />
                  {showProductDropdown && filteredSupplierProducts.length > 0 && (
                    <div className="absolute z-10 left-0 right-0 mt-1 bg-white border rounded-lg shadow-lg max-h-[400px] overflow-y-auto">
                      {filteredSupplierProducts.map(p => (
                        <button key={p.id} type="button"
                          className="w-full text-left px-3 py-2 text-sm hover:bg-blue-50 border-b border-slate-100 last:border-0"
                          onClick={() => { addItem(p.id); setProductSearch(''); setShowProductDropdown(false); }}
                        >
                          <span className="font-medium">{p.description}</span>
                          {p.specification_obj?.description && <span className="text-slate-500 ml-1">({p.specification_obj.description})</span>}
                          {p.grm_number && <span className="text-slate-400 ml-2 text-xs font-mono">GRM: {p.grm_number}</span>}
                        </button>
                      ))}
                    </div>
                  )}
                  {createForm.items.length > 0 && (
                    <div className="mt-2 space-y-1">
                      {createForm.items.map((item, i) => {
                        const prod = products.find(p => p.id === item.product_id);
                        return (
                          <div key={i} className="flex items-center justify-between bg-slate-50 rounded px-3 py-2 text-xs">
                            <span className="flex-1">{prod?.description || '?'}</span>
                            <div className="flex items-center gap-2">
                              <input type="number" min={1} className="w-16 border rounded px-2 py-1 text-center"
                                value={item.quantity}
                                onChange={e => setCreateForm({ ...createForm, items: createForm.items.map((it, idx) => idx === i ? { ...it, quantity: parseInt(e.target.value) || 1 } : it) })} />
                              <button type="button" className="text-red-500 hover:text-red-700"
                                onClick={() => setCreateForm({ ...createForm, items: createForm.items.filter((_, idx) => idx !== i) })}>x</button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowCreate(false); setCreateForm({ supplier_id: '', grm_number: '', items: [] }); setProductSearch(''); }}
                  className="flex-1 border rounded-lg py-2 text-sm hover:bg-slate-50">Annuler</button>
                <button type="submit"
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Receive Modal - Enhanced with scan mode */}
      {showReceive && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            {/* Header with progress */}
            <div className="p-5 border-b">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-lg font-bold">Réception — {orderDetail?.supplier?.name}</h2>
                <span className="text-xs bg-green-100 text-green-700 px-2.5 py-1 rounded-full font-medium">
                  {receiveItems.filter(i => i.serial_number.trim()).length}/{receiveItems.length} rempli(s)
                </span>
              </div>
              {orderDetail?.grm_number && (
                <p className="text-xs text-slate-500">GRM: {orderDetail.grm_number}</p>
              )}

              {/* Scan to auto-fill */}
              <div className="mt-3 bg-blue-50 rounded-lg p-3 border border-blue-100">
                <p className="text-xs font-medium text-blue-700 mb-1.5">Mode scan rapide</p>
                <p className="text-[11px] text-blue-600 mb-2">Scannez un code-barres pour remplir automatiquement le prochain champ N° Série vide</p>
                <input
                  data-testid="receive-scan-input"
                  className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-blue-400"
                  placeholder="Scanner ici..."
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const val = e.target.value.trim();
                      if (!val) return;
                      // Find first empty serial field and fill it
                      const emptyIdx = receiveItems.findIndex(ri => !ri.serial_number.trim());
                      if (emptyIdx >= 0) {
                        setReceiveItems(receiveItems.map((ri, idx) =>
                          idx === emptyIdx ? { ...ri, serial_number: val } : ri
                        ));
                        toast.success(`N° Série assigné au produit #${emptyIdx + 1}`);
                      } else {
                        toast.info('Tous les champs sont déjà remplis');
                      }
                      e.target.value = '';
                    }
                  }}
                />
              </div>
            </div>

            {/* Items */}
            <div className="p-5 space-y-3">
              {receiveItems.map((item, i) => {
                const isFilled = item.serial_number.trim();
                return (
                  <div key={i} data-testid={`receive-item-${i}`}
                    className={`rounded-lg p-3 border transition-colors ${
                      isFilled ? 'bg-green-50 border-green-200' : 'bg-slate-50 border-slate-200'
                    }`}>
                    <div className="flex items-center gap-2 mb-2">
                      <span className={`w-6 h-6 rounded-full text-xs flex items-center justify-center font-bold ${
                        isFilled ? 'bg-green-600 text-white' : 'bg-slate-300 text-white'
                      }`}>{i + 1}</span>
                      <p className="text-sm font-medium flex-1">
                        {item.product?.description || '—'}
                        {item.product?.specification && <span className="text-slate-500 font-normal"> ({item.product.specification})</span>}
                      </p>
                      {isFilled && <Check className="w-4 h-4 text-green-600" />}
                    </div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">N° Série *</label>
                        <input
                          data-testid={`serial-input-${i}`}
                          className={`w-full border rounded px-2 py-1.5 text-sm outline-none ${
                            isFilled ? 'bg-green-50 border-green-300' : 'focus:ring-2 focus:ring-blue-400'
                          }`}
                          value={item.serial_number}
                          onChange={e => setReceiveItems(receiveItems.map((ri, idx) => idx === i ? { ...ri, serial_number: e.target.value } : ri))}
                          onKeyDown={e => {
                            // Tab-like: on Enter, focus next serial field
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              const nextInput = document.querySelector(`[data-testid="serial-input-${i + 1}"]`);
                              if (nextInput) nextInput.focus();
                            }
                          }}
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">N° Lot</label>
                        <input className="w-full border rounded px-2 py-1.5 text-sm"
                          value={item.lot_number}
                          onChange={e => setReceiveItems(receiveItems.map((ri, idx) => idx === i ? { ...ri, lot_number: e.target.value } : ri))} />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-0.5">Date expiration</label>
                        <input type="date" className="w-full border rounded px-2 py-1.5 text-sm"
                          value={item.expiration_date}
                          onChange={e => setReceiveItems(receiveItems.map((ri, idx) => idx === i ? { ...ri, expiration_date: e.target.value } : ri))} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer with batch actions */}
            <div className="p-5 border-t bg-slate-50 flex items-center gap-3">
              <button onClick={() => {
                // Apply same lot + expiry to all empty items
                const firstFilled = receiveItems.find(ri => ri.lot_number || ri.expiration_date);
                if (firstFilled) {
                  setReceiveItems(receiveItems.map(ri => ({
                    ...ri,
                    lot_number: ri.lot_number || firstFilled.lot_number,
                    expiration_date: ri.expiration_date || firstFilled.expiration_date,
                  })));
                  toast.success('Lot et expiration copiés sur tous les articles');
                } else {
                  toast.info('Remplissez d\'abord le lot/expiration d\'un article');
                }
              }}
                className="text-xs text-blue-600 hover:text-blue-800 font-medium">
                Copier lot/expiration sur tous
              </button>
              <div className="flex-1" />
              <button onClick={() => setShowReceive(null)}
                className="px-4 py-2 border rounded-lg text-sm hover:bg-white">Annuler</button>
              <button onClick={handleReceive}
                className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                Confirmer la réception ({receiveItems.filter(i => i.serial_number.trim()).length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
