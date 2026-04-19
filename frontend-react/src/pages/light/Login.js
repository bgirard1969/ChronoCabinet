import React, { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import axios from 'axios';
import { AlertTriangle, Delete, ArrowLeft, CreditCard, Keyboard } from 'lucide-react';

const API = `${process.env.REACT_APP_BACKEND_URL}/api`;

export default function LightLogin({ onLogin }) {
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState('pin'); // 'pin' | 'card'
  const [cardInput, setCardInput] = useState('');
  const [shakeError, setShakeError] = useState(false);
  const [successFlash, setSuccessFlash] = useState(false);
  const navigate = useNavigate();
  const cardRef = useRef(null);
  const cardTimerRef = useRef(null);

  // Focus card input in card mode
  useEffect(() => {
    if (mode === 'card' && cardRef.current) cardRef.current.focus();
  }, [mode]);

  const triggerError = () => {
    setShakeError(true);
    setTimeout(() => setShakeError(false), 500);
  };

  const triggerSuccess = () => {
    setSuccessFlash(true);
    setTimeout(() => setSuccessFlash(false), 600);
  };

  const handleDigit = (d) => setPin(prev => prev.length < 8 ? prev + d : prev);
  const handleDelete = () => setPin(prev => prev.slice(0, -1));
  const handleClear = () => setPin('');

  const handlePinSubmit = async () => {
    if (!pin) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login-pin`, { pin });
      triggerSuccess();
      setTimeout(() => {
        toast.success(`Bienvenue, ${res.data.user.first_name}`);
        onLogin(res.data.access_token, res.data.user, 'production');
      }, 400);
    } catch (err) {
      triggerError();
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'NIP invalide');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Card reader: captures rapid keystrokes from RFID readers
  const handleCardInput = useCallback(async (value) => {
    const cardId = value.trim();
    if (!cardId) return;
    setLoading(true);
    try {
      const res = await axios.post(`${API}/auth/login-card`, { card_id: cardId });
      triggerSuccess();
      setTimeout(() => {
        toast.success(`Bienvenue, ${res.data.user.first_name}`);
        onLogin(res.data.access_token, res.data.user, 'production');
      }, 400);
    } catch (err) {
      triggerError();
      const detail = err.response?.data?.detail;
      toast.error(typeof detail === 'string' ? detail : 'Carte non reconnue');
      setCardInput('');
      if (cardRef.current) cardRef.current.focus();
    } finally {
      setLoading(false);
    }
  }, [onLogin]);

  // Auto-submit card after a pause in input (RFID readers type fast then stop)
  const onCardChange = (e) => {
    const val = e.target.value;
    setCardInput(val);
    if (cardTimerRef.current) clearTimeout(cardTimerRef.current);
    if (val.length >= 4) {
      cardTimerRef.current = setTimeout(() => handleCardInput(val), 300);
    }
  };

  const onCardKeyDown = (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (cardTimerRef.current) clearTimeout(cardTimerRef.current);
      handleCardInput(cardInput);
    }
  };

  const handleEmergency = async () => {
    try {
      await axios.post(`${API}/hardware/emergency`, {}, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token') || ''}` }
      });
    } catch {}
    toast.warning('Mode urgence activé — cabinets déverrouillés');
  };

  return (
    <div className={`min-h-screen flex flex-col items-center justify-center p-4 select-none transition-colors duration-300 ${
      successFlash ? 'bg-green-900' : 'bg-slate-900'
    }`}>
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-white tracking-tight">Chrono DMI</h1>
        <p className="text-sm text-slate-400 mt-1">Production</p>
      </div>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-4 bg-slate-800 rounded-xl p-1">
        <button
          data-testid="mode-pin"
          onClick={() => { setMode('pin'); setCardInput(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'pin' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Keyboard className="w-4 h-4" /> NIP
        </button>
        <button
          data-testid="mode-card"
          onClick={() => { setMode('card'); setPin(''); }}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            mode === 'card' ? 'bg-blue-600 text-white' : 'text-slate-400 hover:text-white'
          }`}
        >
          <CreditCard className="w-4 h-4" /> Carte
        </button>
      </div>

      <div className={`bg-slate-800 rounded-2xl p-8 w-full max-w-sm transition-transform ${
        shakeError ? 'animate-shake' : ''
      }`}>

        {mode === 'pin' ? (
          <>
            {/* PIN display */}
            <div className={`rounded-xl px-4 py-4 mb-6 text-center min-h-[56px] flex items-center justify-center transition-colors ${
              successFlash ? 'bg-green-700' : 'bg-slate-700'
            }`}>
              {pin ? (
                <div className="flex gap-2 justify-center">
                  {pin.split('').map((_, i) => (
                    <div key={i} className={`w-3.5 h-3.5 rounded-full transition-all ${
                      successFlash ? 'bg-green-300 scale-110' : 'bg-blue-400'
                    }`} style={{ animationDelay: `${i * 50}ms` }} />
                  ))}
                </div>
              ) : (
                <p className="text-slate-500 text-sm">Entrez votre NIP</p>
              )}
            </div>

            {/* Numpad */}
            <div className="grid grid-cols-3 gap-2 mb-4">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => (
                <button
                  key={d}
                  data-testid={`numpad-${d}`}
                  onClick={() => handleDigit(String(d))}
                  className="h-16 rounded-xl bg-slate-700 text-white text-2xl font-bold hover:bg-slate-600 active:scale-95 active:bg-blue-600 transition-all"
                >
                  {d}
                </button>
              ))}
              <button onClick={handleClear} data-testid="numpad-clear"
                className="h-16 rounded-xl bg-slate-700 text-slate-400 text-sm font-medium hover:bg-slate-600 active:scale-95 transition-all">
                C
              </button>
              <button onClick={() => handleDigit('0')} data-testid="numpad-0"
                className="h-16 rounded-xl bg-slate-700 text-white text-2xl font-bold hover:bg-slate-600 active:scale-95 active:bg-blue-600 transition-all">
                0
              </button>
              <button onClick={handleDelete} data-testid="numpad-delete"
                className="h-16 rounded-xl bg-slate-700 text-slate-400 hover:bg-slate-600 active:scale-95 transition-all flex items-center justify-center">
                <Delete className="w-6 h-6" />
              </button>
            </div>

            {/* Submit */}
            <button
              data-testid="pin-submit"
              onClick={handlePinSubmit}
              disabled={!pin || loading}
              className="w-full h-14 rounded-xl bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 transition-all mb-3"
            >
              {loading ? 'Connexion...' : 'Confirmer'}
            </button>
          </>
        ) : (
          <>
            {/* Card scan mode */}
            <div className={`rounded-xl px-6 py-8 mb-6 text-center transition-colors ${
              successFlash ? 'bg-green-700' : 'bg-slate-700'
            }`}>
              <CreditCard className={`w-12 h-12 mx-auto mb-3 ${
                successFlash ? 'text-green-300' : loading ? 'text-blue-400 animate-pulse' : 'text-slate-500'
              }`} />
              <p className="text-white font-medium">
                {loading ? 'Lecture en cours...' : 'Scannez votre carte employé'}
              </p>
              <p className="text-slate-400 text-xs mt-1">Passez votre carte devant le lecteur RFID</p>
            </div>

            {/* Hidden input for card reader */}
            <input
              ref={cardRef}
              data-testid="card-input"
              className="w-full bg-slate-700 border border-slate-600 rounded-xl px-4 py-3 text-white text-center text-lg font-mono placeholder-slate-500 outline-none focus:border-blue-500 mb-4"
              placeholder="ID de carte..."
              value={cardInput}
              onChange={onCardChange}
              onKeyDown={onCardKeyDown}
              autoFocus
            />

            <button
              data-testid="card-submit"
              onClick={() => handleCardInput(cardInput)}
              disabled={!cardInput || loading}
              className="w-full h-14 rounded-xl bg-blue-600 text-white text-lg font-bold hover:bg-blue-700 active:scale-[0.98] disabled:opacity-40 transition-all mb-3"
            >
              {loading ? 'Vérification...' : 'Valider manuellement'}
            </button>
          </>
        )}

        {/* Emergency */}
        <button
          data-testid="emergency-btn"
          onClick={handleEmergency}
          className="w-full h-14 rounded-xl bg-red-600 text-white text-lg font-bold hover:bg-red-700 active:scale-[0.98] transition-all flex items-center justify-center gap-3"
        >
          <AlertTriangle className="w-6 h-6" />
          URGENCE
        </button>
      </div>

      <a href="/" className="mt-6 flex items-center gap-2 text-sm text-slate-500 hover:text-white transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Gestion
      </a>

      {/* Shake animation */}
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20% { transform: translateX(-12px); }
          40% { transform: translateX(10px); }
          60% { transform: translateX(-8px); }
          80% { transform: translateX(6px); }
        }
        .animate-shake { animation: shake 0.4s ease-in-out; }
      `}</style>
    </div>
  );
}
