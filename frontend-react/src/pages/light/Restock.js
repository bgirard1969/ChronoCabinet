import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '@/App';
import { toast } from 'sonner';
import { ArrowLeft, Camera, MapPin, Check, AlertCircle, RefreshCw, Package } from 'lucide-react';

export default function LightRestock({ user, onLogout }) {
  const navigate = useNavigate();
  const [scanInput, setScanInput] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [completedItems, setCompletedItems] = useState([]);
  const scanRef = useRef(null);

  useEffect(() => {
    if (scanRef.current) scanRef.current.focus();
  });

  const handleScan = async () => {
    const serial = scanInput.trim();
    if (!serial) return;
    setScanResult(null);

    try {
      const res = await api.post('/instances/scan', { serial_number: serial });
      setScanResult(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur lors du scan');
    }

    setScanInput('');
    if (scanRef.current) scanRef.current.focus();
  };

  const handlePlace = async (instanceId, locationId) => {
    setProcessing(true);
    try {
      const endpoint = scanResult?.action === 'return_to_stock'
        ? '/instances/return-to-stock'
        : '/instances/place';
      const res = await api.post(endpoint, { instance_id: instanceId, location_id: locationId });
      toast.success(`Produit placé: ${res.data.location_code}`);
      setCompletedItems(prev => [...prev, {
        serial: scanResult?.instance?.serial_number || '—',
        location: res.data.location_code,
      }]);
      setScanResult(null);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 p-4 select-none">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => navigate('/production/interventions')}
          className="p-3 rounded-xl bg-slate-800 text-slate-400 hover:text-white">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-white flex items-center gap-2">
            <Package className="w-5 h-5 text-emerald-400" />
            Mise en stock
          </h1>
          <p className="text-sm text-slate-400">Scannez le numéro de série du produit</p>
        </div>
      </div>

      {/* Scan area */}
      <div className="bg-slate-800 rounded-xl p-4 mb-6">
        <div className="flex gap-2">
          <input
            ref={scanRef}
            data-testid="restock-scan-input"
            className="flex-1 bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-lg placeholder-slate-500 outline-none focus:border-blue-500"
            placeholder="Numéro de série..."
            value={scanInput}
            onChange={e => setScanInput(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleScan()}
          />
          <button onClick={handleScan} data-testid="restock-scan-submit"
            className="px-6 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition-colors">
            OK
          </button>
        </div>
      </div>

      {/* Scan result */}
      {scanResult && (
        <div className="bg-slate-800 rounded-xl p-4 mb-6">
          {scanResult.action === 'place' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Check className="w-5 h-5 text-green-400" />
                <span className="text-green-400 font-medium">Produit réceptionné — prêt pour placement</span>
              </div>
              <div className="bg-slate-700 rounded-lg p-3 mb-3">
                <p className="text-white font-medium">{scanResult.instance?.product?.description || '—'}</p>
                <p className="text-slate-400 text-sm">SN: {scanResult.instance?.serial_number}</p>
                {scanResult.instance?.expiration_date && (
                  <p className="text-slate-400 text-sm">Exp: {new Date(scanResult.instance.expiration_date).toLocaleDateString('fr-CA')}</p>
                )}
              </div>
              {scanResult.suggested_location ? (
                <div>
                  <p className="text-sm text-slate-400 mb-2 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Emplacement suggéré:</p>
                  <div className="bg-blue-600/20 border border-blue-600/30 rounded-lg p-3 mb-3">
                    <p className="text-blue-300 font-bold">
                      {scanResult.suggested_location.cabinet?.description || '?'} — R{scanResult.suggested_location.row} C{scanResult.suggested_location.column}
                    </p>
                  </div>
                  <button
                    data-testid="confirm-placement"
                    onClick={() => handlePlace(scanResult.instance.id, scanResult.suggested_location.id)}
                    disabled={processing}
                    className="w-full h-14 rounded-xl bg-green-600 text-white text-lg font-bold hover:bg-green-700 disabled:opacity-50 transition-colors"
                  >
                    {processing ? 'Placement...' : 'Confirmer le placement'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertCircle className="w-5 h-5" />
                  <span>Aucun emplacement disponible</span>
                </div>
              )}
            </div>
          )}

          {scanResult.action === 'return_to_stock' && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <RefreshCw className="w-5 h-5 text-blue-400" />
                <span className="text-blue-400 font-medium">Produit prélevé — remise en stock</span>
              </div>
              <div className="bg-slate-700 rounded-lg p-3 mb-3">
                <p className="text-white font-medium">{scanResult.instance?.product?.description || '—'}</p>
                <p className="text-slate-400 text-sm">SN: {scanResult.instance?.serial_number}</p>
              </div>
              {scanResult.suggested_location ? (
                <div>
                  <p className="text-sm text-slate-400 mb-2 flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> Emplacement suggéré:</p>
                  <div className="bg-blue-600/20 border border-blue-600/30 rounded-lg p-3 mb-3">
                    <p className="text-blue-300 font-bold">
                      {scanResult.suggested_location.cabinet?.description || '?'} — R{scanResult.suggested_location.row} C{scanResult.suggested_location.column}
                    </p>
                  </div>
                  <button
                    data-testid="confirm-return"
                    onClick={() => handlePlace(scanResult.instance.id, scanResult.suggested_location.id)}
                    disabled={processing}
                    className="w-full h-14 rounded-xl bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 disabled:opacity-50 transition-colors"
                  >
                    {processing ? 'Placement...' : 'Confirmer la remise en stock'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-2 text-amber-400">
                  <AlertCircle className="w-5 h-5" />
                  <span>Aucun emplacement disponible</span>
                </div>
              )}
            </div>
          )}

          {scanResult.action === 'already_placed' && (
            <div className="flex items-center gap-2 text-slate-400">
              <AlertCircle className="w-5 h-5" />
              <span>Ce produit est déjà en stock
                {scanResult.location && ` (${scanResult.location.cabinet?.description || '?'} R${scanResult.location.row} C${scanResult.location.column})`}
              </span>
            </div>
          )}

          {scanResult.action === 'unknown' && (
            <div className="flex items-center gap-2 text-amber-400">
              <AlertCircle className="w-5 h-5" />
              <span>Numéro de série inconnu dans le système</span>
            </div>
          )}

          {scanResult.action === 'unavailable' && (
            <div className="flex items-center gap-2 text-red-400">
              <AlertCircle className="w-5 h-5" />
              <span>{scanResult.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Completed items */}
      {completedItems.length > 0 && (
        <div>
          <h2 className="text-sm font-bold text-slate-400 uppercase mb-3">Placés cette session</h2>
          <div className="space-y-1">
            {completedItems.map((item, i) => (
              <div key={i} className="bg-green-900/30 border border-green-700/30 rounded-lg px-3 py-2 flex items-center gap-2 text-sm">
                <Check className="w-4 h-4 text-green-400" />
                <span className="text-green-300 font-mono">{item.serial}</span>
                <span className="text-green-500 text-xs ml-auto">{item.location}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
