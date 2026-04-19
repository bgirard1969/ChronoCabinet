import React from 'react';
import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Calendar, Box, Package, ShoppingCart, Users, Activity, LogOut, ClipboardCheck } from 'lucide-react';

const NAV_ITEMS = [
  { to: '/management/interventions', label: 'Interventions', icon: Calendar },
  { to: '/management/cabinets', label: 'Cabinets', icon: Box },
  { to: '/management/products', label: 'Produits', icon: Package },
  { to: '/management/orders', label: 'Commandes', icon: ShoppingCart },
  { to: '/management/consumption', label: 'Consommation', icon: ClipboardCheck },
  { to: '/management/employees', label: 'Employés', icon: Users },
  { to: '/management/movements', label: 'Mouvements', icon: Activity },
];

export default function AdminLayout({ user, onLogout }) {
  const navigate = useNavigate();

  const handleLogout = () => {
    onLogout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-slate-200 flex flex-col shrink-0">
        <div className="p-4 border-b border-slate-200">
          <h1 className="text-lg font-bold text-blue-700 tracking-tight">Chrono DMI</h1>
          <p className="text-xs text-slate-400">Gestion</p>
        </div>

        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              data-testid={`nav-${to.split('/').pop()}`}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`
              }
            >
              <Icon className="w-4 h-4" />
              {label}
            </NavLink>
          ))}
        </nav>

        <div className="p-3 border-t border-slate-200">
          <div className="flex items-center gap-2 px-2 mb-2">
            <div className="w-7 h-7 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center text-xs font-bold">
              {user?.first_name?.[0]}{user?.last_name?.[0]}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-slate-700 truncate">{user?.first_name} {user?.last_name}</p>
              <p className="text-[10px] text-slate-400 capitalize">{user?.role}</p>
            </div>
          </div>
          <button
            data-testid="logout-btn"
            onClick={handleLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-red-600 hover:bg-red-50 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Déconnexion
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
