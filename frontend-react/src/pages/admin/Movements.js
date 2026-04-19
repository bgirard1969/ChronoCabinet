import React, { useState, useEffect, useRef } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Activity, Search, ScanLine, X, Calendar as CalendarIcon, FileSpreadsheet, FileText, ArrowUp, ArrowDown } from 'lucide-react';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { fr } from 'date-fns/locale';
import { format } from 'date-fns';

const TYPE_LABELS = {
  commande: 'Commandé',
  reception: 'Réception',
  placement: 'Placement',
  prelevement: 'Prélèvement',
  retour: 'Retour',
  consommation: 'Consommation',
  facturation: 'Facturation',
};
const TYPE_COLORS = {
  commande: 'bg-slate-100 text-slate-700',
  reception: 'bg-purple-100 text-purple-700',
  placement: 'bg-blue-100 text-blue-700',
  prelevement: 'bg-amber-100 text-amber-700',
  retour: 'bg-green-100 text-green-700',
  consommation: 'bg-teal-100 text-teal-700',
  facturation: 'bg-indigo-100 text-indigo-700',
};

export default function Movements() {
  const [movements, setMovements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterType, setFilterType] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [filterDateTo, setFilterDateTo] = useState('');
  const [dateRange, setDateRange] = useState(undefined); // { from: Date, to: Date }
  const [datePopoverOpen, setDatePopoverOpen] = useState(false);
  const [filterSN, setFilterSN] = useState('');
  const [filterLot, setFilterLot] = useState('');
  const snRef = useRef(null);
  const lotRef = useRef(null);
  const [sortKey, setSortKey] = useState('timestamp');
  const [sortDir, setSortDir] = useState('desc');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await api.get('/movements');
        setMovements(res.data);
      } catch (err) {
        toast.error(err.response?.data?.detail || 'Erreur');
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const handleSNScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      // Value already set via onChange
    }
  };

  const handleLotScan = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
    }
  };

  // Sync dateRange → filterDate/filterDateTo strings for filtering and export
  useEffect(() => {
    if (dateRange?.from) {
      setFilterDate(format(dateRange.from, 'yyyy-MM-dd'));
    } else {
      setFilterDate('');
    }
    if (dateRange?.to) {
      setFilterDateTo(format(dateRange.to, 'yyyy-MM-dd'));
    } else {
      setFilterDateTo('');
    }
  }, [dateRange]);

  const filtered = movements.filter(m => {
    if (filterType && m.type !== filterType) return false;
    if (filterDate || filterDateTo) {
      const mDateET = m.timestamp
        ? new Date(m.timestamp).toLocaleDateString('en-CA', { timeZone: 'America/Toronto' })
        : '';
      if (filterDate && mDateET < filterDate) return false;
      if (filterDateTo && mDateET > filterDateTo) return false;
    }
    if (filterSN) {
      const sn = (m.serial_number || '').toLowerCase();
      if (!sn.includes(filterSN.toLowerCase())) return false;
    }
    if (filterLot) {
      const lot = (m.lot_number || '').toLowerCase();
      if (!lot.includes(filterLot.toLowerCase())) return false;
    }
    return true;
  });

  const hasActiveFilters = filterType || filterDate || filterDateTo || filterSN || filterLot;

  const toggleSort = (key) => {
    if (sortKey === key) {
      setSortDir(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir(key === 'timestamp' ? 'desc' : 'asc');
    }
  };

  const SortIcon = ({ col }) => {
    if (sortKey !== col) return <ArrowDown className="w-3 h-3 text-slate-300 ml-1 inline" />;
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 text-blue-500 ml-1 inline" />
      : <ArrowDown className="w-3 h-3 text-blue-500 ml-1 inline" />;
  };

  const sorted = [...filtered].sort((a, b) => {
    const dir = sortDir === 'asc' ? 1 : -1;
    let va, vb;
    switch (sortKey) {
      case 'timestamp':
        va = a.timestamp || ''; vb = b.timestamp || '';
        return va < vb ? -dir : va > vb ? dir : 0;
      case 'type':
        va = (TYPE_LABELS[a.type] || a.type || '').toLowerCase();
        vb = (TYPE_LABELS[b.type] || b.type || '').toLowerCase();
        return va < vb ? -dir : va > vb ? dir : 0;
      case 'product':
        va = (a.product?.description || '').toLowerCase();
        vb = (b.product?.description || '').toLowerCase();
        return va < vb ? -dir : va > vb ? dir : 0;
      case 'serial_number':
        va = (a.serial_number || '').toLowerCase();
        vb = (b.serial_number || '').toLowerCase();
        return va < vb ? -dir : va > vb ? dir : 0;
      case 'lot_number':
        va = (a.lot_number || '').toLowerCase();
        vb = (b.lot_number || '').toLowerCase();
        return va < vb ? -dir : va > vb ? dir : 0;
      case 'location':
        va = (a.location_code || '').toLowerCase();
        vb = (b.location_code || '').toLowerCase();
        return va < vb ? -dir : va > vb ? dir : 0;
      case 'user':
        va = (a.user_name || '').toLowerCase();
        vb = (b.user_name || '').toLowerCase();
        return va < vb ? -dir : va > vb ? dir : 0;
      case 'reason':
        va = (a.reason || '').toLowerCase();
        vb = (b.reason || '').toLowerCase();
        return va < vb ? -dir : va > vb ? dir : 0;
      default:
        return 0;
    }
  });

  const handleExport = async (format) => {
    try {
      const params = new URLSearchParams();
      if (filterDate) params.append('date_from', filterDate);
      if (filterDateTo) params.append('date_to', filterDateTo);
      if (filterType) params.append('type', filterType);
      if (filterSN) params.append('serial_number', filterSN);
      if (filterLot) params.append('lot_number', filterLot);
      const res = await api.get(`/movements/export/${format}?${params.toString()}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(res.data);
      const a = document.createElement('a');
      a.href = url;
      a.download = `mouvements.${format === 'excel' ? 'xlsx' : 'pdf'}`;
      a.click();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      toast.error('Erreur lors de l\'export');
    }
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Mouvements</h1>
          <p className="text-sm text-slate-500 mt-0.5">Journal d'audit des opérations sur les produits</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            data-testid="export-excel-btn"
            onClick={() => handleExport('excel')}
            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
          >
            <FileSpreadsheet className="w-4 h-4" /> Excel
          </button>
          <button
            data-testid="export-pdf-btn"
            onClick={() => handleExport('pdf')}
            className="flex items-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700 transition-colors"
          >
            <FileText className="w-4 h-4" /> PDF
          </button>
        </div>
      </div>

      {/* Date range + count above filters */}
      <div className="flex items-center gap-3 mb-3">
        <Popover open={datePopoverOpen} onOpenChange={setDatePopoverOpen}>
          <PopoverTrigger asChild>
            <button
              data-testid="date-range-trigger"
              className={`flex items-center gap-2 px-3 py-2 border rounded-lg text-sm transition-colors ${
                dateRange?.from
                  ? 'bg-blue-50 border-blue-300 text-blue-700'
                  : 'bg-white border-slate-300 text-slate-500 hover:bg-slate-50'
              }`}
            >
              <CalendarIcon className="w-4 h-4" />
              {dateRange?.from ? (
                dateRange.to ? (
                  <span>{format(dateRange.from, 'dd MMM yyyy', { locale: fr })} — {format(dateRange.to, 'dd MMM yyyy', { locale: fr })}</span>
                ) : (
                  <span>{format(dateRange.from, 'dd MMM yyyy', { locale: fr })} — ...</span>
                )
              ) : (
                <span>Sélectionner une période</span>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="range"
              selected={dateRange}
              onSelect={(range) => {
                setDateRange(range);
                if (range?.from && range?.to) setDatePopoverOpen(false);
              }}
              numberOfMonths={2}
              locale={fr}
            />
          </PopoverContent>
        </Popover>
        {dateRange?.from && (
          <button onClick={() => setDateRange(undefined)} className="text-slate-400 hover:text-slate-600">
            <X className="w-4 h-4" />
          </button>
        )}
        <div className="text-sm text-slate-500">
          {filtered.length} / {movements.length} mouvement(s)
        </div>
      </div>

      {/* Type filter buttons + scan inputs on same line */}
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button onClick={() => setFilterType('')}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${!filterType ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}>
          Tous
        </button>
        {Object.entries(TYPE_LABELS).map(([k, v]) => (
          <button key={k} onClick={() => setFilterType(filterType === k ? '' : k)}
            className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${filterType === k ? 'bg-blue-600 text-white' : 'bg-white text-slate-600 border hover:bg-slate-50'}`}>
            {v}
          </button>
        ))}

        <div className="w-px h-6 bg-slate-300 mx-1" />

        {/* Serial number */}
        <div className="relative">
          <ScanLine className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={snRef}
            data-testid="filter-serial"
            type="text"
            placeholder="N° Série"
            value={filterSN}
            onChange={e => setFilterSN(e.target.value)}
            onKeyDown={handleSNScan}
            className="pl-8 pr-7 py-1.5 border border-slate-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none bg-white w-36 font-mono"
          />
          {filterSN && (
            <button onClick={() => { setFilterSN(''); snRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Lot number */}
        <div className="relative">
          <ScanLine className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
          <input
            ref={lotRef}
            data-testid="filter-lot"
            type="text"
            placeholder="N° Lot"
            value={filterLot}
            onChange={e => setFilterLot(e.target.value)}
            onKeyDown={handleLotScan}
            className="pl-8 pr-7 py-1.5 border border-slate-300 rounded-lg text-sm focus:border-blue-500 focus:outline-none bg-white w-36 font-mono"
          />
          {filterLot && (
            <button onClick={() => { setFilterLot(''); lotRef.current?.focus(); }} className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        {hasActiveFilters && (
          <button
            data-testid="clear-filters"
            onClick={() => { setFilterType(''); setDateRange(undefined); setFilterSN(''); setFilterLot(''); }}
            className="px-3 py-1.5 text-xs text-red-500 hover:bg-red-50 rounded-lg border border-red-200 transition-colors"
          >
            Effacer
          </button>
        )}
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('timestamp')}>
                Date/Heure <SortIcon col="timestamp" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('type')}>
                Type <SortIcon col="type" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('product')}>
                Produit <SortIcon col="product" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('serial_number')}>
                N° Série <SortIcon col="serial_number" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('lot_number')}>
                N° Lot <SortIcon col="lot_number" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('location')}>
                Emplacement <SortIcon col="location" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('user')}>
                Utilisateur <SortIcon col="user" />
              </th>
              <th className="text-left px-4 py-3 font-medium text-slate-500 cursor-pointer select-none hover:text-blue-600" onClick={() => toggleSort('reason')}>
                Détail <SortIcon col="reason" />
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">Chargement...</td></tr>
            ) : sorted.length === 0 ? (
              <tr><td colSpan="8" className="px-4 py-8 text-center text-slate-400">Aucun mouvement</td></tr>
            ) : sorted.map(m => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 text-slate-600 text-xs">
                  {new Date(m.timestamp).toLocaleString('fr-CA')}
                </td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[m.type] || 'bg-slate-100'}`}>
                    {TYPE_LABELS[m.type] || m.type}
                  </span>
                </td>
                <td className="px-4 py-3">{m.product?.description || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">{m.serial_number || '—'}</td>
                <td className="px-4 py-3 font-mono text-xs">{m.lot_number || '—'}</td>
                <td className="px-4 py-3 text-xs">{m.location_code || '—'}</td>
                <td className="px-4 py-3">{m.user_name || '—'}</td>
                <td className="px-4 py-3 text-slate-600 max-w-xs break-words">{m.reason || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
