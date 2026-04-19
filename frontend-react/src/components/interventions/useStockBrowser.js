import { useState, useCallback } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';

export function useStockBrowser() {
  const [stockCatId, setStockCatId] = useState('');
  const [stockTypeId, setStockTypeId] = useState('');
  const [stockSpecId, setStockSpecId] = useState('');
  const [stockFilterOptions, setStockFilterOptions] = useState({ categories: [], types: [], specifications: [] });
  const [stockResults, setStockResults] = useState([]);
  const [stockLoading, setStockLoading] = useState(false);

  const fetchStock = useCallback(async (catId, typId, spcId) => {
    setStockLoading(true);
    try {
      const params = new URLSearchParams();
      if (catId) params.set('category_id', catId);
      if (typId) params.set('type_id', typId);
      if (spcId) params.set('specification_id', spcId);
      const res = await api.get(`/products/filter-options?${params}`);
      setStockResults(res.data.products || []);
      setStockFilterOptions(res.data.filter_options || { categories: [], types: [], specifications: [] });
    } catch {
      toast.error('Erreur de chargement');
    } finally {
      setStockLoading(false);
    }
  }, []);

  const handleCatChange = useCallback((val) => {
    setStockCatId(prev => {
      const v = prev === val ? '' : val;
      setStockTypeId('');
      setStockSpecId('');
      fetchStock(v, '', '');
      return v;
    });
  }, [fetchStock]);

  const handleTypeChange = useCallback((val) => {
    setStockTypeId(prev => {
      const v = prev === val ? '' : val;
      setStockSpecId('');
      fetchStock(stockCatId, v, '');
      return v;
    });
  }, [fetchStock, stockCatId]);

  const handleSpecChange = useCallback((val) => {
    setStockSpecId(prev => {
      const v = prev === val ? '' : val;
      fetchStock(stockCatId, stockTypeId, v);
      return v;
    });
  }, [fetchStock, stockCatId, stockTypeId]);

  const resetFilters = useCallback(() => {
    setStockCatId('');
    setStockTypeId('');
    setStockSpecId('');
    fetchStock('', '', '');
  }, [fetchStock]);

  const setFilters = useCallback((catId, typId, spcId) => {
    setStockCatId(catId);
    setStockTypeId(typId);
    setStockSpecId(spcId);
    fetchStock(catId, typId, spcId);
  }, [fetchStock]);

  return {
    stockCatId, stockTypeId, stockSpecId,
    stockFilterOptions, stockResults, stockLoading,
    fetchStock, handleCatChange, handleTypeChange, handleSpecChange,
    resetFilters, setFilters,
  };
}
