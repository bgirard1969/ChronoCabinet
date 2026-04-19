import React from 'react';

/**
 * Shared form fields for intervention create/edit: Date, Salle, MRN, Birth Date.
 *
 * Props:
 *  - form: { planned_date, operating_room, patient_file_number, birth_date }
 *  - onChange(field, value): callback
 *  - dark: boolean
 *  - testIdPrefix: prefix for data-testid attributes
 */
export function InterventionFormFields({ form, onChange, dark = false, testIdPrefix = '' }) {
  const inputClass = dark
    ? 'w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white placeholder-slate-500 focus:border-blue-500 focus:outline-none'
    : 'w-full border rounded-lg px-3 py-2 text-sm';

  const labelClass = dark
    ? 'block text-xs font-medium text-slate-400 mb-1'
    : 'block text-xs font-medium text-slate-500 mb-1';

  return (
    <>
      <div className="grid grid-cols-4 gap-3">
        <div className="col-span-1">
          <label className={labelClass}>Date *</label>
          <input
            type="date"
            required
            data-testid={`${testIdPrefix}-date`}
            className={inputClass}
            value={form.planned_date}
            onChange={e => onChange('planned_date', e.target.value)}
          />
        </div>
        <div className="col-span-1">
          <label className={labelClass}>Salle</label>
          <input
            data-testid={`${testIdPrefix}-salle`}
            className={inputClass}
            placeholder="Ex: 05"
            maxLength={2}
            value={form.operating_room}
            onChange={e => onChange('operating_room', e.target.value.replace(/[^0-9]/g, '').slice(0, 2))}
          />
        </div>
        <div className="col-span-1">
          <label className={labelClass}>MRN</label>
          <input
            data-testid={`${testIdPrefix}-patient`}
            className={inputClass}
            placeholder="Facultatif"
            value={form.patient_file_number}
            onChange={e => onChange('patient_file_number', e.target.value)}
          />
        </div>
        <div className="col-span-1">
          <label className={labelClass}>Date naissance</label>
          <input
            type="date"
            data-testid={`${testIdPrefix}-birthdate`}
            className={inputClass}
            value={form.birth_date}
            onChange={e => onChange('birth_date', e.target.value)}
          />
        </div>
      </div>
    </>
  );
}
