import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { AlertTriangle, CheckCircle, Clock, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const Alerts = () => {
  const { t } = useLanguage();
  const [alerts, setAlerts] = useState([]);
  const [expiredProducts, setExpiredProducts] = useState([]);
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [alertsRes, expiredRes, lowStockRes] = await Promise.all([
        api.get('/alerts'),
        api.get('/alerts/expired-products'),
        api.get('/alerts/low-stock')
      ]);
      setAlerts(alertsRes.data);
      setExpiredProducts(expiredRes.data);
      setLowStockProducts(lowStockRes.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des alertes');
    } finally {
      setLoading(false);
    }
  };

  const fetchAlerts = async () => {
    try {
      const response = await api.get('/alerts');
      setAlerts(response.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des alertes');
    }
  };

  const handleResolve = async (alertId) => {
    try {
      await api.put(`/alerts/${alertId}`, { statut: 'traitee' });
      toast.success('Alerte marquée comme traitée');
      fetchAlerts();
    } catch (error) {
      toast.error('Erreur lors de la mise à jour');
    }
  };

  const getAlertIcon = (type) => {
    switch (type) {
      case 'expiration':
        return <Clock size={24} className="text-orange-600" />;
      case 'stock_bas':
        return <AlertTriangle size={24} className="text-red-600" />;
      default:
        return <AlertTriangle size={24} className="text-yellow-600" />;
    }
  };

  const getAlertStyle = (type) => {
    switch (type) {
      case 'expiration':
        return 'bg-orange-50 border-orange-500';
      case 'stock_bas':
        return 'bg-red-50 border-red-500';
      default:
        return 'bg-yellow-50 border-yellow-500';
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
    <div className="p-8" data-testid="alerts-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
          {t('alertsTitle')}
        </h1>
        <p className="text-gray-600">{t('alertsDescription')}</p>
      </div>

      {/* Section Produits Expirés */}
      {expiredProducts.length > 0 && (
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-red-600 mb-4 flex items-center gap-2">
            <AlertTriangle size={28} />
            {t('expired')} ({expiredProducts.length})
          </h2>
          <div className="card bg-red-50 border-2 border-red-500">
            <div className="overflow-x-auto">
              <table>
                <thead className="bg-red-100">
                  <tr>
                    <th>{t('product')}</th>
                    <th>{t('reference')}</th>
                    <th>{t('lotNumber')}</th>
                    <th>{t('serialNumber')}</th>
                    <th>{t('expirationDate')}</th>
                    <th>{t('location')}</th>
                    <th>{t('quantity')}</th>
                  </tr>
                </thead>
                <tbody>
                  {expiredProducts.map((item, idx) => (
                    <tr key={item.batch_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-red-50'}>
                      <td className="font-medium text-red-900">{item.product_name}</td>
                      <td className="text-gray-700">{item.product_reference}</td>
                      <td className="text-gray-700">{item.numero_lot}</td>
                      <td className="text-gray-700">{item.numero_serie}</td>
                      <td className="text-red-600 font-bold">
                        {new Date(item.date_expiration).toLocaleDateString('fr-FR')}
                      </td>
                      <td className="text-blue-600 font-mono">{item.localisation}</td>
                      <td className="text-center font-bold">{item.quantite}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Section Alertes Stock Bas */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-orange-600 mb-4 flex items-center gap-2">
          <Package size={28} />
          {t('stockAlerts')} ({lowStockProducts.length})
        </h2>
        
        {lowStockProducts.length === 0 ? (
          <div className="card text-center py-12">
            <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">{t('noAlerts')}</h3>
            <p className="text-gray-500">{t('allStocksOk')}</p>
          </div>
        ) : (
          <div className="card bg-orange-50 border-2 border-orange-500">
            <div className="overflow-x-auto">
              <table>
                <thead className="bg-orange-100">
                  <tr>
                    <th>{t('product')}</th>
                    <th>{t('reference')}</th>
                    <th>{t('supplier')}</th>
                    <th className="text-center">Stock actuel</th>
                    <th className="text-center">Stock min</th>
                    <th className="text-center text-blue-700">En commande</th>
                    <th className="text-center text-red-700">Manquant</th>
                  </tr>
                </thead>
                <tbody>
                  {lowStockProducts.map((item, idx) => (
                    <tr key={item.product_id} className={idx % 2 === 0 ? 'bg-white' : 'bg-orange-50'}>
                      <td className="font-medium text-gray-900">{item.product_name}</td>
                      <td className="text-gray-700 font-mono">{item.product_reference}</td>
                      <td className="text-gray-700">{item.fabricant}</td>
                      <td className={`text-center font-bold ${item.stock_actuel === 0 ? 'text-red-600' : 'text-orange-600'}`}>
                        {item.stock_actuel}
                      </td>
                      <td className="text-center text-gray-600">{item.stock_minimum}</td>
                      <td className="text-center">
                        {item.deja_commande > 0 ? (
                          <span className="font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            {item.deja_commande}
                          </span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      <td className="text-center">
                        {item.manquant > 0 ? (
                          <span className="font-bold text-red-600 bg-red-100 px-2 py-1 rounded">
                            {item.manquant}
                          </span>
                        ) : (
                          <span className="text-green-600 font-medium">✓ Couvert</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Section Alertes Manuelles */}
      {alerts.length > 0 && (
        <>
          <h2 className="text-2xl font-bold text-gray-900 mb-4">Alertes manuelles</h2>
          <div className="space-y-4">
            {alerts.map((alert) => (
              <div
                key={alert.id}
                data-testid="alert-card"
                className={`card border-l-4 ${getAlertStyle(alert.type)} animate-fadeIn`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex gap-4 flex-1">
                    <div className="flex-shrink-0">
                      {getAlertIcon(alert.type)}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-2">
                        <span className={`badge ${
                          alert.type === 'expiration' ? 'badge-warning' : 'badge-danger'
                        }`}>
                          {alert.type === 'expiration' ? 'Expiration proche' : 'Stock bas'}
                        </span>
                        <span className="text-sm text-gray-500">
                          {new Date(alert.date_creation).toLocaleDateString('fr-FR')}
                        </span>
                      </div>
                      <p className="text-lg font-medium text-gray-900 mb-1">{alert.message}</p>
                      <p className="text-sm text-gray-600">
                        Lot ID: {alert.batch_id}
                      </p>
                    </div>
                  </div>
                  <Button
                    data-testid="resolve-alert-button"
                    onClick={() => handleResolve(alert.id)}
                    variant="outline"
                    size="sm"
                    className="ml-4"
                  >
                    <CheckCircle size={16} className="mr-2" />
                    Marquer traitée
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
};

export default Alerts;