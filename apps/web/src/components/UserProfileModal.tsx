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
}

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserProfileData;
  onUpdateDisplayName?: (newName: string) => Promise<void>;
  onChangeRolePreview?: (newRole: CollaboratorRole) => void;
  onLogout: () => void;
  onOpenLogin: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
  user,
  onUpdateDisplayName,
  onChangeRolePreview,
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
        {/* Banner Header */}
        <div className="relative h-24 bg-gradient-to-r from-amber-600/30 via-[#181b22] to-amber-900/20 border-b border-[#252834] p-4 flex justify-between items-start">
          <div className="flex items-center gap-2 text-xs font-mono text-amber-400/80 bg-black/40 px-2.5 py-1 rounded-full border border-amber-500/20 backdrop-blur-sm">
            <Film className="w-3.5 h-3.5" />
            <span>OpenScript Studio Member</span>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-black/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Profile Avatar & Details */}
        <div className="px-6 pb-6 pt-0 relative flex flex-col gap-5">
          {/* Floating Avatar Circle */}
          <div className="flex items-end justify-between -mt-10">
            <div className="relative">
              <div 
                className="w-20 h-20 rounded-2xl flex items-center justify-center text-3xl font-black text-white shadow-2xl ring-4 ring-[#12141a]"
                style={{ backgroundColor: avatarColor }}
              >
                {user.displayName.charAt(0).toUpperCase()}
              </div>
              <span className="absolute bottom-1 right-1 w-4 h-4 rounded-full bg-emerald-500 ring-2 ring-[#12141a] animate-pulse" title="Active & Verified" />
            </div>

            <div className="flex items-center gap-2">
              <span className={`px-3 py-1 rounded-full text-xs font-mono font-semibold border ${currentRoleStyle.bg} ${currentRoleStyle.text} ${currentRoleStyle.border}`}>
                {currentRoleStyle.label}
              </span>
            </div>
          </div>

          {/* Name & Email */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {isEditingName ? (
                <div className="flex items-center gap-2 w-full">
                  <input
                    type="text"
                    value={nameInput}
                    onChange={(e) => setNameInput(e.target.value)}
                    className="flex-1 bg-[#191c25] border border-amber-500/50 rounded-lg px-3 py-1.5 text-sm text-white font-semibold focus:outline-none focus:ring-1 focus:ring-amber-500"
                    placeholder="Enter display name"
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
                <CheckCircle className="w-3.5 h-3.5" /> Verified Writer
              </span>
            </div>
          </div>

          {/* Persona / Role Quick Switcher (Testing & Preview) */}
          {onChangeRolePreview && (
            <div className="p-3 rounded-xl bg-[#161821] border border-[#262936] space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono font-semibold text-gray-300 flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-amber-400" /> Switch Role Persona (Preview):
                </span>
                <span className="text-[10px] text-gray-500 font-mono">Simulate Co-Writer / Reader</span>
              </div>
              <div className="grid grid-cols-4 gap-1.5">
                {(['owner', 'co-writer', 'commenter', 'reader'] as CollaboratorRole[]).map((r) => (
                  <button
                    key={r}
                    onClick={() => onChangeRolePreview(r)}
                    className={`py-1.5 px-2 rounded-lg text-[11px] font-mono capitalize transition-all border ${
                      user.role === r
                        ? 'bg-amber-500 text-black font-bold border-amber-500 shadow-sm'
                        : 'bg-[#1b1e28] text-gray-400 hover:text-white border-[#2b2f3d]'
                    }`}
                  >
                    {r}
                  </button>
                ))}
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
              className="px-3.5 py-1.5 rounded-lg bg-[#1a1d26] hover:bg-[#222634] text-xs font-mono text-amber-400 border border-[#2a2e3d] transition-colors"
            >
              Switch Account
            </button>

            <button
              onClick={() => {
                onClose();
                onLogout();
              }}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-red-500/10 hover:bg-red-500/20 text-red-400 border border-red-500/30 text-xs font-mono transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
