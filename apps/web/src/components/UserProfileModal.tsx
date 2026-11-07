import React, { useState } from 'react';
import { 
  X, 
  User, 
  Mail, 
  Shield, 
  Film, 
  CheckCircle, 
  LogOut, 
  Edit2, 
  Check, 
  Building2, 
  Calendar,
  Key
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

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfileData;
  onUpdateDisplayName?: (newName: string) => Promise<void>;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateDisplayName,
  onLogout,
  onOpenLogin,
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [nameInput, setNameInput] = useState(user.displayName);
  const [isSaving, setIsSaving] = useState(false);

  if (!isOpen) return null;

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
            {/* User Avatar with custom accent color */}
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

        {/* Modal Body */}
        <div className="p-6 space-y-5">
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

          {/* Action Buttons */}
          <div className="pt-2 border-t border-[#22252f] flex items-center justify-between">
            <button
              onClick={() => {
                onClose();
                onOpenLogin();
              }}
              className="px-3.5 py-1.5 rounded-lg bg-[#1a1d26] hover:bg-[#222634] text-xs font-mono text-amber-400 border border-[#2a2e3d] transition-colors"
            >
              Switch Account
            </button>

            <button
              onClick={() => {
                onLogout();
                onClose();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-xs font-mono text-red-400 border border-red-500/30 transition-colors"
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
