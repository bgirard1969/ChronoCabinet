import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Scan, CheckCircle, ChevronLeft, ChevronRight, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';

const Scanner = () => {
  const { t } = useLanguage();
  const [scannedBatches, setScannedBatches] = useState([]); // Array of batches
  const [scannedProducts, setScannedProducts] = useState({}); // Map of product_id -> product
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [manualCode, setManualCode] = useState('');
  const [searchType, setSearchType] = useState(''); // 'unique' or 'multiple'
  const inputRef = useRef(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  useEffect(() => {
    if (scannedBatches.length === 0 && inputRef.current) {
      inputRef.current.focus();
    }
  }, [scannedBatches]);

  const searchBatch = async (code) => {
    try {
      const response = await api.post('/batches/scan', { code });
      const batches = response.data.batches || [response.data.batch];
      const products = response.data.products || { [response.data.batch?.product_id]: response.data.product };
      
      if (batches.length === 0) {
        toast.error('Aucun lot trouvé avec ce code');
        return;
      }
      
      setScannedBatches(batches);
      setScannedProducts(products);
      setSelectedIndex(0);
      setSearchType(response.data.search_type || (batches.length > 1 ? 'multiple' : 'unique'));
      
      if (batches.length === 1) {
        toast.success('Lot trouvé !');
      } else {
        toast.success(`${batches.length} lots trouvés !`);
      }
    } catch (error) {
      toast.error('Lot non trouvé avec ce code');
      if (inputRef.current) {
        inputRef.current.select();
      }
    }
  };

  const handleManualSearch = (e) => {
    e.preventDefault();
    if (manualCode.trim()) {
      searchBatch(manualCode.trim());
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && manualCode.trim()) {
      e.preventDefault();
      searchBatch(manualCode.trim());
    }
  };

  const resetScan = () => {
    setScannedBatches([]);
    setScannedProducts({});
    setSelectedIndex(0);
    setManualCode('');
    setSearchType('');
  };

  const getDaysUntilExpiration = (expirationDate) => {
    if (!expirationDate) return null;
    const now = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };

  const currentBatch = scannedBatches[selectedIndex];
  const currentProduct = currentBatch ? scannedProducts[currentBatch.product_id] : null;

  return (
    <div className="p-8" data-testid="scanner-page">
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
          {t('scannerTitle')}
        </h1>
        <p className="text-gray-600">{t('scanOrSearchBarcode')}</p>
      </div>

      <div className="max-w-4xl mx-auto">
        {scannedBatches.length === 0 ? (
          <div className="card">
            <div className="flex items-center gap-3 mb-6">
              <Scan size={32} className="text-blue-600" />
              <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>
                {t('scanProductTitle')}
              </h2>
            </div>
            <p className="text-sm text-gray-600 mb-4">
              {t('scanBarcodeHelp')}
            </p>
            <form onSubmit={handleManualSearch} className="flex gap-3">
              <input
                ref={inputRef}
                type="text"
                data-testid="manual-code-input"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={t('scanOrEnterCode')}
                className="flex-1 px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-lg"
                autoFocus
              />
              <Button type="submit" data-testid="search-button" className="bg-blue-600 hover:bg-blue-700 px-6">
                {t('search')}
              </Button>
            </form>
          </div>
        ) : (
          <div className="card">
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <CheckCircle size={32} className="text-green-600" />
                <h2 className="text-2xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>
                  {scannedBatches.length === 1 ? t('batchIdentified') : `${scannedBatches.length} ${t('batchesFound') || 'lots trouvés'}`}
                </h2>
              </div>
              <Button
                data-testid="reset-scan-button"
                onClick={resetScan}
                variant="outline"
              >
                {t('newScan')}
              </Button>
            </div>

            {/* Navigation for multiple results */}
            {scannedBatches.length > 1 && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <List size={20} className="text-blue-600" />
                    <span className="font-medium text-blue-800">
                      {t('result') || 'Résultat'} {selectedIndex + 1} / {scannedBatches.length}
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedIndex(Math.max(0, selectedIndex - 1))}
                      disabled={selectedIndex === 0}
                    >
                      <ChevronLeft size={18} />
                      {t('previous') || 'Précédent'}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedIndex(Math.min(scannedBatches.length - 1, selectedIndex + 1))}
                      disabled={selectedIndex === scannedBatches.length - 1}
                    >
                      {t('next') || 'Suivant'}
                      <ChevronRight size={18} />
                    </Button>
                  </div>
                </div>
                
                {/* Quick navigation dots */}
                <div className="flex justify-center gap-2 mt-3">
                  {scannedBatches.map((_, idx) => (
                    <button
                      key={idx}
                      onClick={() => setSelectedIndex(idx)}
                      className={`w-3 h-3 rounded-full transition-colors ${
                        idx === selectedIndex ? 'bg-blue-600' : 'bg-blue-200 hover:bg-blue-400'
                      }`}
                    />
                  ))}
                </div>
              </div>
            )}

            {currentBatch && currentProduct && (
              <>
                <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg p-6 mb-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{t('productInfo')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">{t('product')}</p>
                      <p className="font-medium text-gray-900">{currentProduct?.nom}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('type')}</p>
                      <p className="font-medium text-gray-900">{currentProduct?.type}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('manufacturer')}</p>
                      <p className="font-medium text-gray-900">{currentProduct?.fabricant}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('reference')}</p>
                      <p className="font-medium text-gray-900">{currentProduct?.reference}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-gray-50 rounded-lg p-6">
                  <h3 className="text-lg font-bold text-gray-900 mb-4">{t('batchInfo')}</h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">{t('lotNumber')}</p>
                      <p className="font-medium text-gray-900">{currentBatch.numero_lot || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('serialNumber')}</p>
                      <p className="font-medium text-gray-900">{currentBatch.numero_serie || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('barcode')}</p>
                      <p className="font-medium text-gray-900">{currentBatch.code_barre || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('availableStock')}</p>
                      <p className="font-medium text-gray-900">
                        {currentBatch.quantite_actuelle} / {currentBatch.quantite_initiale} {t('units')}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('location')}</p>
                      <p className="font-medium text-gray-900">{(currentBatch.localisation || '').replace(/^ARMOIRE-([A-Z])-/, '$1-')}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('manufacturingDate')}</p>
                      <p className="font-medium text-gray-900">
                        {currentBatch.date_fabrication 
                          ? new Date(currentBatch.date_fabrication).toLocaleDateString('fr-FR')
                          : '-'}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('expirationDate')}</p>
                      <p className="font-medium text-gray-900">
                        {currentBatch.date_expiration 
                          ? new Date(currentBatch.date_expiration).toLocaleDateString('fr-FR')
                          : '-'}
                        {currentBatch.date_expiration && getDaysUntilExpiration(currentBatch.date_expiration) <= 30 && (
                          <span className="ml-2 text-orange-600 text-xs">
                            ({getDaysUntilExpiration(currentBatch.date_expiration)} {t('daysRemaining')})
                          </span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">{t('status')}</p>
                      <span className={`badge ${
                        currentBatch.statut === 'actif' || currentBatch.statut === 'disponible' ? 'badge-success' : 'badge-danger'
                      }`}>
                        {currentBatch.statut === 'actif' || currentBatch.statut === 'disponible' ? t('active') : currentBatch.statut}
                      </span>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default Scanner;
