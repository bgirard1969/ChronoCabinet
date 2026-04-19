import React, { useState, useEffect, useMemo } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Package, MapPin, Calendar, AlertTriangle, ShieldCheck, Lock, ClipboardList, User, Stethoscope, ScanLine, Hand, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';

const Picking = () => {
  const { permissions } = useUser();
  const { t } = useLanguage();
  const [products, setProducts] = useState([]);
  const [productsWithStock, setProductsWithStock] = useState([]);
  const [pickingList, setPickingList] = useState(null);
  const [selectedProductStock, setSelectedProductStock] = useState(null);
  const [availableLots, setAvailableLots] = useState([]); // Available lots for selected product
  const [selectedLots, setSelectedLots] = useState([]); // Manually selected lots
  const [scanCode, setScanCode] = useState('');
  const [scannedItems, setScannedItems] = useState([]); // Multiple scanned items
  const [step, setStep] = useState(1); // 1: selection, 2: patient validation
  const [patientNumber, setPatientNumber] = useState('');
  const [replacementModalOpen, setReplacementModalOpen] = useState(false);
  const [replacingItemIndex, setReplacingItemIndex] = useState(null);
  const [replacementScanCode, setReplacementScanCode] = useState('');
  const [productSearchTerm, setProductSearchTerm] = useState(''); // Search term for manual selection
  const [formData, setFormData] = useState({
    product_id: '',
    quantite: 1,
  });
  
  // Manager approval for expired products
  const [managerApprovalModalOpen, setManagerApprovalModalOpen] = useState(false);
  const [managerPin, setManagerPin] = useState('');
  const [managerApprovalLoading, setManagerApprovalLoading] = useState(false);
  const [expiredItemsInList, setExpiredItemsInList] = useState([]);
  
  // Surgical Request states
  const [surgicalRequests, setSurgicalRequests] = useState([]);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [requestBatches, setRequestBatches] = useState([]);
  const [selectedRequestBatches, setSelectedRequestBatches] = useState([]);
  const [requestPatientNumber, setRequestPatientNumber] = useState('');
  const [requestStep, setRequestStep] = useState(1); // 1: list, 2: products, 3: confirm

  useEffect(() => {
    fetchProducts();
    fetchSurgicalRequests();
  }, []);
  
  const fetchSurgicalRequests = async () => {
    try {
      const response = await api.get('/surgical-requests');
      setSurgicalRequests(response.data);
    } catch (error) {
      console.error('Error fetching surgical requests:', error);
    }
  };

  const fetchProducts = async () => {
    try {
      const [productsRes, batchesRes] = await Promise.all([
        api.get('/products'),
        api.get('/batches')
      ]);
      
      const allProducts = productsRes.data;
      const allBatches = batchesRes.data;
      
      console.log('Total products:', allProducts.length);
      console.log('Total batches:', allBatches.length);
      
      // Calculate stock for each product from batches
      // Only count batches with statut "disponible" and quantite_actuelle = 1
      const productsStock = allProducts.map(product => {
        // Get all batches for this product
        const allProductBatches = allBatches.filter(b => b.product_id === product.id);
        
        // Filter only available batches
        const productBatches = allProductBatches.filter(b => {
          const isAvailable = b.statut === 'disponible';
          const hasStock = b.quantite_actuelle === 1;
          return isAvailable && hasStock;
        });
        
        const totalStock = productBatches.length; // Each batch is 1 unit
        
        if (allProductBatches.length > 0) {
          console.log(`Product: ${product.nom} (Ref: ${product.reference})`);
          console.log(`  Total batches: ${allProductBatches.length}`);
          console.log(`  Available batches: ${totalStock}`);
          allProductBatches.forEach((b, idx) => {
            console.log(`    Batch ${idx + 1}: statut="${b.statut}", quantite_actuelle=${b.quantite_actuelle}`);
          });
        }
        
        return { ...product, stock_disponible: totalStock };
      });
      
      // Filter only products with stock > 0
      const availableProducts = productsStock.filter(p => p.stock_disponible > 0);
      
      console.log('=== RÉSUMÉ ===');
      console.log('Produits avec stock disponible:', availableProducts.length);
      availableProducts.forEach(p => {
        console.log(`- ${p.nom} (${p.reference}): ${p.stock_disponible} unité(s)`);
      });
      
      setProducts(allProducts);
      setProductsWithStock(availableProducts);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Erreur lors du chargement des produits: ' + (error.response?.data?.detail || error.message));
    }
  };
  
  const handleProductChange = async (productId) => {
    setFormData({ ...formData, product_id: productId, quantite: 1 });
    const product = productsWithStock.find(p => p.id === productId);
    setSelectedProductStock(product ? product.stock_disponible : null);
    setSelectedLots([]); // Reset selected lots
    
    // Fetch available lots for this product
    if (productId) {
      try {
        const response = await api.post('/picking/preview', {
          product_id: productId,
          quantite: 1
        });
        setAvailableLots(response.data.available_lots || []);
      } catch (error) {
        console.error('Error fetching available lots:', error);
        setAvailableLots([]);
      }
    } else {
      setAvailableLots([]);
    }
  };

  const toggleLotSelection = (lot) => {
    // Show warning for expired lots but allow selection with manager approval
    if (lot.is_expired) {
      toast.warning('⚠️ Ce lot est expiré - Approbation gestionnaire requise pour le collecte');
    }
    
    setSelectedLots(prev => {
      const isSelected = prev.find(l => l.batch_id === lot.batch_id);
      if (isSelected) {
        return prev.filter(l => l.batch_id !== lot.batch_id);
      } else {
        return [...prev, lot];
      }
    });
  };

  const handleScan = async (e) => {
    e.preventDefault();
    if (!scanCode.trim()) {
      toast.error('Veuillez entrer un numéro de série  complet');
      return;
    }

    try {
      // Search for batch by serial number  only (exact match)
      const response = await api.post('/batches/scan', { code: scanCode.trim() });
      const batch = response.data.batch;
      const product = response.data.product;
      
      if (!batch || !product) {
        toast.error('Aucun lot trouvé avec ce code');
        setScanCode('');
        return;
      }

      // VALIDATION 1: Check if batch is available (not reserved or used)
      if (batch.statut !== 'disponible') {
        toast.error(`⚠️ Produit en statut "${batch.statut}" - Non disponible pour collecte`);
        setScanCode('');
        return;
      }

      // VALIDATION 2: Check if product has stock
      if (batch.quantite_actuelle <= 0) {
        toast.error('❌ Ce produit n\'a plus de stock disponible');
        setScanCode('');
        return;
      }

      // VALIDATION 3: Check if product is expired - allow but mark for manager approval
      const expirationDate = new Date(batch.date_expiration);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const isExpired = expirationDate <= today;
      if (isExpired) {
        toast.warning(`⚠️ PRODUIT EXPIRÉ !\nExpire le: ${expirationDate.toLocaleDateString('fr-FR')}\nApprobation gestionnaire requise pour le collecte.`);
      }

      // VALIDATION 4: Check if this exact batch has already been scanned
      const alreadyScanned = scannedItems.find(item => item.batch.id === batch.id);
      if (alreadyScanned) {
        toast.warning(`⚠️ Ce produit a déjà été scanné !\n${product.nom}\nN° Série: ${batch.numero_serie || batch.numero_lot}`);
        setScanCode('');
        return;
      }

      // VALIDATION 5: Check for closer expiration date (FIFO check)
      const batchesRes = await api.get('/batches');
      const allBatches = batchesRes.data;
      
      const otherBatches = allBatches.filter(b => 
        b.product_id === product.id &&
        b.statut === 'disponible' &&
        b.quantite_actuelle > 0 &&
        b.id !== batch.id &&
        !scannedItems.find(item => item.batch.id === b.id) // Not already scanned
      );
      
      let closerBatch = null;
      const scannedExpDate = new Date(batch.date_expiration);
      scannedExpDate.setHours(0, 0, 0, 0); // Normalize to start of day
      
      for (const otherBatch of otherBatches) {
        const otherExpDate = new Date(otherBatch.date_expiration);
        otherExpDate.setHours(0, 0, 0, 0); // Normalize to start of day
        
        // Skip if expired
        if (otherExpDate <= today) continue;
        
        // Only flag if other batch expires STRICTLY BEFORE the scanned one
        // Not equal (same day = no FIFO issue)
        if (otherExpDate.getTime() < scannedExpDate.getTime()) {
          if (!closerBatch) {
            closerBatch = otherBatch;
          } else {
            const currentCloserExpDate = new Date(closerBatch.date_expiration);
            currentCloserExpDate.setHours(0, 0, 0, 0);
            if (otherExpDate.getTime() < currentCloserExpDate.getTime()) {
              closerBatch = otherBatch;
            }
          }
        }
      }

      // If closer expiration found, show warning and add flag
      if (closerBatch) {
        const daysDiff = Math.ceil((scannedExpDate - new Date(closerBatch.date_expiration)) / (1000 * 60 * 60 * 24));
        toast.warning(
          `⚠️ ATTENTION FIFO !\n` +
          `Le produit scanné expire le ${scannedExpDate.toLocaleDateString('fr-FR')}\n\n` +
          `Un autre lot expire ${daysDiff} jour(s) plus tôt :\n` +
          `📍 ${closerBatch.localisation}\n` +
          `📅 ${new Date(closerBatch.date_expiration).toLocaleDateString('fr-FR')}\n\n` +
          `Scannez ce produit recommandé ou continuez avec celui-ci.`,
          { duration: 8000 }
        );
      }

      // Add to scanned items list with FIFO warning
      setScannedItems(prev => [...prev, {
        product,
        batch,
        quantite: 1,
        scannedCode: scanCode.trim(),
        hasCloserExpiration: !!closerBatch,
        isExpired: isExpired,
        closerBatch: closerBatch ? {
          id: closerBatch.id,
          location: closerBatch.localisation,
          expiration: closerBatch.date_expiration,
          numero_serie: closerBatch.numero_serie || closerBatch.numero_lot
        } : null
      }]);
      
      toast.success(`✓ Ajouté : ${product.nom}`);
      setScanCode('');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du scan');
      setScanCode('');
    }
  };

  const removeScannedItem = (index) => {
    setScannedItems(prev => prev.filter((_, i) => i !== index));
    toast.info('Produit retiré de la liste');
  };

  const proceedToPatientValidation = async () => {
    if (scannedItems.length === 0) {
      toast.error('Veuillez scanner au moins un produit');
      return;
    }

    // Check if any items have FIFO warnings
    const itemsWithWarnings = scannedItems.filter(item => item.hasCloserExpiration);
    if (itemsWithWarnings.length > 0) {
      const confirm = window.confirm(
        `⚠️ ${itemsWithWarnings.length} produit(s) ont des dates d'expiration plus proches disponibles.\n\n` +
        `Voulez-vous continuer quand même ?\n\n` +
        `Recommandation : Scannez les produits recommandés pour respecter le FIFO.`
      );
      if (!confirm) {
        return;
      }
    }

    // Request picking for all scanned items
    try {
      const allPickingLists = [];
      
      for (const item of scannedItems) {
        const response = await api.post('/picking/request', {
          product_id: item.product.id,
          quantite: item.quantite,
        });
        
        const enrichedPickingList = response.data.picking_list.map(pickingItem => ({
          ...pickingItem,
          productName: item.product.nom,
          hasCloserExpiration: item.hasCloserExpiration,
          closerBatch: item.closerBatch,
          is_expired: item.isExpired,
          days_until_expiration: item.isExpired ? -Math.abs(getDaysUntilExpiration(item.batch.date_expiration)) : getDaysUntilExpiration(item.batch.date_expiration)
        }));
        
        allPickingLists.push(...enrichedPickingList);
      }
      
      setPickingList({ 
        picking_list: allPickingLists,
        product: { nom: `${scannedItems.length} produit(s)` }
      });
      setStep(2);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la demande');
    }
  };

  const cancelScanning = () => {
    if (window.confirm('Annuler le collecte ? Les produits scannés ne seront pas affectés.')) {
      setScannedItems([]);
      setStep(1);
      setScanCode('');
    }
  };

  const openReplacementModal = (index) => {
    setReplacingItemIndex(index);
    setReplacementScanCode('');
    setReplacementModalOpen(true);
  };

  const handleReplacementScan = async (e) => {
    e.preventDefault();
    if (!replacementScanCode.trim()) {
      toast.error('Veuillez scanner le produit recommandé');
      return;
    }

    const itemToReplace = scannedItems[replacingItemIndex];
    if (!itemToReplace || !itemToReplace.closerBatch) {
      toast.error('Erreur: Produit de remplacement non trouvé');
      return;
    }

    try {
      // Scan the replacement product
      const response = await api.post('/batches/scan', { code: replacementScanCode.trim() });
      const batch = response.data.batch;
      const product = response.data.product;
      
      if (!batch || !product) {
        toast.error('❌ Produit non trouvé');
        return;
      }

      // Validate it's the recommended batch
      if (batch.id !== itemToReplace.closerBatch.id) {
        toast.error(`⚠️ Ce n'est pas le produit recommandé !\n\nAttendu: ${itemToReplace.closerBatch.location}\nScanné: ${batch.localisation || 'Inconnu'}`);
        return;
      }

      // Validations (same as main scan)
      if (batch.statut !== 'disponible') {
        toast.error(`⚠️ Produit en statut "${batch.statut}" - Non disponible`);
        return;
      }

      if (batch.quantite_actuelle <= 0) {
        toast.error('❌ Ce produit n\'a plus de stock disponible');
        return;
      }

      const expirationDate = new Date(batch.date_expiration);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      if (expirationDate <= today) {
        toast.error(`❌ PRODUIT EXPIRÉ !\nExpire le: ${expirationDate.toLocaleDateString('fr-FR')}`);
        return;
      }

      // Check if already scanned (except the one being replaced)
      const alreadyScanned = scannedItems.find((item, idx) => idx !== replacingItemIndex && item.batch.id === batch.id);
      if (alreadyScanned) {
        toast.error(`⚠️ Ce produit a déjà été scanné !`);
        return;
      }

      // Replace the item
      const newScannedItems = [...scannedItems];
      newScannedItems[replacingItemIndex] = {
        product,
        batch,
        quantite: 1,
        scannedCode: replacementScanCode.trim(),
        hasCloserExpiration: false, // This is now the correct one
        closerBatch: null
      };
      
      setScannedItems(newScannedItems);
      setReplacementModalOpen(false);
      toast.success(`✅ Produit remplacé avec succès !\nRespect du FIFO confirmé.`);
      
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors du scan');
    }
  };

  const handleRequestPicking = async (e) => {
    e.preventDefault();
    if (!formData.product_id) {
      toast.error('Veuillez sélectionner un produit');
      return;
    }
    
    // Check if lots are manually selected or use automatic FIFO
    const lotsToUse = selectedLots.length > 0 ? selectedLots : null;
    
    if (lotsToUse && lotsToUse.length === 0) {
      toast.error('Veuillez sélectionner au moins un lot');
      return;
    }
    
    try {
      let pickingListData;
      
      if (lotsToUse) {
        // Use manually selected lots
        const selectedProduct = productsWithStock.find(p => p.id === formData.product_id);
        const productName = selectedProduct ? selectedProduct.nom : 'Produit';
        
        pickingListData = {
          product: { nom: productName },
          picking_list: lotsToUse.map(lot => ({
            batch_id: lot.batch_id,
            numero_serie: lot.numero_serie,
            location: lot.location,
            expiration_date: lot.expiration_date,
            days_until_expiration: lot.days_until_expiration,
            is_expired: lot.is_expired,
            is_expiring_soon: lot.is_expiring_soon,
            productName: productName,
            hasCloserExpiration: false,
            closerBatch: null
          })),
          message: `Prélever ${lotsToUse.length} unité(s) aux emplacements indiqués`
        };
      } else {
        // Use automatic FIFO selection
        const response = await api.post('/picking/request', {
          product_id: formData.product_id,
          quantite: parseInt(formData.quantite),
        });
        
        const selectedProduct = productsWithStock.find(p => p.id === formData.product_id);
        const productName = selectedProduct ? selectedProduct.nom : 'Produit';
        
        pickingListData = {
          ...response.data,
          picking_list: response.data.picking_list.map(item => ({
            ...item,
            productName: productName,
            hasCloserExpiration: false,
            closerBatch: null
          })),
          product: { nom: productName }
        };
      }
      
      setPickingList(pickingListData);
      setStep(2); // Advance to patient validation step
      toast.success(pickingListData.message);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la demande de collecte');
    }
  };

  const resetForm = () => {
    setPickingList(null);
    setScannedItems([]);
    setStep(1);
    setPatientNumber('');
    setFormData({
      product_id: '',
      quantite: 1,
    });
    setSelectedProductStock(null);
    setAvailableLots([]);
    setSelectedLots([]);
    // Refresh inventory
    fetchProducts();
  };

  const cancelPicking = () => {
    if (window.confirm('Annuler le collecte ?')) {
      resetForm();
      toast.info('Collecte annulé');
    }
  };

  const confirmPicking = async (managerPin = null, managerName = null) => {
    try {
      const batchIds = pickingList.picking_list.map(b => b.batch_id);
      const payload = { 
        batch_ids: batchIds, 
        patient_id: patientNumber 
      };
      
      // Add manager approval data if provided
      if (managerPin && managerName) {
        payload.manager_pin = managerPin;
        payload.manager_name = managerName;
      }
      
      await api.post('/picking/confirm', payload);
      toast.success('Collecte confirmé et stock mis à jour');
      resetForm();
    } catch (e) {
      toast.error(e.response?.data?.detail || 'Erreur lors de la confirmation du collecte');
    }
  };

  const getDaysUntilExpiration = (expirationDate) => {
    const now = new Date();
    const expDate = new Date(expirationDate);
    const diffTime = expDate - now;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays;
  };
  
  // ============= SURGICAL REQUEST FUNCTIONS =============
  
  const handleSelectRequest = async (request) => {
    try {
      const response = await api.get(`/surgical-requests/${request.id}`);
      setSelectedRequest(response.data);
      setRequestBatches(response.data.batches_details || []);
      setSelectedRequestBatches(response.data.batches_details?.map(b => b.id) || []);
      setRequestStep(2);
    } catch (error) {
      toast.error('Erreur lors du chargement de la requête');
    }
  };
  
  const toggleRequestBatchSelection = (batchId) => {
    setSelectedRequestBatches(prev => {
      if (prev.includes(batchId)) {
        return prev.filter(id => id !== batchId);
      } else {
        return [...prev, batchId];
      }
    });
  };
  
  const handleRequestPickingConfirm = () => {
    if (selectedRequestBatches.length === 0) {
      toast.error('Veuillez sélectionner au moins un produit');
      return;
    }
    
    // Check for expired products
    const expiredBatches = requestBatches.filter(
      b => selectedRequestBatches.includes(b.id) && new Date(b.date_expiration) < new Date()
    );
    
    if (expiredBatches.length > 0) {
      setExpiredItemsInList(expiredBatches);
      setManagerApprovalModalOpen(true);
    } else {
      setRequestStep(3);
    }
  };
  
  const handleFinalRequestConfirm = async () => {
    if (!requestPatientNumber.trim()) {
      toast.error('Veuillez entrer le numéro de patient');
      return;
    }
    
    try {
      await api.put(`/surgical-requests/${selectedRequest.id}/confirm`, {
        patient_id: requestPatientNumber,
        picked_batches: selectedRequestBatches,
        manager_pin: managerPin || null,
        manager_name: null
      });
      
      toast.success('Collecte confirmé avec succès');
      
      // Reset states
      setSelectedRequest(null);
      setRequestBatches([]);
      setSelectedRequestBatches([]);
      setRequestPatientNumber('');
      setRequestStep(1);
      setManagerPin('');
      
      // Refresh data
      fetchProducts();
      fetchSurgicalRequests();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la confirmation');
    }
  };
  
  const cancelRequestPicking = () => {
    setSelectedRequest(null);
    setRequestBatches([]);
    setSelectedRequestBatches([]);
    setRequestPatientNumber('');
    setRequestStep(1);
  };
  
  const getStatusBadge = (status) => {
    switch (status) {
      case 'à_faire':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'en_cours':
        return 'bg-blue-100 text-blue-800 border-blue-300';
      case 'terminé':
        return 'bg-green-100 text-green-800 border-green-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };
  
  const getStatusLabel = (status) => {
    switch (status) {
      case 'à_faire': return 'À faire';
      case 'en_cours': return 'En cours';
      case 'terminé': return 'Terminé';
      default: return status;
    }
  };

  return (
    <div className="p-8" data-testid="picking-page">
      {/* Read-only banner */}
      {permissions.isReadOnly && (
        <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-center gap-2">
          <Lock className="text-yellow-600" size={20} />
          <span className="text-yellow-800 text-sm font-medium">
            {t('readOnlyMode')} - {t('readOnlyPicking')}
          </span>
        </div>
      )}
      
      {!permissions.canPick && !permissions.isReadOnly && (
        <div className="mb-4 p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-center gap-2">
          <AlertTriangle className="text-orange-600" size={20} />
          <span className="text-orange-800 text-sm font-medium">
            {t('roleNotAllowed')}
          </span>
        </div>
      )}
      
      <div className="mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-4xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
            {t('pickingTitle')}
          </h1>
          <p className="text-gray-600">{t('pickingDescription')}</p>
        </div>
        {permissions.canDelete && (
          <div className="flex gap-3">
            <Button
              onClick={async () => {
                if (window.confirm('⚠️ NETTOYER TOUTES LES DONNÉES ?\n\nCela supprimera :\n- Tous les lots\n- Tous les mouvements\n- Toutes les alertes\n- Toutes les commandes\n\nGardera :\n- Produits\n- Fabricants\n- Types\n\nConfirmez-vous ?')) {
                  try {
                    const response = await api.post('/maintenance/reset-all-data');
                    toast.success(`✅ ${response.data.message}\n\n${response.data.deleted.batches} lots supprimés\n${response.data.locations_reset} emplacements réinitialisés\n${response.data.products_replenishment_reset || 0} produits réappro réinitialisés`);
                    fetchProducts(); // Refresh the list
                  } catch (error) {
                    toast.error('Erreur lors du nettoyage');
                  }
                }
              }}
              variant="outline"
              className="bg-red-50 border-red-300 text-red-700 hover:bg-red-100"
            >
              🗑️ Nettoyer BD
            </Button>
            <Button
              onClick={async () => {
                if (window.confirm('Libérer tous les lots bloqués en statut "réservé" ?\n\nCela peut arriver si une réception GRM n\'a pas été finalisée.')) {
                  try {
                    const response = await api.post('/batches/release-reserved');
                    toast.success(response.data.message);
                    fetchProducts(); // Refresh the list
                  } catch (error) {
                    toast.error('Erreur lors de la libération des lots');
                  }
                }
              }}
              variant="outline"
              className="bg-orange-50 border-orange-300 text-orange-700 hover:bg-orange-100"
            >
              🔓 Libérer lots réservés
          </Button>
          </div>
        )}
      </div>

      {step === 1 ? (
        permissions.isReadOnly ? (
          <div className="text-center py-16">
            <Lock size={64} className="mx-auto text-gray-300 mb-4" />
            <h3 className="text-xl font-medium text-gray-900 mb-2">{t('accessRestricted')}</h3>
            <p className="text-gray-500">{t('roleNotAllowed')}</p>
          </div>
        ) : (
        <div className="space-y-6">
          {/* Scan Section */}
          <div className="card max-w-6xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <ScanLine size={24} className="text-blue-600" />
              {t('scanProduct')}
            </h2>
            <p className="text-sm text-gray-600 mb-4">
              {t('scanOrEnter')}
            </p>
            <form onSubmit={handleScan} className="space-y-4">
              <div className="flex gap-3">
                <Input
                  type="text"
                  placeholder="N° Série  (code complet)"
                  value={scanCode}
                  onChange={(e) => setScanCode(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleScan(e);
                    }
                  }}
                  className="flex-1 text-lg"
                  autoFocus
                  disabled={!permissions.canPick}
                />
                <Button type="submit" className="bg-blue-600 hover:bg-blue-700 px-8" disabled={!permissions.canPick}>
                  Scanner
                </Button>
              </div>
              <p className="text-sm text-gray-500">Entrez le numéro de série  complet du produit</p>

              {/* Liste des produits scannés */}
              {scannedItems.length > 0 && (
                <div className="mt-6 border-t pt-4">
                  <h3 className="text-lg font-bold mb-3">Produits scannés ({scannedItems.length})</h3>
                  <div className="space-y-2">
                    {scannedItems.map((item, idx) => {
                      const daysUntilExp = getDaysUntilExpiration(item.batch.date_expiration);
                      const isExpired = daysUntilExp <= 0;
                      const isExpiringSoon = daysUntilExp > 0 && daysUntilExp <= 30;
                      return (
                      <div key={idx} className={`p-3 rounded-lg border-2 shadow-sm ${
                        isExpired 
                          ? 'bg-red-50 border-red-400' 
                          : isExpiringSoon 
                            ? 'bg-white border-orange-400' 
                            : 'bg-white border-green-400'
                      }`}>
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                                isExpired 
                                  ? 'border-red-500 bg-red-500 text-white'
                                  : isExpiringSoon
                                    ? 'border-orange-500 bg-orange-500 text-white'
                                    : 'border-green-500 bg-green-500 text-white'
                              }`}>
                                {isExpired ? '⚠' : '✓'}
                              </div>
                              <p className={`font-bold ${isExpired ? 'text-red-900' : 'text-gray-900'}`}>
                                {item.product.nom}
                              </p>
                            </div>
                            <div className="flex flex-wrap gap-4 text-sm text-gray-600 mt-2 ml-8">
                              <span>📍 {item.batch.localisation}</span>
                              <span>📦 N° Série: <span className="font-mono">{item.batch.numero_serie || item.batch.numero_lot || '-'}</span></span>
                            </div>
                            <div className={`text-sm mt-1 ml-8 font-medium ${
                              isExpired 
                                ? 'text-red-600' 
                                : isExpiringSoon 
                                  ? 'text-orange-600' 
                                  : 'text-green-600'
                            }`}>
                              📅 Expire: {new Date(item.batch.date_expiration).toLocaleDateString('fr-FR')}
                              {isExpired && ' ⛔ EXPIRÉ'}
                              {isExpiringSoon && !isExpired && ` ⚠️ ${daysUntilExp}${t('daysRemaining')}`}
                              {!isExpired && !isExpiringSoon && ` ✓ ${daysUntilExp}${t('daysRemaining')}`}
                            </div>
                            
                            {/* Alerte FIFO si date plus proche */}
                            {item.hasCloserExpiration && item.closerBatch && (
                              <div className="mt-3 p-3 bg-orange-100 border-l-4 border-orange-600 rounded">
                                <p className="text-sm font-bold text-orange-900 flex items-center gap-1">
                                  ⚠️ Date d'expiration plus rapprochée disponible :
                                </p>
                                <p className="text-sm text-orange-800 mt-2">
                                  📍 {item.closerBatch.location} • 
                                  📅 Expire: {new Date(item.closerBatch.expiration).toLocaleDateString('fr-FR')} • 
                                  🔖 {item.closerBatch.numero_serie}
                                </p>
                                <Button
                                  onClick={() => openReplacementModal(idx)}
                                  className="mt-3 w-full bg-orange-600 hover:bg-orange-700 text-white"
                                  size="sm"
                                >
                                  🔄 Scanner le produit recommandé
                                </Button>
                              </div>
                            )}
                          </div>
                          <div className="flex flex-col items-end gap-2 ml-2">
                            <span className={`text-xs px-2 py-1 rounded ${
                              isExpired 
                                ? 'bg-red-200 text-red-800' 
                                : isExpiringSoon 
                                  ? 'bg-orange-200 text-orange-800' 
                                  : 'bg-green-200 text-green-800'
                            }`}>
                              {isExpired ? t('expired') : isExpiringSoon ? t('expiringSoon') : t('valid')}
                            </span>
                            <Button
                              onClick={() => removeScannedItem(idx)}
                              variant="outline"
                              size="sm"
                              className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                              ✕ Retirer
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                    })}
                  </div>
                  <div className="flex gap-3 mt-4">
                    <Button
                      onClick={proceedToPatientValidation}
                      className="flex-1 bg-green-600 hover:bg-green-700 text-lg py-6"
                    >
                      Confirmer les produits ({scannedItems.length}) →
                    </Button>
                    <Button
                      onClick={() => setScannedItems([])}
                      variant="outline"
                      className="text-red-600"
                    >
                      Tout effacer
                    </Button>
                  </div>
                </div>
              )}
            </form>
          </div>

          {/* Manual Selection Section */}
          <div className="card max-w-6xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <Hand size={24} className="text-green-600" />
              {t('manualSelection')}
            </h2>
            <form onSubmit={handleRequestPicking} className="space-y-4">
            <div>
              <Label>{t('products')}</Label>
              {/* Search input for filtering products */}
              <div className="relative mb-2">
                <Search size={18} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                <Input
                  type="text"
                  placeholder="Tapez pour rechercher un produit (nom, référence, description)..."
                  value={productSearchTerm}
                  onChange={(e) => {
                    setProductSearchTerm(e.target.value);
                    // Clear selection when searching
                    if (e.target.value && formData.product_id) {
                      setFormData({ ...formData, product_id: '' });
                      setSelectedProductStock(null);
                      setAvailableLots([]);
                      setSelectedLots([]);
                    }
                  }}
                  className="pl-10"
                />
                {productSearchTerm && (
                  <button
                    type="button"
                    onClick={() => setProductSearchTerm('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    ✕
                  </button>
                )}
              </div>
              
              {/* Filtered product list with text highlighting */}
              <div className="border rounded-lg max-h-64 overflow-y-auto bg-white">
                {(() => {
                  const searchLower = productSearchTerm.toLowerCase().trim();
                  
                  // If no search term, show message
                  if (!searchLower) {
                    return (
                      <div className="p-6 text-center">
                        <Search size={32} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-gray-500">Tapez au moins 2 caractères pour rechercher parmi {productsWithStock.length} produits</p>
                        <p className="text-xs text-gray-400 mt-1">Recherche par nom, référence ou description</p>
                      </div>
                    );
                  }
                  
                  // If search term is too short
                  if (searchLower.length < 2) {
                    return (
                      <div className="p-4 text-center text-gray-500">
                        Continuez à taper pour filtrer les résultats...
                      </div>
                    );
                  }
                  
                  // Filter products that match the search
                  const filteredProducts = productsWithStock.filter(product => 
                    product.nom?.toLowerCase().includes(searchLower) ||
                    product.reference?.toLowerCase().includes(searchLower) ||
                    product.description?.toLowerCase().includes(searchLower)
                  );
                  
                  if (filteredProducts.length === 0) {
                    return (
                      <div className="p-4 text-center text-gray-500">
                        Aucun produit trouvé pour "{productSearchTerm}"
                      </div>
                    );
                  }
                  
                  // Function to highlight matching text
                  const highlightText = (text, search) => {
                    if (!text || !search) return text;
                    const parts = text.split(new RegExp(`(${search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi'));
                    return parts.map((part, i) => 
                      part.toLowerCase() === search.toLowerCase() 
                        ? <mark key={i} className="bg-yellow-300 text-yellow-900 px-0.5 rounded">{part}</mark>
                        : part
                    );
                  };
                  
                  return (
                    <>
                      <div className="px-3 py-2 bg-gray-50 border-b text-sm text-gray-600">
                        {filteredProducts.length} produit{filteredProducts.length > 1 ? 's' : ''} trouvé{filteredProducts.length > 1 ? 's' : ''}
                      </div>
                      {filteredProducts.map((product) => {
                        const isSelected = formData.product_id === product.id;
                        
                        return (
                          <div
                            key={product.id}
                            onClick={() => {
                              handleProductChange(product.id);
                              setProductSearchTerm(''); // Clear search after selection
                            }}
                            className={`p-3 cursor-pointer border-b last:border-b-0 transition-all hover:bg-blue-50 ${
                              isSelected ? 'bg-blue-100 border-l-4 border-l-blue-500' : ''
                            }`}
                          >
                            <div className="flex justify-between items-center">
                              <div>
                                <span className="font-medium">
                                  {highlightText(product.nom, searchLower)}
                                </span>
                                <span className="text-gray-500 text-sm ml-2">
                                  - {highlightText(product.reference, searchLower)}
                                </span>
                              </div>
                              <span className="text-sm font-medium px-2 py-1 rounded bg-green-100 text-green-700">
                                Stock: {product.stock_disponible}
                              </span>
                            </div>
                            {product.description && (
                              <p className="text-xs mt-1 text-gray-500">
                                {highlightText(product.description, searchLower)}
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </>
                  );
                })()}
              </div>
              
              {/* Selected product display */}
              {formData.product_id && !productSearchTerm && (
                <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <div className="flex justify-between items-center">
                    <div>
                      <span className="text-sm text-blue-600 font-medium">Produit sélectionné :</span>
                      <p className="font-bold text-blue-900">
                        {productsWithStock.find(p => p.id === formData.product_id)?.nom}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-sm text-blue-600">{t('stockAvailable')}</span>
                      <p className="font-bold text-blue-900">{selectedProductStock} {selectedProductStock > 1 ? t('units') : t('unit')}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
            
            {/* Available Lots Display */}
            {availableLots.length > 0 && (
              <div className="border rounded-lg p-4 bg-gray-50">
                <h3 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                  📦 {t('availableLots')} ({availableLots.length})
                  <span className="text-sm font-normal text-gray-600">
                    - Cliquez pour sélectionner
                  </span>
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  💡 Les lots sont triés par date d'expiration (FIFO). Les lots expirés nécessitent une approbation gestionnaire.
                </p>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableLots.map((lot, idx) => {
                    const isSelected = selectedLots.find(l => l.batch_id === lot.batch_id);
                    const expDate = new Date(lot.expiration_date);
                    
                    return (
                      <div
                        key={lot.batch_id}
                        onClick={() => toggleLotSelection(lot)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          lot.is_expired 
                            ? isSelected
                              ? 'bg-red-100 border-red-500 ring-2 ring-red-400'
                              : 'bg-red-50 border-red-300 hover:border-red-400'
                            : lot.is_expiring_soon
                              ? isSelected 
                                ? 'bg-orange-100 border-orange-500 ring-2 ring-orange-400'
                                : 'bg-orange-50 border-orange-300 hover:border-orange-400'
                              : isSelected
                                ? 'bg-green-100 border-green-500 ring-2 ring-green-400'
                                : 'bg-white border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              lot.is_expired 
                                ? isSelected
                                  ? 'border-red-500 bg-red-500 text-white'
                                  : 'border-red-400 bg-red-100'
                                : isSelected 
                                  ? 'border-green-500 bg-green-500 text-white' 
                                  : 'border-gray-300'
                            }`}>
                              {isSelected && <span>✓</span>}
                              {!isSelected && lot.is_expired && <span className="text-red-600 text-xs">⚠</span>}
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium">📍 {lot.location}</span>
                                <span className="text-sm text-gray-600">• N° {lot.numero_serie}</span>
                              </div>
                              <div className={`text-sm mt-1 font-medium ${
                                lot.is_expired 
                                  ? 'text-red-600' 
                                  : lot.is_expiring_soon 
                                    ? 'text-orange-600' 
                                    : 'text-green-600'
                              }`}>
                                📅 Expire: {expDate.toLocaleDateString('fr-FR')}
                                {lot.is_expired && ' ⛔ EXPIRÉ'}
                                {lot.is_expiring_soon && !lot.is_expired && ` ⚠️ ${lot.days_until_expiration}j restant(s)`}
                                {!lot.is_expired && !lot.is_expiring_soon && ` ✓ ${lot.days_until_expiration}j`}
                              </div>
                            </div>
                          </div>
                          <div className={`text-xs px-2 py-1 rounded ${
                            lot.is_expired 
                              ? 'bg-red-200 text-red-800' 
                              : lot.is_expiring_soon 
                                ? 'bg-orange-200 text-orange-800' 
                                : 'bg-green-200 text-green-800'
                          }`}>
                            {lot.status}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                {/* Selected lots summary */}
                {selectedLots.length > 0 && (
                  <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                    <p className="text-sm font-medium text-blue-800">
                      ✓ {selectedLots.length} {t('selectedLots')}
                    </p>
                  </div>
                )}
              </div>
            )}
            
            {/* Quantity selector - only show if no lots manually selected */}
            {selectedLots.length === 0 && (
              <div>
                <Label>{t('quantity')} ({t('fifoAutomatic')})</Label>
                <Input
                  data-testid="picking-quantite-input"
                  type="number"
                  min="1"
                  max={selectedProductStock || 1}
                  value={formData.quantite}
                  onChange={(e) => setFormData({ ...formData, quantite: e.target.value })}
                  required
                  disabled={!formData.product_id}
                />
                {selectedProductStock !== null && (
                  <p className="text-xs text-gray-500 mt-1">
                    Maximum : {selectedProductStock}
                  </p>
                )}
              </div>
            )}
            
            <Button 
              type="submit" 
              className="w-full" 
              data-testid="request-picking-button"
              disabled={!formData.product_id}
            >
              {selectedLots.length > 0 
                ? `${t('pickSelectedLots')} (${selectedLots.length})`
                : t('requestPicking')
              }
            </Button>
          </form>
          </div>
          
          {/* ============= SÉLECTION PAR REQUÊTE ============= */}
          <div className="card max-w-6xl">
            <h2 className="text-xl font-bold text-gray-900 mb-4 flex items-center gap-2" style={{ fontFamily: 'Space Grotesk' }}>
              <ClipboardList size={24} className="text-purple-600" />
              {t('selectionByRequest')}
            </h2>
            
            {requestStep === 1 && (
              <>
                <p className="text-gray-600 mb-4">{t('selectSurgicalRequest')}</p>
                
                {surgicalRequests.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <ClipboardList size={48} className="mx-auto mb-3 opacity-50" />
                    <p>{t('noSurgicalRequests')}</p>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="bg-purple-50 text-purple-900">
                          <th className="px-3 py-2 text-left">{t('dateTime')}</th>
                          <th className="px-3 py-2 text-left">{t('requestNumber')}</th>
                          <th className="px-3 py-2 text-left">{t('status')}</th>
                          <th className="px-3 py-2 text-left">{t('specialty')}</th>
                          <th className="px-3 py-2 text-left">{t('intervention')}</th>
                          <th className="px-3 py-2 text-center">{t('action')}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {surgicalRequests.filter(r => r.status !== 'terminé').map((request) => (
                          <tr key={request.id} className="border-b hover:bg-purple-50 transition-colors">
                            <td className="px-3 py-3 font-mono">
                              {new Date(request.date_time).toLocaleDateString('fr-FR')} | {new Date(request.date_time).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}
                            </td>
                            <td className="px-3 py-3 font-bold text-purple-700">{request.request_number}</td>
                            <td className="px-3 py-3">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium border ${getStatusBadge(request.status)}`}>
                                {getStatusLabel(request.status)}
                              </span>
                            </td>
                            <td className="px-3 py-3">{request.specialty}</td>
                            <td className="px-3 py-3">{request.intervention}</td>
                            <td className="px-3 py-3 text-center">
                              <Button
                                size="sm"
                                onClick={() => handleSelectRequest(request)}
                                className="bg-purple-600 hover:bg-purple-700"
                              >
                                {t('select')}
                              </Button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </>
            )}
            
            {requestStep === 2 && selectedRequest && (
              <div className="space-y-4">
                <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-600">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-bold text-purple-900 text-lg">{t('requestNumber')} {selectedRequest.request_number}</h3>
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1 mt-2 text-sm text-purple-800">
                        <p><span className="font-medium">{t('specialty')}:</span> {selectedRequest.specialty}</p>
                        <p><span className="font-medium">{t('intervention')}:</span> {selectedRequest.intervention}</p>
                      </div>
                    </div>
                    <Button variant="outline" size="sm" onClick={cancelRequestPicking} className="text-red-600">
                      ✕ {t('cancel')}
                    </Button>
                  </div>
                </div>
                
                <h4 className="font-bold text-gray-900">{t('requiredProducts')} ({requestBatches.length})</h4>
                <p className="text-sm text-gray-600">{t('clickToSelect')}</p>
                
                <div className="space-y-2">
                  {requestBatches.map((batch) => {
                    const isSelected = selectedRequestBatches.includes(batch.id);
                    const daysUntilExp = getDaysUntilExpiration(batch.date_expiration);
                    const isExpired = daysUntilExp <= 0;
                    const isExpiringSoon = daysUntilExp > 0 && daysUntilExp <= 30;
                    const expDate = new Date(batch.date_expiration);
                    
                    return (
                      <div
                        key={batch.id}
                        onClick={() => toggleRequestBatchSelection(batch.id)}
                        className={`p-3 rounded-lg border-2 cursor-pointer transition-all ${
                          isExpired 
                            ? isSelected
                              ? 'bg-red-50 border-red-500 ring-2 ring-red-400'
                              : 'bg-red-50 border-red-300 hover:border-red-400'
                            : isExpiringSoon
                              ? isSelected 
                                ? 'bg-white border-orange-500 ring-2 ring-orange-400'
                                : 'bg-white border-orange-300 hover:border-orange-400'
                              : isSelected
                                ? 'bg-white border-green-500 ring-2 ring-green-400'
                                : 'bg-white border-gray-200 hover:border-blue-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              isExpired 
                                ? isSelected
                                  ? 'border-red-500 bg-red-500 text-white'
                                  : 'border-red-400 bg-red-100'
                                : isSelected 
                                  ? 'border-green-500 bg-green-500 text-white' 
                                  : 'border-gray-300'
                            }`}>
                              {isSelected && <span>✓</span>}
                              {!isSelected && isExpired && <span className="text-red-600 text-xs">⚠</span>}
                            </div>
                            <div>
                              <p className={`font-bold ${isExpired ? 'text-red-900' : 'text-gray-900'}`}>
                                {batch.product_name}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="font-medium">📍 {batch.localisation}</span>
                                <span>• N° {batch.numero_serie || batch.numero_lot || '-'}</span>
                              </div>
                              <div className={`text-sm mt-1 font-medium ${
                                isExpired 
                                  ? 'text-red-600' 
                                  : isExpiringSoon 
                                    ? 'text-orange-600' 
                                    : 'text-green-600'
                              }`}>
                                📅 Expire: {expDate.toLocaleDateString('fr-FR')}
                                {isExpired && ' ⛔ EXPIRÉ'}
                                {isExpiringSoon && !isExpired && ` ⚠️ ${daysUntilExp}${t('daysRemaining')}`}
                                {!isExpired && !isExpiringSoon && ` ✓ ${daysUntilExp}${t('daysRemaining')}`}
                              </div>
                            </div>
                          </div>
                          <div className={`text-xs px-2 py-1 rounded ${
                            isExpired 
                              ? 'bg-red-200 text-red-800' 
                              : isExpiringSoon 
                                ? 'bg-orange-200 text-orange-800' 
                                : 'bg-green-200 text-green-800'
                          }`}>
                            {isExpired ? t('expired') : isExpiringSoon ? t('expiringSoon') : t('valid')}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
                
                <Button
                  onClick={handleRequestPickingConfirm}
                  className="w-full bg-purple-600 hover:bg-purple-700"
                  disabled={selectedRequestBatches.length === 0}
                >
                  {t('requestPicking')} ({selectedRequestBatches.length} {t('products')})
                </Button>
              </div>
            )}
            
            {requestStep === 3 && selectedRequest && (
              <div className="space-y-6">
                <div className="bg-purple-50 p-4 rounded-lg border-l-4 border-purple-600">
                  <h3 className="font-bold text-purple-900 text-lg">{t('pickingConfirmation')}</h3>
                  <p className="text-purple-700 mt-1">{t('requestNumber')} {selectedRequest.request_number} - {selectedRequest.intervention}</p>
                </div>
                
                <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-4">
                  <Label className="text-lg font-bold text-yellow-900 flex items-center gap-2">
                    <User size={20} />
                    {t('patientNumberRequired')}
                  </Label>
                  <Input
                    placeholder={t('enterPatientNumber')}
                    className="text-xl py-4 mt-2 border-2 border-yellow-500"
                    value={requestPatientNumber}
                    onChange={(e) => setRequestPatientNumber(e.target.value)}
                    autoFocus
                  />
                </div>
                
                <div className="border rounded-lg p-4 bg-gray-50">
                  <h4 className="font-bold text-gray-900 mb-3 flex items-center gap-2">
                    📦 {t('selectedArticles')} ({selectedRequestBatches.length})
                  </h4>
                  <div className="space-y-2">
                    {requestBatches.filter(b => selectedRequestBatches.includes(b.id)).map((batch) => {
                      const daysUntilExp = getDaysUntilExpiration(batch.date_expiration);
                      const isExpired = daysUntilExp <= 0;
                      const isExpiringSoon = daysUntilExp > 0 && daysUntilExp <= 30;
                      const expDate = new Date(batch.date_expiration);
                      
                      return (
                        <div 
                          key={batch.id} 
                          className={`p-3 rounded-lg border-2 ${
                            isExpired 
                              ? 'bg-red-50 border-red-300' 
                              : isExpiringSoon
                                ? 'bg-orange-50 border-orange-300'
                                : 'bg-white border-gray-200'
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center ${
                              isExpired 
                                ? 'border-red-500 bg-red-500 text-white'
                                : 'border-green-500 bg-green-500 text-white'
                            }`}>
                              {isExpired ? '⚠' : '✓'}
                            </div>
                            <div className="flex-1">
                              <p className={`font-bold ${isExpired ? 'text-red-900' : 'text-gray-900'}`}>
                                {batch.product_name}
                              </p>
                              <div className="flex items-center gap-2 text-sm text-gray-600">
                                <span className="font-medium">📍 {batch.localisation}</span>
                                <span>• N° {batch.numero_serie || '-'}</span>
                              </div>
                              <div className={`text-sm mt-1 font-medium ${
                                isExpired 
                                  ? 'text-red-600' 
                                  : isExpiringSoon 
                                    ? 'text-orange-600' 
                                    : 'text-green-600'
                              }`}>
                                📅 Expire: {expDate.toLocaleDateString('fr-FR')}
                                {isExpired && ` ⛔ ${t('expired').toUpperCase()}`}
                                {isExpiringSoon && !isExpired && ` ⚠️ ${daysUntilExp}${t('daysRemaining')}`}
                                {!isExpired && !isExpiringSoon && ` ✓ ${daysUntilExp}${t('daysRemaining')}`}
                              </div>
                            </div>
                            <div className={`text-xs px-2 py-1 rounded ${
                              isExpired 
                                ? 'bg-red-200 text-red-800' 
                                : isExpiringSoon 
                                  ? 'bg-orange-200 text-orange-800' 
                                  : 'bg-green-200 text-green-800'
                            }`}>
                              {isExpired ? t('expired') : isExpiringSoon ? t('expiringSoon') : t('valid')}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
                
                <div className="flex gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setRequestStep(2)}
                    className="flex-1"
                  >
                    ← {t('back')}
                  </Button>
                  <Button
                    onClick={handleFinalRequestConfirm}
                    className="flex-1 bg-green-600 hover:bg-green-700"
                    disabled={!requestPatientNumber.trim()}
                  >
                    ✓ {t('confirmPickingBtn')}
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
        )
      ) : step === 2 && pickingList ? (
        <div className="space-y-6 max-w-7xl mx-auto">
          <div className="card bg-gradient-to-br from-blue-50 to-indigo-50 border-2 border-blue-200">
            <div className="flex items-center justify-between">
              <div className="flex items-start gap-4">
                <div className="bg-blue-600 text-white p-4 rounded-lg">
                  <Package size={32} />
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl font-bold text-gray-900 mb-2" style={{ fontFamily: 'Space Grotesk' }}>
                    {t('patientValidation')}
                  </h2>
                  <p className="text-gray-600">{pickingList.picking_list.length} {t('products')}</p>
                </div>
              </div>
              <Button onClick={cancelPicking} variant="outline" className="text-red-600">
                ✕ {t('cancelPicking')}
              </Button>
            </div>
          </div>

          {/* MRN Patient */}
          <div className="card bg-yellow-50 border-2 border-yellow-400">
            <h2 className="text-2xl font-bold text-gray-900 mb-4 flex items-center gap-2">
              📋 {t('patientNumber')}
            </h2>
            <div className="flex gap-4 items-end">
              <div className="flex-1">
                <Label className="text-lg font-medium">MRN *</Label>
                <Input
                  placeholder="Entrez le MRN"
                  className="text-2xl py-6 border-2 border-yellow-600"
                  value={patientNumber}
                  onChange={(e) => setPatientNumber(e.target.value)}
                  data-testid="picking-patient-input"
                  autoFocus
                  required
                />
              </div>
            </div>
          </div>

          {/* Liste de collecte */}
          <div className="card">
            <h2 className="text-xl font-bold text-gray-900 mb-4" style={{ fontFamily: 'Space Grotesk' }}>
              Liste de collecte ({pickingList.picking_list.length} unité{pickingList.picking_list.length > 1 ? 's' : ''})
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              Prélevez les produits dans l'ordre indiqué (trié par date d'expiration - FIFO)
            </p>
            <div className="space-y-4">
              {pickingList.picking_list.map((item, index) => {
                const daysUntilExp = item.days_until_expiration !== undefined 
                  ? item.days_until_expiration 
                  : getDaysUntilExpiration(item.expiration_date);
                const expDate = new Date(item.expiration_date);
                const isExpired = daysUntilExp <= 0;
                const isExpiringSoon = daysUntilExp > 0 && daysUntilExp <= 30;
                
                // Determine card style based on expiration
                let cardStyle = 'border-blue-200 bg-blue-50';
                let iconBgStyle = 'bg-blue-600';
                let iconColor = 'text-blue-600';
                
                if (isExpired) {
                  cardStyle = 'border-red-400 bg-red-50';
                  iconBgStyle = 'bg-red-600';
                  iconColor = 'text-red-600';
                } else if (isExpiringSoon || item.hasCloserExpiration) {
                  cardStyle = 'border-orange-400 bg-orange-50';
                  iconBgStyle = 'bg-orange-600';
                  iconColor = 'text-orange-600';
                }
                
                return (
                  <div
                    key={item.batch_id}
                    data-testid="picking-item"
                    className={`border-2 rounded-lg p-4 ${cardStyle}`}
                  >
                    {/* Expired product warning banner */}
                    {isExpired && (
                      <div className="mb-3 p-3 bg-red-200 border-l-4 border-red-600 rounded flex items-center gap-2">
                        <AlertTriangle className="text-red-600" size={24} />
                        <div>
                          <p className="font-bold text-red-800">⛔ PRODUIT EXPIRÉ</p>
                          <p className="text-sm text-red-700">Ce produit nécessite l'approbation d'un gestionnaire</p>
                        </div>
                      </div>
                    )}
                    
                    {/* Header with product name if available */}
                    {item.productName && (
                      <div className={`mb-2 pb-2 border-b ${isExpired ? 'border-red-300' : isExpiringSoon ? 'border-orange-300' : 'border-gray-300'}`}>
                        <p className={`font-bold ${isExpired ? 'text-red-900' : 'text-gray-900'}`}>{item.productName}</p>
                      </div>
                    )}
                    
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-4">
                        <div className={`${iconBgStyle} text-white w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg`}>
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <MapPin size={18} className={iconColor} />
                            <span className={`text-2xl font-bold ${iconColor}`}>{item.location}</span>
                          </div>
                          <p className="text-sm text-gray-600">N° Série: <span className="font-medium font-mono">{item.numero_serie}</span></p>
                          
                          {/* Date d'expiration - Plus visible */}
                          <div className={`mt-2 p-2 rounded border ${isExpired ? 'bg-red-100 border-red-400' : 'bg-white border-gray-300'}`}>
                            <div className="flex items-center gap-2">
                              <Calendar size={18} className={isExpired ? 'text-red-600' : daysUntilExp <= 30 ? 'text-orange-600' : 'text-green-600'} />
                              <span className={`text-base font-bold ${isExpired ? 'text-red-700' : ''}`}>
                                📅 Expire le: {expDate.toLocaleDateString('fr-FR')}
                              </span>
                              {isExpired ? (
                                <span className="badge bg-red-200 text-red-800 ml-2 font-bold">
                                  ⛔ EXPIRÉ ({Math.abs(daysUntilExp)} jour{Math.abs(daysUntilExp) > 1 ? 's' : ''})
                                </span>
                              ) : daysUntilExp <= 30 ? (
                                <span className={`badge ${daysUntilExp <= 10 ? 'bg-red-100 text-red-800' : 'badge-warning'} ml-2`}>
                                  {daysUntilExp} jour{daysUntilExp > 1 ? 's' : ''} restant{daysUntilExp > 1 ? 's' : ''}
                                </span>
                              ) : null}
                            </div>
                          </div>
                          
                          {/* Alerte si date plus proche disponible */}
                          {item.hasCloserExpiration && item.closerBatch && (
                            <div className="mt-3 p-3 bg-orange-100 border-l-4 border-orange-600 rounded">
                              <p className="text-sm font-bold text-orange-900 flex items-center gap-2">
                                ⚠️ ATTENTION : Date d'expiration plus proche disponible !
                              </p>
                              <p className="text-sm text-orange-800 mt-1">
                                📍 Emplacement: <span className="font-bold font-mono">{item.closerBatch.location}</span>
                              </p>
                              <p className="text-sm text-orange-800">
                                📅 Expire le: <span className="font-bold">{new Date(item.closerBatch.expiration).toLocaleDateString('fr-FR')}</span>
                              </p>
                              <p className="text-xs text-orange-700 mt-2 italic">
                                Recommandation FIFO : Prélever d'abord le produit à cet emplacement
                              </p>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <Button
              onClick={async () => {
                if (!patientNumber.trim()) {
                  toast.error(t('patientNumber'));
                  return;
                }
                
                // Check for expired items
                const expiredItems = pickingList.picking_list.filter(item => {
                  const daysUntil = item.days_until_expiration !== undefined 
                    ? item.days_until_expiration 
                    : getDaysUntilExpiration(item.expiration_date);
                  return daysUntil <= 0;
                });
                
                if (expiredItems.length > 0) {
                  // Store expired items and open manager approval modal
                  setExpiredItemsInList(expiredItems);
                  setManagerApprovalModalOpen(true);
                  return;
                }
                
                // No expired items, proceed with confirmation
                await confirmPicking();
              }}
              className="w-full mt-6 bg-green-600 hover:bg-green-700 text-lg py-6"
              data-testid="confirm-picking-button"
            >
              ✓ {t('confirmPicking')}
            </Button>
          </div>

          <Button
            onClick={resetForm}
            variant="outline"
            className="w-full mt-6"
            data-testid="new-picking-button"
          >
            {t('newPicking')}
          </Button>
        </div>
      ) : null}

      {/* Manager Approval Modal for Expired Products */}
      <Dialog open={managerApprovalModalOpen} onOpenChange={(open) => {
        setManagerApprovalModalOpen(open);
        if (!open) {
          setManagerPin('');
        }
      }}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2 text-red-600">
              <AlertTriangle size={28} />
              {t('expiredProductsApproval')}
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Warning message */}
            <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
              <p className="font-bold text-red-900 mb-2">
                ⛔ {expiredItemsInList.length} {t('expiredProductsInList')}
              </p>
              <p className="text-sm text-red-800">
                {t('expiredPickingWarning')}
              </p>
            </div>
            
            {/* Manager PIN input */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-300">
              <div className="flex items-center gap-2 mb-3">
                <ShieldCheck className="text-yellow-600" size={24} />
                <Label className="text-lg font-bold text-yellow-800">{t('managerCode')}</Label>
              </div>
              <Input
                type="password"
                placeholder={t('enterManagerPin')}
                value={managerPin}
                onChange={(e) => setManagerPin(e.target.value)}
                className="text-xl py-6 text-center tracking-widest"
                maxLength={10}
                autoFocus
              />
              <p className="text-xs text-yellow-700 mt-2">
                💡 {t('pinTraceability')}
              </p>
            </div>
            
            {/* Action buttons */}
            <div className="flex gap-3">
              <Button
                variant="outline"
                onClick={() => {
                  setManagerApprovalModalOpen(false);
                  setManagerPin('');
                }}
                className="flex-1"
                disabled={managerApprovalLoading}
              >
                {t('cancel')}
              </Button>
              <Button
                onClick={async () => {
                  if (!managerPin.trim()) {
                    toast.error(t('enterManagerPin'));
                    return;
                  }
                  
                  setManagerApprovalLoading(true);
                  try {
                    // Verify manager PIN
                    const verifyResponse = await api.post('/picking/verify-manager-pin', {
                      pin: managerPin
                    });
                    
                    if (!verifyResponse.data.valid) {
                      toast.error(`❌ ${t('invalidManagerCode')}`);
                      setManagerApprovalLoading(false);
                      return;
                    }
                    
                    const managerName = verifyResponse.data.manager_name;
                    
                    // Proceed with confirmation including manager approval
                    await confirmPicking(managerPin, managerName);
                    
                    setManagerApprovalModalOpen(false);
                    setManagerPin('');
                    toast.success(`✅ ${t('pickingApprovedBy')} ${managerName}`);
                  } catch (error) {
                    toast.error(error.response?.data?.detail || 'Erreur de vérification');
                  } finally {
                    setManagerApprovalLoading(false);
                  }
                }}
                className="flex-1 bg-red-600 hover:bg-red-700"
                disabled={managerApprovalLoading || !managerPin.trim()}
              >
                {managerApprovalLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                    {t('loading')}
                  </span>
                ) : (
                  <>
                    <ShieldCheck size={20} className="mr-2" />
                    {t('approvePicking')}
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Modal de remplacement pour scanner le produit recommandé */}
      <Dialog open={replacementModalOpen} onOpenChange={setReplacementModalOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="text-2xl">🔄 Scanner le produit recommandé</DialogTitle>
          </DialogHeader>
          
          {replacingItemIndex !== null && scannedItems[replacingItemIndex] && (
            <div className="space-y-4">
              {/* Info produit à remplacer */}
              <div className="bg-red-50 p-4 rounded-lg border-l-4 border-red-500">
                <p className="text-sm font-bold text-red-900 mb-2">❌ Produit actuel (sera retiré) :</p>
                <p className="text-sm text-red-800">
                  {scannedItems[replacingItemIndex].product.nom}
                </p>
                <p className="text-xs text-red-700 mt-1">
                  📍 {scannedItems[replacingItemIndex].batch.localisation} • 
                  📅 Expire: {new Date(scannedItems[replacingItemIndex].batch.date_expiration).toLocaleDateString('fr-FR')}
                </p>
              </div>

              {/* Info produit recommandé */}
              {scannedItems[replacingItemIndex].closerBatch && (
                <div className="bg-green-50 p-4 rounded-lg border-l-4 border-green-500">
                  <p className="text-sm font-bold text-green-900 mb-2">✅ Produit recommandé (FIFO) :</p>
                  <p className="text-base text-green-800 font-bold">
                    📍 {scannedItems[replacingItemIndex].closerBatch.location}
                  </p>
                  <p className="text-sm text-green-700 mt-1">
                    📅 Expire: {new Date(scannedItems[replacingItemIndex].closerBatch.expiration).toLocaleDateString('fr-FR')} • 
                    🔖 {scannedItems[replacingItemIndex].closerBatch.numero_serie}
                  </p>
                </div>
              )}

              {/* Champ de scan */}
              <form onSubmit={handleReplacementScan} className="space-y-4">
                <div>
                  <Label className="text-lg font-medium">Scanner le produit recommandé</Label>
                  <Input
                    type="text"
                    placeholder="Scanner ou saisir le code"
                    value={replacementScanCode}
                    onChange={(e) => setReplacementScanCode(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        handleReplacementScan(e);
                      }
                    }}
                    className="text-lg py-6 mt-2"
                    autoFocus
                  />
                  <p className="text-xs text-gray-600 mt-2">
                    💡 Scannez le produit à l'emplacement indiqué ci-dessus
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    onClick={() => setReplacementModalOpen(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-green-600 hover:bg-green-700"
                  >
                    ✓ Confirmer le remplacement
                  </Button>
                </div>
              </form>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Picking;