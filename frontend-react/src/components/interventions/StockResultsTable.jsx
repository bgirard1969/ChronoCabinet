import React from 'react';
import { Plus, Check } from 'lucide-react';

/**
 * Table displaying stock results from cascading filters.
 *
 * Props:
 *  - stockResults: array of product results
 *  - stockLoading: boolean
 *  - dark: boolean
 *  - onAction(product): callback when user clicks the action button
 *  - actionMode: 'add' | 'refine' (default 'add') — determines icon
 *  - maxInstances: max serial numbers to show (default 4)
 */
export function StockResultsTable({
  stockResults,
  stockLoading,
  dark = false,
  onAction,
  actionMode = 'add',
  maxInstances = 4,
}) {
  const ActionIcon = actionMode === 'refine' ? Check : Plus;

  return (
    <div className={`rounded-lg overflow-hidden ${dark ? 'border border-slate-600' : 'border'}`}>
      <table className="w-full text-xs">
        <thead className={dark ? 'bg-slate-700' : 'bg-slate-50'}>
          <tr>
            <th className={`text-left px-3 py-2 font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Description</th>
            <th className={`text-left px-3 py-2 font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>N° de série</th>
            <th className={`text-center px-3 py-2 font-medium ${dark ? 'text-slate-400' : 'text-slate-500'}`}>Stock</th>
            <th className="w-10"></th>
          </tr>
        </thead>
        <tbody className={`divide-y ${dark ? 'divide-slate-700' : 'divide-slate-50'}`}>
          {stockLoading ? (
            <tr><td colSpan="4" className={`px-3 py-4 text-center ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Chargement...</td></tr>
          ) : stockResults.length === 0 ? (
            <tr><td colSpan="4" className={`px-3 py-4 text-center ${dark ? 'text-slate-500' : 'text-slate-400'}`}>Aucun produit trouvé</td></tr>
          ) : stockResults.map(r => (
            <tr key={r.product_id} className={dark ? 'hover:bg-slate-700/50' : 'hover:bg-slate-50'}>
              <td className={`px-3 py-2 font-medium ${dark ? 'text-slate-200' : 'text-slate-700'}`}>{r.description}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1">
                  {(r.instances || []).slice(0, maxInstances).map((inst, idx) => (
                    <span key={idx} className={`inline-block px-1.5 py-0.5 rounded font-mono text-[10px] ${dark ? 'bg-slate-700 text-slate-300' : 'bg-slate-100 text-slate-600'}`}>
                      {inst.serial_number || inst.lot_number || '—'}
                    </span>
                  ))}
                  {(r.instances || []).length > maxInstances && (
                    <span className={`text-[10px] ${dark ? 'text-slate-500' : 'text-slate-400'}`}>+{r.instances.length - maxInstances}</span>
                  )}
                  {(!r.instances || r.instances.length === 0) && (
                    <span className={`text-[10px] ${dark ? 'text-slate-600' : 'text-slate-300'}`}>{dark ? '—' : 'Aucun en stock'}</span>
                  )}
                </div>
              </td>
              <td className="px-3 py-2 text-center">
                {r.quantity > 0 ? (
                  <span className={`inline-block font-bold px-2 py-0.5 rounded-full ${dark ? 'bg-emerald-900/50 text-emerald-400' : 'bg-emerald-50 text-emerald-700'}`}>
                    {r.quantity}
                  </span>
                ) : (
                  <span className={dark ? 'text-slate-600' : 'text-slate-300'}>0</span>
                )}
              </td>
              <td className="px-3 py-2 text-center">
                <button
                  type="button"
                  data-testid={`stock-action-${r.product_id}`}
                  onClick={() => onAction(r)}
                  className={`p-1 rounded-md transition-colors ${dark ? 'bg-blue-600/20 text-blue-400 hover:bg-blue-600/40' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                >
                  <ActionIcon className="w-4 h-4" />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
