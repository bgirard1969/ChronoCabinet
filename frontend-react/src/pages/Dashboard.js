import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import StatsCard from '@/components/StatsCard';
import { Package, Layers, TrendingUp, AlertTriangle, Activity, Calendar } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const Dashboard = () => {
  const { t } = useLanguage();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showExpModal, setShowExpModal] = useState(false);
  const [expiringSoon, setExpiringSoon] = useState([]);
  const [expLoading, setExpLoading] = useState(false);
  const [selectedItems, setSelectedItems] = useState([]);

  const go = (path) => () => window.location.assign(path);

  useEffect(() => {
    let cancelled = false;
    const fetchData = async () => {
      try {
        const statsRes = await api.get('/dashboard/stats');
        if (!cancelled) setStats(statsRes.data);
      } catch (error) {
        if (!cancelled) toast.error("Erreur stats: " + (error.response?.status || 'réseau'));
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchData();
    return () => { cancelled = true; };
  }, []);

  // Lazy-load expirations only when opening modal (15 days + already expired)
  const loadExpiringSoon = async () => {
    setExpLoading(true);
    try {
      const res = await api.get('/reports/stock');
      const now = new Date();
      const in15 = new Date();
      in15.setDate(now.getDate() + 15);
      const items = (res.data || [])
        .filter((b) => {
          // Only include 'disponible' status AND (expired OR expiring within 15 days)
          if (b.statut !== 'disponible') return false;
          const d = new Date(b.date_expiration);
          return d <= in15;
        })
        .map((b) => ({
          id: b.id,
          product: b.product?.nom || '—',
          reference: b.product?.reference || '—',
          numero_grm: b.product?.numero_grm || b.product?.description || '—',
          numero_serie: b.numero_serie,
          expiration: new Date(b.date_expiration).toLocaleDateString('fr-FR'),
          location: b.localisation,
        }));
      setExpiringSoon(items);
      setSelectedItems([]);
    } catch (_) {
      setExpiringSoon([]);
      setSelectedItems([]);
    } finally {
      setExpLoading(false);
    }
  };

  const toggleSelectItem = (id) => {
    setSelectedItems(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedItems.length === expiringSoon.length) {
      setSelectedItems([]);
    } else {
      setSelectedItems(expiringSoon.map(item => item.id));
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
    <div className="p-8" data-testid="dashboard-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
          {t('dashboard')}
        </h1>
        <p className="text-gray-600">{t('appSubtitle')}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
        <StatsCard
          title={t('totalProducts')}
          value={stats?.total_produits || 0}
          icon={Package}
          color="blue"
          onClick={go('/products')}
        />
        <StatsCard
          title={t('batches')}
          value={stats?.total_lots || 0}
          icon={Layers}
          color="green"
          onClick={go('/batches')}
        />
        <StatsCard
          title={t('recentMovements')}
          value={stats?.total_mouvements_jour || 0}
          icon={TrendingUp}
          color="purple"
          onClick={go('/movements')}
        />
        <StatsCard
          title={t('alerts')}
          value={stats?.alertes_actives || 0}
          icon={AlertTriangle}
          color="red"
          onClick={go('/alerts')}
        />
        <StatsCard
          title={t('criticalStock')}
          value={stats?.stock_critique || 0}
          icon={Activity}
          color="orange"
          onClick={go('/replenishment')}
        />
        <StatsCard
          title={t('expiringProducts')}
          value={stats?.expirations_proches || 0}
          icon={Calendar}
          color="orange"
          onClick={async () => { setShowExpModal(true); await loadExpiringSoon(); }}
        />
      </div>

      {showExpModal && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl p-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-2xl font-bold">Expirations proches (≤ 15 jours)</h2>
              <button className="text-gray-500 hover:text-gray-800" onClick={() => setShowExpModal(false)}>
                Fermer
              </button>
            </div>
            {expLoading ? (
              <p className="text-gray-600">Chargement…</p>
            ) : expiringSoon.length === 0 ? (
              <p className="text-gray-600">Aucun produit en expiration prochaine.</p>
            ) : (
              <div className="table-container">
                <table>
                  <thead>
                    <tr>
                      <th className="w-12">
                        <input 
                          type="checkbox" 
                          checked={selectedItems.length === expiringSoon.length && expiringSoon.length > 0}
                          onChange={toggleSelectAll}
                          className="w-4 h-4 cursor-pointer accent-blue-600"
                        />
                      </th>
                      <th className="w-1/3">Description</th>
                      <th>Référence</th>
                      <th>N° GRM</th>
                      <th>N° Série</th>
                      <th>Date d'expiration</th>
                      <th>Emplacement</th>
                    </tr>
                  </thead>
                  <tbody>
                    {expiringSoon.map((it) => (
                      <tr key={it.id}>
                        <td className="text-center">
                          <input 
                            type="checkbox"
                            checked={selectedItems.includes(it.id)}
                            onChange={() => toggleSelectItem(it.id)}
                            className="w-4 h-4 cursor-pointer accent-blue-600"
                          />
                        </td>
                        <td className="font-medium w-1/3">{it.product}</td>
                        <td className="text-gray-600">{it.reference}</td>
                        <td className="text-gray-600">{it.numero_grm}</td>
                        <td className="text-gray-600">{it.numero_serie}</td>
                        <td className="text-gray-600">{it.expiration}</td>
                        <td className="text-gray-600">{it.location}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            <div className="mt-4 flex flex-wrap justify-between items-center gap-3">
              <div className="text-sm text-gray-600">
                {selectedItems.length > 0 ? (
                  <span className="font-medium text-blue-600">
                    {selectedItems.length} produit(s) sélectionné(s)
                  </span>
                ) : (
                  <span>Aucun produit sélectionné</span>
                )}
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  className="px-4 py-2 rounded bg-gray-100 hover:bg-gray-200"
                  onClick={() => setShowExpModal(false)}
                >
                  Fermer
                </button>
                <button
                  className="px-4 py-2 rounded bg-amber-600 text-white hover:bg-amber-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={selectedItems.length === 0}
                  onClick={async () => {
                    if (selectedItems.length === 0) {
                      toast.warning('Veuillez sélectionner au moins un produit');
                      return;
                    }
                    try {
                      await api.post('/expirations/retirer', { batch_ids: selectedItems });
                      toast.success(`${selectedItems.length} produit(s) marqué(s) comme retirés`);
                      setShowExpModal(false);
                    } catch (e) {
                      toast.error("Erreur lors du marquage de retrait");
                    }
                  }}
                >
                  Retirer ({selectedItems.length})
                </button>
                <button
                  className="px-4 py-2 rounded bg-green-600 text-white hover:bg-green-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={selectedItems.length === 0}
                  onClick={async () => {
                    if (selectedItems.length === 0) {
                      toast.warning('Veuillez sélectionner au moins un produit');
                      return;
                    }
                    try {
                      const res = await api.post('/expirations/export/excel', { batch_ids: selectedItems }, { responseType: 'blob' });
                      const url = window.URL.createObjectURL(new Blob([res.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `Retrait_Expirations_${new Date().toISOString().slice(0,16).replace(/[-:T]/g,'')}.xlsx`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      toast.success('Export Excel téléchargé');
                    } catch (e) {
                      toast.error("Erreur lors de l'export Excel");
                    }
                  }}
                >
                  Exporter Excel ({selectedItems.length})
                </button>
                <button
                  className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
                  disabled={selectedItems.length === 0}
                  onClick={async () => {
                    if (selectedItems.length === 0) {
                      toast.warning('Veuillez sélectionner au moins un produit');
                      return;
                    }
                    try {
                      const res = await api.post('/expirations/export/pdf', { batch_ids: selectedItems }, { responseType: 'blob' });
                      const url = window.URL.createObjectURL(new Blob([res.data]));
                      const link = document.createElement('a');
                      link.href = url;
                      link.setAttribute('download', `Retrait_Expirations_${new Date().toISOString().slice(0,16).replace(/[-:T]/g,'')}.pdf`);
                      document.body.appendChild(link);
                      link.click();
                      link.remove();
                      toast.success('Export PDF téléchargé');
                    } catch (e) {
                      toast.error('Erreur lors de la génération du PDF de retrait');
                    }
                  }}
                >
                  Générer PDF ({selectedItems.length})
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
