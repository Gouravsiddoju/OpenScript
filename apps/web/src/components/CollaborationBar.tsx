import React from 'react';
import { Users, MessageSquare, Shield, Edit3, Eye } from 'lucide-react';
import { CollaboratorRole, LivePresence } from '@openscript/screenplay-schema';

interface CollaborationBarProps {
  presencePeers: LivePresence[];
  currentUserRole: CollaboratorRole;
  unresolvedNotesCount: number;
  isNotesPanelOpen: boolean;
  onToggleNotesPanel: () => void;
  onOpenShareModal: () => void;
}

export const CollaborationBar: React.FC<CollaborationBarProps> = ({
  presencePeers,
  currentUserRole,
  unresolvedNotesCount,
  isNotesPanelOpen,
  onToggleNotesPanel,
  onOpenShareModal,
}) => {
  return (
    <div className="flex items-center gap-2">
      {/* Active Collaborators Presence Roster */}
      <div className="flex items-center -space-x-1.5 overflow-hidden pl-1" title="Active collaborators in room">
        {presencePeers.map((peer) => (
          <div
            key={peer.userId}
            className="relative group cursor-pointer"
            title={`${peer.displayName} (${peer.role})${peer.isTyping ? ' - typing...' : ''}`}
          >
            <span
              className="inline-flex items-center justify-center w-6 h-6 rounded-full text-[10px] font-bold text-white ring-2 ring-[#0c0d0e] transition-transform group-hover:scale-110 shadow-sm"
              style={{ backgroundColor: peer.color }}
            >
              {peer.displayName.charAt(0).toUpperCase()}
            </span>
            {/* Live presence pulsing green dot */}
            <span className="absolute bottom-0 right-0 w-2 h-2 rounded-full bg-emerald-400 ring-1 ring-black animate-pulse" />
          </div>
        ))}
      </div>

      {/* ScriptNotes Toggle Button */}
      <button
        onClick={onToggleNotesPanel}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
          isNotesPanelOpen
            ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
            : 'bg-[#181a1f] hover:bg-[#22252c] text-gray-400 hover:text-white border-[#2b2e36]'
        }`}
        title="Toggle ScriptNotes & Production Feedback"
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
    </div>
  );
};
