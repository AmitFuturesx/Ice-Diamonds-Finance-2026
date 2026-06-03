import React, { useState } from 'react';
import { dbService, isLiveSupabase } from '../lib/supabase';
import { ShieldAlert, KeyRound, Mail } from 'lucide-react';
import BrandLogo from './BrandLogo';

interface LoginViewProps {
  onLoginSuccess: (user: any) => void;
}

export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('אנא מלא את כל השדות');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await dbService.login(email, password);
      if (res.success) {
        onLoginSuccess(res.user);
      } else {
        setError(res.error || 'שגיאה בהתחברות');
      }
    } catch (err: any) {
      setError(err.message || 'שגיאה במערכת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4 py-12 relative overflow-hidden">
      {/* Decorative background glow elements */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#22c55e]/5 rounded-full blur-[100px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-emerald-500/5 rounded-full blur-[100px] pointer-events-none"></div>

      <div className="w-full max-w-md space-y-8 bg-[#111] border border-white/10 p-8 rounded-2xl relative z-10 shadow-2xl">
        
        {/* Branding header */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center justify-center">
            <BrandLogo size={90} className="animate-pulse" />
          </div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white mt-1">
            ICE DIAMONDS
          </h1>
          <p className="text-[#22c55e] font-sans tracking-widest text-xs uppercase font-semibold">
            מערכת ניהול כספים
          </p>
          <p className="text-gray-400 text-xs">
            מערכת ניהול פיננסית חכמה ומלוטשת לעסקי תכשיטים ויהלומים
          </p>
        </div>



        {error && (
          <div className="flex items-center gap-2 bg-rose-500/10 border border-rose-500/20 text-rose-450 text-xs p-3.5 rounded-lg font-medium">
            <ShieldAlert className="w-4.5 h-4.5 shrink-0 text-rose-500" />
            <span>{error}</span>
          </div>
        )}

        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 block">כתובת דוא״ל</label>
            <div className="relative font-mono">
              <span className="absolute inset-y-0 right-0 pr-3.5 text-gray-500 flex items-center">
                <Mail className="w-4 h-4" />
              </span>
              <input
                id="email-input"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="example@jewel.com"
                className="w-full bg-[#141414] border border-white/10 outline-none rounded-xl py-3 pr-10 pl-4 text-sm text-white placeholder-gray-650 focus:border-[#22c55e]/70 focus:ring-1 focus:ring-[#22c55e]/20 transition-all font-mono text-left"
                style={{ direction: 'ltr' }}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-400 block">סיסמה סודית</label>
            <div className="relative font-mono">
              <span className="absolute inset-y-0 right-0 pr-3.5 text-gray-500 flex items-center">
                <KeyRound className="w-4 h-4" />
              </span>
              <input
                id="password-input"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#141414] border border-white/10 outline-none rounded-xl py-3 pr-10 pl-4 text-sm text-white placeholder-gray-650 focus:border-[#22c55e]/70 focus:ring-1 focus:ring-[#22c55e]/20 transition-all font-mono text-left"
                style={{ direction: 'ltr' }}
              />
            </div>
          </div>

          <button
            id="login-btn"
            type="submit"
            disabled={loading}
            className="w-full py-3.5 px-4 bg-[#22c55e] hover:bg-emerald-400 disabled:bg-[#22c55e]/20 text-black font-extrabold rounded-xl text-sm transition-all duration-300 shadow-[0_0_15px_rgba(34,197,94,0.3)] focus:ring-2 focus:ring-emerald-500/20 active:scale-[0.98] cursor-pointer hover:scale-[1.01]"
          >
            {loading ? 'מתחבר למערכת...' : 'כניסה למערכת'}
          </button>
        </form>

        <div className="text-center pt-2 text-gray-500 text-xs font-medium font-sans">
          ICE DIAMONDS • © 2026 כל הזכויות שמורות
        </div>
      </div>
    </div>
  );
}
