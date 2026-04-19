import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { FileText, Download, TrendingDown, Package } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, Legend } from 'recharts';

const Reports = () => {
  const [consumptionData, setConsumptionData] = useState([]);
  const [stockData, setStockData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchReports();
  }, []);

  const fetchReports = async () => {
    try {
      const [consumptionRes, stockRes] = await Promise.all([
        api.get('/reports/consumption'),
        api.get('/reports/stock'),
      ]);
      setConsumptionData(consumptionRes.data);
      setStockData(stockRes.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des rapports');
    } finally {
      setLoading(false);
    }
  };

  const getChartData = () => {
    return consumptionData.slice(0, 10).map(item => ({
      name: item.product?.nom || 'Inconnu',
      consommation: item.total_consomme,
    }));
  };

  const getStockStatusData = () => {
    const critique = stockData.filter(b => b.quantite_actuelle <= 5).length;
    const bas = stockData.filter(b => b.quantite_actuelle > 5 && b.quantite_actuelle <= 20).length;
    const normal = stockData.filter(b => b.quantite_actuelle > 20).length;

    return [
      { name: 'Stock critique', value: critique, color: '#ef4444' },
      { name: 'Stock bas', value: bas, color: '#f97316' },
      { name: 'Stock normal', value: normal, color: '#22c55e' },
    ];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="reports-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
          Rapports
        </h1>
        <p className="text-gray-600">Analyses et statistiques de consommation</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Space Grotesk' }}>
            Top 10 - Consommation
          </h2>
          {consumptionData.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune donnée de consommation</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={getChartData()}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" angle={-45} textAnchor="end" height={100} />
                <YAxis />
                <Tooltip />
                <Bar dataKey="consommation" fill="#3b82f6" />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        <div className="card">
          <h2 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Space Grotesk' }}>
            État des stocks
          </h2>
          {stockData.length === 0 ? (
            <p className="text-gray-500 text-center py-8">Aucune donnée de stock</p>
          ) : (
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie
                  data={getStockStatusData()}
                  cx="50%"
                  cy="50%"
                  labelLine={false}
                  label={({ name, value }) => `${name}: ${value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
                >
                  {getStockStatusData().map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="card">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>
            Rapport de consommation
          </h2>
        </div>
        {consumptionData.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune donnée disponible</p>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Type</th>
                  <th>Fabricant</th>
                  <th>Total consommé</th>
                  <th>Stock actuel</th>
                </tr>
              </thead>
              <tbody>
                {consumptionData.map((item, index) => (
                  <tr key={index} data-testid="consumption-row">
                    <td className="font-medium">{item.product?.nom || 'N/A'}</td>
                    <td><span className="badge badge-info">{item.product?.type || 'N/A'}</span></td>
                    <td className="text-gray-600">{item.product?.fabricant || 'N/A'}</td>
                    <td className="font-medium text-blue-600">{item.total_consomme} unités</td>
                    <td className="text-gray-600">{item.batch?.quantite_actuelle || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="card mt-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>
            Rapport de stock
          </h2>
        </div>
        {stockData.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Aucune donnée disponible</p>
        ) : (
          <div className="overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th>Produit</th>
                  <th>Lot</th>
                  <th>Stock actuel</th>
                  <th>Stock initial</th>
                  <th>Taux d'utilisation</th>
                  <th>Localisation</th>
                </tr>
              </thead>
              <tbody>
                {stockData.map((batch, index) => (
                  <tr key={index} data-testid="stock-row">
                    <td className="font-medium">{batch.product?.nom || 'N/A'}</td>
                    <td className="text-gray-600">{batch.numero_lot}</td>
                    <td>
                      <span className={`badge ${
                        batch.quantite_actuelle === 0 ? 'badge-danger' :
                        batch.quantite_actuelle <= 5 ? 'badge-warning' : 'badge-success'
                      }`}>
                        {batch.quantite_actuelle}
                      </span>
                    </td>
                    <td className="text-gray-600">{batch.quantite_initiale}</td>
                    <td>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-blue-600 h-2 rounded-full"
                            style={{ width: `${batch.taux_utilisation}%` }}
                          ></div>
                        </div>
                        <span className="text-sm text-gray-600">{batch.taux_utilisation}%</span>
                      </div>
                    </td>
                    <td className="text-gray-600">{(batch.localisation || '').replace(/^ARMOIRE-([A-Z])-/, '$1-')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;