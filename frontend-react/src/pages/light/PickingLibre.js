import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/App';
import { toast } from 'sonner';
import { ArrowLeft, Search, MapPin, Package, Check, ScanLine, X, FileText, RefreshCw } from 'lucide-react';

export default function LightPickingLibre({ user, onLogout }) {
  const navigate = useNavigate();
  const [categoryId, setCategoryId] = useState('');
  const [typeId, setTypeId] = useState('');
  const [specId, setSpecId] = useState('');
  const [filterOptions, setFilterOptions] = useState({ categories: [], types: [], specifications: [] });
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [patientFile, setPatientFile] = useState('');
  const [birthDate, setBirthDate] = useState('');
  const [operationDate, setOperationDate] = useState('');
  const [operatingRoom, setOperatingRoom] = useState('');
  const [picking, setPicking] = useState(null);
  const [pickedItems, setPickedItems] = useState([]);

  // Scan state
  const [scanSerial, setScanSerial] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [scanning, setScanning] = useState(false);
  const scanRef = useRef(null);

  const fetchStock = useCallback(async (catId, typId, spcId) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (catId) params.set('category_id', catId);
      if (typId) params.set('type_id', typId);
      if (spcId) params.set('specification_id', spcId);
      const res = await api.get(`/instances/available-stock?${params}`);
      setResults(res.data.results);
      setFilterOptions(res.data.filter_options);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStock('', '', ''); }, [fetchStock]);

  const handleCategoryChange = (val) => {
    const v = categoryId === val ? '' : val;
    setCategoryId(v);
    setTypeId('');
    setSpecId('');
    fetchStock(v, '', '');
  };

  const handleTypeChange = (val) => {
    const v = typeId === val ? '' : val;
    setTypeId(v);
    setSpecId('');
    fetchStock(categoryId, v, '');
  };

  const handleSpecChange = (val) => {
    const v = specId === val ? '' : val;
    setSpecId(v);
    fetchStock(categoryId, typeId, v);
  };

  const clearFilters = () => {
    setCategoryId('');
    setTypeId('');
    setSpecId('');
    fetchStock('', '', '');
  };

  const handlePick = async (instanceId) => {
    setPicking(instanceId);
    try {
      await api.post('/instances/pick-libre', {
        instance_id: instanceId,
        patient_file: patientFile,
        birth_date: birthDate || undefined,
      });
      toast.success('Produit prélevé');
      setPickedItems(prev => [...prev, instanceId]);
      fetchStock(categoryId, typeId, specId);
      // If this was the scanned product, clear scan
      if (scanResult?.instance?.id === instanceId) {
        setScanResult(null);
        setScanSerial('');
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setPicking(null);
    }
  };

  // Scan serial number
  const handleScan = async (e) => {
    e?.preventDefault();
    const serial = scanSerial.trim();
    if (!serial) return;
    setScanning(true);
    setScanResult(null);
    try {
      const res = await api.post('/instances/scan', { serial_number: serial });
      setScanResult(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setScanning(false);
    }
  };

  const clearScan = () => {
    setScanSerial('');
    setScanResult(null);
    scanRef.current?.focus();
  };

  const hasFilters = categoryId || typeId || specId;

  return (
    <div className="min-h-screen bg-slate-900 p-4 select-none">
      {/* Header */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => navigate('/production/interventions')}
          className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Search className="w-5 h-5 text-blue-400" />
            PICKING
          </h1>
        </div>
        {hasFilters && (
          <button onClick={clearFilters}
            className="px-3 py-2 rounded-lg bg-slate-700 text-slate-300 text-xs font-medium hover:bg-slate-600">
            Réinitialiser
          </button>
        )}
      </div>

      {/* Scan serial number */}
      <form onSubmit={handleScan} className="mb-4">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <ScanLine className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              ref={scanRef}
              data-testid="scan-serial-input"
              className="w-full bg-slate-800 border border-slate-600 rounded-xl pl-10 pr-10 py-3 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500 font-mono"
              placeholder="Scanner ou saisir un N° de série..."
              value={scanSerial}
              onChange={e => setScanSerial(e.target.value)}
              autoFocus
            />
            {scanSerial && (
              <button type="button" onClick={clearScan}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>
          <button type="submit" data-testid="scan-submit-btn"
            disabled={!scanSerial.trim() || scanning}
            className="px-5 rounded-xl bg-blue-600 text-white font-bold text-sm hover:bg-blue-700 disabled:opacity-40 transition-colors">
            {scanning ? '...' : 'OK'}
          </button>
        </div>
      </form>

      {/* Scan result card */}
      {scanResult && (
        <div className={`mb-4 rounded-xl p-4 border ${
          scanResult.action === 'already_placed' ? 'bg-emerald-900/20 border-emerald-700/50' :
          scanResult.action === 'unknown' ? 'bg-red-900/20 border-red-700/50' :
          'bg-amber-900/20 border-amber-700/50'
        }`}>
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {scanResult.action === 'unknown' ? (
                <div className="text-red-400 font-medium text-sm">{scanResult.message}</div>
              ) : (
                <>
                  <div className="text-white font-semibold text-sm mb-1">
                    {scanResult.instance?.product?.description || '—'}
                  </div>
                  <div className="flex flex-wrap gap-2 text-xs">
                    <span className="font-mono bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                      SN: {scanResult.instance?.serial_number}
                    </span>
                    {scanResult.instance?.lot_number && (
                      <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                        Lot: {scanResult.instance.lot_number}
                      </span>
                    )}
                    {scanResult.instance?.expiration_date && (
                      <span className="bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                        Exp: {new Date(scanResult.instance.expiration_date).toLocaleDateString('fr-CA')}
                      </span>
                    )}
                    {scanResult.location && (
                      <span className="flex items-center gap-1 bg-blue-900/50 text-blue-400 px-2 py-0.5 rounded">
                        <MapPin className="w-3 h-3" />
                        {scanResult.location.code || scanResult.location.name}
                      </span>
                    )}
                  </div>
                  <div className={`text-xs mt-2 ${
                    scanResult.action === 'already_placed' ? 'text-emerald-400' : 'text-amber-400'
                  }`}>
                    {scanResult.message}
                  </div>
                </>
              )}
            </div>
            <div className="shrink-0 flex items-center gap-2">
              {scanResult.action === 'already_placed' && scanResult.instance && (
                pickedItems.includes(scanResult.instance.id) ? (
                  <span className="flex items-center gap-1 text-green-400 text-xs font-bold">
                    <Check className="w-4 h-4" /> Prélevé
                  </span>
                ) : (
                  <button
                    data-testid="scan-pick-btn"
                    onClick={() => handlePick(scanResult.instance.id)}
                    disabled={picking === scanResult.instance.id}
                    className="px-5 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {picking === scanResult.instance.id ? '...' : 'Prélever'}
                  </button>
                )
              )}
              <button onClick={clearScan} className="p-1 text-slate-500 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Patient info fields: Date opération, MRN, Date naissance, Salle */}
      <div className="grid grid-cols-4 gap-2 mb-4">
        <div>
          <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Date opération</label>
          <input
            type="date"
            data-testid="picking-operation-date"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500"
            value={operationDate}
            onChange={e => setOperationDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">MRN</label>
          <input
            data-testid="picking-patient-file"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500"
            placeholder="MRN"
            value={patientFile}
            onChange={e => setPatientFile(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Date naissance</label>
          <input
            type="date"
            data-testid="picking-birth-date"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-blue-500"
            value={birthDate}
            onChange={e => setBirthDate(e.target.value)}
          />
        </div>
        <div>
          <label className="block text-[10px] text-slate-500 uppercase tracking-wide mb-1">Salle</label>
          <input
            data-testid="picking-operating-room"
            className="w-full bg-slate-800 border border-slate-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder-slate-500 outline-none focus:border-blue-500"
            placeholder="Ex: 05"
            maxLength={2}
            value={operatingRoom}
            onChange={e => setOperatingRoom(e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
          />
        </div>
      </div>

      {/* 3-column cascading filters */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        {/* Category */}
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-slate-700/50 text-xs font-bold text-slate-400 uppercase">Catégorie</div>
          <div className="max-h-40 overflow-y-auto">
            {filterOptions.categories.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500">Aucune</div>
            ) : [...filterOptions.categories].sort((a, b) => a.description.localeCompare(b.description)).map(c => (
              <button key={c.id}
                data-testid={`filter-cat-${c.id}`}
                onClick={() => handleCategoryChange(c.id)}
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-slate-700/50 transition-colors ${
                  categoryId === c.id
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {c.description}
              </button>
            ))}
          </div>
        </div>

        {/* Type */}
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-slate-700/50 text-xs font-bold text-slate-400 uppercase">Modèle</div>
          <div className="max-h-40 overflow-y-auto">
            {filterOptions.types.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500">Aucun</div>
            ) : [...filterOptions.types].sort((a, b) => a.description.localeCompare(b.description)).map(t => (
              <button key={t.id}
                data-testid={`filter-type-${t.id}`}
                onClick={() => handleTypeChange(t.id)}
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-slate-700/50 transition-colors ${
                  typeId === t.id
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {t.description}
              </button>
            ))}
          </div>
        </div>

        {/* Specification */}
        <div className="bg-slate-800 rounded-xl overflow-hidden">
          <div className="px-3 py-2 bg-slate-700/50 text-xs font-bold text-slate-400 uppercase">Spécification</div>
          <div className="max-h-40 overflow-y-auto">
            {filterOptions.specifications.length === 0 ? (
              <div className="px-3 py-3 text-xs text-slate-500">Aucune</div>
            ) : [...filterOptions.specifications].sort((a, b) => a.description.localeCompare(b.description)).map(s => (
              <button key={s.id}
                data-testid={`filter-spec-${s.id}`}
                onClick={() => handleSpecChange(s.id)}
                className={`w-full text-left px-3 py-2.5 text-sm border-b border-slate-700/50 transition-colors ${
                  specId === s.id
                    ? 'bg-blue-600 text-white font-medium'
                    : 'text-slate-300 hover:bg-slate-700'
                }`}
              >
                {s.description}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results */}
      <div>
        {loading ? (
          <div className="text-center text-slate-500 py-8">Chargement...</div>
        ) : results.length === 0 ? (
          <div className="bg-slate-800 rounded-xl p-8 text-center">
            <Package className="w-10 h-10 mx-auto mb-2 text-slate-600" />
            <p className="text-slate-500">Aucun produit en stock pour ces filtres</p>
          </div>
        ) : (
          <div className="space-y-2">
            {results.map(r => (
              <div key={r.product_id}
                data-testid={`stock-result-${r.product_id}`}
                className="bg-slate-800 rounded-xl p-4"
              >
                <div className="flex items-center gap-4 mb-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-white font-medium text-sm">{r.description}</div>
                  </div>
                  {r.nearest_location && (
                    <div className="flex items-center gap-1.5 text-blue-400 shrink-0">
                      <MapPin className="w-5 h-5" />
                      <span className="text-2xl font-black">{r.nearest_location}</span>
                    </div>
                  )}
                  <div className="bg-emerald-600/20 border border-emerald-500/30 rounded-lg px-3 py-2 shrink-0 text-center min-w-[60px]">
                    <div className="text-emerald-400 text-2xl font-black leading-none">{r.quantity}</div>
                    <div className="text-emerald-600 text-[10px] mt-0.5">en stock</div>
                  </div>
                  <button
                    data-testid={`refresh-btn-${r.product_id}`}
                    onClick={() => fetchStock(categoryId, typeId, specId)}
                    className="p-2.5 bg-slate-700 text-slate-300 rounded-lg hover:bg-blue-600 hover:text-white shrink-0 transition-colors"
                    title="Rafraîchir"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </button>
                </div>

                {/* Instance list for picking */}
                <div className="space-y-1">
                  {r.instances.map(inst => (
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
                      {pickedItems.includes(inst.id) ? (
                        <span className="flex items-center gap-1 text-green-400 text-xs font-bold">
                          <Check className="w-4 h-4" /> Prélevé
                        </span>
                      ) : (
                        <button
                          data-testid={`pick-btn-${inst.id}`}
                          onClick={() => handlePick(inst.id)}
                          disabled={picking === inst.id}
                          className="px-4 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                        >
                          {picking === inst.id ? '...' : 'Prélever'}
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
