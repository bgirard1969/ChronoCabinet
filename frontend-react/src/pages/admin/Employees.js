import React, { useState, useEffect } from 'react';
import { api } from '@/App';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, ShieldCheck, Key } from 'lucide-react';

const ROLE_LABELS = { administrateur: 'Administrateur', gestionnaire: 'Gestionnaire', technicien: 'Technicien', clinicien: 'Clinicien', lecture: 'Lecture seule' };
const ROLE_COLORS = { administrateur: 'bg-red-100 text-red-700', gestionnaire: 'bg-blue-100 text-blue-700', technicien: 'bg-amber-100 text-amber-700', clinicien: 'bg-green-100 text-green-700', lecture: 'bg-slate-100 text-slate-600' };

export default function Employees() {
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '', role: 'clinicien', pin: '', card_id: '',
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await api.get('/employees');
      setEmployees(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editItem) {
        const payload = { ...form };
        if (!payload.password) delete payload.password;
        if (!payload.pin) delete payload.pin;
        await api.put(`/employees/${editItem.id}`, payload);
        toast.success('Employé mis à jour');
      } else {
        await api.post('/employees', form);
        toast.success('Employé créé');
      }
      setShowForm(false);
      setEditItem(null);
      setForm({ email: '', password: '', first_name: '', last_name: '', role: 'clinicien', pin: '', card_id: '' });
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Supprimer cet employé ?')) return;
    try {
      await api.delete(`/employees/${id}`);
      toast.success('Employé supprimé');
      fetchData();
    } catch (err) {
      toast.error(err.response?.data?.detail || 'Erreur');
    }
  };

  const openEdit = (emp) => {
    setEditItem(emp);
    setForm({
      email: emp.email, password: '', first_name: emp.first_name, last_name: emp.last_name,
      role: emp.role, pin: '', card_id: emp.card_id || '',
    });
    setShowForm(true);
  };

  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Employés</h1>
          <p className="text-sm text-slate-500 mt-0.5">Gestion des comptes et des rôles</p>
        </div>
        <button data-testid="create-employee-btn" onClick={() => { setEditItem(null); setShowForm(true); }}
          className="flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700">
          <Plus className="w-4 h-4" /> Nouvel employé
        </button>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-slate-50">
            <tr>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Nom</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Email</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Rôle</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">Carte</th>
              <th className="text-left px-4 py-3 font-medium text-slate-500">NIP</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">Chargement...</td></tr>
            ) : employees.length === 0 ? (
              <tr><td colSpan="6" className="px-4 py-8 text-center text-slate-400">Aucun employé</td></tr>
            ) : employees.map(emp => (
              <tr key={emp.id} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-medium">{emp.first_name} {emp.last_name}</td>
                <td className="px-4 py-3 text-slate-600">{emp.email}</td>
                <td className="px-4 py-3">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${ROLE_COLORS[emp.role] || 'bg-slate-100'}`}>
                    {ROLE_LABELS[emp.role] || emp.role}
                  </span>
                </td>
                <td className="px-4 py-3 text-slate-600 font-mono text-xs">{emp.card_id ? `****${emp.card_id.slice(-4)}` : '—'}</td>
                <td className="px-4 py-3">
                  {emp.has_pin ? <Key className="w-3.5 h-3.5 text-green-500" /> : <span className="text-slate-300">—</span>}
                </td>
                <td className="px-4 py-3">
                  <div className="flex gap-1">
                    <button onClick={() => openEdit(emp)} className="p-1 hover:bg-slate-100 rounded"><Edit2 className="w-3.5 h-3.5 text-slate-400" /></button>
                    <button onClick={() => handleDelete(emp.id)} className="p-1 hover:bg-red-50 rounded"><Trash2 className="w-3.5 h-3.5 text-red-400" /></button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/30 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">{editItem ? 'Modifier l\'employé' : 'Nouvel employé'}</h2>
            <form onSubmit={handleSubmit} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">Prénom *</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" required
                    value={form.first_name} onChange={e => setForm({ ...form, first_name: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Nom *</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" required
                    value={form.last_name} onChange={e => setForm({ ...form, last_name: e.target.value })} />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Email *</label>
                <input type="email" className="w-full border rounded-lg px-3 py-2 text-sm" required
                  value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">{editItem ? 'Nouveau mot de passe (vide = inchangé)' : 'Mot de passe *'}</label>
                <input type="password" className="w-full border rounded-lg px-3 py-2 text-sm" required={!editItem}
                  value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Rôle *</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm" required
                  value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}>
                  {Object.entries(ROLE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium mb-1">NIP (4+ chiffres)</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm" placeholder={editItem ? 'Vide = inchangé' : ''}
                    value={form.pin} onChange={e => setForm({ ...form, pin: e.target.value })} />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">ID Carte</label>
                  <input className="w-full border rounded-lg px-3 py-2 text-sm"
                    value={form.card_id} onChange={e => setForm({ ...form, card_id: e.target.value })} />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => { setShowForm(false); setEditItem(null); }}
                  className="flex-1 border rounded-lg py-2 text-sm hover:bg-slate-50">Annuler</button>
                <button type="submit"
                  className="flex-1 bg-blue-600 text-white rounded-lg py-2 text-sm font-medium hover:bg-blue-700">{editItem ? 'Mettre à jour' : 'Créer'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
