import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Activity, Package, Layers, MapPin, PackagePlus, PackageSearch, Scan, TrendingUp, ShoppingCart, Truck, FileText, AlertTriangle, LogOut, Building2, Tag, Users, Settings, Globe } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

const Navbar = ({ user, onLogout }) => {
  const location = useLocation();
  const { language, toggleLanguage, t } = useLanguage();
  
  // Check if user is a clinicien - only show picking menu
  const isClinician = user?.role === 'clinicien';

  const allNavItems = [
    { path: '/', icon: Activity, labelKey: 'dashboard' },
    { path: '/products', icon: Package, labelKey: 'products' },
    { path: '/batches', icon: Layers, labelKey: 'batches' },
    { path: '/locations', icon: MapPin, labelKey: 'locations' },
    { path: '/replenishment', icon: ShoppingCart, labelKey: 'replenishment' },
    { path: '/purchase-orders', icon: Truck, labelKey: 'orders' },
    { path: '/picking', icon: PackageSearch, labelKey: 'picking' },
    { path: '/placement', icon: PackagePlus, labelKey: 'restocking' },
    { path: '/scanner', icon: Scan, labelKey: 'scanner' },
    { path: '/movements', icon: TrendingUp, labelKey: 'movements' },
    { path: '/alerts', icon: AlertTriangle, labelKey: 'alerts' },
    { type: 'divider', labelKey: 'configuration' },
    { path: '/fabricants', icon: Building2, labelKey: 'suppliers' },
    { path: '/types-produit', icon: Tag, labelKey: 'productTypes' },
    { type: 'divider', labelKey: 'administration' },
    { path: '/management/employees', icon: Users, labelKey: 'employees' },
  ];
  
  // For clinician, only show picking
  const navItems = isClinician 
    ? allNavItems.filter(item => item.path === '/picking')
    : allNavItems;

  return (
    <nav className="fixed left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col z-50" data-testid="navbar">
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-blue-600" style={{ fontFamily: 'Space Grotesk' }}>Chrono DMI</h1>
          <button
            onClick={toggleLanguage}
            className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
            title={language === 'fr' ? 'Switch to English' : 'Passer en français'}
          >
            <Globe size={14} />
            <span className="uppercase">{language === 'fr' ? 'EN' : 'FR'}</span>
          </button>
        </div>
        <p className="text-xs text-gray-500 mt-1">{t('appSubtitle')}</p>
      </div>

      <div className="flex-1 p-4 overflow-y-auto">
        {navItems.map((item, idx) => {
          if (item.type === 'divider') {
            return (
              <div key={idx} className="mt-4 mb-2 px-4">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">{t(item.labelKey)}</p>
              </div>
            );
          }
          
          const Icon = item.icon;
          const isActive = location.pathname === item.path;

          return (
            <Link
              key={item.path}
              to={item.path}
              data-testid={`nav-${item.labelKey}`}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg mb-1 transition-all ${
                isActive
                  ? 'bg-blue-50 text-blue-600 font-medium'
                  : 'text-gray-700 hover:bg-gray-50'
              }`}
            >
              <Icon size={20} />
              <span>{t(item.labelKey)}</span>
            </Link>
          );
        })}
      </div>

      <div className="p-4 border-t border-gray-200">
        <div className="flex items-center gap-3 px-4 py-3 mb-2">
          <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-semibold">
            {user?.prenom?.[0]}{user?.nom?.[0]}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate">{user?.prenom} {user?.nom}</p>
            <p className="text-xs text-gray-500 truncate">{user?.email}</p>
          </div>
        </div>
        <button
          onClick={onLogout}
          data-testid="logout-button"
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-600 hover:bg-red-50 w-full transition-colors"
        >
          <LogOut size={20} />
          <span>{t('logout')}</span>
        </button>
      </div>
    </nav>
  );
};

export default Navbar;