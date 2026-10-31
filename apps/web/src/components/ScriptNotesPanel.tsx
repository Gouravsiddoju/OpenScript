import React, { useState } from 'react';
import { 
  X, 
  MessageSquare, 
  Plus, 
  Check, 
  RotateCcw, 
  Trash2, 
  Send, 
  Filter, 
  Tag, 
  Clock, 
  User,
  AlertCircle
} from 'lucide-react';
import { ScriptNote, ScriptNoteCategory } from '@openscript/screenplay-schema';

interface ScriptNotesPanelProps {
  isOpen: boolean;
  onClose: () => void;
  notes: ScriptNote[];
  onAddNote: (category: ScriptNoteCategory, content: string, blockId?: string) => void;
  onAddReply: (noteId: string, content: string) => void;
  onToggleResolve: (noteId: string, currentStatus: boolean) => void;
  onDeleteNote: (noteId: string) => void;
  onJumpToBlock?: (blockId: string) => void;
  canEdit: boolean;
  activeBlockId?: string | null;
}

const CATEGORY_COLORS: Record<ScriptNoteCategory, { bg: string; text: string; border: string }> = {
  general: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/30' },
  dialogue: { bg: 'bg-blue-500/10', text: 'text-blue-400', border: 'border-blue-500/30' },
  action: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  production: { bg: 'bg-purple-500/10', text: 'text-purple-400', border: 'border-purple-500/30' },
  director: { bg: 'bg-rose-500/10', text: 'text-rose-400', border: 'border-rose-500/30' },
  legal: { bg: 'bg-orange-500/10', text: 'text-orange-400', border: 'border-orange-500/30' },
};

export const ScriptNotesPanel: React.FC<ScriptNotesPanelProps> = ({
  isOpen,
  onClose,
  notes,
  onAddNote,
  onAddReply,
  onToggleResolve,
  onDeleteNote,
  onJumpToBlock,
  canEdit,
  activeBlockId,
}) => {
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<'all' | 'open' | 'resolved'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  
  // New note form state
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newCategory, setNewCategory] = useState<ScriptNoteCategory>('general');
  const [newContent, setNewContent] = useState('');

  // Active reply inputs: noteId -> replyText
  const [replyInputs, setReplyInputs] = useState<Record<string, string>>({});

  if (!isOpen) return null;

  const filteredNotes = notes.filter((n) => {
    if (filterCategory !== 'all' && n.category !== filterCategory) return false;
    if (filterStatus === 'open' && n.resolved) return false;
    if (filterStatus === 'resolved' && !n.resolved) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const inContent = n.content.toLowerCase().includes(q);
      const inAuthor = n.authorName.toLowerCase().includes(q);
      const inReplies = n.replies?.some((r) => r.content.toLowerCase().includes(q));
      if (!inContent && !inAuthor && !inReplies) return false;
    }
    return true;
  });

  const handleCreateNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContent.trim()) return;
    onAddNote(newCategory, newContent.trim(), activeBlockId || undefined);
    setNewContent('');
    setIsAddingNote(false);
  };

  const handleSendReply = (noteId: string) => {
    const text = replyInputs[noteId]?.trim();
    if (!text) return;
    onAddReply(noteId, text);
    setReplyInputs((prev) => ({ ...prev, [noteId]: '' }));
  };

  return (
    <aside className="no-print fixed top-14 right-0 bottom-0 w-96 bg-[#111317] border-l border-[#21242d] shadow-2xl flex flex-col z-40 animate-in slide-in-from-right duration-200">
      {/* Panel Header */}
      <div className="p-4 border-b border-[#21242d] flex items-center justify-between bg-[#15181e]">
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-amber-400" />
          <h2 className="text-sm font-semibold text-white tracking-wide">ScriptNotes & Feedback</h2>
          <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/30">
            {notes.filter((n) => !n.resolved).length} Open
          </span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#20232c] transition-colors"
          title="Close ScriptNotes Panel"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="p-3 border-b border-[#1e2129] bg-[#0e1014] flex flex-col gap-2">
        <input
          type="text"
          placeholder="Filter notes by keyword..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-3 py-1.5 bg-[#171a21] border border-[#262a34] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
        />

        <div className="flex items-center justify-between text-xs font-mono">
          <div className="flex items-center gap-1">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                filterStatus === 'all' ? 'bg-[#222733] text-amber-400 font-medium' : 'text-gray-400 hover:text-white'
              }`}
            >
              All ({notes.length})
            </button>
            <button
              onClick={() => setFilterStatus('open')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                filterStatus === 'open' ? 'bg-[#222733] text-amber-400 font-medium' : 'text-gray-400 hover:text-white'
              }`}
            >
              Open
            </button>
            <button
              onClick={() => setFilterStatus('resolved')}
              className={`px-2 py-1 rounded text-[11px] transition-colors ${
                filterStatus === 'resolved' ? 'bg-[#222733] text-amber-400 font-medium' : 'text-gray-400 hover:text-white'
              }`}
            >
              Resolved
            </button>
          </div>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="px-2 py-1 bg-[#171a21] border border-[#262a34] rounded text-[11px] text-gray-300 focus:outline-none"
          >
            <option value="all">All Categories</option>
            <option value="general">General</option>
            <option value="dialogue">Dialogue</option>
            <option value="action">Action</option>
            <option value="director">Director</option>
            <option value="production">Production</option>
            <option value="legal">Legal</option>
          </select>
        </div>
      </div>

      {/* Note Creation Trigger / Form */}
      {canEdit && (
        <div className="p-3 border-b border-[#1e2129] bg-[#13161c]">
          {!isAddingNote ? (
            <button
              onClick={() => setIsAddingNote(true)}
              className="w-full py-2 px-3 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Leave ScriptNote on Script</span>
            </button>
          ) : (
            <form onSubmit={handleCreateNote} className="flex flex-col gap-2 bg-[#171a21] p-3 rounded-lg border border-[#2b303d]">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">New Note</span>
                <select
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value as ScriptNoteCategory)}
                  className="px-2 py-0.5 bg-[#0f1115] border border-[#2b303d] rounded text-[11px] text-amber-400 focus:outline-none"
                >
                  <option value="general">General</option>
                  <option value="dialogue">Dialogue</option>
                  <option value="action">Action</option>
                  <option value="director">Director</option>
                  <option value="production">Production</option>
                  <option value="legal">Legal</option>
                </select>
              </div>

              <textarea
                placeholder="Type note or production feedback..."
                value={newContent}
                onChange={(e) => setNewContent(e.target.value)}
                rows={3}
                autoFocus
                className="w-full px-2.5 py-1.5 bg-[#0f1115] border border-[#2b303d] rounded text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50 resize-none font-sans"
              />

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsAddingNote(false)}
                  className="px-2.5 py-1 text-xs text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!newContent.trim()}
                  className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-semibold rounded transition-colors"
                >
                  Post Note
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {/* Notes List */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {filteredNotes.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-center p-6 text-gray-500">
            <MessageSquare className="w-8 h-8 stroke-1 text-gray-600 mb-2" />
            <p className="text-xs font-medium text-gray-400">No ScriptNotes found</p>
            <p className="text-[11px] text-gray-600 mt-1">
              Add margin notes to collaborate on scenes, dialogue tweaks, and director cues.
            </p>
          </div>
        ) : (
          filteredNotes.map((note) => {
            const catStyle = CATEGORY_COLORS[note.category] || CATEGORY_COLORS.general;
            const isResolved = note.resolved;

            return (
              <div
                key={note.id}
                className={`rounded-xl border transition-all ${
                  isResolved
                    ? 'bg-[#121418]/60 border-[#1c1f26] opacity-75'
                    : 'bg-[#16181f] border-[#252934] shadow-sm hover:border-[#353b49]'
                }`}
              >
                {/* Note Header */}
                <div className="p-3 border-b border-[#1e222a] flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow-sm"
                      style={{ backgroundColor: note.authorColor || '#eab308' }}
                    >
                      {note.authorName.charAt(0).toUpperCase()}
                    </span>
                    <span className="text-xs font-semibold text-gray-200">{note.authorName}</span>
                    <span className={`text-[10px] font-mono px-1.5 py-0.5 rounded border ${catStyle.bg} ${catStyle.text} ${catStyle.border}`}>
                      {note.category}
                    </span>
                  </div>

                  <div className="flex items-center gap-1">
                    {/* Resolve / Unresolve Toggle */}
                    <button
                      onClick={() => onToggleResolve(note.id, note.resolved)}
                      className={`p-1 rounded transition-colors ${
                        isResolved
                          ? 'text-emerald-400 hover:bg-emerald-500/10'
                          : 'text-gray-500 hover:text-emerald-400 hover:bg-[#20242e]'
                      }`}
                      title={isResolved ? 'Mark as unresolved' : 'Mark as resolved'}
                    >
                      <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                    </button>

                    {/* Delete Note */}
                    {canEdit && (
                      <button
                        onClick={() => onDeleteNote(note.id)}
                        className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-[#20242e] transition-colors"
                        title="Delete note"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Note Content */}
                <div className="p-3">
                  <p className={`text-xs leading-relaxed ${isResolved ? 'line-through text-gray-400' : 'text-gray-200'}`}>
                    {note.content}
                  </p>

                  {note.blockId && onJumpToBlock && (
                    <button
                      onClick={() => onJumpToBlock(note.blockId)}
                      className="mt-2 text-[10px] font-mono text-amber-400/80 hover:text-amber-300 underline underline-offset-2 flex items-center gap-1 transition-colors"
                    >
                      <span>Jump to script line →</span>
                    </button>
                  )}
                </div>

                {/* Replies Thread */}
                {note.replies && note.replies.length > 0 && (
                  <div className="border-t border-[#1e222a] bg-[#111317] p-2.5 space-y-2">
                    {note.replies.map((reply) => (
                      <div key={reply.id} className="flex items-start gap-2 text-xs">
                        <span
                          className="w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold text-white shrink-0 mt-0.5"
                          style={{ backgroundColor: reply.authorColor || '#3b82f6' }}
                        >
                          {reply.authorName.charAt(0).toUpperCase()}
                        </span>
                        <div className="flex-1 bg-[#171a22] p-2 rounded-lg border border-[#222631]">
                          <div className="flex items-center justify-between text-[10px] text-gray-400 font-mono mb-0.5">
                            <span className="font-semibold text-gray-300">{reply.authorName}</span>
                          </div>
                          <p className="text-gray-300 text-[11px] leading-tight">{reply.content}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Reply Input Box */}
                {!isResolved && canEdit && (
                  <div className="border-t border-[#1e222a] p-2 bg-[#12151b] flex items-center gap-1.5">
                    <input
                      type="text"
                      placeholder="Reply to thread..."
                      value={replyInputs[note.id] || ''}
                      onChange={(e) =>
                        setReplyInputs((prev) => ({ ...prev, [note.id]: e.target.value }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleSendReply(note.id);
                        }
                      }}
                      className="flex-1 px-2.5 py-1 bg-[#191c24] border border-[#272b36] rounded text-[11px] text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/50"
                    />
                    <button
                      onClick={() => handleSendReply(note.id)}
                      disabled={!replyInputs[note.id]?.trim()}
                      className="p-1 rounded bg-amber-500 hover:bg-amber-400 disabled:opacity-30 text-black transition-colors"
                      title="Send reply"
                    >
                      <Send className="w-3 h-3 stroke-[2.5]" />
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
