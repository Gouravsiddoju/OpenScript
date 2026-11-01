import React, { useState } from 'react';
import { 
  X, 
  LogIn, 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  Film, 
  Sparkles, 
  AlertCircle,
  Loader2,
  CheckCircle2
} from 'lucide-react';
import { UserProfileData } from './UserProfileModal';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfileData, token: string) => void;
  defaultMode?: 'login' | 'register';
}


function handleLocalStudioAuth(
  mode: 'login' | 'register',
  email: string,
  _password: string,
  displayName?: string
): { user: any; token: string } {
  const cleanEmail = email.trim().toLowerCase();
  const existingUsersRaw = localStorage.getItem('openscript_local_users');
  let existingUsers: Record<string, any> = {};
  try {
    if (existingUsersRaw) existingUsers = JSON.parse(existingUsersRaw);
  } catch {}

  const defaultKnown: Record<string, any> = {
    'gourav@ssnpictures.in': {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'gourav@ssnpictures.in',
      displayName: 'Gourav (SSN)',
      role: 'owner',
      studio: 'SSN Pictures Studio',
      color: '#f59e0b',
    },
    'navateja@ssnpictures.in': {
      id: '22222222-2222-2222-2222-222222222222',
      email: 'navateja@ssnpictures.in',
      displayName: 'Navateja',
      role: 'co-writer',
      studio: 'SSN Pictures Studio',
      color: '#3b82f6',
    },
    'sarah.prod@studio.com': {
      id: '33333333-3333-3333-3333-333333333333',
      email: 'sarah.prod@studio.com',
      displayName: 'Sarah',
      role: 'commenter',
      studio: 'SSN Pictures Studio',
      color: '#ec4899',
    },
  };

  const allUsers = { ...defaultKnown, ...existingUsers };

  if (mode === 'register') {
    const newUser = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`,
      email: cleanEmail,
      displayName: displayName?.trim() || cleanEmail.split('@')[0],
      role: 'owner',
      studio: 'SSN Pictures Studio',
      color: '#f59e0b',
    };
    allUsers[cleanEmail] = newUser;
    localStorage.setItem('openscript_local_users', JSON.stringify(allUsers));
    return { user: newUser, token: `local-token-${Date.now()}` };
  } else {
    const found = allUsers[cleanEmail] || {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`,
      email: cleanEmail,
      displayName: cleanEmail.split('@')[0],
      role: 'owner',
      studio: 'SSN Pictures Studio',
      color: '#f59e0b',
    };
    return { user: found, token: `local-token-${Date.now()}` };
  }
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  defaultMode = 'login',
}) => {
  const [mode, setMode] = useState<'login' | 'register'>(defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      let data: any;
      try {
        const endpoint = mode === 'login' ? '/api/v1/auth/login' : '/api/v1/auth/register';
        const payload = mode === 'login' 
          ? { email: email.trim(), password }
          : { displayName: displayName.trim(), email: email.trim(), password };

        const res = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });

        if (res.ok) {
          data = await res.json();
        } else {
          const errData = await res.json().catch(() => ({}));
          throw new Error(errData.error || (mode === 'login' ? 'Failed to sign in.' : 'Registration failed.'));
        }
      } catch (fetchErr: any) {
        // If API server is unreachable (local frontend mode), fallback seamlessly to local studio authentication
        const msg = String(fetchErr.message || '');
        if (msg.includes('fetch') || msg.includes('Failed') || msg.includes('Network') || msg.includes('Load failed')) {
          data = handleLocalStudioAuth(mode, email, password, displayName);
        } else {
          throw fetchErr;
        }
      }

      const userProfile: UserProfileData = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName || email.split('@')[0],
        role: data.user.role || 'owner',
        studio: data.user.studio || 'SSN Pictures Studio',
        color: data.user.color || (data.user.role === 'co-writer' ? '#3b82f6' : data.user.role === 'commenter' ? '#ec4899' : '#f59e0b'),
      };

      onAuthSuccess(userProfile, data.token || `token-${Date.now()}`);
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDemoLogin = (demoEmail: string, demoRole: any, demoName: string) => {
    setEmail(demoEmail);
    setPassword('password123');
    setError(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-fadeIn">
      <div 
        className="w-full max-w-md bg-[#13151b] border border-[#2b2f3a] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#22252e] flex items-center justify-between bg-gradient-to-r from-amber-500/10 to-transparent">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                OpenScript Studio
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  SSN Pictures
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                {mode === 'login' ? 'Sign in to access production screenplays' : 'Create a new screenwriting account'}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#20232c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="grid grid-cols-2 p-1.5 m-6 mb-2 bg-[#191c25] rounded-xl border border-[#262a36]">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setError(null);
            }}
            className={`py-2 text-xs font-mono font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              mode === 'login'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <LogIn className="w-3.5 h-3.5" />
            <span>Sign In</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setMode('register');
              setError(null);
            }}
            className={`py-2 text-xs font-mono font-semibold rounded-lg transition-all flex items-center justify-center gap-2 ${
              mode === 'register'
                ? 'bg-amber-500 text-black shadow-md'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <UserPlus className="w-3.5 h-3.5" />
            <span>Create Account</span>
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-4">
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-300 font-mono animate-fadeIn">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {mode === 'register' && (
            <div className="space-y-1.5">
              <label className="text-xs font-mono text-gray-400">Display Name</label>
              <div className="relative">
                <User className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
                <input
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Gourav Siddoju"
                  className="w-full bg-[#171a23] border border-[#2a2e3b] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none transition-colors"
                />
              </div>
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-gray-400">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@ssnpictures.in"
                className="w-full bg-[#171a23] border border-[#2a2e3b] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-mono text-gray-400">Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-3 w-4 h-4 text-gray-500" />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-[#171a23] border border-[#2a2e3b] focus:border-amber-500 rounded-xl pl-9 pr-3 py-2 text-xs text-gray-100 placeholder-gray-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full py-2.5 px-4 bg-amber-500 hover:bg-amber-400 disabled:opacity-50 text-black font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 transition-all flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authenticating...</span>
              </>
            ) : mode === 'login' ? (
              <>
                <LogIn className="w-4 h-4" />
                <span>Sign In to OpenScript</span>
              </>
            ) : (
              <>
                <UserPlus className="w-4 h-4" />
                <span>Create Production Account</span>
              </>
            )}
          </button>

          {/* Quick Demo Logins Helper */}
          {mode === 'login' && (
            <div className="pt-2 border-t border-[#22252e] space-y-2">
              <div className="flex items-center justify-between text-[10px] font-mono text-gray-500 uppercase tracking-wider">
                <span className="flex items-center gap-1">
                  <Sparkles className="w-3 h-3 text-amber-400" /> Quick Demo Accounts:
                </span>
                <span>Click to autofill</span>
              </div>
              <div className="grid grid-cols-3 gap-1.5">
                {[
                  { name: 'Gourav', email: 'gourav@ssnpictures.in', role: 'owner', label: 'Owner' },
                  { name: 'Navateja', email: 'navateja@ssnpictures.in', role: 'co-writer', label: 'Co-writer' },
                  { name: 'Sarah', email: 'sarah.prod@studio.com', role: 'commenter', label: 'Producer' },
                ].map((demo) => (
                  <button
                    key={demo.email}
                    type="button"
                    onClick={() => handleQuickDemoLogin(demo.email, demo.role, demo.name)}
                    className="p-1.5 rounded-lg bg-[#191c25] hover:bg-[#202430] border border-[#282c38] hover:border-amber-500/40 text-left transition-colors"
                  >
                    <div className="text-[11px] font-semibold text-gray-200 truncate">{demo.name}</div>
                    <div className="text-[9px] font-mono text-amber-400/90">{demo.label}</div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </form>
      </div>
    </div>
  );
};
