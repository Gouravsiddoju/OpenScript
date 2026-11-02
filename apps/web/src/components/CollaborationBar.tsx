import React from 'react';
import { Users, MessageSquare, Shield, Edit3, Eye, User } from 'lucide-react';
import { CollaboratorRole, LivePresence } from '@openscript/screenplay-schema';
import { UserProfileData } from './UserProfileModal';

interface CollaborationBarProps {
  presencePeers: LivePresence[];
  currentUserRole: CollaboratorRole;
  currentUser?: UserProfileData | null;
  unresolvedNotesCount: number;
  isNotesPanelOpen: boolean;
  onToggleNotesPanel: () => void;
  onOpenShareModal: () => void;
  onOpenProfileModal?: () => void;
  onSelectPeerProfile?: (peer: LivePresence) => void;
}

export const CollaborationBar: React.FC<CollaborationBarProps> = ({
  presencePeers,
  currentUserRole,
  currentUser,
  unresolvedNotesCount,
  isNotesPanelOpen,
  onToggleNotesPanel,
  onOpenShareModal,
  onOpenProfileModal,
  onSelectPeerProfile,
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Active & Invited Team Presence Roster */}
      <div className="flex items-center -space-x-1.5 overflow-hidden pl-1" title="Project team & active collaborators (Click avatar to view profile)">
        {presencePeers.map((peer) => {
          const isLive = Boolean((peer as any).isOnline || peer.isTyping);
          return (
            <button
              key={peer.userId}
              type="button"
              onClick={() => onSelectPeerProfile && onSelectPeerProfile(peer)}
              className="relative group cursor-pointer focus:outline-none"
              title={`${peer.displayName} (${peer.role}) - ${isLive ? 'Active now in room' : 'Invited / Offline'}`}
            >
              <span
                className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white ring-2 ring-[#0c0d0e] transition-transform group-hover:scale-110 shadow-sm"
                style={{ backgroundColor: peer.color || '#ec4899' }}
              >
                {peer.displayName.charAt(0).toUpperCase()}
              </span>
              {/* Live presence status dot */}
              {isLive ? (
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-black animate-pulse" title="Active now" />
              ) : (
                <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-gray-500 ring-1 ring-black" title="Offline / Invited" />
              )}
            </button>
          );
        })}
      </div>

      {/* ScriptNotes Toggle Button */}
      <button
        onClick={onToggleNotesPanel}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
          isNotesPanelOpen
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
            : 'bg-[#181a1f] hover:bg-[#22252c] text-gray-400 hover:text-white border-[#2b2e36]'
        }`}
        title="Toggle ScriptNotes & Production Feedback (Alt+N)"
      >
        <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden sm:inline">Notes</span>
        {unresolvedNotesCount > 0 && (
          <span className="px-1.5 py-0.2 rounded-full bg-amber-500 text-black font-bold text-[10px] leading-tight">
            {unresolvedNotesCount}
          </span>
        )}
      </button>

      {/* Team / Share Button */}
      <button
        onClick={onOpenShareModal}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181a1f] hover:bg-[#22252c] text-xs font-mono text-gray-300 hover:text-white border border-[#2b2e36] transition-colors"
        title="Share screenplay & manage co-writers"
      >
        <Users className="w-3.5 h-3.5 text-amber-400" />
        <span className="hidden md:inline">Share</span>
      </button>

      {/* Role Pill */}
      {currentUserRole === 'reader' && (
        <span className="flex items-center gap-1 px-2 py-1 rounded bg-red-500/10 text-red-400 border border-red-500/30 text-[11px] font-mono">
          <Eye className="w-3 h-3" />
          <span className="hidden lg:inline">Read Only</span>
        </span>
      )}
      {(currentUserRole === 'guest' || currentUserRole === 'commenter') && (
        <span className="flex items-center gap-1 px-2 py-1 rounded bg-purple-500/10 text-purple-400 border border-purple-500/30 text-[11px] font-mono">
          <MessageSquare className="w-3 h-3" />
          <span className="hidden lg:inline">Guest (Notes)</span>
        </span>
      )}

      {/* Current User Profile Pill (Clickable to view basic info) */}
      <button
        type="button"
        onClick={onOpenProfileModal}
        className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl bg-[#171a22] hover:bg-[#20242f] border border-[#272b38] hover:border-amber-500/50 transition-all text-left group shadow-sm"
        title="Click to view basic info & profile settings"
      >
        <span
          className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold text-white shadow-sm ring-1 ring-black/40 group-hover:scale-105 transition-transform"
          style={{ backgroundColor: currentUser?.color || '#f59e0b' }}
        >
          {currentUser?.displayName?.charAt(0).toUpperCase() || 'S'}
        </span>
        <div className="flex flex-col leading-tight hidden xl:flex">
          <span className="text-xs font-semibold text-gray-200 group-hover:text-amber-300 transition-colors truncate max-w-[120px]">
            {currentUser?.displayName || 'Screenwriter'}
          </span>
          <span className="text-[9px] font-mono text-gray-500 capitalize">
            {currentUser?.role || currentUserRole}
          </span>
        </div>
      </button>
    </div>
  );
};
