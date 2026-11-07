import React, { useState, useEffect } from 'react';
import { 
  X, 
  LogIn, 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  AlertCircle,
  Loader2,
  CheckCircle2,
  Clapperboard,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  ShieldCheck
} from 'lucide-react';
import { UserProfileData, evaluatePasswordStrength } from './UserProfileModal';

export type AuthMode = 'login' | 'register' | 'forgot-password' | 'reset-password';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAuthSuccess: (user: UserProfileData, token: string, isNewUser?: boolean) => void;
  defaultMode?: AuthMode;
  initialResetToken?: string | null;
  isCompulsory?: boolean;
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

  if (mode === 'register') {
    const name = displayName?.trim() || cleanEmail.split('@')[0];
    const newUser = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`,
      email: cleanEmail,
      displayName: name,
      role: 'owner',
      studio: `${name}'s Studio`,
      color: '#f59e0b',
    };
    existingUsers[cleanEmail] = newUser;
    localStorage.setItem('openscript_local_users', JSON.stringify(existingUsers));
    return { user: newUser, token: `local-token-${Date.now()}` };
  } else {
    let found = existingUsers[cleanEmail];
    if (!found) {
      const name = cleanEmail.split('@')[0];
      found = {
        id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `user-${Date.now()}`,
        email: cleanEmail,
        displayName: name,
        role: 'owner',
        studio: `${name}'s Studio`,
        color: '#f59e0b',
      };
      existingUsers[cleanEmail] = found;
      localStorage.setItem('openscript_local_users', JSON.stringify(existingUsers));
    }
    return { user: found, token: `local-token-${Date.now()}` };
  }
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onAuthSuccess,
  defaultMode = 'register',
  initialResetToken = null,
  isCompulsory = false,
}) => {
  const [mode, setMode] = useState<AuthMode>(initialResetToken ? 'reset-password' : defaultMode);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resetToken, setResetToken] = useState(initialResetToken || '');
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const pwStrength = evaluatePasswordStrength(password);

  useEffect(() => {
    if (initialResetToken) {
      setResetToken(initialResetToken);
      setMode('reset-password');
    } else {
      setMode(defaultMode);
    }
  }, [defaultMode, initialResetToken]);

  if (!isOpen) return null;

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim() }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Failed to request password reset');
      }

      setSuccessMessage(`Password reset link sent to ${email.trim()}! Please check your inbox (and spam folder).`);
    } catch (err: any) {
      setError(err.message || 'Failed to send password reset link.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    const strength = evaluatePasswordStrength(password);
    if (!strength.isValid) {
      setError('Password must be at least 8 characters long and contain at least one letter and one number.');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match. Please re-enter.');
      return;
    }

    if (!resetToken.trim()) {
      setError('Missing or invalid reset token. Please click the link in your email.');
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: resetToken.trim(), newPassword: password }),
      });

      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to reset password');
      }

      if (data?.user && data?.token) {
        const userProfile: UserProfileData = {
          id: data.user.id,
          email: data.user.email,
          displayName: data.user.displayName || data.user.email.split('@')[0],
          role: data.user.role || 'owner',
          studio: data.user.studio || 'SSN Pictures Studio',
          color: '#f59e0b',
        };
        onAuthSuccess(userProfile, data.token, false);
        onClose();
      } else {
        setSuccessMessage('Password successfully changed! You can now sign in.');
        setMode('login');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to reset password. Link may have expired.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'forgot-password') return handleForgotPassword(e);
    if (mode === 'reset-password') return handleResetPassword(e);

    setError(null);

    if (mode === 'register') {
      const strength = evaluatePasswordStrength(password);
      if (!strength.isValid) {
        setError('Password must be at least 8 characters long and contain at least one letter and one number.');
        return;
      }
    }

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
          if (errData?.error && (res.status === 400 || res.status === 401 || res.status === 409)) {
            let errorMsg = errData.error;
            if (errData.details?.fieldErrors) {
              const details = Object.entries(errData.details.fieldErrors)
                .map(([field, msgs]: any) => `${field}: ${(msgs as string[]).join(', ')}`)
                .join('; ');
              if (details) errorMsg = `${errorMsg} (${details})`;
            }
            if (res.status === 409 || errorMsg.includes('already exists')) {
              errorMsg = 'An account with this email already exists. Please switch to "Sign In" to continue.';
            }
            throw new Error(errorMsg);
          }
          data = handleLocalStudioAuth(mode, email, password, displayName);
        }
      } catch (fetchErr: any) {
        const msg = String(fetchErr?.message || '');
        if (msg.includes('already exists') || msg.includes('Invalid email') || msg.includes('Password must') || msg.includes('invited') || msg.includes('collaborator')) {
          throw fetchErr;
        }
        data = handleLocalStudioAuth(mode, email, password, displayName);
      }

      const userProfile: UserProfileData = {
        id: data.user.id,
        email: data.user.email,
        displayName: data.user.displayName || email.split('@')[0],
        role: data.user.role || 'owner',
        studio: data.user.studio || 'SSN Pictures Studio',
        color: data.user.color || (data.user.role === 'co-writer' ? '#3b82f6' : data.user.role === 'commenter' ? '#ec4899' : '#f59e0b'),
      };

      onAuthSuccess(userProfile, data.token || `token-${Date.now()}`, mode === 'register');
      onClose();
    } catch (err: any) {
      setError(err.message || 'An unexpected authentication error occurred.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-hidden select-none bg-[#07080a]">
      {/* 1. React Bits Ambient Aurora Gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-32 -left-32 w-[650px] h-[650px] rounded-full bg-gradient-to-tr from-amber-500/35 via-orange-500/20 to-transparent blur-[100px] animate-aurora-1" />
        <div className="absolute -bottom-40 -right-40 w-[700px] h-[700px] rounded-full bg-gradient-to-bl from-indigo-500/35 via-purple-600/30 to-pink-500/20 blur-[110px] animate-aurora-2" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full bg-cyan-500/20 blur-[90px] animate-aurora-3" />
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[550px] bg-gradient-to-b from-amber-400/12 via-amber-500/5 to-transparent blur-[60px] pointer-events-none" />
      </div>

      {/* Floating Cinema Particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-1/4 left-1/5 w-1.5 h-1.5 rounded-full bg-amber-400/50 blur-[0.5px] animate-float-gentle" />
        <div className="absolute top-1/3 right-1/4 w-2 h-2 rounded-full bg-purple-400/40 blur-[0.5px] animate-float-gentle" style={{ animationDelay: '1.5s' }} />
        <div className="absolute bottom-1/4 left-1/3 w-1.5 h-1.5 rounded-full bg-cyan-400/40 blur-[0.5px] animate-float-gentle" style={{ animationDelay: '3s' }} />
        <div className="absolute bottom-1/3 right-1/5 w-1 h-1 rounded-full bg-amber-300/60 blur-[0.5px] animate-float-gentle" style={{ animationDelay: '4.5s' }} />
      </div>

      {/* 2. Studio Grid Matrix Overlay with Radial Vignette */}
      <div 
        className="absolute inset-0 bg-studio-grid opacity-60 pointer-events-none"
        style={{
          maskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, #000 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 70% 60% at 50% 50%, #000 40%, transparent 100%)',
        }}
      />

      {/* 3. Subtle Floating Screenplay Artifacts */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden text-gray-500/10 font-screenplay select-none text-xs hidden md:block">
        <div className="absolute top-12 left-16 tracking-widest animate-float-gentle">
          FADE IN:
        </div>
        <div className="absolute top-16 right-20 tracking-wider">
          INT. SCREENWRITER'S ROOM - NIGHT
        </div>
        <div className="absolute bottom-16 left-20 tracking-wider">
          SCENE 1: THE SPARK
        </div>
        <div className="absolute bottom-12 right-24 tracking-widest animate-float-gentle" style={{ animationDelay: '2s' }}>
          DISSOLVE TO: PRODUCTION DRAFT
        </div>
      </div>

      {/* 4. Spotlight Glow Card Container */}
      <div 
        className="relative w-full max-w-md animate-fadeIn transition-all duration-300"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="absolute -inset-0.5 rounded-3xl bg-gradient-to-b from-amber-500/40 via-purple-500/20 to-transparent blur-sm opacity-80" />

        <div className="relative w-full bg-[#0d0f15]/90 backdrop-blur-2xl border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col">
          <div className="absolute top-0 left-0 right-0 h-[1.5px] overflow-hidden">
            <div className="w-1/2 h-full bg-gradient-to-r from-transparent via-amber-400 to-transparent animate-shimmer-sweep" />
          </div>

          {/* Header */}
          <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-white/5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-1.5 shadow-lg shadow-black/40 transform hover:scale-105 transition-transform">
                <img src="/favicon.svg" alt="OpenScript" className="w-full h-full object-contain" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-base font-bold text-white tracking-wide">
                    OpenScript Studio
                  </h2>
                  <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-300 border border-amber-500/30 shadow-sm">
                    SSN Pictures
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {mode === 'login' && 'Sign in to access production screenplays'}
                  {mode === 'register' && 'Create your screenwriting account'}
                  {mode === 'forgot-password' && 'Reset your account password'}
                  {mode === 'reset-password' && 'Enter your new secure password'}
                </p>
              </div>
            </div>

            {!isCompulsory && (
              <button
                type="button"
                onClick={onClose}
                className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Mode Switcher Pills (Only for Register / Login) */}
          {(mode === 'register' || mode === 'login') && (
            <div className="px-6 pt-4 pb-2">
              <div className="grid grid-cols-2 p-1 bg-[#141720] rounded-2xl border border-white/5 relative">
                <button
                  type="button"
                  onClick={() => {
                    setMode('register');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`py-2 text-xs font-mono font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'register'
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-bold'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <UserPlus className="w-3.5 h-3.5" />
                  <span>Create Account</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setError(null);
                    setSuccessMessage(null);
                  }}
                  className={`py-2 text-xs font-mono font-semibold rounded-xl transition-all duration-200 flex items-center justify-center gap-1.5 cursor-pointer ${
                    mode === 'login'
                      ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20 font-bold'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              </div>
            </div>
          )}

          {/* Form Body */}
          <form onSubmit={handleSubmit} className="px-6 pb-6 pt-2 space-y-3.5">
            {error && (
              <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex flex-col gap-2 text-xs text-red-300 font-mono animate-fadeIn">
                <div className="flex items-start gap-2.5">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
                {error.toLowerCase().includes('already exists') && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                    }}
                    className="self-start mt-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    <span>Switch to Sign In →</span>
                  </button>
                )}
                {(error.toLowerCase().includes('invited') || error.toLowerCase().includes('switch to "create')) && (
                  <button
                    type="button"
                    onClick={() => {
                      setMode('register');
                      setError(null);
                    }}
                    className="self-start mt-1 px-3 py-1 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                  >
                    <span>Activate Account & Set Password →</span>
                  </button>
                )}
              </div>
            )}

            {successMessage && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300 font-mono animate-fadeIn">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                <span>{successMessage}</span>
              </div>
            )}

            {/* FORGOT PASSWORD MODE */}
            {mode === 'forgot-password' && (
              <>
                <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-xl text-xs text-amber-200/90 font-mono leading-relaxed">
                  Enter your registered account email. We will send you an encrypted single-use link valid for 60 minutes to reset your password.
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-gray-400">Your Account Email</label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-500 group-focus-within:text-amber-400 transition-colors" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="screenwriter@studio.com"
                      className="w-full bg-[#13161f]/90 border border-white/10 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 text-black font-bold text-xs shadow-lg shadow-amber-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Sending reset link...</span>
                    </>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Send Password Reset Link</span>
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </>
            )}

            {/* RESET PASSWORD MODE (VIA EMAIL TOKEN) */}
            {mode === 'reset-password' && (
              <>
                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-gray-400 flex items-center justify-between">
                    <span>New Password</span>
                    <span className="text-[10px] text-gray-500">8+ chars, letters & numbers</span>
                  </label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-500 group-focus-within:text-amber-400 transition-colors" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#13161f]/90 border border-white/10 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Password Strength Meter */}
                  {password.length > 0 && (
                    <div className="pt-1.5 space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-gray-500">Password Strength</span>
                        <span className={`font-semibold ${
                          pwStrength.score >= 3 ? 'text-emerald-400' : pwStrength.score === 2 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {pwStrength.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1a1e28] rounded-full overflow-hidden flex gap-1">
                        <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 1 ? pwStrength.color : 'bg-transparent'}`} />
                        <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 2 ? pwStrength.color : 'bg-transparent'}`} />
                        <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 3 ? pwStrength.color : 'bg-transparent'}`} />
                        <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 4 ? pwStrength.color : 'bg-transparent'}`} />
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono text-gray-400 pt-0.5">
                        <span className={pwStrength.hasLength ? 'text-emerald-400' : 'text-gray-600'}>
                          {pwStrength.hasLength ? '✓' : '○'} 8+ chars
                        </span>
                        <span className={pwStrength.hasLetter ? 'text-emerald-400' : 'text-gray-600'}>
                          {pwStrength.hasLetter ? '✓' : '○'} Letters
                        </span>
                        <span className={pwStrength.hasNumber ? 'text-emerald-400' : 'text-gray-600'}>
                          {pwStrength.hasNumber ? '✓' : '○'} Numbers
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-gray-400">Confirm New Password</label>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-500 group-focus-within:text-amber-400 transition-colors" />
                    <input
                      type="password"
                      required
                      minLength={8}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#13161f]/90 border border-white/10 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || !pwStrength.isValid || password !== confirmPassword}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 active:scale-[0.98] disabled:opacity-40 text-black font-bold text-xs shadow-lg shadow-amber-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Saving new password...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck className="w-4 h-4" />
                      <span>Set New Password & Sign In</span>
                    </>
                  )}
                </button>

                <div className="pt-2 text-center">
                  <button
                    type="button"
                    onClick={() => {
                      setMode('login');
                      setError(null);
                      setSuccessMessage(null);
                    }}
                    className="inline-flex items-center gap-1 text-xs text-gray-400 hover:text-amber-400 transition-colors cursor-pointer"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    <span>Back to Sign In</span>
                  </button>
                </div>
              </>
            )}

            {/* REGISTER & LOGIN MODES */}
            {(mode === 'register' || mode === 'login') && (
              <>
                {mode === 'register' && (
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-gray-400 flex items-center justify-between">
                      <span>Display Name / Screenwriter</span>
                      <span className="text-[10px] text-gray-600">Visible on scripts</span>
                    </label>
                    <div className="relative group">
                      <User className="absolute left-3.5 top-3 w-4 h-4 text-gray-500 group-focus-within:text-amber-400 transition-colors" />
                      <input
                        type="text"
                        required
                        value={displayName}
                        onChange={(e) => setDisplayName(e.target.value)}
                        placeholder="e.g. Alex Morgan"
                        className="w-full bg-[#13161f]/90 border border-white/10 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none transition-all"
                      />
                    </div>
                  </div>
                )}

                <div className="space-y-1">
                  <label className="text-[11px] font-mono text-gray-400">Email Address</label>
                  <div className="relative group">
                    <Mail className="absolute left-3.5 top-3 w-4 h-4 text-gray-500 group-focus-within:text-amber-400 transition-colors" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="screenwriter@studio.com"
                      className="w-full bg-[#13161f]/90 border border-white/10 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-[11px] font-mono text-gray-400">Password</label>
                    {mode === 'login' && (
                      <button
                        type="button"
                        onClick={() => {
                          setMode('forgot-password');
                          setError(null);
                          setSuccessMessage(null);
                        }}
                        className="text-[11px] font-mono text-amber-400/90 hover:text-amber-300 hover:underline transition-colors cursor-pointer"
                      >
                        Forgot password?
                      </button>
                    )}
                  </div>
                  <div className="relative group">
                    <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-500 group-focus-within:text-amber-400 transition-colors" />
                    <input
                      type="password"
                      required
                      minLength={mode === 'register' ? 8 : 6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full bg-[#13161f]/90 border border-white/10 focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 rounded-xl pl-10 pr-3.5 py-2.5 text-xs text-gray-100 placeholder-gray-600 focus:outline-none transition-all"
                    />
                  </div>

                  {/* Register Password Strength Meter */}
                  {mode === 'register' && password.length > 0 && (
                    <div className="pt-1.5 space-y-1.5 animate-fadeIn">
                      <div className="flex items-center justify-between text-[10px] font-mono">
                        <span className="text-gray-500">Security Strength</span>
                        <span className={`font-semibold ${
                          pwStrength.score >= 3 ? 'text-emerald-400' : pwStrength.score === 2 ? 'text-amber-400' : 'text-red-400'
                        }`}>
                          {pwStrength.label}
                        </span>
                      </div>
                      <div className="h-1.5 w-full bg-[#1a1e28] rounded-full overflow-hidden flex gap-1">
                        <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 1 ? pwStrength.color : 'bg-transparent'}`} />
                        <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 2 ? pwStrength.color : 'bg-transparent'}`} />
                        <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 3 ? pwStrength.color : 'bg-transparent'}`} />
                        <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 4 ? pwStrength.color : 'bg-transparent'}`} />
                      </div>
                      <div className="flex flex-wrap gap-2 text-[10px] font-mono text-gray-400 pt-0.5">
                        <span className={pwStrength.hasLength ? 'text-emerald-400' : 'text-gray-600'}>
                          {pwStrength.hasLength ? '✓' : '○'} 8+ chars
                        </span>
                        <span className={pwStrength.hasLetter ? 'text-emerald-400' : 'text-gray-600'}>
                          {pwStrength.hasLetter ? '✓' : '○'} Letters
                        </span>
                        <span className={pwStrength.hasNumber ? 'text-emerald-400' : 'text-gray-600'}>
                          {pwStrength.hasNumber ? '✓' : '○'} Numbers
                        </span>
                      </div>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  disabled={isLoading || (mode === 'register' && !pwStrength.isValid)}
                  className="w-full mt-2 py-3 px-4 rounded-xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:brightness-110 active:scale-[0.98] disabled:opacity-50 text-black font-bold text-xs shadow-lg shadow-amber-500/25 transition-all duration-200 flex items-center justify-center gap-2 cursor-pointer"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Setting up your studio...</span>
                    </>
                  ) : mode === 'register' ? (
                    <>
                      <UserPlus className="w-4 h-4" />
                      <span>Create Production Account</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </>
                  ) : (
                    <>
                      <LogIn className="w-4 h-4" />
                      <span>Sign In to OpenScript</span>
                      <ArrowRight className="w-3.5 h-3.5 ml-1" />
                    </>
                  )}
                </button>
              </>
            )}

          </form>
        </div>
      </div>
    </div>
  );
};
