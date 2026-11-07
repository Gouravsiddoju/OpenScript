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
  Send,
  Link,
  ChevronDown
} from 'lucide-react';
import { CollaboratorRole, CollaboratorProfile } from '@openscript/screenplay-schema';

export interface LiveAwarenessPeer {
  clientId: number;
  userId: string;
  displayName: string;
  color: string;
  role: string;
  isTyping?: boolean;
  activeScene?: string;
}

interface WordShareSidebarProps {
  isOpen: boolean;
  onClose: () => void;
  collaborators: CollaboratorProfile[];
  awarenessPeers?: LiveAwarenessPeer[];
  onInviteCollaborator: (email: string, role: CollaboratorRole) => Promise<{ success: boolean; isDuplicate?: boolean; message?: string } | void> | void;
  onResendInvite?: (userId: string) => Promise<boolean> | void;
  onUpdateRole: (userId: string, role: CollaboratorRole) => void;
  onRemoveCollaborator: (userId: string) => void;
  currentUserRole: CollaboratorRole;
  documentTitle: string;
  documentId?: string;
}

const ROLE_OPTIONS: { role: CollaboratorRole; label: string; desc: string }[] = [
  { role: 'co-writer', label: 'Can edit', desc: 'Can write, edit scenes, format, and edit in real time' },
  { role: 'commenter', label: 'Can comment', desc: 'Can leave margin ScriptNotes and feedback' },
  { role: 'reader', label: 'Can view', desc: 'Read-only access with watermarked screenplay view' },
];

export const WordShareSidebar: React.FC<WordShareSidebarProps> = ({
  isOpen,
  onClose,
  collaborators,
  awarenessPeers = [],
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
  const [inviteMessage, setInviteMessage] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);
  const [isInviting, setIsInviting] = useState(false);
  const [resendingId, setResendingId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'info' | 'error'; message: string } | null>(null);

  const isOwner = currentUserRole === 'owner';

  // Deduplicate collaborators by email or userId
  const uniqueCollaborators = React.useMemo(() => {
    const seenEmails = new Set<string>();
    const seenUserIds = new Set<string>();
    let seenOwner = false;
    const list: CollaboratorProfile[] = [];

    for (const collab of collaborators) {
      if (!collab) continue;
      const email = (collab.email || '').trim().toLowerCase();
      const userId = collab.userId || '';
      const isOwnerRole = collab.role === 'owner';

      if (isOwnerRole) {
        if (!seenOwner) {
          seenOwner = true;
          if (email) seenEmails.add(email);
          if (userId) seenUserIds.add(userId);
          list.push(collab);
        }
        continue;
      }

      if (email && seenEmails.has(email)) continue;
      if (userId && seenUserIds.has(userId)) continue;

      if (email) seenEmails.add(email);
      if (userId) seenUserIds.add(userId);
      list.push(collab);
    }
    return list;
  }, [collaborators]);

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail || !inviteEmail.includes('@')) {
      setFeedback({ type: 'error', message: 'Please enter a valid email address.' });
      return;
    }

    setIsInviting(true);
    setFeedback(null);
    try {
      const result = await onInviteCollaborator(inviteEmail.trim(), inviteRole);
      if (result && typeof result === 'object' && result.isDuplicate) {
        setFeedback({
          type: 'info',
          message: result.message || `${inviteEmail.trim()} is already a collaborator on this screenplay.`,
        });
      } else {
        setInviteEmail('');
        setInviteMessage('');
        setFeedback({
          type: 'success',
          message: `Invitation successfully sent to ${inviteEmail.trim()}!`,
        });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Failed to send invite. Please check server connection.' });
    } finally {
      setIsInviting(false);
    }
  };

  const handleCopyLink = () => {
    const shareUrl = `${window.location.origin}${window.location.pathname}?doc=${documentId || ''}&join=true`;
    navigator.clipboard.writeText(shareUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleResend = async (userId: string, email: string) => {
    if (!onResendInvite) return;
    setResendingId(userId);
    try {
      const ok = await onResendInvite(userId);
      if (ok) {
        setFeedback({ type: 'success', message: `Invitation resent to ${email}!` });
      } else {
        setFeedback({ type: 'error', message: `Could not resend email. Please try again.` });
      }
    } catch {
      setFeedback({ type: 'error', message: `Error contacting email server.` });
    } finally {
      setResendingId(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex">
      {/* Backdrop for mobile */}
      <div 
        className="fixed inset-0 bg-black/50 backdrop-blur-xs transition-opacity md:hidden"
        onClick={onClose}
      />

      {/* Word-Style Right Sidebar */}
      <aside className="relative w-full max-w-sm md:w-96 bg-[#181a20] border-l border-[#272b38] shadow-2xl flex flex-col h-full text-gray-200 z-10 animate-in slide-in-from-right duration-200">
        
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#272b38] bg-[#14161b]">
          <div className="flex items-center gap-2.5">
            <Users className="w-5 h-5 text-amber-400" />
            <h2 className="text-base font-semibold text-white tracking-wide">Share</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-md text-gray-400 hover:text-white hover:bg-[#232733] transition-colors"
            title="Close Share Panel"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          
          {/* Invite Section (Owner Only or Co-Writers with permission) */}
          {isOwner && (
            <div className="space-y-3 pb-4 border-b border-[#272b38]">
              <label className="block text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Invite people
              </label>

              <form onSubmit={handleSendInvite} className="space-y-3">
                {/* Email Input & Role Dropdown */}
                <div className="space-y-2">
                  <div className="relative">
                    <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-500" />
                    <input
                      type="email"
                      value={inviteEmail}
                      onChange={(e) => setInviteEmail(e.target.value)}
                      placeholder="Enter an email address..."
                      className="w-full pl-9 pr-3 py-2 bg-[#0e1015] border border-[#2b3040] rounded-lg text-sm text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors"
                    />
                  </div>

                  <div className="flex gap-2">
                    <select
                      value={inviteRole}
                      onChange={(e) => setInviteRole(e.target.value as CollaboratorRole)}
                      className="flex-1 px-3 py-2 bg-[#0e1015] border border-[#2b3040] rounded-lg text-xs font-medium text-gray-200 focus:outline-none focus:border-amber-500 cursor-pointer"
                    >
                      {ROLE_OPTIONS.map((opt) => (
                        <option key={opt.role} value={opt.role}>
                          {opt.label} ({opt.role})
                        </option>
                      ))}
                    </select>

                    <button
                      type="submit"
                      disabled={isInviting || !inviteEmail}
                      className="px-4 py-2 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 disabled:hover:bg-amber-500 text-black text-xs font-bold rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-sm"
                    >
                      {isInviting ? (
                        <RotateCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Send className="w-3.5 h-3.5" />
                      )}
                      Share
                    </button>
                  </div>

                  {/* Optional Message */}
                  <textarea
                    value={inviteMessage}
                    onChange={(e) => setInviteMessage(e.target.value)}
                    placeholder="Include a message (optional)"
                    rows={2}
                    className="w-full px-3 py-1.5 bg-[#0e1015] border border-[#2b3040] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500 transition-colors resize-none"
                  />
                </div>
              </form>

              {/* Feedback toast banner */}
              {feedback && (
                <div
                  className={`p-2.5 rounded-lg text-xs flex items-center gap-2 animate-in fade-in ${
                    feedback.type === 'success'
                      ? 'bg-emerald-950/70 border border-emerald-700/60 text-emerald-300'
                      : feedback.type === 'info'
                      ? 'bg-blue-950/70 border border-blue-700/60 text-blue-300'
                      : 'bg-red-950/70 border border-red-700/60 text-red-300'
                  }`}
                >
                  {feedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-400" />
                  ) : feedback.type === 'info' ? (
                    <AlertCircle className="w-4 h-4 shrink-0 text-blue-400" />
                  ) : (
                    <AlertCircle className="w-4 h-4 shrink-0 text-red-400" />
                  )}
                  <span>{feedback.message}</span>
                </div>
              )}
            </div>
          )}

          {/* Real-time Collaboration Mode Indicator */}
          <div className="flex items-center justify-between text-xs text-gray-400 py-1 border-b border-[#272b38]/60">
            <span>Automatically share changes</span>
            <span className="font-semibold text-emerald-400 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              Always
            </span>
          </div>

          {/* Collaborators List (Word-Style Real-Time Presence) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-gray-300 uppercase tracking-wider">
                Collaborators ({uniqueCollaborators.length})
              </span>
              <span className="text-[11px] text-gray-500">
                {awarenessPeers.length} online
              </span>
            </div>

            <div className="space-y-2">
              {uniqueCollaborators.map((collab) => {
                const isSelf = currentUserRole === 'owner' && collab.role === 'owner';
                const displayName = collab.displayName || (collab.role === 'owner' ? 'Owner' : 'Co-Writer');
                const initial = displayName.charAt(0).toUpperCase();
                const isOnline = awarenessPeers.some((p) => 
                  p.userId === collab.userId || 
                  (collab.displayName && p.displayName?.toLowerCase() === collab.displayName.toLowerCase()) || 
                  (isSelf && p.role === 'owner')
                );
                const isActivelyWriting = awarenessPeers.some((p) => 
                  (p.userId === collab.userId || (collab.displayName && p.displayName?.toLowerCase() === collab.displayName.toLowerCase()) || (isSelf && p.role === 'owner')) && 
                  p.isTyping
                );
                const isInvited = collab.status === 'pending';

                return (
                  <div
                    key={collab.userId || collab.email}
                    className="p-3 bg-[#13151b] border border-[#272b38] rounded-xl flex items-center justify-between gap-3 group hover:border-[#383d4e] transition-colors"
                  >
                    {/* User Info with Avatar & Real-time Indicator */}
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="relative">
                        <span
                          className="inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold text-white shadow-md ring-1 ring-white/10"
                          style={{ backgroundColor: collab.color || '#3b82f6' }}
                        >
                          {initial}
                        </span>
                        {isOnline ? (
                          <span 
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-emerald-400 ring-2 ring-[#13151b] animate-pulse" 
                            title="Editing in real time" 
                          />
                        ) : isInvited ? (
                          <span 
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400 ring-2 ring-[#13151b]" 
                            title="Invitation pending" 
                          />
                        ) : (
                          <span 
                            className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-gray-500 ring-2 ring-[#13151b]" 
                            title="Offline" 
                          />
                        )}
                      </div>

                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs font-semibold text-white truncate max-w-[140px]">
                            {displayName}
                          </span>
                          {collab.role === 'owner' && (
                            <span className="text-[10px] px-1.5 py-0.2 bg-amber-500/20 text-amber-300 rounded font-mono">
                              Owner
                            </span>
                          )}
                        </div>

                        {/* Status Label (Matching Word screenshot: "Editing in real time") */}
                        <div className="text-[11px] truncate">
                          {isActivelyWriting ? (
                            <span className="text-amber-400 font-medium">✍️ Typing now...</span>
                          ) : isOnline ? (
                            <span className="text-emerald-400 font-medium">Editing in real time</span>
                          ) : isInvited ? (
                            <span className="text-amber-400/80">Invitation pending</span>
                          ) : (
                            <span className="text-gray-500">{collab.email || 'Registered writer'}</span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Actions: Resend / Role Selector / Delete */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isInvited && isOwner && onResendInvite && (
                        <button
                          type="button"
                          onClick={() => handleResend(collab.userId, collab.email)}
                          disabled={resendingId === collab.userId}
                          className="px-2 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-semibold rounded border border-amber-500/30 transition-colors flex items-center gap-1 cursor-pointer"
                          title="Resend invitation email"
                        >
                          <RotateCw className={`w-3 h-3 ${resendingId === collab.userId ? 'animate-spin' : ''}`} />
                          Resend
                        </button>
                      )}

                      {isOwner && collab.role !== 'owner' ? (
                        <div className="flex items-center gap-1">
                          <select
                            value={collab.role}
                            onChange={(e) => onUpdateRole(collab.userId, e.target.value as CollaboratorRole)}
                            className="px-2 py-1 bg-[#0c0d11] border border-[#272b38] rounded text-[11px] text-gray-300 font-mono focus:outline-none cursor-pointer"
                          >
                            <option value="co-writer">Co-Writer</option>
                            <option value="commenter">Commenter</option>
                            <option value="reader">Reader</option>
                          </select>
                          <button
                            type="button"
                            onClick={() => onRemoveCollaborator(collab.userId)}
                            className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-[#20242e] transition-colors cursor-pointer"
                            title="Remove collaborator"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500 capitalize px-2 py-1 font-mono">
                          {collab.role}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer: Word-Style "Get a sharing link" */}
        <div className="p-4 border-t border-[#272b38] bg-[#14161b] flex items-center justify-between">
          <button
            type="button"
            onClick={handleCopyLink}
            className="flex items-center gap-2 text-xs font-semibold text-amber-400 hover:text-amber-300 transition-colors cursor-pointer"
          >
            {copiedLink ? <Check className="w-4 h-4 text-emerald-400" /> : <Link className="w-4 h-4" />}
            <span>{copiedLink ? 'Link copied to clipboard!' : 'Get a sharing link'}</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-3 py-1.5 bg-[#232733] hover:bg-[#2e3342] text-gray-200 text-xs font-semibold rounded-lg transition-colors cursor-pointer"
          >
            Done
          </button>
        </div>
      </aside>
    </div>
  );
};
