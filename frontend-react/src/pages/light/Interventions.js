import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { api } from '@/App';
import { toast } from 'sonner';
import { Calendar, ChevronRight, ChevronLeft, LogOut, Package, Search, Plus, X, Trash2, RotateCcw, Pencil, AlertTriangle, FileText } from 'lucide-react';
import { useSocketEvent } from '@/hooks/useSocket';
import {
  useStockBrowser,
  getPartialLabel,
  getResolutionBadge,
  CascadingFilters,
  StockResultsTable,
  InterventionFormFields,
} from '@/components/interventions';

function toLocalDate() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function shiftDate(dateStr, days) {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + days);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}
function formatDateLabel(dateStr) {
  const today = toLocalDate();
  if (dateStr === today) return "Aujourd'hui";
  if (dateStr === shiftDate(today, 1)) return 'Demain';
  if (dateStr === shiftDate(today, -1)) return 'Hier';
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('fr-CA', { weekday: 'long', day: 'numeric', month: 'long' });
}

export default function LightInterventions({ user, onLogout }) {
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(toLocalDate);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const canRestock = ['administrateur', 'gestionnaire'].includes(user?.role);

  // Modal mode: null | 'create' | 'edit'
  const [modalMode, setModalMode] = useState(null);
  const [editIntervention, setEditIntervention] = useState(null);
  const [form, setForm] = useState({ planned_date: '', operating_room: '', patient_file_number: '', birth_date: '' });
  const [formProducts, setFormProducts] = useState([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const stock = useStockBrowser();

  const handleFormField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  // --- Open modals ---
  const openCreateForm = () => {
    setForm({ planned_date: '', operating_room: '', patient_file_number: '', birth_date: '' });
    setFormProducts([]);
    stock.resetFilters();
    setModalMode('create');
  };

  const openEditForm = async (interventionId) => {
    try {
      const res = await api.get(`/interventions/${interventionId}`);
      const intv = res.data;
      setEditIntervention(intv);
      setForm({
        planned_date: intv.planned_datetime ? intv.planned_datetime.slice(0, 10) : '',
        operating_room: intv.operating_room || '',
        patient_file_number: intv.patient_file_number || '',
        birth_date: intv.birth_date || '',
      });
      stock.resetFilters();
      setModalMode('edit');
    } catch (err) {
      toast.error('Erreur chargement intervention');
    }
  };

  // Check URL for ?edit=id
  useEffect(() => {
    const editId = searchParams.get('edit');
    if (editId) {
      openEditForm(editId);
      setSearchParams({}, { replace: true });
    }
  }, []);

  // --- Product management (create mode) ---
  const addProductToFormCreate = (item) => {
    if (!item) return;
    const isDup = formProducts.some(p => {
      if (item.product_id && p.product_id === item.product_id) return true;
      if (!item.product_id && !p.product_id && p.category_id === item.category_id && p.type_id === item.type_id && p.specification_id === item.specification_id) return true;
      return false;
    });
    if (isDup) {
      setFormProducts(formProducts.map(p => {
        if (item.product_id && p.product_id === item.product_id) return { ...p, required_quantity: p.required_quantity + 1 };
        if (!item.product_id && !p.product_id && p.category_id === item.category_id && p.type_id === item.type_id && p.specification_id === item.specification_id) return { ...p, required_quantity: p.required_quantity + 1 };
        return p;
      }));
    } else {
      setFormProducts([...formProducts, { ...item, required_quantity: 1 }]);
    }
  };

  // --- Product management (edit mode) ---
  const addProductToIntervention = async (item) => {
    if (!editIntervention) return;
    try {
      await api.post(`/interventions/${editIntervention.id}/products`, { ...item, required_quantity: 1 });
      const res = await api.get(`/interventions/${editIntervention.id}`);
      setEditIntervention(res.data);
      toast.success('Produit ajouté');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const removeProductFromIntervention = async (ipId) => {
    if (!editIntervention) return;
    try {
      await api.delete(`/interventions/${editIntervention.id}/products/${ipId}`);
      const res = await api.get(`/interventions/${editIntervention.id}`);
      setEditIntervention(res.data);
      toast.success('Produit retiré');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  // --- Handlers ---
  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/interventions', {
        ...form,
        planned_datetime: form.planned_date ? form.planned_date + 'T00:00:00' : '',
        operating_room: form.operating_room || null,
        patient_file_number: form.patient_file_number || null,
        birth_date: form.birth_date || null,
        products: formProducts,
      });
      toast.success('Intervention créée');
      setModalMode(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!editIntervention) return;
    try {
      const payload = {
        planned_datetime: form.planned_date ? form.planned_date + 'T00:00:00' : undefined,
        operating_room: form.operating_room || null,
        patient_file_number: form.patient_file_number || null,
        birth_date: form.birth_date || null,
      };
      if (!payload.patient_file_number) payload.patient_file_number = null;
      if (!payload.birth_date) payload.birth_date = null;
      await api.put(`/interventions/${editIntervention.id}`, payload);
      toast.success('Intervention modifiée');
      setModalMode(null);
      setEditIntervention(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
  };

  const handleDelete = async () => {
    if (!editIntervention) return;
    try {
      await api.delete(`/interventions/${editIntervention.id}`);
      toast.success('Intervention supprimée');
      setShowDeleteConfirm(false);
      setModalMode(null);
      setEditIntervention(null);
      fetchData();
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
  };

  const label = (fp) => getPartialLabel(fp, stock.stockResults, stock.stockFilterOptions);
  const badgeFn = (fp) => getResolutionBadge(fp, true);

  // --- Data fetching ---
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/interventions?date=${selectedDate}`);
      setInterventions(res.data);
    } catch (err) { toast.error(err.response?.data?.detail || 'Erreur'); }
    finally { setLoading(false); }
  }, [selectedDate]);

  useEffect(() => { fetchData(); }, [fetchData]);
  useSocketEvent(['intervention_changed', 'inventory_changed'], () => { fetchData(); });

  // Products list for the active modal
  const activeProducts = modalMode === 'edit' ? (editIntervention?.products || []) : formProducts;
  const addProduct = modalMode === 'edit' ? addProductToIntervention : addProductToFormCreate;

  // Filter-level label
  const filterLevelLabel = [
    stock.stockFilterOptions.categories.find(c => c.id === stock.stockCatId)?.description,
    stock.stockTypeId && stock.stockFilterOptions.types.find(t => t.id === stock.stockTypeId)?.description,
    stock.stockSpecId && stock.stockFilterOptions.specifications.find(s => s.id === stock.stockSpecId)?.description,
  ].filter(Boolean).join(' / ');

  const [mrnSearch, setMrnSearch] = useState('');
  const [salleFilter, setSalleFilter] = useState(null);

  // Compute distinct salles from current interventions
  const distinctSalles = [...new Set(interventions.map(i => i.operating_room).filter(Boolean))].sort();

  // Filter interventions by MRN and Salle, sort by salle ascending
  const filteredInterventions = interventions.filter(intv => {
    if (mrnSearch && !(intv.patient_file_number || '').toLowerCase().includes(mrnSearch.toLowerCase())) return false;
    if (salleFilter && intv.operating_room !== salleFilter) return false;
    return true;
  }).sort((a, b) => (a.operating_room || '').localeCompare(b.operating_room || ''));

  // ---- RENDER ----
  return (
    <div className="min-h-screen bg-slate-900 p-4 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <h1 className="text-xl font-bold text-white">Interventions</h1>
          <p className="text-sm text-slate-400">{user?.first_name} {user?.last_name}</p>
        </div>
        <button data-testid="light-logout" onClick={() => { onLogout(); navigate('/production/login'); }}
          className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
          <LogOut className="w-5 h-5" />
        </button>
      </div>

      {/* Date + MRN + Salle filters — single row */}
      <div className="flex items-center gap-3 mb-4">
        {/* Compact date nav */}
        <div className="flex items-center bg-slate-800 rounded-xl shrink-0 h-[42px]">
          <button data-testid="date-prev" onClick={() => setSelectedDate(d => shiftDate(d, -1))}
            className="px-2 h-full rounded-l-xl hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-1.5 px-2">
            <button data-testid="date-today" onClick={() => setSelectedDate(toLocalDate())}
              className={`text-sm font-semibold capitalize whitespace-nowrap ${selectedDate === toLocalDate() ? 'text-blue-400' : 'text-white hover:text-blue-400'} transition-colors`}>
              {formatDateLabel(selectedDate)}
            </button>
            <div className="relative">
              <input type="date" data-testid="date-picker" value={selectedDate}
                onChange={e => e.target.value && setSelectedDate(e.target.value)}
                className="absolute inset-0 opacity-0 cursor-pointer w-6 h-6" />
              <Calendar className="w-3.5 h-3.5 text-slate-400 pointer-events-none" />
            </div>
          </div>
          <button data-testid="date-next" onClick={() => setSelectedDate(d => shiftDate(d, 1))}
            className="px-2 h-full rounded-r-xl hover:bg-slate-700 text-slate-400 hover:text-white transition-colors">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* MRN search — compact */}
        <div className="relative w-44 shrink-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
          <input
            data-testid="mrn-search"
            maxLength={10}
            className="w-full h-[42px] bg-slate-800 border border-slate-700 rounded-xl pl-9 pr-3 text-sm text-white placeholder-slate-500 outline-none focus:border-blue-500"
            placeholder="MRN..."
            value={mrnSearch}
            onChange={e => setMrnSearch(e.target.value)}
          />
        </div>

        {/* Salle filter boxes — inline, 20% bigger */}
        {distinctSalles.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto">
            {distinctSalles.map(salle => {
              const isActive = salleFilter === salle;
              return (
                <button
                  key={salle}
                  data-testid={`salle-filter-${salle}`}
                  onClick={() => setSalleFilter(isActive ? null : salle)}
                  className={`shrink-0 h-12 min-w-[4.2rem] px-2.5 rounded-xl flex flex-col items-center justify-center transition-all ${
                    isActive
                      ? 'bg-violet-600 text-white'
                      : 'bg-violet-950/60 hover:bg-violet-900/60'
                  }`}
                >
                  <span className={`text-[9px] font-semibold uppercase leading-none ${isActive ? 'text-violet-200' : 'text-violet-300'}`}>SALLE</span>
                  <span className={`text-lg font-bold leading-tight ${isActive ? 'text-white' : 'text-violet-400'}`}>{salle}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Manager actions */}
      {canRestock && (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <button data-testid="light-stock-btn" onClick={() => navigate('/production/restock')}
            className="h-16 rounded-xl bg-emerald-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-emerald-700 transition-colors">
            <Package className="w-5 h-5" /> Mise en stock
          </button>
          <button data-testid="light-picking-btn" onClick={() => navigate('/production/picking-libre')}
            className="h-16 rounded-xl bg-blue-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-blue-700 transition-colors">
            <Search className="w-5 h-5" /> PICKING
          </button>
          <button data-testid="light-create-btn" onClick={openCreateForm}
            className="h-16 rounded-xl bg-violet-600 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-violet-700 transition-colors">
            <Plus className="w-5 h-5" /> Intervention
          </button>
        </div>
      )}

      {/* Interventions list */}
      {loading ? (
        <div className="text-center text-slate-400 py-12">Chargement...</div>
      ) : filteredInterventions.length === 0 ? (
        <div className="text-center py-12">
          <Calendar className="w-12 h-12 mx-auto mb-3 text-slate-600" />
          <p className="text-slate-400">
            {interventions.length === 0 ? 'Aucune intervention pour cette date' : 'Aucune intervention ne correspond aux filtres'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredInterventions.map(intv => (
            <div key={intv.id} className="bg-slate-800 rounded-xl p-4 flex items-center gap-4">
              <button
                data-testid={`light-intervention-${intv.id}`}
                onClick={() => navigate(`/production/picking/${intv.id}`)}
                className="flex-1 flex items-center gap-4 text-left hover:opacity-80 transition-opacity"
              >
                <div className="flex-shrink-0">
                  <div className="w-14 h-14 rounded-xl bg-violet-600/20 flex flex-col items-center justify-center">
                    <span className="text-[10px] text-violet-400 font-medium">SALLE</span>
                    <span className="text-lg font-bold text-violet-400">
                      {intv.operating_room || '—'}
                    </span>
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  {intv.patient_file_number ? (
                    <div className="flex items-center gap-1 text-white font-semibold text-base">
                      <FileText className="w-3.5 h-3.5 text-blue-400" />
                      MRN: {intv.patient_file_number}
                      {intv.birth_date && <span className="text-slate-400 font-normal text-sm ml-2">Né(e): {intv.birth_date}</span>}
                    </div>
                  ) : (
                    <div className="text-slate-400 text-sm italic">Intervention planifiée</div>
                  )}
                  {intv.products?.length > 0 && (
                    <div className="text-slate-500 text-xs mt-0.5">
                      {intv.products.reduce((s, p) => s + p.required_quantity, 0)} produit(s) requis
                    </div>
                  )}
                </div>
                <ChevronRight className="w-5 h-5 text-slate-600 flex-shrink-0" />
              </button>
              <button data-testid={`light-edit-${intv.id}`} onClick={() => openEditForm(intv.id)}
                className="p-2 rounded-lg text-slate-500 hover:text-blue-400 hover:bg-slate-700 transition-colors shrink-0">
                <Pencil className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* =================== CREATE / EDIT MODAL =================== */}
      {modalMode && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-start justify-center pt-4 overflow-y-auto">
          <div className="bg-slate-800 rounded-2xl w-full max-w-4xl mx-4 mb-4">
            {/* Modal header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <h2 className="text-lg font-bold text-white">
                {modalMode === 'create' ? 'Nouvelle intervention' : 'Modifier l\'intervention'}
              </h2>
              <button onClick={() => { setModalMode(null); setEditIntervention(null); }} className="p-1.5 rounded-lg hover:bg-slate-700">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={modalMode === 'create' ? handleCreate : handleEdit} className="p-4 space-y-4">
              <InterventionFormFields
                form={form}
                onChange={handleFormField}
                dark
                testIdPrefix="light-modal"
              />

              {/* Products section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-300">Produits requis</label>
                  <div className="flex items-center gap-2">
                    {stock.stockCatId && (
                      <button type="button" data-testid="light-add-at-filter"
                        onClick={() => addProduct({ category_id: stock.stockCatId, type_id: stock.stockTypeId || undefined, specification_id: stock.stockSpecId || undefined })}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-amber-900/40 text-amber-400 border border-amber-700/50 rounded-lg hover:bg-amber-900/60 transition-colors">
                        <Plus className="w-3 h-3" />
                        {filterLevelLabel}
                      </button>
                    )}
                    {(stock.stockCatId || stock.stockTypeId || stock.stockSpecId) && (
                      <button type="button" onClick={stock.resetFilters}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-400 hover:text-blue-400 border border-slate-600 rounded-md hover:border-blue-500 transition-colors">
                        <RotateCcw className="w-3 h-3" /> Reset
                      </button>
                    )}
                  </div>
                </div>

                {/* Selected / existing products */}
                {activeProducts.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-slate-500 mb-1">
                      {modalMode === 'edit' ? 'Produits de l\'intervention' : 'Sélectionnés'} ({activeProducts.reduce((s, p) => s + (p.required_quantity || 1), 0)})
                    </div>
                    <div className="space-y-1">
                      {activeProducts.map((fp, i) => {
                        const b = badgeFn(fp);
                        return (
                          <div key={fp.id || i} className="flex items-center gap-2 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-2 text-xs">
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${b.color}`}>{b.label}</span>
                            <span className="flex-1 font-medium text-slate-200 truncate">{label(fp)}</span>
                            {fp.serial_number && <span className="font-mono text-[10px] bg-blue-900/40 text-blue-400 px-1.5 py-0.5 rounded">{fp.serial_number}</span>}
                            {modalMode === 'create' && (
                              <div className="flex items-center gap-1 shrink-0">
                                <button type="button" onClick={() => {
                                  if (fp.required_quantity <= 1) setFormProducts(formProducts.filter((_, idx) => idx !== i));
                                  else setFormProducts(formProducts.map((p, idx) => idx === i ? { ...p, required_quantity: p.required_quantity - 1 } : p));
                                }} className="w-5 h-5 rounded bg-slate-600 border border-slate-500 text-slate-300 flex items-center justify-center font-bold hover:bg-slate-500">-</button>
                                <span className="w-6 text-center font-bold text-white">{fp.required_quantity}</span>
                                <button type="button" onClick={() => {
                                  setFormProducts(formProducts.map((p, idx) => idx === i ? { ...p, required_quantity: p.required_quantity + 1 } : p));
                                }} className="w-5 h-5 rounded bg-slate-600 border border-slate-500 text-slate-300 flex items-center justify-center font-bold hover:bg-slate-500">+</button>
                              </div>
                            )}
                            {modalMode === 'edit' && (
                              <span className="text-slate-400 text-[10px] font-bold shrink-0">x{fp.required_quantity || 1}</span>
                            )}
                            <button type="button" className="text-red-400 hover:text-red-300 shrink-0"
                              onClick={() => {
                                if (modalMode === 'create') setFormProducts(formProducts.filter((_, idx) => idx !== i));
                                else removeProductFromIntervention(fp.id);
                              }}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Submit buttons */}
                <div className="flex gap-2 pt-2 pb-3 border-t border-slate-700">
                  {modalMode === 'edit' && (
                    <button type="button" onClick={() => setShowDeleteConfirm(true)} data-testid="light-modal-delete"
                      className="px-4 border border-red-700/50 text-red-400 rounded-lg py-2.5 text-sm hover:bg-red-900/30 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                  <button type="button" onClick={() => { setModalMode(null); setEditIntervention(null); }}
                    className="flex-1 border border-slate-600 text-slate-300 rounded-lg py-2.5 text-sm hover:bg-slate-700 transition-colors">Annuler</button>
                  <button type="submit" data-testid="light-modal-submit"
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors">
                    {modalMode === 'create' ? 'Créer' : 'Enregistrer'}
                  </button>
                </div>

                <CascadingFilters
                  stockFilterOptions={stock.stockFilterOptions}
                  stockCatId={stock.stockCatId}
                  stockTypeId={stock.stockTypeId}
                  stockSpecId={stock.stockSpecId}
                  onCatChange={stock.handleCatChange}
                  onTypeChange={stock.handleTypeChange}
                  onSpecChange={stock.handleSpecChange}
                  dark
                  maxH="max-h-36"
                />

                <StockResultsTable
                  stockResults={stock.stockResults}
                  stockLoading={stock.stockLoading}
                  dark
                  maxInstances={3}
                  onAction={(r) => addProduct({ product_id: r.product_id })}
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-[60]">
          <div className="bg-slate-800 rounded-xl p-6 w-full max-w-sm mx-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-900/50 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <div>
                <h3 className="font-bold text-white">Supprimer l'intervention ?</h3>
                <p className="text-sm text-slate-400 mt-0.5">Cette action est irréversible.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 border border-slate-600 text-slate-300 rounded-lg py-2 text-sm hover:bg-slate-700">Annuler</button>
              <button onClick={handleDelete} data-testid="light-confirm-delete"
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
