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
  Lock,
  Mail,
  Clock,
  CheckCircle2,
  AlertCircle,
  RotateCw,
  Send
} from 'lucide-react';
import { CollaboratorRole, CollaboratorProfile } from '@openscript/screenplay-schema';

interface ShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  collaborators: CollaboratorProfile[];
  onInviteCollaborator: (email: string, role: CollaboratorRole) => Promise<{ success: boolean; isDuplicate?: boolean; message?: string } | void> | void;
  onResendInvite?: (userId: string) => Promise<boolean> | void;
  onUpdateRole: (userId: string, role: CollaboratorRole) => void;
  onRemoveCollaborator: (userId: string) => void;
  currentUserRole: CollaboratorRole;
  documentTitle: string;
  documentId?: string;
}

const ROLE_DESCRIPTIONS: Record<CollaboratorRole, { label: string; icon: any; desc: string }> = {
  owner: { label: 'Owner', icon: Shield, desc: 'Full administrative rights and script control' },
  'co-writer': { label: 'Co-Writer', icon: Edit3, desc: 'Can write, edit scenes, format, and propose takes' },
  guest: { label: 'Guest', icon: MessageSquare, desc: 'Can read final script, leave ScriptNotes and feedback' },
  commenter: { label: 'Commenter / Producer', icon: MessageSquare, desc: 'Can leave margin ScriptNotes and reply to feedback' },
  reader: { label: 'Reader / Viewer', icon: Eye, desc: 'Read-only access with watermarked view' },
};

export const ShareModal: React.FC<ShareModalProps> = ({
  isOpen,
  onClose,
  collaborators,
  onInviteCollaborator,
  onResendInvite,
  onUpdateRole,
  onRemoveCollaborator,
  currentUserRole,
  documentTitle,
  documentId,
}) => {
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<CollaboratorRole>('co-writer');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  if (!isOpen) return null;

  const isOwner = currentUserRole === 'owner';

  // Check if typed email already exists
  const existingCollab = collaborators.find(
    (c) => c.email.toLowerCase().trim() === inviteEmail.toLowerCase().trim()
  );

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isOwner) return;
    const cleanEmail = inviteEmail.trim().toLowerCase();
    if (!cleanEmail) return;

    setIsInviting(true);
    setFeedback(null);

    try {
      const result = await onInviteCollaborator(cleanEmail, inviteRole);
      if (result && typeof result === 'object') {
        if (result.isDuplicate) {
          setFeedback({
            type: 'info',
            message: `ℹ️ ${cleanEmail} was already invited. Their role was updated to ${inviteRole} and invitation refreshed.`,
          });
        } else {
          setFeedback({
            type: 'success',
            message: `✉️ Invitation dispatched to ${cleanEmail}! A confirmation copy was sent to your email.`,
          });
        }
      } else {
        setFeedback({
          type: 'success',
          message: `✉️ Invitation dispatched to ${cleanEmail}!`,
        });
      }
      setInviteEmail('');
    } catch (err: any) {
      setFeedback({
        type: 'error',
        message: err.message || 'Failed to dispatch invitation',
      });
    } finally {
      setIsInviting(false);
    }
  };

  const handleResend = async (collab: CollaboratorProfile) => {
    if (!onResendInvite) return;
    setResendingId(collab.userId);
    try {
      await onResendInvite(collab.userId);
      setFeedback({
        type: 'success',
        message: `✉️ Invitation resent to ${collab.email}!`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        message: `Failed to resend invitation to ${collab.email}`,
      });
    } finally {
      setResendingId(null);
    }
  };

  const shareableUrl = documentId ? `${window.location.origin}/?doc=${documentId}` : window.location.origin;

  const handleCopyLink = () => {
    navigator.clipboard.writeText(shareableUrl);
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
              <p className="text-xs text-gray-400">Manage real-time co-writers, team status, and permissions</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#20242e] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 overflow-y-auto space-y-5">
          {/* Feedback Banner */}
          {feedback && (
            <div
              className={`p-3.5 rounded-xl border flex items-start gap-2.5 text-xs font-mono animate-fadeIn ${
                feedback.type === 'success'
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  : feedback.type === 'info'
                  ? 'bg-sky-500/10 border-sky-500/30 text-sky-300'
                  : 'bg-red-500/10 border-red-500/30 text-red-300'
              }`}
            >
              {feedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
              ) : (
                <AlertCircle className="w-4 h-4 text-sky-400 shrink-0 mt-0.5" />
              )}
              <span className="leading-relaxed">{feedback.message}</span>
            </div>
          )}

          {/* Quick Invite Form (Strictly Owner Only) */}
          {isOwner ? (
            <form onSubmit={handleInvite} className="bg-[#161921] p-4 rounded-xl border border-[#262b37] space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-200 flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-amber-400" />
                  <span>Invite Collaborator by Email</span>
                </label>
                <span className="text-[10px] text-gray-500 font-mono">Two-way email notification</span>
              </div>

              {existingCollab && (
                <div className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 rounded-lg flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span>Already on team as <strong>{existingCollab.role}</strong>. Submitting will update their role and resend an invite.</span>
                </div>
              )}

              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  placeholder="collaborator@studio.com"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  className="flex-1 px-3 py-2 bg-[#0e1014] border border-[#2b303e] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                  required
                />
                <select
                  value={inviteRole}
                  onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                  className="px-3 py-2 bg-[#0e1014] border border-[#2b303e] rounded-lg text-xs text-amber-400 font-mono focus:outline-none cursor-pointer"
                >
                  <option value="co-writer">Co-Writer</option>
                  <option value="guest">Guest (Notes only)</option>
                  <option value="commenter">Commenter</option>
                  <option value="reader">Reader (View only)</option>
                </select>
                <button
                  type="submit"
                  disabled={!inviteEmail.trim() || isInviting}
                  className="px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 hover:brightness-110 disabled:opacity-40 text-black text-xs font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-md shadow-amber-500/20"
                >
                  {isInviting ? (
                    <>
                      <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Invite</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          ) : (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-300 flex items-center gap-2">
              <Lock className="w-4 h-4 text-amber-400 shrink-0" />
              <span>Only the Project Owner can invite members or change role permissions.</span>
            </div>
          )}

          {/* Shareable Link Box */}
          <div className="flex items-center justify-between p-3.5 rounded-xl bg-[#161921] border border-[#262b37]">
            <div className="space-y-0.5">
              <span className="text-xs font-semibold text-gray-200">Shareable Room Link</span>
              <p className="text-[11px] text-gray-400 font-mono truncate max-w-xs">
                {shareableUrl}
              </p>
            </div>
            <button
              onClick={handleCopyLink}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#222734] hover:bg-[#2b3142] text-xs font-mono text-amber-400 border border-amber-500/20 transition-all cursor-pointer"
            >
              {copiedLink ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedLink ? 'Copied!' : 'Copy Link'}</span>
            </button>
          </div>

          {/* Collaborators List with Invitation Status */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-semibold text-gray-300 uppercase tracking-wider font-mono">
                Project Members ({collaborators.length})
              </h3>
              <span className="text-[10px] text-gray-500 font-mono">Real-time status tracking</span>
            </div>

            <div className="space-y-2.5">
              {collaborators.map((collab) => {
                const RoleIcon = ROLE_DESCRIPTIONS[collab.role]?.icon || Edit3;
                const isSelf = collab.role === 'owner';
                const isPending = (collab as any).status === 'pending' || !(collab as any).lastSeenAt;

                return (
                  <div
                    key={collab.userId}
                    className="flex flex-col sm:flex-row sm:items-center justify-between p-3.5 rounded-xl bg-[#161921] border border-[#232733] gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white shadow shrink-0"
                        style={{ backgroundColor: collab.color || '#f59e0b' }}
                      >
                        {collab.displayName.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-semibold text-white truncate max-w-[140px] sm:max-w-none">
                            {collab.displayName}
                          </span>
                          
                          {isSelf ? (
                            <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded font-mono font-medium border border-amber-500/30">
                              Owner
                            </span>
                          ) : isPending ? (
                            <span className="text-[10px] bg-amber-500/15 text-amber-300 px-2 py-0.5 rounded-full font-mono font-medium flex items-center gap-1 border border-amber-500/30">
                              <Clock className="w-2.5 h-2.5" />
                              <span>Pending Invite</span>
                            </span>
                          ) : (
                            <span className="text-[10px] bg-emerald-500/15 text-emerald-300 px-2 py-0.5 rounded-full font-mono font-medium flex items-center gap-1 border border-emerald-500/30">
                              <Check className="w-2.5 h-2.5" />
                              <span>Active</span>
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-gray-400 font-mono truncate block max-w-[200px] sm:max-w-none">
                          {collab.email}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-end sm:self-center">
                      {/* Resend invite button for pending invites */}
                      {isPending && !isSelf && onResendInvite && (
                        <button
                          type="button"
                          onClick={() => handleResend(collab)}
                          disabled={resendingId === collab.userId}
                          title="Resend invitation email"
                          className="px-2 py-1 text-[11px] font-mono rounded bg-[#202532] hover:bg-amber-500/20 text-gray-300 hover:text-amber-300 border border-white/5 transition-colors flex items-center gap-1 cursor-pointer"
                        >
                          {resendingId === collab.userId ? (
                            <RotateCw className="w-3 h-3 animate-spin" />
                          ) : (
                            <Mail className="w-3 h-3 text-amber-400" />
                          )}
                          <span>Resend</span>
                        </button>
                      )}

                      {isSelf || !isOwner ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#20242e] text-amber-400 text-xs font-mono">
                          <RoleIcon className="w-3.5 h-3.5" />
                          <span className="capitalize">{collab.role}</span>
                        </div>
                      ) : (
                        <>
                          <select
                            value={collab.role}
                            onChange={(e) => onUpdateRole(collab.userId, e.target.value as CollaboratorRole)}
                            className="px-2 py-1 bg-[#0f1115] border border-[#2b303e] rounded text-xs text-gray-300 font-mono focus:outline-none cursor-pointer"
                          >
                            <option value="co-writer">Co-Writer</option>
                            <option value="guest">Guest</option>
                            <option value="commenter">Commenter</option>
                            <option value="reader">Reader</option>
                          </select>
                          <button
                            onClick={() => onRemoveCollaborator(collab.userId)}
                            className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-[#20242e] transition-colors cursor-pointer"
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
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#212530] bg-[#161921] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-bold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
