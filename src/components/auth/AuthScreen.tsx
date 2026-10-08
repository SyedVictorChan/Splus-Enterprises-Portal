import React, { useState } from 'react';
import {
  Shield,
  Lock,
  Mail,
  Key,
  ArrowRight,
  AlertCircle,
  Eye,
  EyeOff
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

interface AuthScreenProps {
  darkMode: boolean;
}

export const AuthScreen: React.FC<AuthScreenProps> = () => {
  const {
    signInEmail,
    authSecurityError,
    clearAuthSecurityError
  } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const activeError = authSecurityError || error;

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (typeof clearAuthSecurityError === 'function') {
      clearAuthSecurityError();
    }

    const trimmedEmail = email.trim().toLowerCase();
    const trimmedPass = password.trim();

    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setError('Please provide a valid corporate email address.');
      return;
    }

    if (!trimmedPass) {
      setError('Please enter your password.');
      return;
    }

    setLoading(true);
    try {
      await signInEmail(trimmedEmail, trimmedPass);
    } catch (err: any) {
      console.error('Sign-in error:', err);
      setError(err?.message || 'Authentication failed. Please verify your credentials.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full bg-zinc-950 text-zinc-100 flex flex-col items-center justify-center p-4 selection:bg-zinc-800">
      {/* Background Ambience */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden opacity-30">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-zinc-800 rounded-full blur-3xl"></div>
        <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-zinc-900 rounded-full blur-3xl"></div>
      </div>

      <div className="relative w-full max-w-md z-10 my-8">
        {/* Organization Brand Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white text-black font-black text-xl shadow-lg mb-3">
            S+
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Splus Enterprise Portal
          </h1>
          <p className="text-xs text-zinc-400 mt-1">
            Multi-Marketplace Sales Intelligence & Operations Platform
          </p>

          <div className="inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full bg-zinc-900 border border-zinc-800 text-[11px] font-medium text-emerald-400">
            <Lock size={12} className="text-amber-400" />
            <span className="text-zinc-300">
              Private Organization: <strong className="text-emerald-400">Authorized Access Only</strong>
            </span>
          </div>
        </div>

        {/* Card Container */}
        <div className="bg-zinc-900/90 backdrop-blur-md border border-zinc-800 rounded-2xl p-6 sm:p-8 shadow-2xl space-y-5">
          {/* Required Administrator Authorization Note */}
          <div className="p-3.5 rounded-xl bg-amber-950/40 border border-amber-800/60 text-amber-200/90 text-xs leading-relaxed flex items-start gap-2.5">
            <Shield size={16} className="shrink-0 mt-0.5 text-amber-400" />
            <div>
              <p className="font-medium text-amber-100">
                Only Admin can allow you to access this portal for login in this portal contact admin{' '}
                <a
                  href="mailto:data.processor@splustech.com"
                  className="font-bold text-amber-300 underline underline-offset-2 hover:text-white"
                >
                  data.processor@splustech.com
                </a>
              </p>
            </div>
          </div>

          {/* Active Error Alert */}
          {activeError && (
            <div className="p-3 rounded-xl bg-red-950/70 border border-red-800 text-red-200 text-xs flex items-start gap-2 shadow-sm">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-red-400" />
              <div className="leading-relaxed">
                {activeError}
              </div>
            </div>
          )}

          {/* Sign In Form Only */}
          <form onSubmit={handleSignIn} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail size={15} className="absolute left-3 top-3 text-zinc-500" />
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@splustech.com"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-zinc-500"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1.5">
                Password
              </label>
              <div className="relative">
                <Key size={15} className="absolute left-3 top-3 text-zinc-500" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-9 pr-10 py-2.5 text-xs text-white placeholder-zinc-600 focus:outline-hidden focus:border-zinc-500"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-zinc-500 hover:text-zinc-300 cursor-pointer"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-2.5 px-4 rounded-xl bg-white hover:bg-zinc-100 text-zinc-950 font-bold text-xs flex items-center justify-center gap-2 transition-colors disabled:opacity-50 cursor-pointer shadow-sm mt-2"
            >
              <span>{loading ? 'Authenticating...' : 'Sign In'}</span>
              <ArrowRight size={14} />
            </button>
          </form>
        </div>

        {/* Footer Badges */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-4 text-[11px] text-zinc-500">
          <span className="flex items-center gap-1">
            <Lock size={12} className="text-zinc-400" />
            TLS / AES-256 Protected
          </span>
          <span>•</span>
          <span className="flex items-center gap-1">
            <Shield size={12} className="text-zinc-400" />
            Admin-Managed Whitelist
          </span>
        </div>
      </div>
    </div>
  );
};
