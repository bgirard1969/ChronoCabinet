import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Package, MapPin, CheckCircle, ArrowRight, Scan, RotateCcw, Lock, Plus, ClipboardList, Box, FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';

const Placement = () => {
  const { permissions } = useUser();
  const { t } = useLanguage();
  
  // Tab state: 'scan' | 'pending'
  const [activeTab, setActiveTab] = useState('scan');
  
  // Step state: 1 = Scan serial, 2 = Confirm location
  const [step, setStep] = useState(1);
  
  // Data states
  const [pendingBatches, setPendingBatches] = useState([]); // Batches from PO waiting for placement
  const [pickedBatches, setPickedBatches] = useState([]); // Batches that were collected (for return)
  const [scannedBatch, setScannedBatch] = useState(null); // Current batch being processed
  const [scanResult, setScanResult] = useState(null); // Result from scan-for-placement
  
  // Form states
  const [serialInput, setSerialInput] = useState('');
  const [locationInput, setLocationInput] = useState('');
  
  // Quick receive dialog for unknown serial
  const [quickReceiveDialogOpen, setQuickReceiveDialogOpen] = useState(false);
  const [unknownSerial, setUnknownSerial] = useState('');
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [selectedPO, setSelectedPO] = useState(null);
  const [selectedProductId, setSelectedProductId] = useState('');
  const [quickReceiveData, setQuickReceiveData] = useState({
    numero_lot: '',
    numero_serie: '',
    date_fabrication: '',
    date_expiration: '',
    code_barre: '',
  });
  const [quickReceiveLoading, setQuickReceiveLoading] = useState(false);
  
  // Admin PIN dialog for expired time window
  const [adminPinDialogOpen, setAdminPinDialogOpen] = useState(false);
  const [adminPin, setAdminPin] = useState('');
  const [adminPinLoading, setAdminPinLoading] = useState(false);
  const [pendingExpiredBatch, setPendingExpiredBatch] = useState(null);
  
  // Available locations for placement
  const [availableLocations, setAvailableLocations] = useState([]);
  
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Fetch batches pending placement (from PO)
      const pendingRes = await api.get('/batches/pending-placement');
      setPendingBatches(pendingRes.data || []);
      
      // Fetch batches that were collected (for return to stock)
      // Only show batches collected within the current work window (8:01 AM - 7:59 AM next day)
      const allBatches = await api.get('/batches');
      
      // Calculate the current work window
      const now = new Date();
      const today8AM = new Date(now);
      today8AM.setHours(8, 1, 0, 0);
      
      let windowStart, windowEnd;
      if (now.getHours() >= 8) {
        // After 8:01 AM - window is from today 8:01 AM to tomorrow 7:59 AM
        windowStart = today8AM;
        windowEnd = new Date(today8AM);
        windowEnd.setDate(windowEnd.getDate() + 1);
        windowEnd.setHours(7, 59, 59, 999);
      } else {
        // Before 8:00 AM - window is from yesterday 8:01 AM to today 7:59 AM
        windowStart = new Date(today8AM);
        windowStart.setDate(windowStart.getDate() - 1);
        windowEnd = new Date(now);
        windowEnd.setHours(7, 59, 59, 999);
      }
      
      const picked = (allBatches.data || []).filter(b => {
        // Check status
        const validStatus = ['en_attente_retour', 'retiré', 'utilisé', 'sorti', 'collecte', 'utilisé_partiel'].includes(b.statut);
        if (!validStatus) return false;
        
        // Check if within work window (use updated_at or date_sortie)
        const collectionDate = new Date(b.updated_at || b.date_sortie || b.created_at);
        return collectionDate >= windowStart && collectionDate <= windowEnd;
      });
      setPickedBatches(picked);
      
      // Fetch all locations
      const locationsRes = await api.get('/locations');
      setAvailableLocations(locationsRes.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Fetch POs for quick receive dialog
  const fetchPurchaseOrders = async () => {
    try {
      const res = await api.get('/purchase-orders');
      // Filter to show only POs that can receive items (not fully received)
      const activePOs = (res.data || []).filter(po => 
        po.statut !== 'recu_complet' && 
        po.items.some(item => (item.quantite_recue || 0) < item.quantite)
      );
      setPurchaseOrders(activePOs);
    } catch (error) {
      console.error('Error fetching POs:', error);
      setPurchaseOrders([]);
    }
  };

  // Handle serial number scan
  const handleScanSerial = async () => {
    if (!serialInput.trim()) {
      toast.error('Veuillez entrer un numéro de série');
      return;
    }
    
    try {
      const response = await api.post('/batches/scan-for-placement', { code: serialInput.trim() });
      setScanResult(response.data);
      setScannedBatch(response.data.batch);
      
      if (response.data.action === 'create_new_order') {
        // Unknown serial - open quick receive dialog
        setUnknownSerial(serialInput.trim());
        setQuickReceiveData({
          numero_lot: '',
          numero_serie: serialInput.trim(), // Pre-fill with scanned serial
          date_fabrication: '',
          date_expiration: '',
          code_barre: '',
        });
        setSelectedPO(null);
        setSelectedProductId('');
        await fetchPurchaseOrders();
        setQuickReceiveDialogOpen(true);
        toast.info('Numéro de série inconnu - Sélectionnez une commande');
      } else if (response.data.action === 'return_to_stock_expired') {
        // Time window expired - needs admin PIN
        setPendingExpiredBatch(response.data.batch);
        setAdminPinDialogOpen(true);
        toast.error('Plage horaire dépassée (8h01 - 7h59)');
      } else if (response.data.action === 'already_in_stock') {
        toast.warning(response.data.message);
        setSerialInput('');
      } else {
        // Move to step 2 for placement
        setStep(2);
        toast.success(response.data.message);
      }
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erreur lors du scan';
      toast.error(msg);
    }
  };

  // Handle location QR code confirmation
  const handleConfirmPlacement = async () => {
    if (!locationInput.trim()) {
      toast.error('Veuillez scanner le QR code de l\'emplacement');
      return;
    }
    
    if (!scannedBatch?.id) {
      toast.error('Aucun produit sélectionné');
      return;
    }
    
    try {
      await api.post('/batches/confirm-placement', {
        batch_id: scannedBatch.id,
        serial_number: scannedBatch.numero_serie,
        location_qr_code: locationInput.trim()
      });
      
      toast.success(`Produit placé avec succès à l'emplacement ${locationInput.trim()}`);
      
      // Reset and refresh
      resetForm();
      fetchData();
    } catch (error) {
      const msg = error.response?.data?.detail || 'Erreur lors du placement';
      toast.error(msg);
    }
  };

  // Date mask DD/MM/YYYY
  const maskDateDMY = (val) => {
    const digits = String(val || '').replace(/\D/g, '').slice(0, 8);
    let d = digits.slice(0, 2);
    let m = digits.slice(2, 4);
    const y = digits.slice(4, 8);
    if (m.length === 2) m = String(Math.min(Math.max(parseInt(m, 10), 1), 12)).padStart(2, '0');
    if (d.length === 2) d = String(Math.min(Math.max(parseInt(d, 10), 1), 31)).padStart(2, '0');
    let out = d;
    if (m.length) out += `/${m}`;
    if (y.length) out += `/${y}`;
    return out;
  };

  const isFullDateDMY = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s || '');
  
  const dmyToISO = (s) => {
    const [dd, mm, yyyy] = (s || '').split('/');
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00`).toISOString();
  };

  // Handle quick receive from unknown serial dialog
  const handleQuickReceive = async () => {
    if (!selectedPO || !selectedProductId) {
      toast.error('Veuillez sélectionner une commande et un produit');
      return;
    }
    
    if (!quickReceiveData.numero_serie) {
      toast.error('Le numéro de série est requis');
      return;
    }
    
    if (!isFullDateDMY(quickReceiveData.date_expiration)) {
      toast.error('Date d\'expiration invalide. Format: jj/mm/aaaa');
      return;
    }
    
    if (quickReceiveData.date_fabrication && !isFullDateDMY(quickReceiveData.date_fabrication)) {
      toast.error('Date de fabrication invalide. Format: jj/mm/aaaa');
      return;
    }
    
    setQuickReceiveLoading(true);
    try {
      const submitData = {
        product_id: selectedProductId,
        numero_lot: quickReceiveData.numero_lot || null,
        numero_serie: quickReceiveData.numero_serie,
        date_fabrication: quickReceiveData.date_fabrication ? dmyToISO(quickReceiveData.date_fabrication) : null,
        date_expiration: dmyToISO(quickReceiveData.date_expiration),
        code_barre: quickReceiveData.code_barre || null,
      };
      
      const response = await api.post(`/purchase-orders/${selectedPO.id}/receive-item`, submitData);
      
      toast.success('Produit reçu avec succès');
      
      // Close dialog and refresh data
      setQuickReceiveDialogOpen(false);
      await fetchData();
      
      // Now scan the same serial to proceed to placement
      setSerialInput(quickReceiveData.numero_serie);
      setTimeout(async () => {
        try {
          const scanResponse = await api.post('/batches/scan-for-placement', { code: quickReceiveData.numero_serie });
          if (scanResponse.data.action === 'place_from_po') {
            setScanResult(scanResponse.data);
            setScannedBatch(scanResponse.data.batch);
            setStep(2);
            toast.info('Passez maintenant au placement - Scannez l\'emplacement');
          }
        } catch (err) {
          console.error('Error after quick receive:', err);
        }
      }, 500);
      
    } catch (error) {
      let errorMessage = 'Erreur lors de la réception';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          errorMessage = detail.map(e => e.msg || JSON.stringify(e)).join(', ');
        } else if (typeof detail === 'object') {
          errorMessage = detail.msg || JSON.stringify(detail);
        }
      }
      toast.error(errorMessage);
    } finally {
      setQuickReceiveLoading(false);
    }
  };

  // Handle admin PIN verification for expired time window
  const handleAdminPinVerify = async () => {
    if (!adminPin.trim()) {
      toast.error('Veuillez entrer le PIN administrateur');
      return;
    }
    
    setAdminPinLoading(true);
    try {
      const response = await api.post('/batches/verify-admin-pin', { pin: adminPin.trim() });
      
      if (response.data.valid) {
        toast.success(`Autorisation accordée par ${response.data.admin_name}`);
        
        // Close PIN dialog and proceed to placement
        setAdminPinDialogOpen(false);
        setAdminPin('');
        
        // Set the batch for placement
        if (pendingExpiredBatch) {
          setScannedBatch(pendingExpiredBatch);
          setScanResult({ action: 'return_to_stock', message: 'Remise en stock autorisée' });
          setStep(2);
        }
        setPendingExpiredBatch(null);
      }
    } catch (error) {
      const errorMessage = error.response?.data?.detail || 'PIN invalide';
      toast.error(errorMessage);
    } finally {
      setAdminPinLoading(false);
    }
  };

  // Get available products from selected PO (not fully received)
  const getAvailableProducts = () => {
    if (!selectedPO) return [];
    return selectedPO.items.filter(item => (item.quantite_recue || 0) < item.quantite);
  };

  // Select a batch from pending list
  const selectPendingBatch = (batch) => {
    setScannedBatch(batch);
    setScanResult({ action: 'place_from_po', message: 'Placement depuis commande' });
    setSerialInput(batch.numero_serie);
    setStep(2);
    setActiveTab('scan');
  };

  // Reset form to initial state
  const resetForm = () => {
    setStep(1);
    setSerialInput('');
    setLocationInput('');
    setScannedBatch(null);
    setScanResult(null);
  };

  // Read-only check
  const isReadOnly = !permissions.canRestock;

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>
            {t('restockingTitle') || 'Remplissage'}
          </h1>
          <p className="text-gray-600 mt-1">
            Placement physique des produits dans les armoires
          </p>
        </div>
        {isReadOnly && (
          <div className="flex items-center gap-2 px-4 py-2 bg-yellow-100 rounded-lg">
            <Lock size={18} className="text-yellow-600" />
            <span className="text-yellow-800">{t('readOnlyMode')}</span>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b">
        <button
          onClick={() => setActiveTab('scan')}
          className={`px-4 py-2 font-medium transition-colors ${
            activeTab === 'scan' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <Scan size={18} className="inline mr-2" />
          Scanner un produit
        </button>
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 font-medium transition-colors relative ${
            activeTab === 'pending' 
              ? 'text-blue-600 border-b-2 border-blue-600' 
              : 'text-gray-600 hover:text-gray-900'
          }`}
        >
          <ClipboardList size={18} className="inline mr-2" />
          En attente de placement
          {pendingBatches.length > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
              {pendingBatches.length}
            </span>
          )}
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'scan' ? (
        <div className="max-w-4xl">
          {/* Step 1: Scan Serial Number */}
          {step === 1 && (
            <div className="card">
              <div className="flex items-center gap-3 mb-6">
                <div className="bg-blue-100 p-3 rounded-full">
                  <Scan size={24} className="text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>
                    Étape 1: Scanner le numéro de série
                  </h2>
                  <p className="text-gray-600 text-sm">
                    Scannez ou entrez le numéro de série du produit
                  </p>
                </div>
              </div>
              
              <div className="space-y-4">
                <div>
                  <Label>Numéro de série</Label>
                  <div className="flex gap-2 mt-1">
                    <Input
                      value={serialInput}
                      onChange={(e) => setSerialInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleScanSerial()}
                      placeholder="Scannez ou entrez le numéro de série..."
                      className="text-lg"
                      autoFocus
                      disabled={isReadOnly}
                    />
                    <Button onClick={handleScanSerial} disabled={isReadOnly || !serialInput.trim()}>
                      <Scan size={20} className="mr-2" />
                      Valider
                    </Button>
                  </div>
                </div>
                
                <div className="bg-gray-50 p-4 rounded-lg">
                  <h3 className="font-medium text-gray-700 mb-2">Le système va automatiquement détecter :</h3>
                  <ul className="space-y-2 text-sm text-gray-600">
                    <li className="flex items-center gap-2">
                      <RotateCcw size={16} className="text-orange-500" />
                      <strong>Produit collecté</strong> → Remise en stock
                    </li>
                    <li className="flex items-center gap-2">
                      <Package size={16} className="text-blue-500" />
                      <strong>Produit de commande</strong> → Placement depuis bon de commande
                    </li>
                    <li className="flex items-center gap-2">
                      <Plus size={16} className="text-green-500" />
                      <strong>Numéro inconnu</strong> → Créer une nouvelle commande
                    </li>
                  </ul>
                </div>

                {/* Quick stats */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="bg-orange-50 p-4 rounded-lg">
                    <p className="text-sm text-orange-600">Produits collectés à remettre</p>
                    <p className="text-2xl font-bold text-orange-700">{pickedBatches.length}</p>
                  </div>
                  <div className="bg-blue-50 p-4 rounded-lg">
                    <p className="text-sm text-blue-600">Produits en attente (commandes)</p>
                    <p className="text-2xl font-bold text-blue-700">{pendingBatches.length}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Confirm Location */}
          {step === 2 && scannedBatch && (
            <div className="space-y-4">
              {/* Product Info */}
              <div className={`card ${
                scanResult?.action === 'return_to_stock' 
                  ? 'bg-gradient-to-br from-orange-50 to-amber-50 border-orange-200' 
                  : 'bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200'
              }`}>
                <div className="flex items-start gap-4">
                  <div className={`p-3 rounded-lg ${
                    scanResult?.action === 'return_to_stock' ? 'bg-orange-500' : 'bg-blue-500'
                  } text-white`}>
                    {scanResult?.action === 'return_to_stock' ? <RotateCcw size={28} /> : <Package size={28} />}
                  </div>
                  <div className="flex-1">
                    <span className={`text-sm font-medium px-2 py-1 rounded ${
                      scanResult?.action === 'return_to_stock' 
                        ? 'bg-orange-100 text-orange-700' 
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {scanResult?.action === 'return_to_stock' ? 'Remise en stock' : 'Placement depuis commande'}
                    </span>
                    <div className="flex items-center gap-2 mt-2">
                      <h2 className="text-xl font-bold text-gray-900">
                        {scannedBatch.product?.nom || 'Produit'}
                      </h2>
                      {scannedBatch.product?.type && (
                        <span className="px-2 py-1 text-xs font-medium bg-purple-100 text-purple-700 rounded-full">
                          {scannedBatch.product.type}
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-4 mt-3 text-sm">
                      <div>
                        <span className="text-gray-500">N° Série:</span>
                        <span className="ml-2 font-medium">{scannedBatch.numero_serie}</span>
                      </div>
                      {scannedBatch.numero_lot && (
                        <div>
                          <span className="text-gray-500">N° Lot:</span>
                          <span className="ml-2 font-medium">{scannedBatch.numero_lot}</span>
                        </div>
                      )}
                      {scannedBatch.product?.numero_grm && (
                        <div>
                          <span className="text-gray-500">N° GRM:</span>
                          <span className="ml-2 font-medium">{scannedBatch.product.numero_grm}</span>
                        </div>
                      )}
                      {scannedBatch.date_expiration && (
                        <div>
                          <span className="text-gray-500">Date d'expiration:</span>
                          <span className="ml-2 font-medium">
                            {new Date(scannedBatch.date_expiration).toLocaleDateString('fr-FR')}
                          </span>
                        </div>
                      )}
                      {scanResult?.purchase_order && (
                        <div className="col-span-2">
                          <span className="text-gray-500">Bon de commande:</span>
                          <span className="ml-2 font-medium">{scanResult.purchase_order.numero}</span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Location Input */}
              <div className="card">
                <div className="flex items-center gap-3 mb-4">
                  <div className="bg-green-100 p-3 rounded-full">
                    <MapPin size={24} className="text-green-600" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>
                      Étape 2: Confirmer l'emplacement
                    </h2>
                    <p className="text-gray-600 text-sm">
                      Placez le produit puis scannez le QR code de l'emplacement
                    </p>
                  </div>
                </div>

                <div className="space-y-4">
                  <div>
                    <Label>QR Code de l'emplacement</Label>
                    <div className="flex gap-2 mt-1">
                      <Input
                        value={locationInput}
                        onChange={(e) => setLocationInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleConfirmPlacement()}
                        placeholder="Scannez le QR code de l'emplacement (ex: A-R01-C02)"
                        className="text-lg"
                        autoFocus
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>

                  {/* Available Locations for this product type */}
                  {scannedBatch?.product?.type && (
                    <div className="bg-gray-50 rounded-lg p-4">
                      <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                        <MapPin size={16} className="text-green-600" />
                        Emplacements disponibles pour "{scannedBatch.product.type}"
                      </h3>
                      {(() => {
                        const compatibleLocations = availableLocations.filter(loc => 
                          !loc.occupied && 
                          loc.allowed_product_type === scannedBatch.product.type
                        );
                        
                        if (compatibleLocations.length === 0) {
                          return (
                            <p className="text-sm text-gray-500 italic">
                              Aucun emplacement disponible pour ce type de produit
                            </p>
                          );
                        }
                        
                        return (
                          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3 max-h-[200px] overflow-y-auto">
                            {compatibleLocations.slice(0, 20).map((loc) => (
                              <div 
                                key={loc.id}
                                className="bg-white border border-gray-200 rounded-lg p-2 hover:border-green-400 hover:shadow-sm transition-all cursor-pointer"
                                onClick={() => setLocationInput(loc.qr_code || loc.code)}
                              >
                                <div className="flex flex-col items-center">
                                  {/* Mini QR Code using a simple SVG representation */}
                                  <div className="w-12 h-12 bg-white border border-gray-300 rounded flex items-center justify-center mb-1">
                                    <img 
                                      src={`https://api.qrserver.com/v1/create-qr-code/?size=48x48&data=${encodeURIComponent(loc.qr_code || loc.code)}`}
                                      alt={`QR ${loc.code}`}
                                      className="w-10 h-10"
                                    />
                                  </div>
                                  <span className="text-xs font-mono font-semibold text-gray-800">{loc.code}</span>
                                  {loc.armoire && (
                                    <span className="text-xs text-gray-500">{loc.armoire}</span>
                                  )}
                                </div>
                              </div>
                            ))}
                          </div>
                        );
                      })()}
                      {availableLocations.filter(loc => !loc.occupied && loc.allowed_product_type === scannedBatch?.product?.type).length > 20 && (
                        <p className="text-xs text-gray-500 mt-2 text-center">
                          ... et {availableLocations.filter(loc => !loc.occupied && loc.allowed_product_type === scannedBatch?.product?.type).length - 20} autres emplacements
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={resetForm} className="flex-1">
                      Annuler
                    </Button>
                    <Button 
                      onClick={handleConfirmPlacement} 
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      disabled={isReadOnly || !locationInput.trim()}
                    >
                      <CheckCircle size={20} className="mr-2" />
                      Confirmer le placement
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      ) : (
        /* Pending Tab - List of batches waiting for placement */
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: 'Space Grotesk' }}>
              Produits en attente de placement
            </h2>
            <span className="badge bg-blue-100 text-blue-700">
              {pendingBatches.length} produit(s)
            </span>
          </div>

          {pendingBatches.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <Box size={48} className="mx-auto mb-4 text-gray-300" />
              <p>Aucun produit en attente de placement</p>
              <p className="text-sm mt-1">Les produits réceptionnés dans les commandes apparaîtront ici</p>
            </div>
          ) : (
            <div className="space-y-3">
              {pendingBatches.map((batch) => (
                <div 
                  key={batch.id}
                  className="flex items-center justify-between p-4 bg-gray-50 rounded-lg hover:bg-blue-50 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium text-gray-900">
                        {batch.product?.nom || 'Produit inconnu'}
                      </h3>
                      {batch.product?.type && (
                        <span className="px-2 py-0.5 text-xs bg-purple-100 text-purple-700 rounded-full">
                          {batch.product.type}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm text-gray-600 mt-1">
                      <span>N° Série: <strong>{batch.numero_serie}</strong></span>
                      {batch.numero_lot && <span>N° Lot: {batch.numero_lot}</span>}
                      {batch.purchase_order && (
                        <span className="text-blue-600">
                          BC: {batch.purchase_order.numero}
                        </span>
                      )}
                    </div>
                  </div>
                  <Button 
                    onClick={() => selectPendingBatch(batch)}
                    disabled={isReadOnly}
                  >
                    <ArrowRight size={18} className="mr-2" />
                    Placer
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Quick Receive Dialog (Case C: Unknown serial) */}
      <Dialog open={quickReceiveDialogOpen} onOpenChange={setQuickReceiveDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileText size={24} className="text-blue-600" />
              Réception rapide - N° série inconnu
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Info banner */}
            <div className="bg-yellow-50 p-3 rounded-lg border border-yellow-200">
              <p className="text-yellow-800 text-sm">
                Le N° série <strong className="bg-yellow-200 px-1 rounded">{unknownSerial}</strong> n'existe pas. 
                Sélectionnez une commande pour le recevoir.
              </p>
            </div>
            
            {/* PO Selection */}
            <div>
              <Label className="font-semibold">Bon de commande</Label>
              <Select 
                value={selectedPO?.id || ''} 
                onValueChange={(value) => {
                  if (value === '_create_new') {
                    // Navigate to create new PO
                    navigator.clipboard.writeText(unknownSerial);
                    toast.success(`N° série copié`);
                    setQuickReceiveDialogOpen(false);
                    window.location.href = '/purchase-orders';
                    return;
                  }
                  const po = purchaseOrders.find(p => p.id === value);
                  setSelectedPO(po);
                  setSelectedProductId('');
                }}
              >
                <SelectTrigger className="mt-1">
                  <SelectValue placeholder="Sélectionner une commande..." />
                </SelectTrigger>
                <SelectContent>
                  {/* Always show "Create new order" as first option */}
                  <SelectItem value="_create_new" className="text-blue-600 font-medium">
                    <span className="flex items-center gap-2">
                      <Plus size={16} />
                      Créer une nouvelle commande
                    </span>
                  </SelectItem>
                  {purchaseOrders.length > 0 && (
                    <div className="border-t my-1"></div>
                  )}
                  {purchaseOrders.map((po) => (
                    <SelectItem key={po.id} value={po.id}>
                      {po.po_number} - {po.supplier} ({new Date(po.expected_delivery).toLocaleDateString('fr-FR')})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {/* Product Selection (from PO) */}
            {selectedPO && (
              <div>
                <Label className="font-semibold">Produit à recevoir</Label>
                <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                  <SelectTrigger className="mt-1">
                    <SelectValue placeholder="Sélectionner le produit..." />
                  </SelectTrigger>
                  <SelectContent>
                    {getAvailableProducts().map((item) => {
                      const remaining = item.quantite - (item.quantite_recue || 0);
                      return (
                        <SelectItem key={item.product_id} value={item.product_id}>
                          {item.product_name} ({remaining} restant(s))
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
              </div>
            )}
            
            {/* Batch details form */}
            {selectedProductId && (
              <div className="bg-gray-50 p-4 rounded-lg space-y-3">
                <h4 className="font-semibold text-gray-700">Informations du lot</h4>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label className="text-sm">N° Série <span className="text-red-500">*</span></Label>
                    <Input
                      value={quickReceiveData.numero_serie}
                      onChange={(e) => setQuickReceiveData({...quickReceiveData, numero_serie: e.target.value})}
                      className="mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">N° Lot <span className="text-gray-400">(optionnel)</span></Label>
                    <Input
                      value={quickReceiveData.numero_lot}
                      onChange={(e) => setQuickReceiveData({...quickReceiveData, numero_lot: e.target.value})}
                      className="mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Date d'expiration <span className="text-red-500">*</span></Label>
                    <Input
                      type="text"
                      value={quickReceiveData.date_expiration}
                      onChange={(e) => setQuickReceiveData({...quickReceiveData, date_expiration: maskDateDMY(e.target.value)})}
                      placeholder="jj/mm/aaaa"
                      inputMode="numeric"
                      maxLength={10}
                      className="mt-1 bg-white"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">Date de fabrication <span className="text-gray-400">(optionnel)</span></Label>
                    <Input
                      type="text"
                      value={quickReceiveData.date_fabrication}
                      onChange={(e) => setQuickReceiveData({...quickReceiveData, date_fabrication: maskDateDMY(e.target.value)})}
                      placeholder="jj/mm/aaaa"
                      inputMode="numeric"
                      maxLength={10}
                      className="mt-1 bg-white"
                    />
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm">Code-barres <span className="text-gray-400">(optionnel)</span></Label>
                    <Input
                      value={quickReceiveData.code_barre}
                      onChange={(e) => setQuickReceiveData({...quickReceiveData, code_barre: e.target.value})}
                      className="mt-1 bg-white"
                    />
                  </div>
                </div>
              </div>
            )}
            
            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => {
                  setQuickReceiveDialogOpen(false);
                  setSerialInput('');
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleQuickReceive}
                disabled={!selectedPO || !selectedProductId || quickReceiveLoading}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {quickReceiveLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                ) : (
                  <CheckCircle size={18} className="mr-2" />
                )}
                Recevoir et placer
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Admin PIN Dialog for expired time window */}
      <Dialog open={adminPinDialogOpen} onOpenChange={(open) => {
        setAdminPinDialogOpen(open);
        if (!open) {
          setAdminPin('');
          setPendingExpiredBatch(null);
          setSerialInput('');
        }
      }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-red-600">
              <Lock size={24} />
              Autorisation requise
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <p className="text-red-800 font-medium">
                Plage horaire dépassée
              </p>
              <p className="text-red-700 text-sm mt-1">
                Ce produit a été collecté en dehors de la fenêtre autorisée (8h01 - 7h59).
              </p>
              {pendingExpiredBatch && (
                <div className="mt-3 text-sm">
                  <p><strong>Produit:</strong> {pendingExpiredBatch.product?.nom}</p>
                  <p><strong>N° Série:</strong> {pendingExpiredBatch.numero_serie}</p>
                </div>
              )}
            </div>
            
            <div>
              <Label className="font-semibold">PIN ou ID Carte Administrateur</Label>
              <Input
                type="password"
                value={adminPin}
                onChange={(e) => setAdminPin(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleAdminPinVerify()}
                placeholder="Entrez le PIN ou scannez l'ID Carte"
                className="mt-1 text-center text-2xl tracking-widest"
                autoFocus
              />
              <p className="text-xs text-gray-500 mt-1">
                L'autorisation d'un administrateur est nécessaire pour effectuer cette remise en stock.
              </p>
            </div>
            
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => {
                  setAdminPinDialogOpen(false);
                  setAdminPin('');
                  setPendingExpiredBatch(null);
                  setSerialInput('');
                }}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleAdminPinVerify}
                disabled={!adminPin.trim() || adminPinLoading}
                className="flex-1 bg-red-600 hover:bg-red-700"
              >
                {adminPinLoading ? (
                  <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white mr-2"></div>
                ) : (
                  <Lock size={18} className="mr-2" />
                )}
                Autoriser
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Placement;
