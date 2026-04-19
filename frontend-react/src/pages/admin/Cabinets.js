import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Plus, Grid3X3, Trash2, AlertTriangle, Package, Info } from 'lucide-react';

// Compute days until expiration
function daysUntilExpiry(dateStr) {
  if (!dateStr) return null;
  const exp = new Date(dateStr);
  const now = new Date();
  return Math.ceil((exp - now) / (1000 * 60 * 60 * 24));
}

function ExpiryBadge({ days }) {
  if (days === null) return null;
  if (days < 0) return <span className="text-[9px] font-bold text-red-600 bg-red-100 px-1 rounded">EXPIRÉ</span>;
  if (days <= 30) return <span className="text-[9px] font-bold text-orange-600 bg-orange-100 px-1 rounded">{days}j</span>;
  if (days <= 90) return <span className="text-[9px] font-bold text-amber-600 bg-amber-100 px-1 rounded">{days}j</span>;
  return <span className="text-[9px] text-slate-400">{days}j</span>;
}

export default function Cabinets() {
  const [cabinets, setCabinets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCabinet, setSelectedCabinet] = useState(null);
  const [locations, setLocations] = useState([]);
  const [products, setProducts] = useState([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ description: '', columns: 4, rows: 4 });
  const [hoveredLoc, setHoveredLoc] = useState(null);

  const fetchCabinets = async () => {
    setLoading(true);
    try {
      const [cabRes, prodRes] = await Promise.all([
        api.get('/cabinets'),
        api.get('/products'),
      ]);
      setCabinets(cabRes.data);
      setProducts(prodRes.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur de chargement');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchCabinets(); }, []);

  const selectCabinet = async (cab) => {
    setSelectedCabinet(cab);
    try {
      const res = await api.get(`/cabinets/${cab.id}/locations`);
      setLocations(res.data.locations || []);
    } catch (err) {
      toast.error('Erreur lors du chargement des emplacements');
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/cabinets', form);
      toast.success('Cabinet créé');
      setShowForm(false);
      setForm({ description: '', columns: 4, rows: 4 });
      fetchCabinets();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleAssignProduct = async (locationId, productId) => {
    try {
      await api.put(`/cabinets/${selectedCabinet.id}/locations/${locationId}`, {
        product_id: productId || null,
      });
      selectCabinet(selectedCabinet);
      toast.success('Emplacement mis à jour');
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDeleteCabinet = async (cabId) => {
    if (!window.confirm('Supprimer ce cabinet et tous ses emplacements ?')) return;
    try {
      await api.delete(`/cabinets/${cabId}`);
      toast.success('Cabinet supprimé');
      if (selectedCabinet?.id === cabId) {
        setSelectedCabinet(null);
        setLocations([]);
      }
      fetchCabinets();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  // Build matrix
  const matrix = [];
  if (selectedCabinet) {
    for (let r = 1; r <= selectedCabinet.rows; r++) {
      const row = [];
      for (let c = 1; c <= selectedCabinet.columns; c++) {
        const loc = locations.find(l => l.row === r && l.column === c);
        row.push(loc || null);
      }
      matrix.push(row);
    }
  }

  // Stats
  const occupied = locations.filter(l => !l.is_empty).length;
  const empty = locations.filter(l => l.is_empty).length;
  const expiringLocs = locations.filter(l => {
    if (l.is_empty || !l.instance) return false;
    const days = daysUntilExpiry(l.instance.expiration_date);
    return days !== null && days <= 30;
  });

  // Cell color based on status
  const getCellStyle = (loc) => {
    if (!loc) return 'border-dashed border-slate-200 bg-slate-50/50';
    if (!loc.is_empty && loc.instance) {
      const days = daysUntilExpiry(loc.instance.expiration_date);
      if (days !== null && days < 0) return 'border-red-400 bg-red-50 ring-1 ring-red-200';
      if (days !== null && days <= 30) return 'border-orange-400 bg-orange-50 ring-1 ring-orange-200';
      if (days !== null && days <= 90) return 'border-amber-300 bg-amber-50';
      return 'border-green-300 bg-green-50';
    }
    if (loc.is_empty && loc.product_id) return 'border-blue-200 bg-blue-50/50';
    return 'border-slate-200 bg-white';
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Cabinets</h1>
          <p className="text-sm text-slate-500 mt-0.5">Configuration des armoires et emplacements</p>
        </div>
        <button data-testid="create-cabinet-btn" onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nouveau cabinet
        </button>
      </div>

      {/* Cabinet list - horizontal */}
      <div className="flex flex-wrap gap-3 mb-6">
        {loading ? (
          <div className="text-sm text-slate-400 p-4">Chargement...</div>
        ) : cabinets.length === 0 ? (
          <div className="text-sm text-slate-400 p-4">Aucun cabinet</div>
        ) : cabinets.map(cab => {
          const pct = cab.total_locations ? Math.round((cab.occupied_locations / cab.total_locations) * 100) : 0;
          return (
            <div
              key={cab.id}
              data-testid={`cabinet-item-${cab.id}`}
              onClick={() => selectCabinet(cab)}
              className={`p-3 rounded-xl border cursor-pointer transition-all min-w-[180px] ${
                selectedCabinet?.id === cab.id
                  ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200'
                  : 'bg-white border-slate-200 hover:border-slate-300'
              }`}
            >
              <div className="flex items-center justify-between mb-1.5">
                <h3 className="font-semibold text-sm">{cab.description}</h3>
                <Grid3X3 className="w-4 h-4 text-slate-400" />
              </div>
              <p className="text-xs text-slate-500 mb-2">
                {cab.rows} x {cab.columns} — {cab.occupied_locations || 0}/{cab.total_locations || 0} occupés
              </p>
              <div className="w-full bg-slate-100 rounded-full h-1.5">
                <div
                  className={`h-1.5 rounded-full transition-all ${pct > 80 ? 'bg-green-500' : pct > 40 ? 'bg-blue-500' : 'bg-slate-300'}`}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Matrix view - full width */}
      {selectedCabinet ? (
            <div className="bg-white rounded-xl border border-slate-200 p-5">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="font-bold text-lg">{selectedCabinet.description}</h2>
                  <p className="text-xs text-slate-500">{selectedCabinet.rows} rangées x {selectedCabinet.columns} colonnes</p>
                </div>
                <div className="flex items-center gap-3">
                  {expiringLocs.length > 0 && (
                    <span className="flex items-center gap-1 text-xs text-orange-600 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-200">
                      <AlertTriangle className="w-3 h-3" /> {expiringLocs.length} expiration(s) proche(s)
                    </span>
                  )}
                  <span className="text-xs text-slate-500">{occupied} occupé(s) / {empty} vide(s)</span>
                  <button onClick={() => handleDeleteCabinet(selectedCabinet.id)}
                    className="p-1.5 hover:bg-red-50 rounded" title="Supprimer le cabinet">
                    <Trash2 className="w-4 h-4 text-red-400" />
                  </button>
                </div>
              </div>

              {/* Matrix grid */}
              <div className="overflow-x-auto">
                <div className="inline-grid gap-2" style={{
                  gridTemplateColumns: `40px repeat(${selectedCabinet.columns}, minmax(120px, 1fr))`,
                }}>
                  <div /> {/* Empty top-left */}
                  {Array.from({ length: selectedCabinet.columns }, (_, i) => (
                    <div key={i} className="text-center text-xs font-bold text-slate-400 py-1">C{i + 1}</div>
                  ))}

                  {matrix.map((row, rIdx) => (
                    <React.Fragment key={rIdx}>
                      <div className="flex items-center justify-center text-xs font-bold text-slate-400">R{rIdx + 1}</div>
                      {row.map((loc, cIdx) => {
                        const days = loc?.instance ? daysUntilExpiry(loc.instance.expiration_date) : null;
                        const locKey = `${rIdx + 1}-${cIdx + 1}`;
                        return (
                          <div
                            key={cIdx}
                            data-testid={`loc-r${rIdx + 1}-c${cIdx + 1}`}
                            className={`relative rounded-lg border-2 p-2 min-h-[90px] text-xs transition-all cursor-default ${getCellStyle(loc)}`}
                            onMouseEnter={() => setHoveredLoc(locKey)}
                            onMouseLeave={() => setHoveredLoc(null)}
                          >
                            {loc && (
                              <>
                                {/* Occupied cell */}
                                {!loc.is_empty && loc.instance && (
                                  <div className="space-y-0.5">
                                    <div className="font-bold text-[11px] text-slate-800 truncate">
                                      {loc.instance.serial_number || 'En stock'}
                                    </div>
                                    <div className="text-[10px] text-slate-500 truncate leading-tight">
                                      {[loc.product?.type?.description, loc.product?.specification_obj?.description || loc.product?.specification].filter(Boolean).join(' — ') || '—'}
                                    </div>
                                    <div className="flex items-center gap-1 mt-1">
                                      <ExpiryBadge days={days} />
                                      {loc.instance.lot_number && (
                                        <span className="text-[9px] text-slate-400">Lot: {loc.instance.lot_number}</span>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Empty cell with designated product */}
                                {loc.is_empty && loc.product_id && (
                                  <div className="space-y-0.5">
                                    <div className="text-[10px] text-blue-500 font-medium truncate">
                                      {loc.product?.description || 'Produit désigné'}
                                    </div>
                                    <div className="text-[9px] text-blue-400 italic">Vide</div>
                                  </div>
                                )}

                                {/* Empty cell - product assignment */}
                                {loc.is_empty && (
                                  <select
                                    className="absolute bottom-1 left-1 right-1 text-[9px] border rounded p-0.5 bg-white/90 hover:bg-white"
                                    value={loc.product_id || ''}
                                    onChange={e => handleAssignProduct(loc.id, e.target.value)}
                                  >
                                    <option value="">Sans produit</option>
                                    {products.map(p => (
                                      <option key={p.id} value={p.id}>{p.description}</option>
                                    ))}
                                  </select>
                                )}

                                {/* Tooltip on hover */}
                                {hoveredLoc === locKey && !loc.is_empty && loc.instance && (
                                  <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-10 bg-slate-800 text-white rounded-lg p-2.5 text-[11px] min-w-[200px] shadow-xl pointer-events-none">
                                    <div className="font-bold mb-1">{loc.product?.description || '—'}</div>
                                    {loc.product?.specification && <div className="text-slate-300 mb-1">{loc.product.specification}</div>}
                                    <div className="space-y-0.5 text-slate-300">
                                      <div>N° Série: <span className="text-white font-mono">{loc.instance.serial_number || '—'}</span></div>
                                      <div>N° Lot: <span className="text-white">{loc.instance.lot_number || '—'}</span></div>
                                      <div>Expiration: <span className={`font-medium ${days !== null && days <= 30 ? 'text-orange-400' : 'text-white'}`}>
                                        {loc.instance.expiration_date ? new Date(loc.instance.expiration_date).toLocaleDateString('fr-CA') : '—'}
                                        {days !== null && ` (${days}j)`}
                                      </span></div>
                                    </div>
                                    <div className="absolute left-1/2 -translate-x-1/2 top-full w-0 h-0 border-l-[6px] border-r-[6px] border-t-[6px] border-transparent border-t-slate-800" />
                                  </div>
                                )}
                              </>
                            )}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))}
                </div>
              </div>

              {/* Legend */}
              <div className="flex flex-wrap gap-4 mt-4 pt-3 border-t border-slate-100 text-xs text-slate-500">
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-green-300 bg-green-50" /> Occupé</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-amber-300 bg-amber-50" /> Expire &lt; 90j</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-orange-400 bg-orange-50" /> Expire &lt; 30j</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-red-400 bg-red-50" /> Expiré</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-blue-200 bg-blue-50" /> Vide (produit désigné)</span>
                <span className="flex items-center gap-1.5"><span className="w-3 h-3 rounded border-2 border-slate-200 bg-white" /> Vide (libre)</span>
              </div>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-slate-200 p-12 text-center text-slate-400">
              <Grid3X3 className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p>Sélectionnez un cabinet pour voir sa matrice</p>
            </div>
          )}
        

      {/* Create modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Nouveau cabinet</h2>
            <form onSubmit={handleCreate} className="space-y-3">
              <div>
                <label className="block text-sm font-medium mb-1">Description</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm" maxLength={50} required
                  placeholder="ex: Armoire A"
                  value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Colonnes</label>
                  <input type="number" min={1} max={20} className="w-full border rounded-lg px-3 py-2 text-sm" required
                    value={form.columns} onChange={e => setForm({ ...form, columns: parseInt(e.target.value) || 1 })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Rangées</label>
                  <input type="number" min={1} max={20} className="w-full border rounded-lg px-3 py-2 text-sm" required
                    value={form.rows} onChange={e => setForm({ ...form, rows: parseInt(e.target.value) || 1 })} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)}
                  className="flex-1 border rounded-lg py-2 text-sm hover:bg-slate-50">Annuler</button>
                <button type="submit"
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">Créer</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
