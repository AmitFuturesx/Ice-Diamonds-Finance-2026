import React, { useState } from 'react';
import { dbService } from '../lib/supabase';
import BrandLogo from './BrandLogo';
import OIcon from '../orbit/Icon';

interface LoginViewProps {
  onLoginSuccess: (user: any) => void;
}

/** Sign-in in the Orbit look: green gradient frame, white card, the same fields as before. */
export default function LoginView({ onLoginSuccess }: LoginViewProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [show, setShow] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('צריך למלא אימייל וסיסמה');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await dbService.login(email, password);
      if (res.success) onLoginSuccess(res.user);
      else setError(res.error || 'שגיאה בהתחברות');
    } catch (err: any) {
      setError(err.message || 'שגיאה במערכת');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="ice-login">
      <div className="ice-login-frame">
        <section className="ice-login-side" aria-hidden="true">
          <span className="ice-brand-mark ice-login-mark">
            <BrandLogo size={46} cutout="#ffffff" />
          </span>
          <h2>Ice Diamonds</h2>
          <p>מערכת ניהול כספים</p>
          <ul>
            <li>
              <OIcon name="check" /> תזרים, הוצאות וחובות במקום אחד
            </li>
            <li>
              <OIcon name="check" /> מי מחכה לתשלום, ומתי
            </li>
            <li>
              <OIcon name="check" /> שכר ועמלות מחושבים לבד
            </li>
          </ul>
        </section>

        <form className="ice-login-card" onSubmit={handleSubmit} noValidate>
          <span className="ice-brand-mark ice-login-mark ice-login-mark--sm">
            <BrandLogo size={34} cutout="#ffffff" />
          </span>
          <h1>כניסה למערכת</h1>
          <p className="ice-login-sub">התחבר עם המשתמש של אייס דיימונדס</p>

          {error && (
            <div className="ice-login-error" role="alert">
              <OIcon name="shield" />
              <span>{error}</span>
            </div>
          )}

          <label className="field is-full">
            <span className="field-label">אימייל</span>
            <input id="email-input" type="email" autoComplete="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" autoFocus />
          </label>

          <label className="field is-full">
            <span className="field-label">סיסמה</span>
            <span className="ice-pass">
              <input
                id="password-input"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                dir="ltr"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
              />
              <button type="button" className="icon-btn icon-btn--sm" onClick={() => setShow((s) => !s)} aria-label={show ? 'הסתרת הסיסמה' : 'הצגת הסיסמה'}>
                <OIcon name="eye" />
              </button>
            </span>
          </label>

          <button id="login-btn" type="submit" className="btn btn--primary btn--block ice-login-btn" disabled={loading}>
            {loading ? 'מתחבר...' : 'כניסה'}
          </button>
          <p className="ice-login-foot">Ice Diamonds · © 2026</p>
        </form>
      </div>
    </div>
  );
}
