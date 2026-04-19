import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Search, CheckCircle2, Clock, Package, FileDown, Loader2, AlertTriangle, Upload, X, Check, FileSpreadsheet, History } from 'lucide-react';

const STATUS_LABELS = { 4: 'Prélevé', 5: 'Consommé', 6: 'Facturé' };
const STATUS_COLORS = { 4: 'bg-amber-100 text-amber-700', 5: 'bg-green-100 text-green-700', 6: 'bg-blue-100 text-blue-700' };

export default function Consumption() {
  const [instances, setInstances] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [processing, setProcessing] = useState(null);
  const [exporting, setExporting] = useState(false);
  const [exportResult, setExportResult] = useState(null);
  const [showExportConfirm, setShowExportConfirm] = useState(false);
  const scanRef = useRef(null);
  const fileInputRef = useRef(null);

  // Import state
  const [importPreview, setImportPreview] = useState(null); // { total_rows, matched, unmatched, manual_review, rows }
  const [importLoading, setImportLoading] = useState(false);
  const [importConfirming, setImportConfirming] = useState(false);
  const [importHistory, setImportHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);

  const fetchData = async () => {
    try {
      const res = await api.get('/instances/consumption');
      setInstances(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleConsume = async (instanceId) => {
    setProcessing(instanceId);
    try {
      await api.put(`/instances/${instanceId}/consume`);
      toast.success('Produit marqué comme consommé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setProcessing(null);
    }
  };

  const handleExportGRM = async () => {
    setShowExportConfirm(false);
    setExporting(true);
    try {
      const res = await api.post('/instances/export-grm');
      const { grm_content, grm_lines_count, invoiced_count, orders_created } = res.data;

      // Download GRM file
      const now = new Date();
      const filename = `GRM_${now.toISOString().slice(0, 10).replace(/-/g, '')}_${now.getHours()}${String(now.getMinutes()).padStart(2, '0')}.txt`;
      const blob = new Blob([grm_content], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setExportResult({ invoiced_count, orders_created });
      toast.success(`${grm_lines_count} ligne(s) exportée(s), ${orders_created.length} commande(s) créée(s)`);
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors de l\'export');
    } finally {
      setExporting(false);
    }
  };

  // Filter by serial number search
  const filtered = search.trim()
    ? instances.filter(i =>
        i.serial_number?.toLowerCase().includes(search.toLowerCase()) ||
        i.lot_number?.toLowerCase().includes(search.toLowerCase()) ||
        i.product?.description?.toLowerCase().includes(search.toLowerCase())
      )
    : instances;

  const pickedCount = instances.filter(i => i.status === 4).length;
  const consumedCount = instances.filter(i => i.status === 5).length;

  const handleFileUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportLoading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await api.post('/consumption/import/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportPreview(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de lecture du fichier');
    } finally {
      setImportLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleImportConfirm = async () => {
    if (!importPreview) return;
    const matchedRows = importPreview.rows.filter(r => r.status === 'matched');
    if (matchedRows.length === 0) {
      toast.error('Aucune ligne à confirmer');
      return;
    }
    setImportConfirming(true);
    try {
      const res = await api.post('/consumption/import/confirm', { rows: matchedRows });
      toast.success(`${res.data.confirmed} consommation(s) confirmée(s)`);
      setImportPreview(null);
      fetchData();
      fetchImportHistory();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setImportConfirming(false);
    }
  };

  const fetchImportHistory = async () => {
    try {
      const res = await api.get('/consumption/imports');
      setImportHistory(res.data);
    } catch (err) { /* ignore */ }
  };

  useEffect(() => { fetchImportHistory(); }, []);

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Consommation</h1>
          <p className="text-sm text-slate-500 mt-0.5">Validation des produits prélevés pour envoi GRM</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-sm">
            <span className="flex items-center gap-1.5 bg-amber-50 text-amber-700 px-3 py-1.5 rounded-lg border border-amber-200">
              <Clock className="w-3.5 h-3.5" />
              {pickedCount} prélevé(s)
            </span>
            <span className="flex items-center gap-1.5 bg-green-50 text-green-700 px-3 py-1.5 rounded-lg border border-green-200">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {consumedCount} consommé(s)
            </span>
          </div>
          <input type="file" ref={fileInputRef} accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
          <button
            data-testid="import-file-btn"
            onClick={() => fileInputRef.current?.click()}
            disabled={importLoading}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
          >
            {importLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importLoading ? 'Lecture...' : 'Importer fichier'}
          </button>
          <button
            data-testid="import-history-btn"
            onClick={() => { setShowHistory(!showHistory); if (!showHistory) fetchImportHistory(); }}
            className="flex items-center gap-2 border border-slate-300 text-slate-600 px-3 py-2 rounded-lg text-sm hover:bg-slate-50 transition-colors"
          >
            <History className="w-4 h-4" /> Historique
          </button>
          <button
            data-testid="export-grm-btn"
            onClick={() => {
              if (consumedCount === 0) { toast.error('Aucun produit consommé à exporter'); return; }
              setShowExportConfirm(true);
            }}
            disabled={exporting || consumedCount === 0}
            className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {exporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileDown className="w-4 h-4" />}
            {exporting ? 'Export en cours...' : 'Exporter GRM'}
          </button>
        </div>
      </div>

      {/* Export result summary */}
      {exportResult && (
        <div className="mb-4 p-4 bg-blue-50 border border-blue-200 rounded-xl" data-testid="export-result">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-blue-800 text-sm mb-1">Export GRM effectué</h3>
              <p className="text-xs text-blue-700">
                {exportResult.invoiced_count} produit(s) facturé(s) — {exportResult.orders_created.length} commande(s) de remplacement créée(s)
              </p>
              {exportResult.orders_created.length > 0 && (
                <ul className="mt-1.5 text-xs text-blue-600 space-y-0.5">
                  {exportResult.orders_created.map((o, i) => (
                    <li key={i}>• {o.supplier_name} — {o.total_items} article(s) en attente de réception</li>
                  ))}
                </ul>
              )}
            </div>
            <button onClick={() => setExportResult(null)} className="text-blue-400 hover:text-blue-600 text-xs">Fermer</button>
          </div>
        </div>
      )}

      {/* Import Preview Panel */}
      {importPreview && (
        <div className="mb-4 bg-white rounded-xl border border-emerald-200 overflow-hidden" data-testid="import-preview">
          <div className="p-4 bg-emerald-50 border-b border-emerald-200 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
              <div>
                <h3 className="font-semibold text-emerald-800 text-sm">Prévisualisation de l'import</h3>
                <p className="text-xs text-emerald-600 mt-0.5">
                  {importPreview.total_rows} ligne(s) — {importPreview.matched} trouvée(s) — {importPreview.unmatched} non trouvée(s) — {importPreview.manual_review} à vérifier
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {importPreview.matched > 0 && (
                <button
                  data-testid="import-confirm-btn"
                  onClick={handleImportConfirm}
                  disabled={importConfirming}
                  className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
                >
                  {importConfirming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                  Confirmer {importPreview.matched} consommation(s)
                </button>
              )}
              <button onClick={() => setImportPreview(null)} className="p-1.5 hover:bg-emerald-100 rounded-lg transition-colors">
                <X className="w-4 h-4 text-emerald-600" />
              </button>
            </div>
          </div>
          <div className="max-h-[400px] overflow-y-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">#</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">MRN</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Date naissance</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">N° Série</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">N° Lot</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Description (fichier)</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Correspondance</th>
                  <th className="text-left px-3 py-2 font-medium text-slate-500">Statut</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {importPreview.rows.map((row, i) => (
                  <tr key={i} className={
                    row.status === 'matched' ? 'bg-green-50/50' :
                    row.status === 'manual' ? 'bg-amber-50/50' : 'bg-red-50/50'
                  }>
                    <td className="px-3 py-2 text-slate-400">{row.row_number}</td>
                    <td className="px-3 py-2 font-mono">
                      {row.mrn || '—'}
                      {row.status === 'matched' && (
                        row.mrn_match
                          ? <span className="ml-1 text-green-600" title="MRN correspond">&#10003;</span>
                          : <span className="ml-1 text-amber-500" title="MRN non vérifié">?</span>
                      )}
                    </td>
                    <td className="px-3 py-2">
                      {row.birth_date || '—'}
                      {row.status === 'matched' && (
                        row.birth_date_match
                          ? <span className="ml-1 text-green-600">&#10003;</span>
                          : row.birth_date ? <span className="ml-1 text-amber-500">?</span> : null
                      )}
                    </td>
                    <td className="px-3 py-2 font-mono">{row.serial_number || '—'}</td>
                    <td className="px-3 py-2 font-mono">{row.lot_number || '—'}</td>
                    <td className="px-3 py-2 max-w-[200px] truncate" title={row.description}>{row.description || '—'}</td>
                    <td className="px-3 py-2">
                      {row.status === 'matched' ? (
                        <div>
                          <div className="text-green-700 font-medium truncate max-w-[200px]" title={row.instance_description}>
                            {row.instance_description}
                          </div>
                          <div className="text-slate-400 mt-0.5">
                            via {row.match_method === 'serial_number' ? 'N° série' : row.match_method === 'lot_number' ? 'N° lot' : 'description'}
                            {row.instance_location && <span className="ml-1">| {row.instance_location}</span>}
                            <span className="ml-1">| {row.instance_status_label}</span>
                          </div>
                        </div>
                      ) : '—'}
                    </td>
                    <td className="px-3 py-2">
                      {row.status === 'matched' && (
                        <span className="bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium">Trouvé</span>
                      )}
                      {row.status === 'unmatched' && (
                        <span className="bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-medium">Non trouvé</span>
                      )}
                      {row.status === 'manual' && (
                        <span className="bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full font-medium">À vérifier</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Import History Panel */}
      {showHistory && (
        <div className="mb-4 bg-white rounded-xl border border-slate-200 overflow-hidden" data-testid="import-history">
          <div className="p-4 bg-slate-50 border-b flex items-center justify-between">
            <h3 className="font-semibold text-slate-700 text-sm flex items-center gap-2">
              <History className="w-4 h-4" /> Historique des imports
            </h3>
            <button onClick={() => setShowHistory(false)} className="p-1 hover:bg-slate-200 rounded">
              <X className="w-4 h-4 text-slate-400" />
            </button>
          </div>
          <div className="max-h-[250px] overflow-y-auto">
            {importHistory.length === 0 ? (
              <div className="px-4 py-6 text-center text-sm text-slate-400">Aucun import effectué</div>
            ) : (
              <table className="w-full text-xs">
                <thead className="bg-slate-50 sticky top-0">
                  <tr>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Date</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Par</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Lignes</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Confirmés</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Ignorés</th>
                    <th className="text-left px-3 py-2 font-medium text-slate-500">Erreurs</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {importHistory.map(h => (
                    <tr key={h.id}>
                      <td className="px-3 py-2">{new Date(h.imported_at).toLocaleString('fr-CA')}</td>
                      <td className="px-3 py-2">{h.imported_by_name || '—'}</td>
                      <td className="px-3 py-2">{h.total_rows}</td>
                      <td className="px-3 py-2">
                        <span className="bg-green-100 text-green-700 px-1.5 py-0.5 rounded font-medium">{h.confirmed}</span>
                      </td>
                      <td className="px-3 py-2">{h.skipped}</td>
                      <td className="px-3 py-2">
                        {h.errors?.length > 0 ? (
                          <span className="bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">{h.errors.length}</span>
                        ) : '0'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Scan / Search */}
      <div className="mb-4">
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            ref={scanRef}
            data-testid="consumption-search"
            className="w-full pl-9 pr-3 py-2.5 border rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-400"
            placeholder="Scanner ou rechercher un N° série, lot, produit..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm min-w-[900px]">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Statut</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Action</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">N° Série</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Produit</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Catégorie</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Fournisseur</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">N° Lot</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Expiration</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">Chargement...</td></tr>
            ) : filtered.length === 0 ? (
              <tr>
                <td colSpan="8" className="px-4 py-8 text-center text-slate-400">
                  {search ? 'Aucun résultat pour cette recherche' : 'Aucun produit prélevé ou consommé'}
                </td>
              </tr>
            ) : filtered.map(inst => (
              <tr
                key={inst.id}
                data-testid={`consumption-row-${inst.id}`}
                className={`hover:bg-slate-50 ${search.trim() && inst.serial_number?.toLowerCase() === search.toLowerCase().trim() ? 'bg-blue-50' : ''}`}
              >
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium whitespace-nowrap ${STATUS_COLORS[inst.status] || 'bg-slate-100'}`}>
                    {STATUS_LABELS[inst.status] || inst.status}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {inst.status === 4 ? (
                    <button
                      data-testid={`consume-btn-${inst.id}`}
                      onClick={() => handleConsume(inst.id)}
                      disabled={processing === inst.id}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white rounded-lg text-xs font-medium hover:bg-green-700 disabled:opacity-50 transition-colors whitespace-nowrap"
                    >
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {processing === inst.id ? '...' : 'Consommer'}
                    </button>
                  ) : inst.status === 5 ? (
                    <span className="flex items-center gap-1 text-xs text-green-600 whitespace-nowrap">
                      <CheckCircle2 className="w-3.5 h-3.5" /> Validé
                    </span>
                  ) : (
                    <span className="flex items-center gap-1 text-xs text-blue-600 whitespace-nowrap">
                      <FileDown className="w-3.5 h-3.5" /> Facturé
                    </span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs font-medium">{inst.serial_number || '—'}</td>
                <td className="px-4 py-3">
                  <div>
                    <span className="font-medium">{inst.product?.description || '—'}</span>
                    {inst.product?.specification && (
                      <span className="text-slate-500 text-xs ml-1">({inst.product.specification})</span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3">
                  {inst.product?.category?.description
                    ? <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded whitespace-nowrap">{inst.product.category.description}</span>
                    : '—'}
                </td>
                <td className="px-4 py-3 text-slate-600">{inst.product?.supplier?.name || '—'}</td>
                <td className="px-4 py-3 text-slate-600 text-xs">{inst.lot_number || '—'}</td>
                <td className="px-4 py-3 text-slate-600 text-xs whitespace-nowrap">
                  {inst.expiration_date ? new Date(inst.expiration_date).toLocaleDateString('fr-CA') : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Export GRM confirmation dialog */}
      {showExportConfirm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md mx-4 shadow-xl">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                <FileDown className="w-5 h-5 text-blue-600" />
              </div>
              <div>
                <h3 className="font-bold text-slate-800">Exporter vers GRM ?</h3>
                <p className="text-sm text-slate-500 mt-0.5">
                  {consumedCount} produit(s) consommé(s) à exporter
                </p>
              </div>
            </div>
            <div className="bg-slate-50 rounded-lg p-3 mb-4 text-sm text-slate-600 space-y-1">
              <p>Cette action va :</p>
              <ul className="list-disc list-inside space-y-0.5">
                <li>Générer le fichier GRM</li>
                <li>Créer les commandes de remplacement</li>
                <li>Marquer les produits comme facturés</li>
              </ul>
            </div>
            <div className="flex gap-2">
              <button onClick={() => setShowExportConfirm(false)}
                data-testid="export-cancel-btn"
                className="flex-1 border rounded-lg py-2.5 text-sm hover:bg-slate-50 transition-colors">Annuler</button>
              <button onClick={handleExportGRM}
                data-testid="export-confirm-btn"
                className="flex-1 bg-blue-600 text-white rounded-lg py-2.5 text-sm font-medium hover:bg-blue-700 transition-colors">
                Exporter
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
