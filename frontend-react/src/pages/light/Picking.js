import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { api } from '@/App';
import { toast } from 'sonner';
import { ArrowLeft, Camera, Check, RefreshCw, MapPin, RotateCcw, Plus, AlertCircle, User, FileText, Pencil, X, Trash2 } from 'lucide-react';
import { InterventionFormFields } from '@/components/interventions';
import { useSocketEvent } from '@/hooks/useSocket';

export default function LightPicking({ user, onLogout }) {
  const { interventionId } = useParams();
  const navigate = useNavigate();
  const [intervention, setIntervention] = useState(null);
  const [loading, setLoading] = useState(true);
  const [scanInput, setScanInput] = useState('');
  const [pickedItems, setPickedItems] = useState([]);
  const [fifoSuggestions, setFifoSuggestions] = useState([]);
  const [mismatchConfirm, setMismatchConfirm] = useState(null); // {message, product_id, instance_id, scanned_description}
  const scanRef = useRef(null);

  // Refine states for partial products
  const [refiningIpId, setRefiningIpId] = useState(null);
  const [stockCatId, setStockCatId] = useState('');
  const [stockTypeId, setStockTypeId] = useState('');
  const [stockSpecId, setStockSpecId] = useState('');
  const [stockFilterOptions, setStockFilterOptions] = useState({ categories: [], types: [], specifications: [] });
  const [stockResults, setStockResults] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);

  // Edit intervention state
  const [showEdit, setShowEdit] = useState(false);
  const [editForm, setEditForm] = useState({ planned_date: '', operating_room: '', patient_file_number: '', birth_date: '' });

  // Add product state
  const [showAddProduct, setShowAddProduct] = useState(false);

  const openEditForm = () => {
    if (!intervention) return;
    setEditForm({
      planned_date: intervention.planned_datetime ? intervention.planned_datetime.slice(0, 10) : '',
      operating_room: intervention.operating_room || '',
      patient_file_number: intervention.patient_file_number || '',
      birth_date: intervention.birth_date || '',
    });
    setShowEdit(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        planned_datetime: editForm.planned_date ? editForm.planned_date + 'T00:00:00' : undefined,
        operating_room: editForm.operating_room || null,
        patient_file_number: editForm.patient_file_number || null,
        birth_date: editForm.birth_date || null,
      };
      if (!payload.patient_file_number) payload.patient_file_number = null;
      if (!payload.birth_date) payload.birth_date = null;
      await api.put(`/interventions/${interventionId}`, payload);
      toast.success('Intervention modifiée');
      setShowEdit(false);
      fetchIntervention();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async () => {
    try {
      await api.delete(`/interventions/${interventionId}`);
      toast.success('Intervention supprimée');
      navigate('/production/interventions');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const fetchStock = useCallback(async (catId, typId, spcId) => {
    setStockLoading(true);
    try {
      const params = new URLSearchParams();
      if (catId) params.set('category_id', catId);
      if (typId) params.set('type_id', typId);
      if (spcId) params.set('specification_id', spcId);
      const res = await api.get(`/products/filter-options?${params}`);
      setStockResults(res.data.products || []);
      setStockFilterOptions(res.data.filter_options || { categories: [], types: [], specifications: [] });
    } catch {
      toast.error('Erreur chargement stock');
    } finally {
      setStockLoading(false);
    }
  }, []);

  const handleStockCatChange = (val) => {
    const v = stockCatId === val ? '' : val;
    setStockCatId(v); setStockTypeId(''); setStockSpecId('');
    fetchStock(v, '', '');
  };
  const handleStockTypeChange = (val) => {
    const v = stockTypeId === val ? '' : val;
    setStockTypeId(v); setStockSpecId('');
    fetchStock(stockCatId, v, '');
  };
  const handleStockSpecChange = (val) => {
    const v = stockSpecId === val ? '' : val;
    setStockSpecId(v);
    fetchStock(stockCatId, stockTypeId, v);
  };

  const startRefine = (ip) => {
    setShowAddProduct(false);
    setRefiningIpId(ip.id);
    const catId = ip.category_id || '';
    const typId = ip.type_id || '';
    const spcId = ip.specification_id || '';
    setStockCatId(catId); setStockTypeId(typId); setStockSpecId(spcId);
    fetchStock(catId, typId, spcId);
  };

  const cancelRefine = () => {
    setRefiningIpId(null);
    setStockCatId(''); setStockTypeId(''); setStockSpecId('');
  };

  const startAddProduct = () => {
    setRefiningIpId(null);
    setShowAddProduct(true);
    setStockCatId(''); setStockTypeId(''); setStockSpecId('');
    fetchStock('', '', '');
  };

  const cancelAddProduct = () => {
    setShowAddProduct(false);
    setStockCatId(''); setStockTypeId(''); setStockSpecId('');
  };

  const handleAddProduct = async (product) => {
    try {
      await api.post(`/interventions/${interventionId}/products`, {
        product_id: product.product_id,
        required_quantity: 1,
      });
      toast.success('Produit ajouté');
      setShowAddProduct(false);
      setStockCatId(''); setStockTypeId(''); setStockSpecId('');
      fetchIntervention();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleAddPartial = async () => {
    if (!stockCatId) return;
    try {
      await api.post(`/interventions/${interventionId}/products`, {
        category_id: stockCatId,
        type_id: stockTypeId || undefined,
        specification_id: stockSpecId || undefined,
        required_quantity: 1,
      });
      toast.success('Produit ajouté');
      setShowAddProduct(false);
      setStockCatId(''); setStockTypeId(''); setStockSpecId('');
      fetchIntervention();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const confirmRefine = async (refinement) => {
    if (!refiningIpId) return;
    try {
      await api.put(`/interventions/${interventionId}/products/${refiningIpId}`, refinement);
      toast.success('Produit complété');
      setRefiningIpId(null);
      fetchIntervention();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const fetchIntervention = async () => {
    try {
      const [intRes, fifoRes] = await Promise.all([
        api.get(`/interventions/${interventionId}`),
        api.get(`/interventions/${interventionId}/fifo-suggestions`),
      ]);
      setIntervention(intRes.data);
      setFifoSuggestions(fifoRes.data);
    } catch (err) {
      toast.error('Intervention non trouvée');
      navigate('/production/interventions');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchIntervention(); }, [interventionId]);

  // Auto-refresh on real-time events from other clients
  useSocketEvent(['intervention_changed', 'inventory_changed'], (data) => {
    // Only refresh if it concerns this intervention or is a general inventory change
    if (!data?.id || data.id === interventionId || data.action === 'picked' || data.action === 'returned') {
      fetchIntervention();
    }
  });

  useEffect(() => {
    if (scanRef.current) scanRef.current.focus();
  });

  const handleScan = async () => {
    const serial = scanInput.trim();
    if (!serial) return;

    try {
      const scanRes = await api.post('/instances/scan', { serial_number: serial });
      const data = scanRes.data;

      if (data.action === 'already_placed' && data.instance) {
        const pickRes = await api.post(`/interventions/${interventionId}/pick`, {
          product_id: data.instance.product_id,
          instance_id: data.instance.id,
        });

        // Mismatch — show confirmation dialog
        if (pickRes.data.mismatch) {
          setMismatchConfirm({
            message: pickRes.data.message,
            expected_label: pickRes.data.expected_label,
            scanned_description: pickRes.data.scanned_description,
            product_id: data.instance.product_id,
            instance_id: data.instance.id,
            serial_number: serial,
            expiration_date: data.instance.expiration_date,
          });
          setScanInput('');
          if (scanRef.current) scanRef.current.focus();
          return;
        }

        // Normal pick success
        const ip = intervention?.products?.find(p => p.product_id === data.instance.product_id);
        const typeDesc = ip?.product?.type?.description || ip?.product?.category?.description || '';
        const specDesc = ip?.product?.specification_obj?.description || ip?.product?.specification || '';
        toast.success(`Produit prélevé: ${data.instance.product?.description || serial}`);
        setPickedItems(prev => [...prev, {
          serial_number: serial,
          type_spec: [typeDesc, specDesc].filter(Boolean).join(' — '),
          description: ip?.product?.description || data.instance.product?.description || '—',
          expiration_date: data.instance.expiration_date,
          location_code: pickRes.data.location_code,
        }]);
        fetchIntervention();
      } else if (data.action === 'unknown') {
        toast.error('Numéro de série inconnu');
      } else {
        toast.error(`Produit non disponible (statut: ${data.instance?.status || 'inconnu'})`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du scan');
    }

    setScanInput('');
    if (scanRef.current) scanRef.current.focus();
  };

  const handleMismatchConfirm = async () => {
    if (!mismatchConfirm) return;
    try {
      const pickRes = await api.post(`/interventions/${interventionId}/pick`, {
        product_id: mismatchConfirm.product_id,
        instance_id: mismatchConfirm.instance_id,
        force: true,
      });
      toast.success(`Produit prélevé: ${mismatchConfirm.scanned_description}`);
      setPickedItems(prev => [...prev, {
        serial_number: mismatchConfirm.serial_number,
        type_spec: '',
        description: mismatchConfirm.scanned_description,
        expiration_date: mismatchConfirm.expiration_date,
        location_code: pickRes.data.location_code,
      }]);
      setMismatchConfirm(null);
      fetchIntervention();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
      setMismatchConfirm(null);
    }
  };

  const handlePickInstance = async (productId, instanceId) => {
    try {
      const res = await api.post(`/interventions/${interventionId}/pick`, {
        product_id: productId,
        instance_id: instanceId,
      });
      const ip = intervention?.products?.find(p => p.product_id === productId);
      const typeDesc = ip?.product?.type?.description || ip?.product?.category?.description || '';
      const specDesc = ip?.product?.specification_obj?.description || ip?.product?.specification || '';
      toast.success('Produit prélevé');
      setPickedItems(prev => [...prev, {
        serial_number: res.data.serial_number || '—',
        type_spec: [typeDesc, specDesc].filter(Boolean).join(' — '),
        description: ip?.product?.description || '—',
        expiration_date: res.data.expiration_date,
        location_code: res.data.location_code,
      }]);
      fetchIntervention();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-400">Chargement...</div>;
  }

  return (
    <div className="min-h-screen bg-slate-900 p-4 select-none">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/production/interventions')}
          className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="grid grid-cols-4 gap-3">
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Date opération</span>
              <p className="text-sm font-semibold text-white">
                {intervention?.planned_datetime ? new Date(intervention.planned_datetime).toLocaleDateString('fr-CA') : '—'}
              </p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">MRN</span>
              <p className="text-sm font-semibold text-white">{intervention?.patient_file_number || '—'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Date naissance</span>
              <p className="text-sm font-semibold text-white">{intervention?.birth_date || '—'}</p>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 uppercase tracking-wide">Salle</span>
              <p className="text-sm font-semibold text-white">{intervention?.operating_room || '—'}</p>
            </div>
          </div>
        </div>
        <button data-testid="light-edit-intervention" onClick={openEditForm}
          className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:text-blue-400 transition-colors"
          title="Modifier l'intervention">
          <Pencil className="w-5 h-5" />
        </button>
      </div>

      {/* Scan area */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-2 mb-2">
          <Camera className="w-4 h-4 text-blue-400" />
          <span className="text-sm font-medium text-white">Scanner un produit</span>
        </div>
        <div className="flex gap-2">
          <input
            ref={scanRef}
            data-testid="scan-input"
            className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg placeholder-slate-500 outline-none focus:border-blue-500"
            placeholder="Numéro de série..."
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
          />
          <button onClick={handleScan} data-testid="scan-submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
            OK
          </button>
        </div>
      </div>

      {/* Required products */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold text-slate-400 uppercase">Produits requis</h2>
          <button
            data-testid="add-product-btn"
            onClick={showAddProduct ? cancelAddProduct : startAddProduct}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
              showAddProduct
                ? 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                : 'bg-blue-600 text-white hover:bg-blue-700'
            }`}
          >
            {showAddProduct ? <X className="w-3.5 h-3.5" /> : <Plus className="w-3.5 h-3.5" />}
            {showAddProduct ? 'Fermer' : 'Ajouter'}
          </button>
        </div>

        {/* Add product panel */}
        {showAddProduct && (
          <div className="bg-slate-800/80 border border-blue-500/50 rounded-xl p-4 space-y-3 mb-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Ajouter un produit</span>
              {(stockCatId || stockTypeId || stockSpecId) && (
                <button onClick={() => { setStockCatId(''); setStockTypeId(''); setStockSpecId(''); fetchStock('', '', ''); }}
                  className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400">
                  <RotateCcw className="w-3 h-3" /> Réinitialiser
                </button>
              )}
            </div>

            {/* 3-column cascading filters */}
            <div className="grid grid-cols-3 gap-2">
              <div className="border border-slate-700 rounded-lg overflow-hidden">
                <div className="px-2 py-1 bg-slate-700 text-[9px] font-bold text-slate-400 uppercase tracking-wide">Catégorie</div>
                <div className="max-h-28 overflow-y-auto">
                  {stockFilterOptions.categories.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-slate-500">Aucune</div>
                  ) : [...stockFilterOptions.categories].sort((a, b) => a.description.localeCompare(b.description)).map(c => (
                    <button key={c.id} type="button"
                      onClick={() => handleStockCatChange(c.id)}
                      className={`w-full text-left px-2 py-1.5 text-xs border-b border-slate-700/50 transition-colors ${
                        stockCatId === c.id ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-700/50'
                      }`}>
                      {c.description}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border border-slate-700 rounded-lg overflow-hidden">
                <div className="px-2 py-1 bg-slate-700 text-[9px] font-bold text-slate-400 uppercase tracking-wide">Modèle</div>
                <div className="max-h-28 overflow-y-auto">
                  {stockFilterOptions.types.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-slate-500">Aucun</div>
                  ) : [...stockFilterOptions.types].sort((a, b) => a.description.localeCompare(b.description)).map(t => (
                    <button key={t.id} type="button"
                      onClick={() => handleStockTypeChange(t.id)}
                      className={`w-full text-left px-2 py-1.5 text-xs border-b border-slate-700/50 transition-colors ${
                        stockTypeId === t.id ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-700/50'
                      }`}>
                      {t.description}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border border-slate-700 rounded-lg overflow-hidden">
                <div className="px-2 py-1 bg-slate-700 text-[9px] font-bold text-slate-400 uppercase tracking-wide">Spécification</div>
                <div className="max-h-28 overflow-y-auto">
                  {stockFilterOptions.specifications.length === 0 ? (
                    <div className="px-2 py-1.5 text-xs text-slate-500">Aucune</div>
                  ) : [...stockFilterOptions.specifications].sort((a, b) => a.description.localeCompare(b.description)).map(s => (
                    <button key={s.id} type="button"
                      onClick={() => handleStockSpecChange(s.id)}
                      className={`w-full text-left px-2 py-1.5 text-xs border-b border-slate-700/50 transition-colors ${
                        stockSpecId === s.id ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-700/50'
                      }`}>
                      {s.description}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Confirm at filter level (partial product) */}
            {stockCatId && (
              <button
                data-testid="add-confirm-filter"
                onClick={handleAddPartial}
                className="w-full py-2 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-600/30 transition-colors border border-blue-500/30">
                Ajouter : {[
                  stockFilterOptions.categories.find(c => c.id === stockCatId)?.description,
                  stockTypeId && stockFilterOptions.types.find(t => t.id === stockTypeId)?.description,
                  stockSpecId && stockFilterOptions.specifications.find(s => s.id === stockSpecId)?.description,
                ].filter(Boolean).join(' / ')}
              </button>
            )}

            {/* Product results table */}
            <div className="border border-slate-700 rounded-lg overflow-hidden">
              <table className="w-full text-xs">
                <thead className="bg-slate-700">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-medium text-slate-400">Description</th>
                    <th className="text-center px-2 py-1.5 font-medium text-slate-400">Stock</th>
                    <th className="w-10"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-700/50">
                  {stockLoading ? (
                    <tr><td colSpan="3" className="px-2 py-3 text-center text-slate-500">Chargement...</td></tr>
                  ) : stockResults.length === 0 ? (
                    <tr><td colSpan="3" className="px-2 py-3 text-center text-slate-500">Aucun produit</td></tr>
                  ) : stockResults.map(r => (
                    <tr key={r.product_id} className="hover:bg-slate-700/30">
                      <td className="px-2 py-1.5 text-slate-200">{r.description}</td>
                      <td className="px-2 py-1.5 text-center">
                        <span className="bg-emerald-900/40 text-emerald-400 font-bold px-1.5 py-0.5 rounded-full">{r.quantity}</span>
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          data-testid={`add-select-${r.product_id}`}
                          onClick={() => handleAddProduct(r)}
                          className="p-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-colors">
                          <Plus className="w-4 h-4" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        <div className="space-y-2">
          {(intervention?.products || []).map(ip => {
            const fifo = fifoSuggestions.find(f => f.ip_id === ip.id || f.product_id === ip.product_id);
            const isDone = ip.picked_quantity >= ip.required_quantity;
            const instances = fifo?.instances || [];
            const isPartial = ip.resolution && ip.resolution !== 'product' && ip.resolution !== 'instance';
            const nearestLoc = instances[0]?.location_code;

            // Build display label
            let mainLabel = '';
            if (ip.product?.description) {
              mainLabel = ip.product.description;
            } else {
              const parts = [];
              if (ip.category?.description) parts.push(ip.category.description);
              if (ip.type_obj?.description) parts.push(ip.type_obj.description);
              if (ip.specification_obj?.description) parts.push(ip.specification_obj.description);
              mainLabel = parts.join(' / ') || '—';
            }

            return (
              <div key={ip.id} data-testid={`product-card-${ip.id}`}>
                <div className={`bg-slate-800 rounded-xl p-4 transition-all ${isDone ? 'opacity-50' : ''} ${isPartial ? 'border border-amber-500/30' : ''} ${refiningIpId === ip.id ? 'rounded-b-none border-b-0 border-blue-500/50' : ''}`}>
                  {/* Main row: description + location + quantity */}
                  <div className="flex items-center gap-4 mb-2">
                    <div className="flex-1 min-w-0">
                      {isPartial && (
                        <span className="text-[10px] font-bold text-amber-400 bg-amber-400/10 px-1.5 py-0.5 rounded mb-1 inline-block">
                          {ip.resolution === 'category' ? 'CATÉGORIE' : ip.resolution === 'type' ? 'MODÈLE' : 'SPÉCIFICATION'}
                        </span>
                      )}
                      <div className={`text-white font-medium text-sm ${isPartial ? '' : ''}`}>{mainLabel}</div>
                      {isPartial && <div className="text-amber-400 text-xs mt-0.5">À compléter</div>}
                    </div>

                    {/* Location of first FIFO instance */}
                    {!isDone && !isPartial && nearestLoc && (
                      <div className="flex items-center gap-1.5 text-blue-400 shrink-0">
                        <MapPin className="w-5 h-5" />
                        <span className="text-2xl font-black">{nearestLoc}</span>
                      </div>
                    )}

                    {/* Done badge */}
                    {isDone && (
                      <div className="flex items-center gap-1.5 bg-green-600 px-3 py-2 rounded-lg shrink-0">
                        <Check className="w-4 h-4 text-white" />
                        <span className="text-white text-sm font-bold">OK</span>
                      </div>
                    )}

                    {/* Quantity badge (like stock badge in PickingLibre) */}
                    <div className={`rounded-lg px-3 py-2 shrink-0 text-center min-w-[60px] ${
                      isDone ? 'bg-green-600/20 border border-green-500/30' : 'bg-emerald-600/20 border border-emerald-500/30'
                    }`}>
                      <div className={`text-2xl font-black leading-none ${isDone ? 'text-green-400' : 'text-emerald-400'}`}>
                        {ip.picked_quantity}/{ip.required_quantity}
                      </div>
                      <div className={`text-[10px] mt-0.5 ${isDone ? 'text-green-600' : 'text-emerald-600'}`}>
                        {isDone ? 'complet' : instances.length > 0 ? 'en stock' : 'rupture'}
                      </div>
                    </div>

                    {/* Refresh button */}
                    {!isDone && !isPartial && (
                      <button
                        data-testid={`refresh-btn-${ip.id}`}
                        onClick={() => fetchIntervention()}
                        className="p-2.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-blue-600 hover:text-white shrink-0 transition-colors"
                        title="Rafraîchir"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}

                    {/* Compléter button for partial products */}
                    {isPartial && !isDone && refiningIpId !== ip.id && (
                      <button
                        data-testid={`refine-btn-${ip.id}`}
                        onClick={() => startRefine(ip)}
                        className="px-3 py-2 bg-amber-500/20 text-amber-400 rounded-lg font-bold text-sm hover:bg-amber-500/30 transition-colors shrink-0">
                        Compléter
                      </button>
                    )}
                    {refiningIpId === ip.id && (
                      <button onClick={cancelRefine}
                        className="px-3 py-2 bg-slate-700 text-slate-400 rounded-lg text-sm hover:bg-slate-600 transition-colors shrink-0">
                        Annuler
                      </button>
                    )}
                  </div>

                  {/* Instance sub-rows (like PickingLibre) */}
                  {!isDone && !isPartial && instances.length > 0 && (
                    <div className="space-y-1">
                      {instances.map(inst => (
                        <div key={inst.id}
                          className="flex items-center gap-3 bg-slate-700/50 rounded-lg px-3 py-2"
                        >
                          <div className="flex-1 min-w-0">
                            <span className="text-slate-300 font-mono text-xs">{inst.serial_number || inst.lot_number || '—'}</span>
                            {inst.expiration_date && (
                              <span className="text-slate-500 text-xs ml-2">
                                Exp: {new Date(inst.expiration_date).toLocaleDateString('fr-CA')}
                              </span>
                            )}
                            {inst.location_code && (
                              <span className="text-blue-400 text-xs ml-2">{inst.location_code}</span>
                            )}
                          </div>
                          <button
                            data-testid={`pick-instance-${inst.id}`}
                            onClick={() => handlePickInstance(ip.product_id || ip.id, inst.id)}
                            className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 transition-colors"
                          >
                            Prélever
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Inline refine panel */}
                {refiningIpId === ip.id && (
                  <div className="bg-slate-800/80 border border-blue-500/50 border-t-0 rounded-b-xl p-4 space-y-3">
                    {/* Header */}
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-blue-400 uppercase tracking-wide">Compléter la sélection</span>
                      {(stockCatId || stockTypeId || stockSpecId) && (
                        <button onClick={() => { setStockCatId(''); setStockTypeId(''); setStockSpecId(''); fetchStock('', '', ''); }}
                          className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-blue-400">
                          <RotateCcw className="w-3 h-3" /> Réinitialiser
                        </button>
                      )}
                    </div>

                    {/* 3-column cascading filters — dark theme */}
                    <div className="grid grid-cols-3 gap-2">
                      {/* Catégorie */}
                      <div className="border border-slate-700 rounded-lg overflow-hidden">
                        <div className="px-2 py-1 bg-slate-700 text-[9px] font-bold text-slate-400 uppercase tracking-wide">Catégorie</div>
                        <div className="max-h-28 overflow-y-auto">
                          {stockFilterOptions.categories.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-slate-500">Aucune</div>
                          ) : [...stockFilterOptions.categories].sort((a, b) => a.description.localeCompare(b.description)).map(c => (
                            <button key={c.id} type="button"
                              onClick={() => handleStockCatChange(c.id)}
                              className={`w-full text-left px-2 py-1.5 text-xs border-b border-slate-700/50 transition-colors ${
                                stockCatId === c.id ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-700/50'
                              }`}>
                              {c.description}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Modèle */}
                      <div className="border border-slate-700 rounded-lg overflow-hidden">
                        <div className="px-2 py-1 bg-slate-700 text-[9px] font-bold text-slate-400 uppercase tracking-wide">Modèle</div>
                        <div className="max-h-28 overflow-y-auto">
                          {stockFilterOptions.types.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-slate-500">Aucun</div>
                          ) : [...stockFilterOptions.types].sort((a, b) => a.description.localeCompare(b.description)).map(t => (
                            <button key={t.id} type="button"
                              onClick={() => handleStockTypeChange(t.id)}
                              className={`w-full text-left px-2 py-1.5 text-xs border-b border-slate-700/50 transition-colors ${
                                stockTypeId === t.id ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-700/50'
                              }`}>
                              {t.description}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Spécification */}
                      <div className="border border-slate-700 rounded-lg overflow-hidden">
                        <div className="px-2 py-1 bg-slate-700 text-[9px] font-bold text-slate-400 uppercase tracking-wide">Spécification</div>
                        <div className="max-h-28 overflow-y-auto">
                          {stockFilterOptions.specifications.length === 0 ? (
                            <div className="px-2 py-1.5 text-xs text-slate-500">Aucune</div>
                          ) : [...stockFilterOptions.specifications].sort((a, b) => a.description.localeCompare(b.description)).map(s => (
                            <button key={s.id} type="button"
                              onClick={() => handleStockSpecChange(s.id)}
                              className={`w-full text-left px-2 py-1.5 text-xs border-b border-slate-700/50 transition-colors ${
                                stockSpecId === s.id ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-700/50'
                              }`}>
                              {s.description}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* Confirm at filter level */}
                    {stockCatId && (
                      <button
                        data-testid="refine-confirm-filter"
                        onClick={() => confirmRefine({ category_id: stockCatId, type_id: stockTypeId || undefined, specification_id: stockSpecId || undefined })}
                        className="w-full py-2 bg-blue-600/20 text-blue-400 rounded-lg text-xs font-bold hover:bg-blue-600/30 transition-colors border border-blue-500/30">
                        Confirmer : {[
                          stockFilterOptions.categories.find(c => c.id === stockCatId)?.description,
                          stockTypeId && stockFilterOptions.types.find(t => t.id === stockTypeId)?.description,
                          stockSpecId && stockFilterOptions.specifications.find(s => s.id === stockSpecId)?.description,
                        ].filter(Boolean).join(' / ')}
                      </button>
                    )}

                    {/* Stock results */}
                    <div className="border border-slate-700 rounded-lg overflow-hidden">
                      <table className="w-full text-xs">
                        <thead className="bg-slate-700">
                          <tr>
                            <th className="text-left px-2 py-1.5 font-medium text-slate-400">Description</th>
                            <th className="text-left px-2 py-1.5 font-medium text-slate-400">N° de série</th>
                            <th className="text-center px-2 py-1.5 font-medium text-slate-400">Stock</th>
                            <th className="w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-700/50">
                          {stockLoading ? (
                            <tr><td colSpan="4" className="px-2 py-3 text-center text-slate-500">Chargement...</td></tr>
                          ) : stockResults.length === 0 ? (
                            <tr><td colSpan="4" className="px-2 py-3 text-center text-slate-500">Aucun produit</td></tr>
                          ) : stockResults.map(r => (
                            <tr key={r.product_id} className="hover:bg-slate-700/30">
                              <td className="px-2 py-1.5 text-slate-200">{r.description}</td>
                              <td className="px-2 py-1.5">
                                <div className="flex flex-wrap gap-1">
                                  {(r.instances || []).slice(0, 3).map((inst, idx) => (
                                    <span key={idx} className="bg-slate-700 text-slate-300 px-1 py-0.5 rounded font-mono text-[10px]">
                                      {inst.serial_number || inst.lot_number || '—'}
                                    </span>
                                  ))}
                                  {(r.instances || []).length > 3 && (
                                    <span className="text-slate-500 text-[10px]">+{r.instances.length - 3}</span>
                                  )}
                                </div>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <span className="bg-emerald-900/40 text-emerald-400 font-bold px-1.5 py-0.5 rounded-full">{r.quantity}</span>
                              </td>
                              <td className="px-2 py-1.5 text-center">
                                <button
                                  data-testid={`refine-select-${r.product_id}`}
                                  onClick={() => confirmRefine({ product_id: r.product_id })}
                                  className="p-1 rounded bg-blue-600/20 text-blue-400 hover:bg-blue-600/40 transition-colors">
                                  <Check className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Picked items log */}
      {pickedItems.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase mb-3">Prélevés cette session</h2>
          <div className="space-y-1">
            {pickedItems.map((item, i) => (
              <div key={i} className="bg-green-900/30 border border-green-700/30 rounded-lg px-3 py-2.5 text-sm">
                <div className="flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                  <span className="text-green-300 font-mono font-bold">{item.serial_number}</span>
                  <span className="flex-1" />
                  {item.location_code && <span className="text-green-600 text-xs">{item.location_code}</span>}
                  {item.expiration_date && (
                    <span className="text-green-500 text-xs">
                      Exp: {new Date(item.expiration_date).toLocaleDateString('fr-CA')}
                    </span>
                  )}
                </div>
                {item.type_spec && <div className="text-green-400 text-xs mt-1 ml-6">{item.type_spec}</div>}
                <div className="text-green-600 text-xs mt-0.5 ml-6">{item.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}
      {/* Mismatch confirmation dialog */}
      {mismatchConfirm && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-slate-800 border border-amber-500/50 rounded-2xl p-6 w-full max-w-md">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-400" />
              </div>
              <h3 className="text-white font-bold text-lg">Produit non conforme</h3>
            </div>

            <p className="text-slate-300 text-sm mb-4">{mismatchConfirm.message}</p>

            <div className="bg-slate-700/50 rounded-lg p-3 mb-4 text-sm">
              <div className="text-slate-400 mb-1">Produit scanné :</div>
              <div className="text-white font-semibold">{mismatchConfirm.scanned_description}</div>
            </div>

            <p className="text-slate-400 text-sm mb-5">Voulez-vous l'ajouter quand même à cette intervention ?</p>

            <div className="flex gap-3">
              <button
                data-testid="mismatch-cancel"
                onClick={() => setMismatchConfirm(null)}
                className="flex-1 py-3 bg-slate-700 text-slate-300 rounded-xl font-bold hover:bg-slate-600 transition-colors">
                Non, annuler
              </button>
              <button
                data-testid="mismatch-confirm"
                onClick={handleMismatchConfirm}
                className="flex-1 py-3 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-500 transition-colors">
                Oui, ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit intervention modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-slate-800 rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white">Modifier l'intervention</h2>
              <button onClick={() => setShowEdit(false)} className="p-1.5 rounded-lg hover:bg-slate-700">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>
            <form onSubmit={handleEdit} className="p-4 space-y-4">
              <InterventionFormFields
                form={editForm}
                onChange={(field, value) => setEditForm(prev => ({ ...prev, [field]: value }))}
                dark
                testIdPrefix="light-picking-edit"
              />
              <div className="flex gap-2 pt-2 border-t border-slate-700">
                <button type="button" onClick={handleDelete} data-testid="light-delete-intervention"
                  className="px-4 border border-red-700/50 text-red-400 rounded-lg py-2.5 text-sm hover:bg-red-900/30 transition-colors">
                  <Trash2 className="w-4 h-4" />
                </button>
                <button type="button" onClick={() => setShowEdit(false)}
                  className="flex-1 border border-slate-600 text-slate-300 rounded-lg py-2.5 text-sm hover:bg-slate-700 transition-colors">Annuler</button>
                <button type="submit" data-testid="light-edit-submit"
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
