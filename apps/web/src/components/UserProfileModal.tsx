import React, { useState } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Shield, 
  CheckCircle, 
  LogOut, 
  Edit2, 
  Check, 
  Building2, 
  Lock,
  KeyRound,
  Laptop,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  ShieldCheck
} from 'lucide-react';
import { CollaboratorRole } from '@openscript/screenplay-schema';

export interface UserProfileData {
  id: string;
  email: string;
  displayName: string;
  role: CollaboratorRole;
  studio?: string;
  color?: string;
  isOnline?: boolean;
}

export function evaluatePasswordStrength(password: string): {
  score: number;
  label: 'Weak' | 'Fair' | 'Good' | 'Strong';
  color: string;
  hasLength: boolean;
  hasLetter: boolean;
  hasNumber: boolean;
  hasSpecial: boolean;
  isValid: boolean;
} {
  const hasLength = password.length >= 8;
  const hasLetter = /[a-zA-Z]/.test(password);
  const hasNumber = /[0-9]/.test(password);
  const hasSpecial = /[^a-zA-Z0-9]/.test(password);

  let score = 0;
  if (hasLength) score += 1;
  if (hasLetter) score += 1;
  if (hasNumber) score += 1;
  if (hasSpecial || password.length >= 12) score += 1;

  const isValid = hasLength && hasLetter && hasNumber;

  if (score <= 1) return { score: 1, label: 'Weak', color: 'bg-red-500', hasLength, hasLetter, hasNumber, hasSpecial, isValid };
  if (score === 2) return { score: 2, label: 'Fair', color: 'bg-amber-500', hasLength, hasLetter, hasNumber, hasSpecial, isValid };
  if (score === 3) return { score: 3, label: 'Good', color: 'bg-blue-500', hasLength, hasLetter, hasNumber, hasSpecial, isValid };
  return { score: 4, label: 'Strong', color: 'bg-emerald-500', hasLength, hasLetter, hasNumber, hasSpecial, isValid };
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfileData;
  authToken?: string | null;
  onUpdateDisplayName?: (newName: string) => Promise<void>;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  authToken,
  onUpdateDisplayName,
  onLogout,
  onOpenLogin,
}) => {
  const [activeTab, setActiveTab] = useState<'profile' | 'security'>('profile');
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user.displayName);
  const [isSaving, setIsSaving] = useState(false);

  // Security & Password Form States
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [pwLoading, setPwLoading] = useState(false);
  const [pwError, setPwError] = useState<string | null>(null);
  const [pwSuccess, setPwSuccess] = useState<string | null>(null);

  // Session Revocation States
  const [revokeLoading, setRevokeLoading] = useState(false);
  const [revokeSuccess, setRevokeSuccess] = useState<string | null>(null);
  const [revokeError, setRevokeError] = useState<string | null>(null);

  if (!isOpen) return null;

  const pwStrength = evaluatePasswordStrength(newPassword);

  const handleSaveName = async () => {
    if (!nameInput.trim()) return;
    setIsSaving(true);
    try {
      if (onUpdateDisplayName) {
        await onUpdateDisplayName(nameInput.trim());
      }
      setIsEditingName(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPwError(null);
    setPwSuccess(null);

    if (!currentPassword) {
      setPwError('Please enter your current password.');
      return;
    }

    if (!pwStrength.isValid) {
      setPwError('New password must be at least 8 characters long and contain both letters and numbers.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setPwError('New passwords do not match. Please verify.');
      return;
    }

    setPwLoading(true);

    try {
      const token = authToken || localStorage.getItem('openscript_auth_token');
      const res = await fetch('/api/v1/auth/change-password', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ currentPassword, newPassword }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to change password. Please check your current password.');
      }

      setPwSuccess('Password updated successfully! All other active sessions have been secured.');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      setPwError(err.message || 'Failed to update password.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleRevokeAllSessions = async () => {
    setRevokeError(null);
    setRevokeSuccess(null);
    setRevokeLoading(true);

    try {
      const token = authToken || localStorage.getItem('openscript_auth_token');
      const res = await fetch('/api/v1/auth/revoke-all-sessions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Failed to revoke other sessions.');
      }

      setRevokeSuccess('All other device sessions have been signed out successfully.');
    } catch (err: any) {
      setRevokeError(err.message || 'Failed to sign out other devices.');
    } finally {
      setRevokeLoading(false);
    }
  };

  const roleBadgeStyles: Record<CollaboratorRole, { label: string; bg: string; text: string; border: string }> = {
    owner: {
      label: 'Production Owner',
      bg: 'bg-amber-500/10',
      text: 'text-amber-400',
      border: 'border-amber-500/30',
    },
    'co-writer': {
      label: 'Co-Writer / Screenwriter',
      bg: 'bg-blue-500/10',
      text: 'text-blue-400',
      border: 'border-blue-500/30',
    },
    guest: {
      label: 'Invited Guest (Notes & Feedback)',
      bg: 'bg-purple-500/10',
      text: 'text-purple-400',
      border: 'border-purple-500/30',
    },
    commenter: {
      label: 'Producer / Commenter',
      bg: 'bg-pink-500/10',
      text: 'text-pink-400',
      border: 'border-pink-500/30',
    },
    reader: {
      label: 'Read-Only Script Reader',
      bg: 'bg-gray-500/10',
      text: 'text-gray-400',
      border: 'border-gray-500/30',
    },
  };

  const currentRoleStyle = roleBadgeStyles[user.role] || roleBadgeStyles.owner;
  const avatarColor = user.color || '#f59e0b';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-lg bg-[#12141a] border border-[#2b2f3a] rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="relative p-6 pb-4 bg-gradient-to-b from-[#181c24] to-[#12141a] border-b border-[#242733] flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div 
              className="w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-lg ring-2 ring-white/10"
              style={{ backgroundColor: avatarColor }}
            >
              {user.displayName.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-mono font-medium border ${currentRoleStyle.bg} ${currentRoleStyle.text} ${currentRoleStyle.border}`}>
                  {currentRoleStyle.label}
                </span>
                {user.isOnline ? (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" title="Active now">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                    </span>
                    Active Now
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-mono bg-gray-500/10 text-gray-400 border border-gray-500/20" title="Offline">
                    <span className="inline-flex rounded-full h-2 w-2 bg-gray-500"></span>
                    Offline
                  </span>
                )}
              </div>
              <h2 className="text-xl font-bold text-white mt-1 flex items-center gap-2">
                {user.displayName}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#222632] transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Switcher */}
        <div className="px-6 pt-3 bg-[#12141a] border-b border-[#242733] flex items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab('profile')}
            className={`pb-2.5 px-3 text-xs font-mono font-semibold transition-all relative flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'profile'
                ? 'text-amber-400 border-b-2 border-amber-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <User className="w-3.5 h-3.5" />
            <span>Studio Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('security')}
            className={`pb-2.5 px-3 text-xs font-mono font-semibold transition-all relative flex items-center gap-1.5 cursor-pointer ${
              activeTab === 'security'
                ? 'text-amber-400 border-b-2 border-amber-500'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Security & Password</span>
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5 max-h-[70vh] overflow-y-auto">
          {activeTab === 'profile' && (
            <>
              {/* Display Name Section */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-mono uppercase tracking-wider text-gray-400 flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-amber-500" /> Screenplay Display Name
                </label>
                <div className="flex items-center justify-between p-3 rounded-xl bg-[#171a22] border border-[#242733]">
                  {isEditingName ? (
                    <div className="flex items-center gap-2 w-full">
                      <input
                        type="text"
                        value={nameInput}
                        onChange={(e) => setNameInput(e.target.value)}
                        disabled={isSaving}
                        className="flex-1 px-2.5 py-1 text-sm bg-[#0e1015] border border-amber-500/50 rounded-lg text-white focus:outline-none"
                        autoFocus
                      />
                      <button
                        onClick={handleSaveName}
                        disabled={isSaving}
                        className="p-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black transition-colors"
                        title="Save"
                      >
                        <Check className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => {
                          setNameInput(user.displayName);
                          setIsEditingName(false);
                        }}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-white bg-[#1e222c] transition-colors"
                        title="Cancel"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <h3 className="text-lg font-bold text-gray-100 flex items-center gap-2">
                        {user.displayName}
                      </h3>
                      <button
                        onClick={() => setIsEditingName(true)}
                        className="p-1 text-gray-500 hover:text-amber-400 rounded transition-colors"
                        title="Edit display name"
                      >
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                    </>
                  )}
                </div>
                <p className="text-xs text-gray-400 flex items-center gap-1.5 font-mono">
                  <Mail className="w-3.5 h-3.5 text-gray-500" />
                  <span>{user.email}</span>
                </p>
              </div>

              {/* Basic Info Cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-[#171a22] border border-[#242733] flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase text-gray-500 flex items-center gap-1">
                    <Building2 className="w-3 h-3 text-amber-500" /> Studio Organization
                  </span>
                  <span className="text-xs font-semibold text-gray-200">
                    {user.studio || 'SSN Pictures Studio'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-[#171a22] border border-[#242733] flex flex-col gap-1">
                  <span className="text-[10px] font-mono uppercase text-gray-500 flex items-center gap-1">
                    <Shield className="w-3 h-3 text-emerald-400" /> Account Status
                  </span>
                  <span className="text-xs font-semibold text-emerald-400 flex items-center gap-1">
                    <CheckCircle className="w-3.5 h-3.5" /> Verified Screenwriter
                  </span>
                </div>
              </div>
            </>
          )}

          {activeTab === 'security' && (
            <div className="space-y-6">
              {/* Change Password Sub-section */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 pb-1 border-b border-[#242733]">
                  <KeyRound className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">
                    Change Studio Password
                  </h3>
                </div>

                {pwError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl flex items-start gap-2.5 text-xs text-red-300 font-mono animate-fadeIn">
                    <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
                    <span>{pwError}</span>
                  </div>
                )}

                {pwSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl flex items-start gap-2.5 text-xs text-emerald-300 font-mono animate-fadeIn">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                    <span>{pwSuccess}</span>
                  </div>
                )}

                <form onSubmit={handleChangePassword} className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-gray-400">Current Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-500 group-focus-within:text-amber-400 transition-colors" />
                      <input
                        type={showCurrentPw ? 'text' : 'password'}
                        required
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#171a22] border border-[#242733] focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl pl-10 pr-10 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowCurrentPw(!showCurrentPw)}
                        className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[11px] font-mono text-gray-400">New Password</label>
                    <div className="relative group">
                      <Lock className="absolute left-3.5 top-3 w-4 h-4 text-gray-500 group-focus-within:text-amber-400 transition-colors" />
                      <input
                        type={showNewPw ? 'text' : 'password'}
                        required
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#171a22] border border-[#242733] focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl pl-10 pr-10 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPw(!showNewPw)}
                        className="absolute right-3 top-2.5 text-gray-500 hover:text-gray-300 transition-colors"
                      >
                        {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>

                    {/* Live Password Strength Meter */}
                    {newPassword.length > 0 && (
                      <div className="pt-1.5 space-y-1.5 animate-fadeIn">
                        <div className="flex items-center justify-between text-[10px] font-mono">
                          <span className="text-gray-500">Security Strength</span>
                          <span className={`font-semibold ${
                            pwStrength.score >= 3 ? 'text-emerald-400' : pwStrength.score === 2 ? 'text-amber-400' : 'text-red-400'
                          }`}>
                            {pwStrength.label}
                          </span>
                        </div>
                        <div className="h-1.5 w-full bg-[#20242f] rounded-full overflow-hidden flex gap-1">
                          <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 1 ? pwStrength.color : 'bg-transparent'}`} />
                          <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 2 ? pwStrength.color : 'bg-transparent'}`} />
                          <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 3 ? pwStrength.color : 'bg-transparent'}`} />
                          <div className={`h-full flex-1 transition-all rounded-full ${pwStrength.score >= 4 ? pwStrength.color : 'bg-transparent'}`} />
                        </div>
                        <div className="flex flex-wrap gap-2 text-[10px] font-mono text-gray-400 pt-0.5">
                          <span className={pwStrength.hasLength ? 'text-emerald-400' : 'text-gray-600'}>
                            {pwStrength.hasLength ? '✓' : '○'} 8+ characters
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
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        className="w-full bg-[#171a22] border border-[#242733] focus:border-amber-500 focus:ring-1 focus:ring-amber-500/30 rounded-xl pl-10 pr-3.5 py-2 text-xs text-gray-100 placeholder-gray-600 focus:outline-none"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    disabled={pwLoading || !pwStrength.isValid || newPassword !== confirmPassword}
                    className="w-full mt-2 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-[0.98] disabled:opacity-40 text-black font-bold text-xs font-mono shadow-md shadow-amber-500/20 transition-all flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    {pwLoading ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>Save New Password</span>
                      </>
                    )}
                  </button>
                </form>
              </div>

              {/* Session Management Sub-section */}
              <div className="space-y-3 pt-3 border-t border-[#242733]">
                <div className="flex items-center gap-2">
                  <Laptop className="w-4 h-4 text-amber-500" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-gray-200">
                    Active Devices & Sessions
                  </h3>
                </div>

                <div className="p-3 bg-[#171a22] border border-[#242733] rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                      <Laptop className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-gray-200">Current Device / Browser</span>
                        <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-emerald-500/20 text-emerald-300">
                          Active Now
                        </span>
                      </div>
                      <span className="text-[11px] text-gray-400 font-mono">
                        Authenticated via SSL & Encrypted Session
                      </span>
                    </div>
                  </div>
                </div>

                {revokeError && (
                  <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-300 font-mono">
                    {revokeError}
                  </div>
                )}

                {revokeSuccess && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-300 font-mono">
                    {revokeSuccess}
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleRevokeAllSessions}
                  disabled={revokeLoading}
                  className="w-full py-2 px-3 rounded-xl bg-[#1e222c] hover:bg-[#252a36] active:scale-[0.98] text-xs font-mono text-gray-300 hover:text-white border border-[#2e3342] transition-colors flex items-center justify-center gap-2 cursor-pointer"
                >
                  {revokeLoading ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Terminating other sessions...</span>
                    </>
                  ) : (
                    <>
                      <LogOut className="w-3.5 h-3.5 text-amber-400" />
                      <span>Sign Out of All Other Devices</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="pt-2 border-t border-[#22252f] flex items-center justify-between">
            <button
              onClick={() => {
                onClose();
                onOpenLogin();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-[#1a1d26] hover:bg-[#222634] text-xs font-mono text-amber-400 border border-[#2a2e3d] transition-colors cursor-pointer"
            >
              Switch Account
            </button>

            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-mono text-red-400 border border-red-500/30 transition-colors cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Log Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
