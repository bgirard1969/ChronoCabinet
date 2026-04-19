import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Plus, Package, Truck, CheckCircle, Clock, MapPin, Lock, ShoppingCart, RefreshCw, CalendarIcon, Upload, FileSpreadsheet, X, AlertTriangle, Ban } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { useUser } from '@/contexts/UserContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { format } from 'date-fns';
import { fr } from 'date-fns/locale';

const PurchaseOrders = () => {
  const { permissions } = useUser();
  const { t } = useLanguage();
  const [purchaseOrders, setPurchaseOrders] = useState([]);
  const [products, setProducts] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedPO, setSelectedPO] = useState(null);
  const [receivingDialogOpen, setReceivingDialogOpen] = useState(false);
  
  // New state for replenishment order dialog
  const [reapproDialogOpen, setReapproDialogOpen] = useState(false);
  const [reapproData, setReapproData] = useState(null);
  const [reapproLoading, setReapproLoading] = useState(false);
  const [selectedReapproProducts, setSelectedReapproProducts] = useState([]);
  const [reapproQuantities, setReapproQuantities] = useState({});
  const [reapproFormData, setReapproFormData] = useState({
    po_number: '',
    supplier: '',
    expected_delivery: null, // Changed to Date object
  });
  const [reapproCalendarOpen, setReapproCalendarOpen] = useState(false);
  
  const [formData, setFormData] = useState({
    po_number: '',
    supplier: '',
    expected_delivery: '',
    items: [],
  });
  const [currentItem, setCurrentItem] = useState({
    product_id: '',
    quantite: 1,
  });

  // CSV Import states
  const csvInputRef = useRef(null);
  const [csvDialogOpen, setCsvDialogOpen] = useState(false);
  const [csvData, setCsvData] = useState([]);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvFormData, setCsvFormData] = useState({
    po_number: '',
    supplier: '',
    expected_delivery: '',
  });
  const [csvImportLoading, setCsvImportLoading] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [posRes, productsRes, suppliersRes] = await Promise.all([
        api.get('/purchase-orders'),
        api.get('/products'),
        api.get('/fabricants'),
      ]);
      setPurchaseOrders(posRes.data);
      setProducts(productsRes.data);
      setSuppliers(suppliersRes.data);
    } catch (error) {
      toast.error('Erreur lors du chargement des données');
    } finally {
      setLoading(false);
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

  const handleDateInput = (e) => {
    const masked = maskDateDMY(e.target.value);
    setFormData({ ...formData, expected_delivery: masked });
  };

  const isFullDateDMY = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s || '');
  
  const dmyToISO = (s) => {
    const [dd, mm, yyyy] = (s || '').split('/');
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00`).toISOString();
  };

  // ============================================
  // CSV Import Functions
  // ============================================
  
  const handleCsvFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.name.endsWith('.csv')) {
      toast.error('Veuillez sélectionner un fichier CSV');
      return;
    }
    
    const reader = new FileReader();
    reader.onload = async (event) => {
      const text = event.target.result;
      await parseCsvData(text);
    };
    reader.readAsText(file, 'UTF-8');
  };
  
  const parseCsvData = async (text) => {
    const lines = text.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
      toast.error('Le fichier CSV est vide ou invalide');
      return;
    }
    
    // Remove BOM if present
    let headerLine = lines[0];
    if (headerLine.charCodeAt(0) === 0xFEFF) {
      headerLine = headerLine.slice(1);
    }
    
    // Parse header - new format:
    // Code produit, Description produit, Fournisseur, Code GRM, N° Lot, N° de série, Code-barres, Date de fabrication, Date d'expiration
    const header = headerLine.split(',').map(h => h.trim());
    
    // Parse rows
    const rows = [];
    const errors = [];
    const serialsInCsv = new Set(); // Track serials within the CSV file
    
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim());
      if (values.length < 9) {
        errors.push(`Ligne ${i + 1}: nombre de colonnes insuffisant (${values.length}/9)`);
        continue;
      }
      
      const row = {
        lineNumber: i + 1,
        product_code: values[0] || '',
        product_description: values[1] || '',
        supplier: values[2] || '',
        code_grm: values[3] || '',
        numero_lot: values[4] || '',
        numero_serie: values[5] || '',
        code_barre: values[6] || '',
        date_fabrication: values[7] || '',
        date_expiration: values[8] || '',
        isValid: true,
        error: null,
        matched_product: null,
      };
      
      // Try to match product by reference (trim whitespace and tabs)
      const normalizeRef = (s) => (s || '').trim().replace(/\t/g, '');
      const matchedProduct = products.find(p => 
        normalizeRef(p.reference) === normalizeRef(row.product_code) || 
        normalizeRef(p.nom) === normalizeRef(row.product_description)
      );
      
      if (matchedProduct) {
        row.matched_product = matchedProduct;
      }
      
      // Check for duplicate serial within CSV
      if (row.numero_serie && serialsInCsv.has(row.numero_serie)) {
        row.isValid = false;
        row.error = 'N° série en double dans le CSV';
      } else if (row.numero_serie) {
        serialsInCsv.add(row.numero_serie);
      }
      
      // Validate required fields (only if not already invalid)
      if (row.isValid) {
        if (!row.product_code && !row.product_description) {
          row.isValid = false;
          row.error = 'Produit requis';
        } else if (!row.supplier) {
          row.isValid = false;
          row.error = 'Fournisseur requis';
        } else if (!row.numero_serie) {
          row.isValid = false;
          row.error = 'N° de série requis';
        } else if (!row.date_expiration || !isFullDateDMY(row.date_expiration)) {
          row.isValid = false;
          row.error = 'Date d\'expiration invalide';
        } else if (!matchedProduct) {
          row.isValid = false;
          row.error = 'Produit non trouvé';
        }
      }
      
      rows.push(row);
    }
    
    // Check for duplicates in database
    try {
      const serialsToCheck = rows.filter(r => r.numero_serie).map(r => r.numero_serie);
      if (serialsToCheck.length > 0) {
        const batchesRes = await api.get('/batches');
        const existingSerials = new Set((batchesRes.data || []).map(b => b.numero_serie).filter(Boolean));
        
        // Mark rows with existing serials as invalid
        for (const row of rows) {
          if (row.isValid && row.numero_serie && existingSerials.has(row.numero_serie)) {
            row.isValid = false;
            row.error = 'N° série existe déjà';
          }
        }
      }
    } catch (err) {
      console.error('Error checking existing serials:', err);
    }
    
    // Extract unique supplier from CSV (should be one per file typically)
    const uniqueSuppliers = [...new Set(rows.map(r => r.supplier).filter(Boolean))];
    if (uniqueSuppliers.length === 1) {
      setCsvFormData(prev => ({ ...prev, supplier: uniqueSuppliers[0] }));
    }
    
    setCsvData(rows);
    setCsvErrors(errors);
    setCsvDialogOpen(true);
    
    // Reset file input
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
    
    toast.success(`${rows.length} lignes chargées depuis le CSV`);
  };
  
  const handleCsvImport = async () => {
    if (!csvFormData.expected_delivery) {
      toast.error('Veuillez saisir la date de livraison prévue');
      return;
    }
    
    if (!isFullDateDMY(csvFormData.expected_delivery)) {
      toast.error('Date de livraison invalide. Format: jj/mm/aaaa');
      return;
    }
    
    const validRows = csvData.filter(r => r.isValid);
    if (validRows.length === 0) {
      toast.error('Aucune ligne valide à importer');
      return;
    }
    
    setCsvImportLoading(true);
    
    try {
      // Group valid rows by product
      const productGroups = {};
      for (const row of validRows) {
        const productId = row.matched_product?.id;
        if (!productGroups[productId]) {
          productGroups[productId] = {
            product: row.matched_product,
            rows: []
          };
        }
        productGroups[productId].rows.push(row);
      }
      
      // Get supplier from first valid row (all should have same supplier)
      const supplier = validRows[0]?.supplier || csvFormData.supplier;
      
      // Build items array for PO
      const items = Object.values(productGroups).map(group => ({
        product_id: group.product.id,
        product_name: group.product.nom,
        reference: group.product.reference,
        quantite: group.rows.length,
        quantite_recue: 0,
      }));
      
      // 1. Create the PO
      const poPayload = {
        po_number: csvFormData.po_number || `CSV-${Date.now()}`,
        supplier: supplier,
        expected_delivery: dmyToISO(csvFormData.expected_delivery),
        items: items,
      };
      
      const poResponse = await api.post('/purchase-orders', poPayload);
      const poId = poResponse.data.id;
      
      // 2. Receive each item from CSV
      let successCount = 0;
      let errorCount = 0;
      
      for (const row of validRows) {
        try {
          const receivePayload = {
            product_id: row.matched_product.id,
            numero_lot: row.numero_lot || null,
            numero_serie: row.numero_serie,
            date_fabrication: row.date_fabrication && isFullDateDMY(row.date_fabrication) ? dmyToISO(row.date_fabrication) : null,
            date_expiration: dmyToISO(row.date_expiration),
            code_barre: row.code_barre || null,
          };
          
          await api.post(`/purchase-orders/${poId}/receive-item`, receivePayload);
          successCount++;
        } catch (err) {
          errorCount++;
          console.error(`Error receiving item ${row.numero_serie}:`, err);
        }
      }
      
      toast.success(`Import terminé: ${successCount} produits reçus, ${errorCount} erreurs`);
      setCsvDialogOpen(false);
      setCsvData([]);
      setCsvFormData({ po_number: '', supplier: '', expected_delivery: '' });
      fetchData();
      
    } catch (error) {
      let errorMessage = 'Erreur lors de l\'import CSV';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        errorMessage = typeof detail === 'string' ? detail : JSON.stringify(detail);
      }
      toast.error(errorMessage);
    } finally {
      setCsvImportLoading(false);
    }
  };

  // Filter products by selected supplier
  const filteredProducts = formData.supplier 
    ? products.filter(p => p.fabricant === formData.supplier)
    : products;

  const addItemToOrder = () => {
    if (!currentItem.product_id || currentItem.quantite < 1) {
      toast.error('Veuillez sélectionner un produit et une quantité');
      return;
    }

    const product = products.find(p => p.id === currentItem.product_id);
    const newItem = {
      product_id: currentItem.product_id,
      product_name: product.nom,
      reference: product.reference,
      quantite: parseInt(currentItem.quantite),
      quantite_recue: 0,
    };

    setFormData({
      ...formData,
      items: [...formData.items, newItem],
    });

    setCurrentItem({ product_id: '', quantite: 1 });
  };

  const removeItem = (index) => {
    setFormData({
      ...formData,
      items: formData.items.filter((_, i) => i !== index),
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (formData.items.length === 0) {
      toast.error('Ajoutez au moins un produit à la commande');
      return;
    }
    
    if (!isFullDateDMY(formData.expected_delivery)) {
      toast.error('Date invalide. Format attendu: jj/mm/aaaa');
      return;
    }

    try {
      const submitData = {
        ...formData,
        expected_delivery: dmyToISO(formData.expected_delivery),
      };
      await api.post('/purchase-orders', submitData);
      toast.success('Commande créée avec succès');
      setDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création');
    }
  };

  const resetForm = () => {
    setFormData({
      po_number: '',
      supplier: '',
      expected_delivery: '',
      items: [],
    });
    setCurrentItem({ product_id: '', quantite: 1 });
  };

  // Generate PO number with date/time format like "20260107_2100"
  const generatePONumber = () => {
    const now = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}_${pad(now.getHours())}${pad(now.getMinutes())}`;
  };

  // Fetch replenishment data and open dialog
  const openReapproDialog = async () => {
    setReapproLoading(true);
    try {
      const response = await api.get('/replenishment/check');
      setReapproData(response.data);
      
      // Pre-select only products that still need ordering (quantite_a_commander > 0)
      const productsToOrder = response.data.orders.filter(o => o.quantite_a_commander > 0);
      const productIdsToOrder = productsToOrder.map(o => o.product_id);
      setSelectedReapproProducts(productIdsToOrder);
      
      const initialQuantities = {};
      response.data.orders.forEach(order => {
        // Set quantity to order (or 1 if already fully ordered)
        initialQuantities[order.product_id] = order.quantite_a_commander || 1;
      });
      setReapproQuantities(initialQuantities);
      
      // Generate PO number
      setReapproFormData({
        po_number: generatePONumber(),
        supplier: '',
        expected_delivery: null,
      });
      
      setReapproDialogOpen(true);
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la récupération des produits à réapprovisionner');
    } finally {
      setReapproLoading(false);
    }
  };

  // Filter products by selected supplier
  const filteredReapproOrders = reapproData?.orders?.filter(order => {
    if (!reapproFormData.supplier) return true; // Show all if no supplier selected
    return order.fabricant === reapproFormData.supplier;
  }) || [];

  // Handle supplier change - update selection to only include filtered products
  const handleReapproSupplierChange = (value) => {
    setReapproFormData({ ...reapproFormData, supplier: value });
    
    // Update selection to only include products from this supplier that still need ordering
    if (value && reapproData?.orders) {
      const filteredProductIds = reapproData.orders
        .filter(o => o.fabricant === value && o.quantite_a_commander > 0)
        .map(o => o.product_id);
      setSelectedReapproProducts(filteredProductIds);
    } else {
      // If no supplier selected, select all products that still need ordering
      setSelectedReapproProducts(
        reapproData?.orders?.filter(o => o.quantite_a_commander > 0).map(o => o.product_id) || []
      );
    }
  };

  const toggleReapproProductSelection = (productId) => {
    setSelectedReapproProducts(prev => 
      prev.includes(productId) 
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const toggleSelectAllReappro = () => {
    const currentFilteredIds = filteredReapproOrders.map(o => o.product_id);
    const allSelected = currentFilteredIds.every(id => selectedReapproProducts.includes(id));
    
    if (allSelected) {
      // Deselect all filtered products
      setSelectedReapproProducts(prev => prev.filter(id => !currentFilteredIds.includes(id)));
    } else {
      // Select all filtered products
      setSelectedReapproProducts(prev => [...new Set([...prev, ...currentFilteredIds])]);
    }
  };

  const handleReapproQuantityChange = (productId, value) => {
    const numValue = parseInt(value) || 0;
    setReapproQuantities(prev => ({
      ...prev,
      [productId]: numValue
    }));
  };

  const handleReapproSubmit = async (e) => {
    e.preventDefault();
    
    if (selectedReapproProducts.length === 0) {
      toast.error('Veuillez sélectionner au moins un produit');
      return;
    }
    
    if (!reapproFormData.supplier) {
      toast.error('Veuillez sélectionner un fournisseur');
      return;
    }
    
    if (!reapproFormData.expected_delivery) {
      toast.error('Veuillez sélectionner une date de livraison');
      return;
    }

    // Build items from selected products
    const items = selectedReapproProducts.map(productId => {
      const order = reapproData.orders.find(o => o.product_id === productId);
      return {
        product_id: productId,
        product_name: order.nom,
        reference: order.reference,
        quantite: reapproQuantities[productId] || 1,
        quantite_recue: 0,
      };
    });

    try {
      await api.post('/purchase-orders', {
        po_number: reapproFormData.po_number,
        supplier: reapproFormData.supplier,
        expected_delivery: reapproFormData.expected_delivery.toISOString(),
        items: items,
      });
      
      // Mark products as pending replenishment
      await api.post('/replenishment/pending', {
        items: selectedReapproProducts.map(pid => {
          const order = reapproData.orders.find(o => o.product_id === pid);
          return {
            product_id: pid,
            qty: reapproQuantities[pid] || 1,
            nom: order?.nom || '',
            reference: order?.reference || '',
            fabricant: order?.fabricant || ''
          };
        }),
        log_movement: true
      });
      
      toast.success('Commande de réapprovisionnement créée avec succès');
      setReapproDialogOpen(false);
      setReapproData(null);
      setSelectedReapproProducts([]);
      setReapproQuantities({});
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de la création de la commande');
    }
  };

  const handleViewPO = (po) => {
    setSelectedPO(po);
    setReceivingDialogOpen(true);
  };

  // Cancel PO state and handler
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [poToCancel, setPoToCancel] = useState(null);
  const [cancelLoading, setCancelLoading] = useState(false);

  const handleCancelClick = (po) => {
    setPoToCancel(po);
    setCancelDialogOpen(true);
  };

  const handleCancelConfirm = async () => {
    if (!poToCancel) return;
    
    setCancelLoading(true);
    try {
      const response = await api.post(`/purchase-orders/${poToCancel.id}/cancel`);
      toast.success(response.data.message || 'Commande annulée');
      setCancelDialogOpen(false);
      setPoToCancel(null);
      fetchData();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Erreur lors de l\'annulation');
    } finally {
      setCancelLoading(false);
    }
  };

  const getStatusBadge = (statut) => {
    const badges = {
      en_attente: { class: 'badge-warning', labelKey: 'pending' },
      recu_partiel: { class: 'badge-info', labelKey: 'partialReceived' },
      recu_complet: { class: 'badge-success', labelKey: 'fullReceived' },
      annule: { class: 'bg-red-100 text-red-800', label: 'Annulée' },
    };
    const badge = badges[statut] || badges.en_attente;
    return <span className={`badge ${badge.class}`}>{badge.label || t(badge.labelKey)}</span>;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-8" data-testid="purchase-orders-page">
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
            {t('ordersTitle')}
          </h1>
          <p className="text-gray-600">{t('ordersDescription')}</p>
        </div>
        {permissions.canCreate && (
          <div className="flex gap-3">
            {/* Bouton Commande Réappro */}
            <Button 
              onClick={openReapproDialog}
              disabled={reapproLoading}
              className="bg-purple-600 hover:bg-purple-700"
            >
              {reapproLoading ? (
                <RefreshCw size={20} className="mr-2 animate-spin" />
              ) : (
                <ShoppingCart size={20} className="mr-2" />
              )}
              Commande Réappro
            </Button>
            
            {/* Bouton Import CSV */}
            <div>
              <input
                type="file"
                ref={csvInputRef}
                accept=".csv"
                className="hidden"
                onChange={handleCsvFileSelect}
              />
              <Button 
                variant="outline"
                onClick={() => csvInputRef.current?.click()}
                className="border-green-500 text-green-600 hover:bg-green-50"
              >
                <FileSpreadsheet size={20} className="mr-2" />
                CSV
              </Button>
            </div>
            
            {/* Bouton Nouvelle Commande */}
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button data-testid="add-po-button" className="bg-blue-600 hover:bg-blue-700">
                  <Plus size={20} className="mr-2" />
                  {t('newOrder')}
                </Button>
              </DialogTrigger>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{t('newOrder')}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>{t('orderNumber')}</Label>
                    <Input
                      data-testid="po-number-input"
                      value={formData.po_number}
                      onChange={(e) => setFormData({ ...formData, po_number: e.target.value })}
                      required
                    />
                  </div>
                  <div>
                    <Label>{t('supplier')}</Label>
                    <Select 
                      value={formData.supplier} 
                      onValueChange={(value) => {
                        setFormData({ ...formData, supplier: value });
                        // Reset current item when supplier changes
                        setCurrentItem({ product_id: '', quantite: 1 });
                      }}
                    >
                      <SelectTrigger data-testid="supplier-select">
                        <SelectValue placeholder={t('selectSupplier') || 'Sélectionner un fournisseur'} />
                      </SelectTrigger>
                      <SelectContent>
                        {suppliers.map((supplier) => (
                          <SelectItem key={supplier.id} value={supplier.nom}>
                            {supplier.nom}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div>
                  <Label>{t('expectedDelivery')}</Label>
                  <Input
                    type="text"
                    data-testid="expected-delivery-input"
                    value={formData.expected_delivery}
                    onChange={handleDateInput}
                    placeholder="jj/mm/aaaa"
                    inputMode="numeric"
                    maxLength={10}
                    required
                  />
                </div>

              <div className="border-t pt-4">
                <h3 className="font-bold text-gray-900 mb-4">{t('products')}</h3>
                <div className="grid grid-cols-3 gap-3 mb-3">
                  <div className="col-span-2">
                    <Select value={currentItem.product_id} onValueChange={(value) => setCurrentItem({ ...currentItem, product_id: value })}>
                      <SelectTrigger>
                        <SelectValue placeholder={t('selectProduct')} />
                      </SelectTrigger>
                      <SelectContent>
                        {filteredProducts.map((product) => (
                          <SelectItem key={product.id} value={product.id}>
                            {product.nom} - {product.reference}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      min="1"
                      value={currentItem.quantite}
                      onChange={(e) => setCurrentItem({ ...currentItem, quantite: e.target.value })}
                      placeholder={t('qty')}
                    />
                    <Button type="button" onClick={addItemToOrder}>
                      <Plus size={16} />
                    </Button>
                  </div>
                </div>

                {formData.items.length > 0 && (
                  <div className="bg-gray-50 rounded-lg p-4">
                    {formData.items.map((item, index) => (
                      <div key={index} className="flex items-center justify-between py-2 border-b last:border-b-0">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm text-gray-600">{t('reference')}: {item.reference}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-medium">{item.quantite} {t('units')}</span>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => removeItem(index)}
                            className="text-red-600 hover:text-red-700"
                          >
                            {t('delete')}
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <Button type="submit" className="w-full">
                {t('create')}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
        
        {/* Dialog Commande Réappro */}
        <Dialog open={reapproDialogOpen} onOpenChange={(open) => {
          setReapproDialogOpen(open);
          if (!open) {
            setReapproData(null);
            setSelectedReapproProducts([]);
            setReapproQuantities({});
          }
        }}>
          <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ShoppingCart size={24} className="text-purple-600" />
                Commande Réapprovisionnement
              </DialogTitle>
            </DialogHeader>
            
            {reapproData && (
              <form onSubmit={handleReapproSubmit} className="space-y-4">
                {/* Header with PO info */}
                <div className="grid grid-cols-3 gap-4 p-4 bg-purple-50 rounded-lg">
                  <div>
                    <Label className="text-purple-900 font-semibold">{t('orderNumber')}</Label>
                    <Input
                      value={reapproFormData.po_number}
                      onChange={(e) => setReapproFormData({ ...reapproFormData, po_number: e.target.value })}
                      className="bg-white font-mono"
                      required
                    />
                  </div>
                  <div>
                    <Label className="text-purple-900 font-semibold">{t('supplier')}</Label>
                    <Select 
                      value={reapproFormData.supplier} 
                      onValueChange={handleReapproSupplierChange}
                    >
                      <SelectTrigger className="bg-white">
                        <SelectValue placeholder={t('selectSupplier') || 'Sélectionner un fournisseur'} />
                      </SelectTrigger>
                      <SelectContent>
                        {/* Get unique suppliers from products to replenish */}
                        {[...new Set(reapproData.orders.map(o => o.fabricant).filter(Boolean))].map((supplierName) => (
                          <SelectItem key={supplierName} value={supplierName}>
                            {supplierName}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label className="text-purple-900 font-semibold">{t('expectedDelivery')}</Label>
                    <Popover open={reapproCalendarOpen} onOpenChange={setReapproCalendarOpen}>
                      <PopoverTrigger asChild>
                        <Button
                          variant="outline"
                          className={`w-full justify-start text-left font-normal bg-white ${!reapproFormData.expected_delivery && "text-muted-foreground"}`}
                        >
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {reapproFormData.expected_delivery ? (
                            format(reapproFormData.expected_delivery, "dd/MM/yyyy", { locale: fr })
                          ) : (
                            <span>Sélectionner une date</span>
                          )}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={reapproFormData.expected_delivery}
                          onSelect={(date) => {
                            setReapproFormData({ ...reapproFormData, expected_delivery: date });
                            setReapproCalendarOpen(false);
                          }}
                          disabled={(date) => date < new Date()}
                          initialFocus
                          locale={fr}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                </div>

                {/* Products list */}
                <div className="border rounded-lg">
                  <div className="p-3 bg-gray-50 border-b flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={filteredReapproOrders.length > 0 && filteredReapproOrders.every(o => selectedReapproProducts.includes(o.product_id))}
                        onChange={toggleSelectAllReappro}
                        className="w-5 h-5 rounded border-gray-300"
                      />
                      <span className="font-semibold text-gray-700">
                        Produits à commander ({filteredReapproOrders.length})
                        {reapproFormData.supplier && (
                          <span className="ml-2 text-purple-600 font-normal">
                            - {reapproFormData.supplier}
                          </span>
                        )}
                      </span>
                    </div>
                    <span className="text-sm text-purple-600 font-medium">
                      {selectedReapproProducts.filter(id => filteredReapproOrders.some(o => o.product_id === id)).length} sélectionné(s)
                    </span>
                  </div>
                  
                  {filteredReapproOrders.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Package size={48} className="mx-auto mb-3 opacity-50" />
                      <p>{reapproFormData.supplier ? `Aucun produit de ${reapproFormData.supplier} à réapprovisionner` : 'Aucun produit à réapprovisionner pour le moment'}</p>
                    </div>
                  ) : (
                    <div className="max-h-[400px] overflow-y-auto">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-100 sticky top-0">
                          <tr>
                            <th className="px-3 py-2 text-left w-10"></th>
                            <th className="px-3 py-2 text-left">{t('product')}</th>
                            <th className="px-3 py-2 text-left">{t('reference')}</th>
                            <th className="px-3 py-2 text-left">{t('supplier')}</th>
                            <th className="px-3 py-2 text-center">Stock</th>
                            <th className="px-3 py-2 text-center">Min</th>
                            <th className="px-3 py-2 text-center text-blue-700">Déjà cmd</th>
                            <th className="px-3 py-2 text-center w-24">À commander</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredReapproOrders.map((order) => {
                            const isSelected = selectedReapproProducts.includes(order.product_id);
                            const hasAlreadyOrdered = (order.deja_commande || 0) > 0;
                            const isFullyOrdered = order.quantite_a_commander === 0; // Already has enough on order
                            const stockBelowMin = order.stock_actuel < order.stock_minimum;
                            
                            return (
                              <tr 
                                key={order.product_id} 
                                className={`border-b cursor-pointer transition-colors ${
                                  isFullyOrdered 
                                    ? 'bg-green-50 opacity-60' 
                                    : isSelected 
                                      ? 'bg-purple-50' 
                                      : hasAlreadyOrdered 
                                        ? 'bg-blue-50 hover:bg-blue-100' 
                                        : 'hover:bg-gray-50'
                                }`}
                                onClick={() => !isFullyOrdered && toggleReapproProductSelection(order.product_id)}
                              >
                                <td className="px-3 py-2">
                                  <input
                                    type="checkbox"
                                    checked={isSelected}
                                    onChange={() => toggleReapproProductSelection(order.product_id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="w-5 h-5 rounded border-gray-300"
                                    disabled={isFullyOrdered}
                                  />
                                </td>
                                <td className="px-3 py-2 font-medium">
                                  {order.nom}
                                  {isFullyOrdered ? (
                                    <span className="ml-2 px-2 py-0.5 text-xs bg-green-200 text-green-800 rounded-full">
                                      ✓ Couvert
                                    </span>
                                  ) : hasAlreadyOrdered ? (
                                    <span className="ml-2 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                                      En commande
                                    </span>
                                  ) : null}
                                </td>
                                <td className="px-3 py-2 font-mono text-gray-600">{order.reference}</td>
                                <td className="px-3 py-2 text-gray-600">{order.fabricant}</td>
                                <td className={`px-3 py-2 text-center font-bold ${stockBelowMin ? 'text-red-600' : 'text-green-600'}`}>
                                  {order.stock_actuel}
                                </td>
                                <td className="px-3 py-2 text-center text-gray-600">{order.stock_minimum}</td>
                                <td className="px-3 py-2 text-center">
                                  {hasAlreadyOrdered ? (
                                    <span className={`font-bold ${isFullyOrdered ? 'text-green-600' : 'text-blue-600'}`}>
                                      {order.deja_commande}
                                    </span>
                                  ) : (
                                    <span className="text-gray-400">-</span>
                                  )}
                                </td>
                                <td className="px-3 py-2">
                                  {isFullyOrdered ? (
                                    <span className="text-green-600 font-medium">0</span>
                                  ) : (
                                    <Input
                                      type="number"
                                      min="1"
                                      value={reapproQuantities[order.product_id] || 1}
                                      onChange={(e) => handleReapproQuantityChange(order.product_id, e.target.value)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="w-20 text-center"
                                      disabled={!isSelected}
                                    />
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Submit button */}
                <div className="flex gap-3">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setReapproDialogOpen(false)}
                    className="flex-1"
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    className="flex-1 bg-purple-600 hover:bg-purple-700"
                    disabled={selectedReapproProducts.length === 0}
                  >
                    <ShoppingCart size={20} className="mr-2" />
                    Créer la commande ({selectedReapproProducts.length} produit{selectedReapproProducts.length > 1 ? 's' : ''})
                  </Button>
                </div>
              </form>
            )}
          </DialogContent>
        </Dialog>
        </div>
        )}
      </div>

      {purchaseOrders.length === 0 ? (
        <div className="text-center py-16">
          <Truck size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-medium text-gray-900 mb-2">{t('noData')}</h3>
          <p className="text-gray-500">{t('newOrder')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {purchaseOrders.map((po) => (
            <div key={po.id} className={`card ${po.statut === 'annule' ? 'opacity-60' : ''}`} data-testid="po-card">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-4">
                  <div className={`p-3 rounded-lg ${po.statut === 'annule' ? 'bg-gray-100' : 'bg-blue-100'}`}>
                    <Package size={32} className={po.statut === 'annule' ? 'text-gray-400' : 'text-blue-600'} />
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{po.po_number}</h3>
                    <p className="text-gray-600">{t('supplier')}: {po.supplier}</p>
                    <p className="text-sm text-gray-500">
                      {t('expectedDelivery')}: {new Date(po.expected_delivery).toLocaleDateString('fr-FR')}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {getStatusBadge(po.statut)}
                  {po.statut !== 'annule' && po.statut !== 'recu_complet' && permissions.canEdit && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCancelClick(po)}
                      className="text-red-600 border-red-300 hover:bg-red-50"
                      data-testid="cancel-po-button"
                    >
                      <Ban size={16} className="mr-1" />
                      Annuler
                    </Button>
                  )}
                  {po.statut !== 'annule' && (
                    <Button
                      onClick={() => handleViewPO(po)}
                      data-testid="view-po-button"
                    >
                      {t('viewReceive')}
                    </Button>
                  )}
                </div>
              </div>
              <div className="bg-gray-50 rounded-lg p-4">
                <p className="text-sm font-medium text-gray-700 mb-2">{po.items.length} {t('productsOrdered')}</p>
                <div className="space-y-1">
                  {po.items.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between text-sm">
                      <span className="text-gray-600">{item.product_name}</span>
                      <span className="font-medium">
                        {item.quantite_recue || 0} / {item.quantite}
                        {(item.quantite_recue || 0) === item.quantite && (
                          <CheckCircle size={14} className="inline ml-2 text-green-600" />
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Cancel PO Confirmation Dialog */}
      <AlertDialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Annuler la commande ?</AlertDialogTitle>
            <AlertDialogDescription>
              Êtes-vous sûr de vouloir annuler la commande <strong>{poToCancel?.po_number}</strong> ?
              <br /><br />
              Cette action va :
              <ul className="list-disc ml-5 mt-2">
                <li>Marquer la commande comme annulée</li>
                <li>Supprimer les lots non placés associés</li>
                <li>Libérer les emplacements réservés</li>
              </ul>
              <br />
              <span className="text-red-600 font-medium">Cette action est irréversible.</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={cancelLoading}>Retour</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleCancelConfirm}
              disabled={cancelLoading}
              className="bg-red-600 hover:bg-red-700"
            >
              {cancelLoading ? 'Annulation...' : 'Confirmer l\'annulation'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {selectedPO && (
        <ReceivingDialog
          po={selectedPO}
          open={receivingDialogOpen}
          onClose={() => {
            setReceivingDialogOpen(false);
            setSelectedPO(null);
            fetchData();
          }}
          products={products}
          t={t}
          isReadOnly={permissions.isReadOnly}
        />
      )}
      
      {/* CSV Import Dialog */}
      <Dialog open={csvDialogOpen} onOpenChange={(open) => {
        setCsvDialogOpen(open);
        if (!open) {
          setCsvData([]);
          setCsvErrors([]);
          setCsvFormData({ po_number: '', supplier: '', expected_delivery: '' });
        }
      }}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FileSpreadsheet size={24} className="text-green-600" />
              Import CSV - Créer une commande
            </DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* Form header - simplified */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-green-50 rounded-lg">
              <div>
                <Label className="font-semibold">N° Commande <span className="text-gray-400 text-sm">(auto-généré si vide)</span></Label>
                <Input
                  value={csvFormData.po_number}
                  onChange={(e) => setCsvFormData({ ...csvFormData, po_number: e.target.value })}
                  placeholder="CSV-..."
                  className="bg-white"
                />
              </div>
              <div>
                <Label className="font-semibold">Date de livraison prévue <span className="text-red-500">*</span></Label>
                <Input
                  type="text"
                  value={csvFormData.expected_delivery}
                  onChange={(e) => setCsvFormData({ ...csvFormData, expected_delivery: maskDateDMY(e.target.value) })}
                  placeholder="jj/mm/aaaa"
                  inputMode="numeric"
                  maxLength={10}
                  className="bg-white"
                />
              </div>
            </div>
            
            {/* CSV Preview */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-semibold text-gray-700">
                  Aperçu des données ({csvData.length} lignes)
                </h3>
                <div className="flex items-center gap-2 text-sm">
                  <span className="text-green-600">{csvData.filter(r => r.isValid).length} valides</span>
                  <span className="text-red-600">{csvData.filter(r => !r.isValid).length} invalides</span>
                </div>
              </div>
              
              {csvErrors.length > 0 && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3 mb-3">
                  <h4 className="text-red-800 font-medium flex items-center gap-1 mb-1">
                    <AlertTriangle size={16} />
                    Erreurs de parsing
                  </h4>
                  <ul className="text-sm text-red-700 list-disc list-inside">
                    {csvErrors.slice(0, 5).map((err, i) => (
                      <li key={i}>{err}</li>
                    ))}
                    {csvErrors.length > 5 && <li>...et {csvErrors.length - 5} autres erreurs</li>}
                  </ul>
                </div>
              )}
              
              <div className="border rounded-lg overflow-hidden max-h-[350px] overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="bg-gray-100 sticky top-0">
                    <tr>
                      <th className="px-2 py-2 text-left w-8">#</th>
                      <th className="px-2 py-2 text-left">Code</th>
                      <th className="px-2 py-2 text-left max-w-[180px]">Produit</th>
                      <th className="px-2 py-2 text-left">Fournisseur</th>
                      <th className="px-2 py-2 text-left">N° Lot</th>
                      <th className="px-2 py-2 text-left">N° Série</th>
                      <th className="px-2 py-2 text-left">Date Fab.</th>
                      <th className="px-2 py-2 text-left">Date Exp.</th>
                      <th className="px-2 py-2 text-left w-20">Statut</th>
                    </tr>
                  </thead>
                  <tbody>
                    {csvData.slice(0, 50).map((row, idx) => (
                      <tr key={idx} className={row.isValid ? 'hover:bg-gray-50' : 'bg-red-50'}>
                        <td className="px-2 py-2 text-gray-500 text-xs">{row.lineNumber}</td>
                        <td className="px-2 py-2 text-xs font-mono">{row.product_code || '-'}</td>
                        <td className="px-2 py-2 text-xs max-w-[180px] truncate" title={row.product_description}>
                          {row.matched_product ? (
                            <span className="text-green-700">{row.matched_product.nom}</span>
                          ) : (
                            <span className="text-red-600">{row.product_description || '-'}</span>
                          )}
                        </td>
                        <td className="px-2 py-2 text-xs">{row.supplier || '-'}</td>
                        <td className="px-2 py-2 text-xs">{row.numero_lot || '-'}</td>
                        <td className="px-2 py-2 font-mono text-xs">{row.numero_serie || '-'}</td>
                        <td className="px-2 py-2 text-xs">{row.date_fabrication || '-'}</td>
                        <td className="px-2 py-2 text-xs">{row.date_expiration || '-'}</td>
                        <td className="px-2 py-2">
                          {row.isValid ? (
                            <CheckCircle size={16} className="text-green-500" />
                          ) : (
                            <span className="text-red-600 text-xs flex items-center gap-1" title={row.error}>
                              <X size={14} /> {row.error}
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {csvData.length > 50 && (
                  <p className="text-center text-gray-500 text-sm py-2 bg-gray-50">
                    ...et {csvData.length - 50} autres lignes
                  </p>
                )}
              </div>
            </div>
            
            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button 
                variant="outline" 
                onClick={() => setCsvDialogOpen(false)}
                className="flex-1"
              >
                Annuler
              </Button>
              <Button 
                onClick={handleCsvImport}
                disabled={csvImportLoading || csvData.filter(r => r.isValid).length === 0}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                {csvImportLoading ? (
                  <span className="flex items-center gap-2">
                    <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                    Import en cours...
                  </span>
                ) : (
                  <>
                    <Upload size={18} className="mr-2" />
                    Importer {csvData.filter(r => r.isValid).length} produits
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

// Receiving Dialog Component with Multiple Quantity Support
const ReceivingDialog = ({ po, open, onClose, products, t, isReadOnly }) => {
  const [selectedItemIndex, setSelectedItemIndex] = useState(0);
  // Step: 1 = Enter data only (no placement step anymore)
  const [step, setStep] = useState(1);
  
  // For multiple items receiving - each item has its own complete data
  const [quantityToReceive, setQuantityToReceive] = useState(1);
  const [receivedItems, setReceivedItems] = useState([]); // Tracking received items
  
  // Array of individual item data - each item has its own lot, serial, barcode, dates
  const [individualItems, setIndividualItems] = useState([{
    numero_lot: '',
    numero_serie: '',
    date_fabrication: '',
    date_expiration: '',
    code_barre: '',
  }]);
  
  // Legacy single item data (used when quantity = 1)
  const [receivingData, setReceivingData] = useState({
    numero_lot: '',
    numero_serie: '',
    date_fabrication: '',
    date_expiration: '',
    code_barre: '',
  });
  
  // State for previous batches (lot/series history)
  const [prevBatches, setPrevBatches] = useState([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const currentItem = po.items[selectedItemIndex];
  const remainingToReceive = currentItem ? currentItem.quantite - (currentItem.quantite_recue || 0) : 0;

  // Fetch previous batches when product changes
  useEffect(() => {
    const fetchPrevBatches = async () => {
      if (!currentItem?.product_id) {
        setPrevBatches([]);
        return;
      }
      setLoadingHistory(true);
      try {
        const res = await api.get(`/products/${currentItem.product_id}/previous-batches`);
        setPrevBatches(res.data || []);
      } catch (err) {
        console.warn('Could not fetch previous batches', err);
        setPrevBatches([]);
      } finally {
        setLoadingHistory(false);
      }
    };
    fetchPrevBatches();
  }, [currentItem?.product_id]);

  // Reset quantity when product changes
  useEffect(() => {
    setQuantityToReceive(1);
  }, [selectedItemIndex]);

  // Mask date as DD/MM/YYYY
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

  const handleDateInputDMY = (field) => (e) => {
    const masked = maskDateDMY(e.target.value);
    setReceivingData((prev) => ({ ...prev, [field]: masked }));
  };

  const isFullDateDMY = (s) => /^\d{2}\/\d{2}\/\d{4}$/.test(s || '');
  const dmyToISO = (s) => {
    const [dd, mm, yyyy] = (s || '').split('/');
    return new Date(`${yyyy}-${mm}-${dd}T00:00:00`).toISOString();
  };

  const isoToDMY = (isoStr) => {
    if (!isoStr) return '';
    try {
      const dt = new Date(isoStr);
      if (isNaN(dt.getTime())) return '';
      const dd = String(dt.getDate()).padStart(2, '0');
      const mm = String(dt.getMonth() + 1).padStart(2, '0');
      const yyyy = dt.getFullYear();
      return `${dd}/${mm}/${yyyy}`;
    } catch {
      return '';
    }
  };

  // Auto-fill dates when a lot is selected
  const handleLotSelect = (lot) => {
    setReceivingData(prev => ({ ...prev, numero_lot: lot }));
    const match = prevBatches.find(b => b.numero_lot === lot);
    if (match) {
      const dfStr = isoToDMY(match.date_fabrication);
      const deStr = isoToDMY(match.date_expiration);
      setReceivingData(prev => ({
        ...prev,
        numero_lot: lot,
        date_fabrication: dfStr || prev.date_fabrication,
        date_expiration: deStr || prev.date_expiration,
      }));
    }
  };

  // Auto-fill dates when a serial number is selected
  const handleSerieSelect = (serie) => {
    setReceivingData(prev => ({ ...prev, numero_serie: serie }));
    const match = prevBatches.find(b => 
      b.numero_lot === receivingData.numero_lot && b.numero_serie === serie
    );
    if (match) {
      const dfStr = isoToDMY(match.date_fabrication);
      const deStr = isoToDMY(match.date_expiration);
      setReceivingData(prev => ({
        ...prev,
        numero_serie: serie,
        date_fabrication: dfStr || prev.date_fabrication,
        date_expiration: deStr || prev.date_expiration,
      }));
    }
  };

  const uniqueLots = [...new Set(prevBatches.map(b => b.numero_lot).filter(Boolean))];
  const seriesForLot = prevBatches
    .filter(b => b.numero_lot === receivingData.numero_lot)
    .map(b => b.numero_serie)
    .filter(Boolean);
  const uniqueSeries = [...new Set(seriesForLot)];

  // Handle receiving multiple items
  const handleReceiveMultiple = async () => {
    try {
      // Use individual items if quantity > 1, otherwise use receivingData
      const itemsToProcess = quantityToReceive > 1 ? individualItems : [receivingData];
      
      // Validate all items
      for (let i = 0; i < quantityToReceive; i++) {
        const item = itemsToProcess[i];
        if (!item) {
          toast.error(`Données manquantes pour l'unité ${i + 1}`);
          return;
        }
        // Date d'expiration est obligatoire
        if (!isFullDateDMY(item.date_expiration)) {
          toast.error(`Date d'expiration invalide pour l'unité ${i + 1}. Format attendu: jj/mm/aaaa`);
          return;
        }
        // Date de fabrication est optionnelle mais doit être valide si fournie
        if (item.date_fabrication && !isFullDateDMY(item.date_fabrication)) {
          toast.error(`Date de fabrication invalide pour l'unité ${i + 1}. Format attendu: jj/mm/aaaa`);
          return;
        }
        // N° Série est obligatoire
        if (!item.numero_serie) {
          toast.error(`N° Série requis pour l'unité ${i + 1}`);
          return;
        }
      }
      
      // Check for duplicates within the batch (only for non-empty values)
      if (quantityToReceive > 1) {
        const series = itemsToProcess.map(i => i.numero_serie).filter(Boolean);
        const barcodes = itemsToProcess.map(i => i.code_barre).filter(Boolean);
        
        // N° Série doit être unique
        if (new Set(series).size !== series.length) {
          toast.error('Les numéros de série doivent être uniques');
          return;
        }
        // Code-barres doit être unique (si fourni)
        if (barcodes.length > 0 && new Set(barcodes).size !== barcodes.length) {
          toast.error('Les codes-barres doivent être uniques');
          return;
        }
      }

      setIsProcessing(true);
      const placements = [];
      
      // Create batches for each unit
      for (let i = 0; i < quantityToReceive; i++) {
        const item = itemsToProcess[i];
        const submitData = {
          product_id: currentItem.product_id,
          numero_lot: item.numero_lot || null,
          numero_serie: item.numero_serie,
          date_fabrication: item.date_fabrication ? dmyToISO(item.date_fabrication) : null,
          date_expiration: dmyToISO(item.date_expiration),
          code_barre: item.code_barre || null,
          
        };

        const response = await api.post(`/purchase-orders/${po.id}/receive-item`, submitData);
        receivedItems.push({
          batch_id: response.data.batch_id,
          numero_serie: submitData.numero_serie,
          index: i + 1,
        });
      }
      
      // All items received - close dialog and refresh
      toast.success(`${quantityToReceive} unité(s) enregistrée(s). Placement à faire via le module Remplissage.`);
      onClose();
      setStep(1);
    } catch (error) {
      // Handle error - ensure we show a string, not an object
      let errorMessage = 'Erreur lors de la réception';
      if (error.response?.data?.detail) {
        const detail = error.response.data.detail;
        if (typeof detail === 'string') {
          errorMessage = detail;
        } else if (Array.isArray(detail)) {
          // Pydantic validation errors are arrays
          errorMessage = detail.map(e => e.msg || JSON.stringify(e)).join(', ');
        } else if (typeof detail === 'object') {
          errorMessage = detail.msg || JSON.stringify(detail);
        }
      }
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  // Removed: Old placement confirmation - now done in Remplissage module
  const handleCloseReceiveDialog = () => {
    onClose();
    setStep(1);
    setQuantityToReceive(1);
    setIndividualItems([]);
    setReceivingData({
      numero_lot: '',
      numero_serie: '',
      date_fabrication: '',
      date_expiration: '',
      code_barre: ''
    });
  };

  // Simplified reset and close - no more pending placements to cancel
  const resetAndClose = () => {
    setStep(1);
    setQuantityToReceive(1);
    setReceivedItems([]);
    setIndividualItems([{
      numero_lot: '',
      numero_serie: '',
      date_fabrication: '',
      date_expiration: '',
      code_barre: '',
    }]);
    setReceivingData({
      numero_lot: '',
      numero_serie: '',
      date_fabrication: '',
      date_expiration: '',
      code_barre: '',
    });
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={resetAndClose}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {t('receiving')} - {po.po_number}
          </DialogTitle>
        </DialogHeader>
        
        {step === 1 && (
          <div className="space-y-4">
            <div className="bg-blue-50 p-4 rounded-lg">
              <h3 className="font-bold text-gray-900 mb-2">{t('selectProductToReceive')}</h3>
              <div className="space-y-2">
                {po.items.map((item, idx) => {
                  const remaining = item.quantite - (item.quantite_recue || 0);
                  return (
                    <button
                      key={idx}
                      onClick={() => setSelectedItemIndex(idx)}
                      disabled={remaining === 0}
                      className={`w-full p-3 rounded-lg text-left transition-colors ${
                        selectedItemIndex === idx
                          ? 'bg-blue-600 text-white'
                          : remaining === 0
                          ? 'bg-gray-200 text-gray-400 cursor-not-allowed'
                          : 'bg-white hover:bg-blue-100'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium">{item.product_name}</p>
                          <p className="text-sm opacity-80">Réf: {item.reference}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold">{item.quantite_recue || 0} / {item.quantite}</p>
                          <p className="text-sm opacity-80">{remaining} restant(s)</p>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {remainingToReceive > 0 && (
              <div className="space-y-4">
                <h3 className="font-bold text-gray-900">{t('batchInfo')}</h3>
                
                {/* Quantity selector */}
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <Label className="text-green-800 font-semibold">{t('quantityToReceive')}</Label>
                  <div className="flex items-center gap-3 mt-2">
                    <Input
                      type="number"
                      min="1"
                      max={remainingToReceive}
                      value={quantityToReceive}
                      onChange={(e) => {
                        const newQty = Math.min(Math.max(1, parseInt(e.target.value) || 1), remainingToReceive);
                        setQuantityToReceive(newQty);
                        // Initialize individual items array when quantity changes
                        if (newQty > 1) {
                          setIndividualItems(Array(newQty).fill(null).map(() => ({
                            numero_lot: '',
                            numero_serie: '',
                            date_fabrication: '',
                            date_expiration: '',
                            code_barre: '',
                            
                          })));
                        }
                      }}
                      className="w-24"
                    />
                    <span className="text-green-700">/ {remainingToReceive} {t('remaining')}</span>
                    {quantityToReceive > 1 && (
                      <span className="text-sm text-green-600 bg-green-100 px-2 py-1 rounded">
                        {quantityToReceive} {t('locations')}
                      </span>
                    )}
                  </div>
                </div>
                
                {/* Single item form (quantity = 1) */}
                {quantityToReceive === 1 && (
                  <>
                    {/* History dropdowns for lot/serial */}
                    {prevBatches.length > 0 && (
                      <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <h4 className="font-semibold text-yellow-800 mb-3">{t('previousBatches')}</h4>
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <Label className="text-yellow-800">{t('lotNumber')}</Label>
                            <select
                              className="w-full px-3 py-2 border rounded-lg bg-white"
                              value={receivingData.numero_lot}
                              onChange={(e) => handleLotSelect(e.target.value)}
                            >
                              <option value="">-- {t('newLot')} --</option>
                              {uniqueLots.map((lot, idx) => (
                                <option key={`lot-${idx}`} value={lot}>{lot}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <Label className="text-yellow-800">{t('serialNumber')}</Label>
                            <select
                              className="w-full px-3 py-2 border rounded-lg bg-white"
                              value={receivingData.numero_serie}
                              onChange={(e) => handleSerieSelect(e.target.value)}
                              disabled={!receivingData.numero_lot}
                            >
                              <option value="">-- {t('newSerial')} --</option>
                              {uniqueSeries.map((ser, idx) => (
                                <option key={`ser-${idx}`} value={ser}>{ser}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                        {loadingHistory && (
                          <p className="text-xs text-yellow-600 mt-2">{t('loading')}</p>
                        )}
                      </div>
                    )}
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>{t('lotNumber')} <span className="text-gray-400 text-sm">({t('optional')})</span></Label>
                        <Input
                          value={receivingData.numero_lot}
                          onChange={(e) => setReceivingData({ ...receivingData, numero_lot: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{t('serialNumber')} <span className="text-red-500">*</span></Label>
                        <Input
                          value={receivingData.numero_serie}
                          onChange={(e) => setReceivingData({ ...receivingData, numero_serie: e.target.value })}
                          required
                        />
                      </div>
                      <div>
                        <Label>{t('barcode')} <span className="text-gray-400 text-sm">({t('optional')})</span></Label>
                        <Input
                          value={receivingData.code_barre}
                          onChange={(e) => setReceivingData({ ...receivingData, code_barre: e.target.value })}
                        />
                      </div>
                      <div>
                        <Label>{t('manufacturingDate')} <span className="text-gray-400 text-sm">({t('optional')})</span></Label>
                        <Input
                          type="text"
                          value={receivingData.date_fabrication}
                          onChange={handleDateInputDMY('date_fabrication')}
                          placeholder="jj/mm/aaaa"
                          inputMode="numeric"
                          maxLength={10}
                        />
                      </div>
                      <div>
                        <Label>{t('expirationDate')} <span className="text-red-500">*</span></Label>
                        <Input
                          type="text"
                          value={receivingData.date_expiration}
                          onChange={handleDateInputDMY('date_expiration')}
                          placeholder="jj/mm/aaaa"
                          inputMode="numeric"
                          maxLength={10}
                          required
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* Multiple items form (quantity > 1) */}
                {quantityToReceive > 1 && (
                  <div className="space-y-4">
                    <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                      <p className="text-orange-800 text-sm font-medium">
                        ⚠️ N° Série et Code-barres doivent être uniques pour chaque unité
                      </p>
                    </div>
                    
                    <div className="space-y-4 max-h-[400px] overflow-y-auto border rounded-lg p-4 bg-gray-50">
                      {individualItems.map((item, idx) => (
                        <div key={idx} className="bg-white rounded-lg p-4 border shadow-sm">
                          <h4 className="font-bold text-blue-800 mb-3 flex items-center gap-2">
                            <span className="bg-blue-600 text-white px-2 py-1 rounded text-sm">{idx + 1}</span>
                            Unité {idx + 1}
                          </h4>
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <Label className="text-sm">{t('lotNumber')} <span className="text-gray-400 text-xs">({t('optional')})</span></Label>
                              <Input
                                value={item.numero_lot}
                                onChange={(e) => {
                                  const newItems = [...individualItems];
                                  newItems[idx] = { ...newItems[idx], numero_lot: e.target.value };
                                  setIndividualItems(newItems);
                                }}
                                placeholder="N° Lot"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">{t('serialNumber')} <span className="text-red-500">*</span></Label>
                              <Input
                                value={item.numero_serie}
                                onChange={(e) => {
                                  const newItems = [...individualItems];
                                  newItems[idx] = { ...newItems[idx], numero_serie: e.target.value };
                                  setIndividualItems(newItems);
                                }}
                                placeholder="N° Série (unique)"
                                required
                              />
                            </div>
                            <div>
                              <Label className="text-sm">{t('barcode')} <span className="text-gray-400 text-xs">({t('optional')})</span></Label>
                              <Input
                                value={item.code_barre}
                                onChange={(e) => {
                                  const newItems = [...individualItems];
                                  newItems[idx] = { ...newItems[idx], code_barre: e.target.value };
                                  setIndividualItems(newItems);
                                }}
                                placeholder="Code-barres (unique)"
                              />
                            </div>
                            <div>
                              <Label className="text-sm">{t('manufacturingDate')} <span className="text-gray-400 text-xs">({t('optional')})</span></Label>
                              <Input
                                type="text"
                                value={item.date_fabrication}
                                onChange={(e) => {
                                  const newItems = [...individualItems];
                                  newItems[idx] = { ...newItems[idx], date_fabrication: maskDateDMY(e.target.value) };
                                  setIndividualItems(newItems);
                                }}
                                placeholder="jj/mm/aaaa"
                                inputMode="numeric"
                                maxLength={10}
                              />
                            </div>
                            <div>
                              <Label className="text-sm">{t('expirationDate')} <span className="text-red-500">*</span></Label>
                              <Input
                                type="text"
                                value={item.date_expiration}
                                onChange={(e) => {
                                  const newItems = [...individualItems];
                                  newItems[idx] = { ...newItems[idx], date_expiration: maskDateDMY(e.target.value) };
                                  setIndividualItems(newItems);
                                }}
                                placeholder="jj/mm/aaaa"
                                inputMode="numeric"
                                maxLength={10}
                                required
                              />
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {isReadOnly ? (
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 text-center">
                    <Lock size={20} className="mx-auto text-yellow-600 mb-2" />
                    <p className="text-yellow-800 text-sm font-medium">
                      Mode lecture seule - Réception non autorisée
                    </p>
                  </div>
                ) : (
                  <Button 
                    onClick={handleReceiveMultiple} 
                    className="w-full"
                    disabled={isProcessing}
                  >
                    {isProcessing ? (
                      <span className="flex items-center gap-2">
                        <div className="animate-spin rounded-full h-4 w-4 border-t-2 border-white"></div>
                        {t('loading')}
                      </span>
                    ) : (
                      <>
                        <CheckCircle size={20} className="mr-2" />
                        {t('receiveProducts')} ({quantityToReceive})
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default PurchaseOrders;
