import React, { useState, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import axios from 'axios';
import { Toaster } from 'sonner';
import '@/App.css';

// Pages Gestion (ex Client Lourd)
import AdminLayout from '@/pages/admin/AdminLayout';
import AdminInterventions from '@/pages/admin/Interventions';
import AdminCabinets from '@/pages/admin/Cabinets';
import AdminProducts from '@/pages/admin/Products';
import AdminOrders from '@/pages/admin/Orders';
import AdminEmployees from '@/pages/admin/Employees';
import AdminMovements from '@/pages/admin/Movements';
import AdminConsumption from '@/pages/admin/Consumption';

// Pages Production (ex Client Léger)
import LightLogin from '@/pages/light/Login';
import LightInterventions from '@/pages/light/Interventions';
import LightPicking from '@/pages/light/Picking';
import LightRestock from '@/pages/light/Restock';
import LightPickingLibre from '@/pages/light/PickingLibre';

// Shared
import Login from '@/pages/Login';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export const api = axios.create({ baseURL: API });

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.data?.detail) {
      const detail = error.response.data.detail;
      if (typeof detail === 'string') {
        error.message = detail;
      } else if (Array.isArray(detail)) {
        error.message = detail.map(d => (typeof d === 'string' ? d : d.msg || JSON.stringify(d))).join(', ');
      } else if (typeof detail === 'object') {
        error.message = detail.msg || detail.message || JSON.stringify(detail);
      }
      error.response.data.detail = error.message;
    }
    return Promise.reject(error);
  }
);

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [clientMode, setClientMode] = useState(null); // 'management' or 'production'

  useEffect(() => {
    const token = localStorage.getItem('token');
    const mode = localStorage.getItem('clientMode');
    if (token) {
      api.get('/auth/me')
        .then((res) => {
          setUser(res.data);
          setClientMode(mode || 'management');
        })
        .catch(() => {
          localStorage.removeItem('token');
          localStorage.removeItem('clientMode');
        })
        .finally(() => setLoading(false));
    } else {
      setLoading(false);
    }
  }, []);

  const handleLogin = (token, userData, mode = 'management') => {
    localStorage.setItem('token', token);
    localStorage.setItem('clientMode', mode);
    setUser(userData);
    setClientMode(mode);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('clientMode');
    setUser(null);
    setClientMode(null);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
      </div>
    );
  }

  return (
    <BrowserRouter>
      <Toaster position="bottom-center" richColors />
      <Routes>
        {/* Entry point */}
        <Route path="/" element={
          user ? <Navigate to={clientMode === 'production' ? '/production/interventions' : '/management/interventions'} /> : <Login onLogin={handleLogin} />
        } />

        {/* Production routes */}
        <Route path="/production/login" element={
          user ? <Navigate to="/production/interventions" /> : <LightLogin onLogin={handleLogin} />
        } />
        <Route path="/production/interventions" element={
          user ? <LightInterventions user={user} onLogout={handleLogout} /> : <Navigate to="/production/login" />
        } />
        <Route path="/production/picking/:interventionId" element={
          user ? <LightPicking user={user} onLogout={handleLogout} /> : <Navigate to="/production/login" />
        } />
        <Route path="/production/restock" element={
          user ? <LightRestock user={user} onLogout={handleLogout} /> : <Navigate to="/production/login" />
        } />
        <Route path="/production/picking-libre" element={
          user ? <LightPickingLibre user={user} onLogout={handleLogout} /> : <Navigate to="/production/login" />
        } />

        {/* Management routes */}
        <Route path="/management/*" element={
          user && ['administrateur', 'gestionnaire'].includes(user.role)
            ? <AdminLayout user={user} onLogout={handleLogout} />
            : <Navigate to="/" />
        }>
          <Route path="interventions" element={<AdminInterventions />} />
          <Route path="cabinets" element={<AdminCabinets />} />
          <Route path="products" element={<AdminProducts />} />
          <Route path="orders" element={<AdminOrders />} />
          <Route path="consumption" element={<AdminConsumption />} />
          <Route path="employees" element={<AdminEmployees />} />
          <Route path="movements" element={<AdminMovements />} />
          <Route index element={<Navigate to="interventions" />} />
        </Route>

        <Route path="*" element={<Navigate to="/" />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
