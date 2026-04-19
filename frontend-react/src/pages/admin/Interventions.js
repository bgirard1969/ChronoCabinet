import React, { useState, useEffect, useCallback } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Plus, Calendar as CalendarIcon, X, Package, Trash2, Pencil, RotateCcw, AlertCircle, Check, AlertTriangle, Upload, Search } from 'lucide-react';
import { useSocketEvent } from '@/hooks/useSocket';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { fr } from 'date-fns/locale';
import { format } from 'date-fns';
import {
  useStockBrowser,
  getPartialLabel,
  getResolutionBadge,
  statusColors,
  statusLabels,
  CascadingFilters,
  StockResultsTable,
  InterventionFormFields,
} from '@/components/interventions';

export default function Interventions() {
  const [interventions, setInterventions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('today');
  const [dateRange, setDateRange] = useState(undefined);
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [selectedIntervention, setSelectedIntervention] = useState(null);
  const [form, setForm] = useState({
    planned_date: '',
    operating_room: '',
    patient_file_number: '',
    birth_date: '',
    products: [],
  });
  const [showEditForm, setShowEditForm] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [salleFilter, setSalleFilter] = useState(null);
  const [mrnSearch, setMrnSearch] = useState('');
  const [editForm, setEditForm] = useState({
    planned_date: '',
    operating_room: '',
    patient_file_number: '',
    birth_date: '',
  });

  const stock = useStockBrowser();
  const [refiningIpId, setRefiningIpId] = useState(null);
  const [importing, setImporting] = useState(false);
  const csvInputRef = React.useRef(null);

  const handleImportCSV = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = '';
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/interventions/import-csv', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      const { created, duplicates, errors } = res.data;
      let msg = `${created} intervention(s) créée(s)`;
      if (duplicates > 0) msg += `, ${duplicates} doublon(s) ignoré(s)`;
      if (errors.length > 0) msg += `, ${errors.length} erreur(s)`;
      toast.success(msg);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'import');
    } finally {
      setImporting(false);
    }
  };

  const openCreateForm = () => {
    setShowForm(true);
    setForm({ planned_date: '', operating_room: '', patient_file_number: '', birth_date: '', products: [] });
    setRefiningIpId(null);
    stock.resetFilters();
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      let url = '/interventions';
      if (dateRange?.from) {
        const from = format(dateRange.from, 'yyyy-MM-dd');
        const to = dateRange.to ? format(dateRange.to, 'yyyy-MM-dd') : from;
        url += `?date_from=${from}&date_to=${to}`;
      } else {
        url += `?filter=${filter}`;
      }
      const intRes = await api.get(url);
      setInterventions(intRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, [filter, dateRange]);

  useSocketEvent(['intervention_changed', 'inventory_changed'], () => {
    fetchData();
  });

  const handleFormField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const handleEditFormField = (field, value) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        planned_datetime: form.planned_date ? form.planned_date + 'T00:00:00' : '',
        operating_room: form.operating_room || null,
        patient_file_number: form.patient_file_number || null,
        birth_date: form.birth_date || null,
      };
      delete payload.planned_date;
      await api.post('/interventions', payload);
      toast.success('Intervention créée');
      setShowForm(false);
      setForm({ planned_date: '', operating_room: '', patient_file_number: '', birth_date: '', products: [] });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const openEditForm = (intv) => {
    const dt = intv.planned_datetime ? intv.planned_datetime.slice(0, 10) : '';
    setEditForm({
      planned_date: dt,
      operating_room: intv.operating_room || '',
      patient_file_number: intv.patient_file_number || '',
      birth_date: intv.birth_date || '',
    });
    setShowEditForm(true);
  };

  const handleEdit = async (e) => {
    e.preventDefault();
    if (!selectedIntervention) return;
    try {
      const payload = {
        planned_datetime: editForm.planned_date ? editForm.planned_date + 'T00:00:00' : undefined,
        operating_room: editForm.operating_room || null,
        patient_file_number: editForm.patient_file_number || null,
        birth_date: editForm.birth_date || null,
      };
      await api.put(`/interventions/${selectedIntervention.id}`, payload);
      toast.success('Intervention modifiée');
      setShowEditForm(false);
      const res = await api.get(`/interventions/${selectedIntervention.id}`);
      setSelectedIntervention(res.data);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la modification');
    }
  };

  const handleDelete = async () => {
    if (!selectedIntervention) return;
    try {
      await api.delete(`/interventions/${selectedIntervention.id}`);
      toast.success('Intervention supprimée');
      setShowDeleteConfirm(false);
      setSelectedIntervention(null);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de la suppression');
    }
  };

  const addProductToForm = (item) => {
    if (!item) return;
    const isDuplicate = form.products.some(p => {
      if (item.product_id && p.product_id === item.product_id) return true;
      if (!item.product_id && !p.product_id
        && p.category_id === item.category_id
        && p.type_id === item.type_id
        && p.specification_id === item.specification_id) return true;
      return false;
    });
    if (isDuplicate) {
      setForm({
        ...form,
        products: form.products.map(p => {
          if (item.product_id && p.product_id === item.product_id) return { ...p, required_quantity: p.required_quantity + 1 };
          if (!item.product_id && !p.product_id
            && p.category_id === item.category_id
            && p.type_id === item.type_id
            && p.specification_id === item.specification_id) return { ...p, required_quantity: p.required_quantity + 1 };
          return p;
        }),
      });
    } else {
      setForm({ ...form, products: [...form.products, { ...item, required_quantity: 1 }] });
    }
  };

  const label = (fp) => getPartialLabel(fp, stock.stockResults, stock.stockFilterOptions);
  const badge = (fp) => getResolutionBadge(fp, false);

  const openDetail = async (intv) => {
    try {
      const res = await api.get(`/interventions/${intv.id}`);
      setSelectedIntervention(res.data);
      setRefiningIpId(null);
      stock.resetFilters();
    } catch (err) {
      toast.error('Erreur lors du chargement');
    }
  };

  const addProductToIntervention = async (payload) => {
    if (!selectedIntervention || !payload) return;
    const data = typeof payload === 'string' ? { product_id: payload, required_quantity: 1 } : { ...payload, required_quantity: 1 };
    try {
      await api.post(`/interventions/${selectedIntervention.id}/products`, data);
      toast.success('Produit ajouté');
      const res = await api.get(`/interventions/${selectedIntervention.id}`);
      setSelectedIntervention(res.data);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const startRefine = (ip) => {
    setRefiningIpId(ip.id);
    stock.setFilters(ip.category_id || '', ip.type_id || '', ip.specification_id || '');
  };

  const cancelRefine = () => {
    setRefiningIpId(null);
    stock.resetFilters();
  };

  const confirmRefine = async (refinement) => {
    if (!refiningIpId || !selectedIntervention) return;
    try {
      await api.put(`/interventions/${selectedIntervention.id}/products/${refiningIpId}`, refinement);
      toast.success('Produit complété');
      setRefiningIpId(null);
      const res = await api.get(`/interventions/${selectedIntervention.id}`);
      setSelectedIntervention(res.data);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const removeProductFromIntervention = async (ipId) => {
    if (!selectedIntervention) return;
    try {
      await api.delete(`/interventions/${selectedIntervention.id}/products/${ipId}`);
      toast.success('Produit retiré');
      const res = await api.get(`/interventions/${selectedIntervention.id}`);
      setSelectedIntervention(res.data);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const updateProductQuantity = async (ipId, newQty) => {
    if (!selectedIntervention || newQty < 1) return;
    try {
      await api.put(`/interventions/${selectedIntervention.id}/products/${ipId}`, {
        required_quantity: newQty,
      });
      const res = await api.get(`/interventions/${selectedIntervention.id}`);
      setSelectedIntervention(res.data);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  // Build filter-level label for "Add at filter level" button
  const filterLevelLabel = [
    stock.stockFilterOptions.categories.find(c => c.id === stock.stockCatId)?.description,
    stock.stockTypeId && stock.stockFilterOptions.types.find(t => t.id === stock.stockTypeId)?.description,
    stock.stockSpecId && stock.stockFilterOptions.specifications.find(s => s.id === stock.stockSpecId)?.description,
  ].filter(Boolean).join(' / ');

  // Distinct salles + filtered interventions
  const distinctSalles = [...new Set(interventions.map(i => i.operating_room).filter(Boolean))].sort();
  const filteredInterventions = interventions
    .filter(intv => {
      if (salleFilter && intv.operating_room !== salleFilter) return false;
      if (mrnSearch && !(intv.patient_file_number || '').toLowerCase().includes(mrnSearch.toLowerCase())) return false;
      return true;
    })
    .sort((a, b) => (a.operating_room || '').localeCompare(b.operating_room || ''));

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Interventions</h1>
          <p className="text-sm text-slate-500 mt-0.5">Planification et suivi des interventions chirurgicales</p>
        </div>
        <div className="flex items-center gap-2">
          <input type="file" ref={csvInputRef} accept=".csv" className="hidden" onChange={handleImportCSV} />
          <button
            data-testid="import-csv-btn"
            onClick={() => csvInputRef.current?.click()}
            disabled={importing}
            className="flex items-center gap-2 bg-white text-slate-600 border border-slate-300 px-4 py-2 rounded-lg text-sm font-medium hover:bg-slate-50 transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> {importing ? 'Import...' : 'Importer CSV'}
          </button>
          <button
            data-testid="create-intervention-btn"
            onClick={openCreateForm}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" /> Nouvelle intervention
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 mb-4">
        {[
          { value: 'today', label: "Aujourd'hui" },
          { value: 'week', label: 'Cette semaine' },
          { value: 'all', label: 'Toutes' },
        ].map(f => (
          <button
            key={f.value}
            data-testid={`filter-${f.value}`}
            onClick={() => { setFilter(f.value); setDateRange(undefined); }}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              filter === f.value && !dateRange?.from ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border hover:bg-slate-50'
            }`}
          >
            {f.label}
          </button>
        ))}

        <div className="w-px h-6 bg-slate-300 mx-1" />

        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              data-testid="calendar-range-trigger"
              className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                dateRange?.from
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 border hover:bg-slate-50'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              {dateRange?.from ? (
                dateRange.to
                  ? <span>{format(dateRange.from, 'dd MMM', { locale: fr })} — {format(dateRange.to, 'dd MMM yyyy', { locale: fr })}</span>
                  : <span>{format(dateRange.from, 'dd MMM yyyy', { locale: fr })}</span>
              ) : (
                <span>Période</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                if (range?.from && range?.to) setDatePopoverOpen(false);
              }}
              numberOfMonths={2}
              locale={fr}
            />
          </PopoverContent>
        </Popover>
        {dateRange?.from && (
          <button onClick={() => { setDateRange(undefined); setFilter('today'); }} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* MRN search */}
        <div className="relative w-40">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
          <input
            data-testid="mrn-search"
            maxLength={10}
            className="w-full pl-8 pr-3 py-1.5 border rounded-lg text-sm placeholder-slate-400 focus:border-blue-500 focus:outline-none"
            placeholder="MRN..."
            value={mrnSearch}
            onChange={e => setMrnSearch(e.target.value)}
          />
        </div>

        {/* Salle filter boxes */}
        {distinctSalles.length > 0 && (
          <>
            <div className="w-px h-6 bg-slate-300 mx-1" />
            {distinctSalles.map(salle => {
              const isActive = salleFilter === salle;
              return (
                <button
                  key={salle}
                  data-testid={`salle-filter-${salle}`}
                  onClick={() => setSalleFilter(isActive ? null : salle)}
                  className={`shrink-0 h-9 min-w-[3.5rem] px-2 rounded-lg flex flex-col items-center justify-center transition-colors ${
                    isActive
                      ? 'bg-violet-600 text-white'
                      : 'bg-violet-50 text-violet-700 hover:bg-violet-100'
                  }`}
                >
                  <span className={`text-[8px] font-semibold uppercase leading-none ${isActive ? 'text-violet-200' : 'text-violet-400'}`}>SALLE</span>
                  <span className="text-sm font-bold leading-tight">{salle}</span>
                </button>
              );
            })}
          </>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Date</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Salle</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">MRN</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Date naissance</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Produits</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Statut</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">Chargement...</td></tr>
            ) : filteredInterventions.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                {interventions.length === 0 ? 'Aucune intervention' : 'Aucune intervention ne correspond aux filtres'}
              </td></tr>
            ) : filteredInterventions.map(intv => (
              <tr key={intv.id} data-testid={`intervention-row-${intv.id}`}
                onClick={() => openDetail(intv)}
                className="hover:bg-slate-50 cursor-pointer"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CalendarIcon className="w-3.5 h-3.5 text-slate-400" />
                    {new Date(intv.planned_datetime).toLocaleDateString('fr-CA')}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {intv.operating_room ? (
                    <span className="inline-flex items-center gap-1 text-xs font-bold bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full">
                      {intv.operating_room}
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">{intv.patient_file_number || '—'}</td>
                <td className="px-4 py-3">{intv.birth_date || '—'}</td>
                <td className="px-4 py-3">
                  {(intv.products || []).length > 0 ? (
                    <span className="text-xs bg-slate-100 px-2 py-0.5 rounded-full">
                      {intv.products.reduce((s, p) => s + p.required_quantity, 0)} produit(s)
                    </span>
                  ) : '—'}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusColors[intv.status] || 'bg-slate-100'}`}>
                    {statusLabels[intv.status] || intv.status}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            <div className="flex items-center justify-between p-5 border-b">
              <h2 className="text-lg font-bold">Nouvelle intervention</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 rounded-lg hover:bg-slate-100">
                <X className="w-5 h-5 text-slate-400" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-5 space-y-4">
              <InterventionFormFields
                form={form}
                onChange={handleFormField}
                testIdPrefix="create"
              />

              {/* Produits requis section */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-semibold text-slate-700">Produits requis</label>
                  <div className="flex items-center gap-2">
                    {stock.stockCatId && (
                      <button type="button"
                        data-testid="add-at-filter-level"
                        onClick={() => addProductToForm({ category_id: stock.stockCatId, type_id: stock.stockTypeId || undefined, specification_id: stock.stockSpecId || undefined })}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                        <Plus className="w-3 h-3" />
                        Ajouter : {filterLevelLabel}
                      </button>
                    )}
                    {(stock.stockCatId || stock.stockTypeId || stock.stockSpecId) && (
                      <button type="button" onClick={stock.resetFilters}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-blue-600 border rounded-md hover:border-blue-300 transition-colors">
                        <RotateCcw className="w-3 h-3" /> Réinitialiser
                      </button>
                    )}
                  </div>
                </div>

                {/* Selected products */}
                {form.products.length > 0 && (
                  <div className="mb-3">
                    <div className="text-xs font-semibold text-slate-500 mb-1">Produits sélectionnés ({form.products.reduce((s, p) => s + p.required_quantity, 0)})</div>
                    <div className="space-y-1">
                      {form.products.map((fp, i) => {
                        const b = badge(fp);
                        return (
                          <div key={i} className="flex items-center gap-2 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-xs">
                            <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${b.color}`}>{b.label}</span>
                            <span className="flex-1 font-medium text-slate-700 truncate">{label(fp)}</span>
                            {fp.serial_number && <span className="font-mono text-[10px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded">{fp.serial_number}</span>}
                            <div className="flex items-center gap-1 shrink-0">
                              <button type="button" onClick={() => {
                                if (fp.required_quantity <= 1) {
                                  setForm({ ...form, products: form.products.filter((_, idx) => idx !== i) });
                                } else {
                                  setForm({ ...form, products: form.products.map((p, idx) => idx === i ? { ...p, required_quantity: p.required_quantity - 1 } : p) });
                                }
                              }} className="w-5 h-5 rounded bg-white border text-slate-600 flex items-center justify-center font-bold hover:bg-slate-50">-</button>
                              <span className="w-6 text-center font-bold">{fp.required_quantity}</span>
                              <button type="button" onClick={() => {
                                setForm({ ...form, products: form.products.map((p, idx) => idx === i ? { ...p, required_quantity: p.required_quantity + 1 } : p) });
                              }} className="w-5 h-5 rounded bg-white border text-slate-600 flex items-center justify-center font-bold hover:bg-slate-50">+</button>
                            </div>
                            <button type="button" className="text-red-400 hover:text-red-600 shrink-0"
                              onClick={() => setForm({ ...form, products: form.products.filter((_, idx) => idx !== i) })}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Buttons */}
                <div className="flex gap-2 pt-2 pb-3 border-t">
                  <button type="button" onClick={() => setShowForm(false)}
                    data-testid="create-intervention-cancel"
                    className="flex-1 border rounded-lg py-2 text-sm hover:bg-slate-50">Annuler</button>
                  <button type="submit"
                    data-testid="create-intervention-submit"
                    className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Créer</button>
                </div>

                <CascadingFilters
                  stockFilterOptions={stock.stockFilterOptions}
                  stockCatId={stock.stockCatId}
                  stockTypeId={stock.stockTypeId}
                  stockSpecId={stock.stockSpecId}
                  onCatChange={stock.handleCatChange}
                  onTypeChange={stock.handleTypeChange}
                  onSpecChange={stock.handleSpecChange}
                  testIdPrefix="stock"
                />

                <StockResultsTable
                  stockResults={stock.stockResults}
                  stockLoading={stock.stockLoading}
                  onAction={(r) => addProductToForm({ product_id: r.product_id })}
                />
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Detail panel */}
      {selectedIntervention && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl w-full max-w-5xl max-h-[92vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b">
              <div>
                <h2 className="text-lg font-bold">Intervention</h2>
                <p className="text-sm text-slate-500">
                  {new Date(selectedIntervention.planned_datetime).toLocaleDateString('fr-CA')}
                  {selectedIntervention.operating_room && ` — Salle: ${selectedIntervention.operating_room}`}
                  {selectedIntervention.patient_file_number && ` — MRN: ${selectedIntervention.patient_file_number}`}
                  {selectedIntervention.birth_date && ` — Né(e): ${selectedIntervention.birth_date}`}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button data-testid="edit-intervention-btn" onClick={() => openEditForm(selectedIntervention)}
                  className="p-1.5 rounded-lg hover:bg-blue-50 text-slate-400 hover:text-blue-600 transition-colors"
                  title="Modifier l'intervention">
                  <Pencil className="w-5 h-5" />
                </button>
                <button data-testid="delete-intervention-btn" onClick={() => setShowDeleteConfirm(true)}
                  className="p-1.5 rounded-lg hover:bg-red-50 text-slate-400 hover:text-red-600 transition-colors"
                  title="Supprimer l'intervention">
                  <Trash2 className="w-5 h-5" />
                </button>
                <button data-testid="close-detail" onClick={() => setSelectedIntervention(null)}
                  className="p-1.5 rounded-lg hover:bg-slate-100"><X className="w-5 h-5 text-slate-400" /></button>
              </div>
            </div>

            {/* Products list */}
            <div className="p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-sm flex items-center gap-2">
                  <Package className="w-4 h-4 text-blue-500" /> Produits requis
                </h3>
              </div>

              {(selectedIntervention.products || []).length === 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">Aucun produit associé</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {(selectedIntervention.products || []).map(ip => {
                    const b = badge(ip);
                    const isPartial = ip.resolution && ip.resolution !== 'product' && ip.resolution !== 'instance';
                    const isBeingRefined = refiningIpId === ip.id;
                    return (
                      <div key={ip.id} data-testid={`detail-product-${ip.id}`}
                        className={`rounded-lg px-4 py-3 border ${isBeingRefined ? 'bg-blue-50 border-blue-300 ring-2 ring-blue-200' : isPartial ? 'bg-amber-50/50 border-amber-200' : 'bg-slate-50 border-slate-100'}`}>
                        <div className="flex items-center gap-3">
                          <span className={`shrink-0 px-1.5 py-0.5 rounded text-[10px] font-bold ${b.color}`}>{b.label}</span>
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm">{label(ip)}</p>
                            {ip.serial_number && <p className="text-xs text-blue-600 font-mono mt-0.5">SN: {ip.serial_number}</p>}
                            {isPartial && !isBeingRefined && (
                              <p className="text-xs text-amber-600 mt-0.5 flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" /> À compléter
                              </p>
                            )}
                            {isBeingRefined && (
                              <p className="text-xs text-blue-600 mt-0.5 font-medium">En cours de sélection...</p>
                            )}
                          </div>
                          {isPartial && !isBeingRefined && (
                            <button
                              data-testid={`refine-product-${ip.id}`}
                              onClick={() => startRefine(ip)}
                              className="px-2.5 py-1.5 text-xs font-medium bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-colors shrink-0">
                              Compléter
                            </button>
                          )}
                          {isBeingRefined && (
                            <button onClick={cancelRefine}
                              className="px-2 py-1 text-xs text-slate-500 border rounded-md hover:bg-slate-50 shrink-0">
                              Annuler
                            </button>
                          )}
                          <div className="flex items-center gap-2 shrink-0">
                            <button
                              onClick={() => updateProductQuantity(ip.id, ip.required_quantity - 1)}
                              disabled={ip.required_quantity <= 1}
                              className="w-7 h-7 rounded-md border bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-30 text-sm font-bold"
                            >-</button>
                            <span className="w-8 text-center font-semibold text-sm">{ip.required_quantity}</span>
                            <button
                              onClick={() => updateProductQuantity(ip.id, ip.required_quantity + 1)}
                              className="w-7 h-7 rounded-md border bg-white text-slate-600 hover:bg-slate-50 text-sm font-bold"
                            >+</button>
                          </div>
                          <div className="text-xs text-slate-400 w-16 text-right shrink-0">
                            {ip.picked_quantity > 0 && <span className="text-green-600">{ip.picked_quantity} prélevé(s)</span>}
                          </div>
                          <button
                            data-testid={`remove-product-${ip.id}`}
                            onClick={() => removeProductFromIntervention(ip.id)}
                            className="p-1.5 rounded-lg hover:bg-red-50 text-slate-300 hover:text-red-500 shrink-0"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Cascading filters for add / refine */}
              <div className="border-t pt-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium">
                    {refiningIpId ? 'Compléter la sélection' : 'Ajouter un produit'}
                  </label>
                  <div className="flex items-center gap-2">
                    {stock.stockCatId && !refiningIpId && (
                      <button type="button"
                        data-testid="detail-add-at-filter"
                        onClick={() => addProductToIntervention({ category_id: stock.stockCatId, type_id: stock.stockTypeId || undefined, specification_id: stock.stockSpecId || undefined })}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100 transition-colors">
                        <Plus className="w-3 h-3" />
                        Ajouter : {filterLevelLabel}
                      </button>
                    )}
                    {refiningIpId && stock.stockCatId && (
                      <button type="button"
                        data-testid="detail-confirm-refine"
                        onClick={() => confirmRefine({ category_id: stock.stockCatId, type_id: stock.stockTypeId || undefined, specification_id: stock.stockSpecId || undefined })}
                        className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100 transition-colors">
                        <Check className="w-3 h-3" />
                        Confirmer : {filterLevelLabel}
                      </button>
                    )}
                    {(stock.stockCatId || stock.stockTypeId || stock.stockSpecId) && (
                      <button type="button" onClick={stock.resetFilters}
                        className="flex items-center gap-1 px-2 py-1 text-xs text-slate-500 hover:text-blue-600 border rounded-md hover:border-blue-300 transition-colors">
                        <RotateCcw className="w-3 h-3" /> Réinitialiser
                      </button>
                    )}
                  </div>
                </div>

                <CascadingFilters
                  stockFilterOptions={stock.stockFilterOptions}
                  stockCatId={stock.stockCatId}
                  stockTypeId={stock.stockTypeId}
                  stockSpecId={stock.stockSpecId}
                  onCatChange={stock.handleCatChange}
                  onTypeChange={stock.handleTypeChange}
                  onSpecChange={stock.handleSpecChange}
                  maxH="max-h-28"
                />

                <StockResultsTable
                  stockResults={stock.stockResults}
                  stockLoading={stock.stockLoading}
                  actionMode={refiningIpId ? 'refine' : 'add'}
                  onAction={(r) => {
                    if (refiningIpId) {
                      confirmRefine({ product_id: r.product_id });
                    } else {
                      addProductToIntervention({ product_id: r.product_id });
                    }
                  }}
                />
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-end p-5 border-t">
              <button onClick={() => setSelectedIntervention(null)}
                className="px-4 py-2 bg-slate-100 text-slate-600 rounded-lg text-sm font-medium hover:bg-slate-200">
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit modal */}
      {showEditForm && selectedIntervention && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg">
            <h2 className="text-lg font-bold mb-4">Modifier l'intervention</h2>
            <form onSubmit={handleEdit} className="space-y-3">
              <InterventionFormFields
                form={editForm}
                onChange={handleEditFormField}
                testIdPrefix="edit"
              />
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowEditForm(false)}
                  data-testid="edit-cancel-btn"
                  className="flex-1 border rounded-lg py-2 text-sm hover:bg-slate-50">Annuler</button>
                <button type="submit"
                  data-testid="edit-save-btn"
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Enregistrer</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {showDeleteConfirm && selectedIntervention && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5 text-red-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Supprimer l'intervention ?</h3>
                <p className="text-sm text-slate-500 mt-0.5">Cette action est irréversible. Tous les produits associés seront également supprimés.</p>
              </div>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(false)}
                data-testid="delete-cancel-btn"
                className="flex-1 border rounded-lg py-2 text-sm hover:bg-slate-50">Annuler</button>
              <button onClick={handleDelete}
                data-testid="delete-confirm-btn"
                className="flex-1 bg-red-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-red-700">Supprimer</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
