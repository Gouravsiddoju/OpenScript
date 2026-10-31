import React, { useState } from 'react';
import { 
  X, 
  Users, 
  UserPlus, 
  Copy, 
  Check, 
  Shield, 
  Eye, 
  MessageSquare, 
  Edit3, 
  Trash2,
  ExternalLink
} from 'lucide-react';
import { CollaboratorRole, CollaboratorProfile } from '@openscript/screenplay-schema';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaborators: CollaboratorProfile[];
  onInviteCollaborator: (email: string, role: CollaboratorRole) => void;
  onUpdateRole: (userId: string, role: CollaboratorRole) => void;
  onRemoveCollaborator: (userId: string) => void;
  currentUserRole: CollaboratorRole;
  onChangeUserRolePreview: (role: CollaboratorRole) => void;
  documentTitle: string;
}

const ROLE_DESCRIPTIONS: Record<CollaboratorRole, { label: string; icon: any; desc: string }> = {
  owner: { label: 'Owner', icon: Shield, desc: 'Full administrative rights and script control' },
  'co-writer': { label: 'Co-Writer', icon: Edit3, desc: 'Can write, edit scenes, format, and add notes' },
  commenter: { label: 'Commenter / Producer', icon: MessageSquare, desc: 'Can leave margin ScriptNotes and reply to feedback' },
  reader: { label: 'Reader / Viewer', icon: Eye, desc: 'Read-only access with strict edit protection' },
};

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  collaborators,
  onInviteCollaborator,
  onUpdateRole,
  onRemoveCollaborator,
  currentUserRole,
  onChangeUserRolePreview,
  documentTitle,
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('co-writer');
  const [copiedLink, setCopiedLink] = useState(false);

  if (!isOpen) return null;

  const handleInvite = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) return;
    onInviteCollaborator(inviteEmail.trim(), inviteRole);
    setInviteEmail('');
  };

  const handleCopyLink = () => {
    const inviteUrl = `${window.location.origin}/join/${encodeURIComponent(documentTitle.toLowerCase().replace(/\s+/g, '-'))}`;
    navigator.clipboard.writeText(inviteUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#121419] border border-[#232732] rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#212530] flex items-center justify-between bg-[#161921]">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-semibold text-white">Share Screenplay & Team Access</h2>
              <p className="text-xs text-gray-400">Manage real-time co-writers, producers, and script readers</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#20242e] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-6">
          {/* Quick Invite Form */}
          <form onSubmit={handleInvite} className="bg-[#161921] p-3.5 rounded-xl border border-[#262b37] space-y-3">
            <label className="text-xs font-semibold text-gray-300 block">Invite Collaborator by Email</label>
            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="email"
                placeholder="colleague@ssnpictures.in"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="flex-1 px-3 py-2 bg-[#0e1014] border border-[#2b303e] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                className="px-3 py-2 bg-[#0e1014] border border-[#2b303e] rounded-lg text-xs text-amber-400 font-mono focus:outline-none"
              >
                <option value="co-writer">Co-Writer</option>
                <option value="commenter">Commenter</option>
                <option value="reader">Reader</option>
              </select>
              <button
                type="submit"
                disabled={!inviteEmail.trim()}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5"
              >
                <UserPlus className="w-4 h-4" />
                <span>Invite</span>
              </button>
            </div>
          </form>

          {/* Shareable Link Box */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#161921] border border-[#262b37]">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-gray-200">Shareable Room Link</span>
              <p className="text-[11px] text-gray-400 font-mono truncate max-w-xs">
                {window.location.origin}/join/{documentTitle.toLowerCase().replace(/\s+/g, '-')}
              </p>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222734] hover:bg-[#2b3142] text-xs font-mono text-amber-400 border border-amber-500/20 transition-all"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>

          {/* Collaborators List */}
          <div>
            <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider mb-2 font-mono">
              Project Members ({collaborators.length})
            </h3>
            <div className="space-y-2">
              {collaborators.map((collab) => {
                const RoleIcon = ROLE_DESCRIPTIONS[collab.role]?.icon || Edit3;
                const isSelf = collab.role === 'owner';

                return (
                  <div
                    key={collab.userId}
                    className="flex items-center justify-between p-3 rounded-xl bg-[#161921] border border-[#242835]"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow-sm"
                        style={{ backgroundColor: collab.color }}
                      >
                        {collab.displayName.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-semibold text-white">{collab.displayName}</span>
                          {isSelf && (
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                              You
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400">{collab.email}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isSelf ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#20242e] text-amber-400 text-xs font-mono">
                          <Shield className="w-3.5 h-3.5" />
                          <span>Owner</span>
                        </div>
                      ) : (
                        <>
                          <select
                            value={collab.role}
                            onChange={(e) => onUpdateRole(collab.userId, e.target.value as CollaboratorRole)}
                            className="px-2 py-1 bg-[#0f1115] border border-[#2b303e] rounded text-xs text-gray-300 font-mono focus:outline-none"
                          >
                            <option value="co-writer">Co-Writer</option>
                            <option value="commenter">Commenter</option>
                            <option value="reader">Reader</option>
                          </select>
                          <button
                            onClick={() => onRemoveCollaborator(collab.userId)}
                            className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-[#20242e] transition-colors"
                            title="Remove collaborator"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Test Permission Simulator */}
          <div className="p-3.5 rounded-xl bg-[#171a22] border border-[#282d3b] space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300">Live Role Simulator (Test Studio Permissions)</span>
              <span className="text-[10px] font-mono text-amber-400">Active: {currentUserRole}</span>
            </div>
            <p className="text-[11px] text-gray-400">
              Preview how OpenScript behaves under different production permissions:
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 pt-1">
              {(['owner', 'co-writer', 'commenter', 'reader'] as CollaboratorRole[]).map((role) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => onChangeUserRolePreview(role)}
                  className={`py-1.5 px-2 rounded-lg text-xs font-mono border transition-all capitalize ${
                    currentUserRole === role
                      ? 'bg-amber-500 text-black font-bold border-amber-400 shadow-sm'
                      : 'bg-[#101216] text-gray-300 hover:bg-[#20242e] border-[#292e3c]'
                  }`}
                >
                  {role}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#212530] bg-[#161921] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
