import React from 'react';

/**
 * 3-column cascading filter for Category / Model / Specification.
 *
 * Props:
 *  - stockFilterOptions: { categories, types, specifications }
 *  - stockCatId, stockTypeId, stockSpecId
 *  - onCatChange, onTypeChange, onSpecChange
 *  - dark: boolean
 *  - maxH: optional max-height class (default "max-h-32")
 *  - testIdPrefix: optional prefix for data-testid
 */
export function CascadingFilters({
  stockFilterOptions,
  stockCatId, stockTypeId, stockSpecId,
  onCatChange, onTypeChange, onSpecChange,
  dark = false,
  maxH = 'max-h-32',
  testIdPrefix = '',
}) {
  const columns = [
    { key: 'categories', label: 'Catégorie', emptyLabel: 'Aucune', selected: stockCatId, onChange: onCatChange },
    { key: 'types', label: 'Modèle', emptyLabel: 'Aucun', selected: stockTypeId, onChange: onTypeChange },
    { key: 'specifications', label: 'Spécification', emptyLabel: 'Aucune', selected: stockSpecId, onChange: onSpecChange },
  ];

  return (
    <div className="grid grid-cols-3 gap-2 mb-3">
      {columns.map(col => (
        <div key={col.key} className={`rounded-lg overflow-hidden ${dark ? 'border border-slate-600' : 'border'}`}>
          <div className={`px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide ${dark ? 'bg-slate-700 text-slate-400' : 'bg-slate-50 text-slate-400'}`}>
            {col.label}
          </div>
          <div className={`${maxH} overflow-y-auto`}>
            {(stockFilterOptions[col.key] || []).length === 0 ? (
              <div className={`px-3 py-2 text-xs ${dark ? 'text-slate-500' : 'text-slate-400'}`}>{col.emptyLabel}</div>
            ) : [...(stockFilterOptions[col.key] || [])].sort((a, b) => a.description.localeCompare(b.description)).map(item => (
              <button
                key={item.id}
                type="button"
                data-testid={testIdPrefix ? `${testIdPrefix}-${col.key.slice(0, 3)}-${item.id}` : undefined}
                onClick={() => col.onChange(item.id)}
                className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                  dark ? `border-b border-slate-700 ${col.selected === item.id ? 'bg-blue-600/20 text-blue-400 font-semibold' : 'text-slate-300 hover:bg-slate-700'}`
                    : `border-b border-slate-50 ${col.selected === item.id ? 'bg-blue-50 text-blue-700 font-semibold' : 'text-slate-600 hover:bg-slate-50'}`
                }`}
              >
                {item.description}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
