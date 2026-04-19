import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { ShoppingCart, Download, AlertTriangle, CheckCircle, Lock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';

const Replenishment = () => {
  const { permissions } = useUser();
  const { t } = useLanguage();
  const [replenishmentData, setReplenishmentData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [selectedProducts, setSelectedProducts] = useState([]);
  const [quantities, setQuantities] = useState({});

  useEffect(() => {
    fetchReplenishmentNeeds();
  }, []);

  const fetchReplenishmentNeeds = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get('/replenishment/check');
      setReplenishmentData(response.data);
      // Start with no selection by default
      setSelectedProducts([]);
      // Initialize quantities with calculated values
      const initialQuantities = {};
      response.data.orders.forEach(order => {
        initialQuantities[order.product_id] = order.quantite_a_commander;
      });
      setQuantities(initialQuantities);
    } catch (error) {
      console.error('Error fetching replenishment:', error);
      setError(error.response?.data?.detail || 'Erreur lors de la vérification des besoins');
      toast.error('Erreur lors de la vérification des besoins');
    } finally {
      setLoading(false);
    }
  };

  const toggleProductSelection = (productId) => {
    setSelectedProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAll = () => {
    if (selectedProducts.length === replenishmentData?.orders.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(replenishmentData?.orders.map(o => o.product_id) || []);
    }
  };

  const handleQuantityChange = (productId, value) => {
    const numValue = parseInt(value) || 0;
    setQuantities(prev => ({
      ...prev,
      [productId]: numValue
    }));
  };

  const handleGeneratePDF = async (silent=false) => {
    if (selectedProducts.length === 0) {
      toast.error('Veuillez sélectionner au moins un produit');
      return;
    }

    // Build items with custom quantities
    const items = selectedProducts.map(productId => {
      const order = replenishmentData.orders.find(o => o.product_id === productId);
      return {
        product_id: productId,
        nom: order.nom,
        reference: order.reference,
        fabricant: order.fabricant || '',
        quantite: quantities[productId] || 0
      };
    });

    setGenerating(true);
    try {
      const response = await api.post('/replenishment/export/pdf', {
        product_ids: selectedProducts
      }, {
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const filename = `Commande_CathLab${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.pdf`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      if (!silent) toast.success('Bon de commande généré avec succès');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la génération du PDF');
    } finally {
      setGenerating(false);
    }
  };

  const handleExportExcel = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Veuillez sélectionner au moins un produit');
      return;
    }

    // Build items with custom quantities
    const items = selectedProducts.map(productId => {
      const order = replenishmentData.orders.find(o => o.product_id === productId);
      return {
        product_id: productId,
        nom: order.nom,
        reference: order.reference,
        fabricant: order.fabricant || '',
        quantite: quantities[productId] || 0
      };
    });

    setGenerating(true);
    try {
      const response = await api.post('/replenishment/export/excel', {
        product_ids: selectedProducts
      }, {
        responseType: 'blob',
      });
      
      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      const now = new Date();
      const pad = (n) => String(n).padStart(2, '0');
      const filename = `Commande_CathLab${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`;
      link.setAttribute('download', filename);
      document.body.appendChild(link);
      link.click();
      link.remove();
      
      toast.success('Fichier Excel généré avec succès');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la génération du fichier Excel');
    } finally {
      setGenerating(false);
    }
  };

  // Mark selected products as ordered (pending replenishment)
  const handleMarkAsOrdered = async () => {
    if (selectedProducts.length === 0) {
      toast.error('Veuillez sélectionner au moins un produit');
      return;
    }

    const items = selectedProducts.map(productId => {
      const order = replenishmentData.orders.find(o => o.product_id === productId);
      return { 
        product_id: productId, 
        qty: quantities[productId] || 0,
        nom: order?.nom || '',
        reference: order?.reference || '',
        fabricant: order?.fabricant || ''
      };
    });

    setGenerating(true);
    try {
      // 1. Mark as ordered and log movements
      await api.post('/replenishment/pending', { items, log_movement: true });
      
      // 2. Export PDF (silent)
      try {
        const pdfResponse = await api.post('/replenishment/export/pdf', {
          product_ids: selectedProducts
        }, { responseType: 'blob' });
        
        const pdfUrl = window.URL.createObjectURL(new Blob([pdfResponse.data]));
        const pdfLink = document.createElement('a');
        pdfLink.href = pdfUrl;
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        pdfLink.setAttribute('download', `Commande_CathLab${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.pdf`);
        document.body.appendChild(pdfLink);
        pdfLink.click();
        pdfLink.remove();
      } catch (e) {
        console.error('PDF export error:', e);
      }

      // 3. Export Excel (silent)
      try {
        const excelResponse = await api.post('/replenishment/export/excel', {
          product_ids: selectedProducts
        }, { responseType: 'blob' });
        
        const excelUrl = window.URL.createObjectURL(new Blob([excelResponse.data]));
        const excelLink = document.createElement('a');
        excelLink.href = excelUrl;
        const now = new Date();
        const pad = (n) => String(n).padStart(2, '0');
        excelLink.setAttribute('download', `Commande_CathLab${now.getFullYear()}${pad(now.getMonth()+1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}.xlsx`);
        document.body.appendChild(excelLink);
        excelLink.click();
        excelLink.remove();
      } catch (e) {
        console.error('Excel export error:', e);
      }

      toast.success(`${selectedProducts.length} produit(s) commandé(s) - PDF et Excel téléchargés`);
      fetchReplenishmentNeeds();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la commande');
    } finally {
      setGenerating(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8">
        <div className="card bg-red-50 border-2 border-red-200">
          <div className="flex items-center gap-4">
            <div className="text-red-600">
              <AlertTriangle size={48} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-red-900 mb-2">Erreur de chargement</h2>
              <p className="text-red-700">{error}</p>
              <Button
                onClick={fetchReplenishmentNeeds}
                className="mt-4"
                variant="outline"
              >
                Réessayer
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="replenishment-page">
      {/* Read-only banner */}
      {permissions.isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <Lock className="text-yellow-600" size={20} />
          <span className="text-yellow-800 text-sm font-medium">
            {t('readOnlyMode')} - {t('readOnlyProducts')}
          </span>
        </div>
      )}
      
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
            {t('replenishmentTitle')}
          </h1>
          <p className="text-gray-600">{t('replenishmentDescription')}</p>
        </div>
        {replenishmentData?.items_needing_replenishment > 0 && !permissions.isReadOnly && (
          <div className="flex gap-3">
            <Button
              onClick={toggleSelectAll}
              variant="outline"
              data-testid="toggle-all-button"
            >
              {selectedProducts.length === replenishmentData?.orders.length ? t('deselectAll') : t('selectAll')}
            </Button>
            <Button
              onClick={() => handleGeneratePDF(false)}
              disabled={generating || selectedProducts.length === 0}
              data-testid="export-pdf-button"
              variant="outline"
            >
              <Download size={20} className="mr-2" />
              {t('exportPdf') || 'Exporter PDF'}
            </Button>
            <Button
              onClick={handleExportExcel}
              disabled={generating || selectedProducts.length === 0}
              data-testid="export-excel-button"
              className="bg-green-600 hover:bg-green-700"
            >
              <Download size={20} className="mr-2" />
              {t('exportExcelUpper')}
            </Button>
            <Button
              onClick={handleMarkAsOrdered}
              disabled={generating || selectedProducts.length === 0}
              data-testid="mark-ordered-button"
              className="bg-orange-600 hover:bg-orange-700"
            >
              <ShoppingCart size={20} className="mr-2" />
              {generating ? t('loading') : `${t('markAsOrdered') || 'Commander'} (${selectedProducts.length})`}
            </Button>
          </div>
        )}
      </div>

      {replenishmentData?.items_needing_replenishment === 0 ? (
        <div className="text-center py-16">
          <CheckCircle size={64} className="mx-auto text-green-500 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">{t('noData')}</h3>
          <p className="text-gray-500">{t('noData')}</p>
        </div>
      ) : (
        <div>
          <div className="card bg-gradient-to-br from-orange-50 to-red-50 mb-6">
            <div className="flex items-center gap-4">
              <div className="bg-orange-600 text-white p-4 rounded-lg">
                <AlertTriangle size={32} />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>
                  {replenishmentData?.items_needing_replenishment} {t('productsToReplenish')}
                </h2>
                <p className="text-gray-600">{t('stockBelowMin')}</p>
              </div>
            </div>
          </div>

          <div className="card overflow-x-auto">
            <table>
              <thead>
                <tr>
                  <th style={{width:'3%'}} className="text-center">
                    <input
                      type="checkbox"
                      checked={selectedProducts.length === replenishmentData?.orders.length}
                      onChange={toggleSelectAll}
                      className="w-4 h-4"
                    />
                  </th>
                  <th style={{width:'35%'}}>{t('product')}</th>
                  <th style={{width:'12%'}} className="text-center">{t('reference')}</th>
                  <th style={{width:'8%'}} className="text-center">{t('stock')}</th>
                  <th style={{width:'10%'}} className="text-center text-blue-700">En commande</th>
                  <th style={{width:'7%'}} className="text-center">{t('min')}</th>
                  <th style={{width:'7%'}} className="text-center">{t('max')}</th>
                  <th style={{width:'15%'}} className="text-center">{t('toOrder')}</th>
                </tr>
              </thead>
              <tbody>
                {replenishmentData?.orders.map((order) => {
                  const hasAlreadyOrdered = (order.deja_commande || 0) > 0;
                  return (
                  <tr 
                    key={order.product_id} 
                    data-testid="replenishment-item"
                    className={hasAlreadyOrdered ? 'bg-blue-50' : ''}
                  >
                    <td className="text-center">
                      <input
                        type="checkbox"
                        checked={selectedProducts.includes(order.product_id)}
                        onChange={() => toggleProductSelection(order.product_id)}
                        className="w-4 h-4"
                      />
                    </td>
                    <td className="font-medium">
                      {order.nom}
                      {hasAlreadyOrdered && (
                        <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          En commande
                        </span>
                      )}
                    </td>
                    <td className="text-gray-600 text-center">{order.reference}</td>
                    <td className="text-center font-bold">
                      <span className={order.stock_actuel === 0 ? 'text-red-600' : 'text-orange-600'}>
                        {order.stock_actuel}
                      </span>
                    </td>
                    <td className="text-center">
                      {hasAlreadyOrdered ? (
                        <span className="font-bold text-blue-600 bg-blue-100 px-2 py-1 rounded">
                          {order.deja_commande}
                        </span>
                      ) : (
                        <span className="text-gray-400">-</span>
                      )}
                    </td>
                    <td className="text-gray-600 text-center">{order.stock_minimum}</td>
                    <td className="text-gray-600 text-center">{order.stock_maximum}</td>
                    <td className="text-center">
                      <input
                        type="number"
                        min="1"
                        value={quantities[order.product_id] || 0}
                        onChange={(e) => handleQuantityChange(order.product_id, e.target.value)}
                        className="w-20 px-2 py-1 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 font-bold text-green-600 text-center"
                        data-testid={`quantity-input-${order.product_id}`}
                      />
                    </td>
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default Replenishment;