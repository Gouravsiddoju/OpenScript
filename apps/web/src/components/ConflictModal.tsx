import React, { useState, useMemo } from 'react';
import {
  AlertTriangle,
  Copy,
  Check,
  ArrowRight,
  RefreshCw,
  GitMerge,
  GitBranch,
  ShieldAlert,
  Eye,
  Columns,
  Layers,
  X,
} from 'lucide-react';
import { smartMergeFountain } from '../utils/conflictResolver';

interface ConflictModalProps {
  isOpen: boolean;
  serverRevisionNumber?: number;
  localRevisionNumber?: number;
  localContentPreview?: string;
  serverContentPreview?: string;
  serverUpdatedAt?: string;
  onSmartMerge: (mergedText: string) => void;
  onForkDraft: () => void;
  onOverwrite: () => void;
  onReloadServer: () => void;
  onClose: () => void;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  serverRevisionNumber = 2,
  localRevisionNumber = 1,
  localContentPreview = '',
  serverContentPreview = '',
  serverUpdatedAt,
  onSmartMerge,
  onForkDraft,
  onOverwrite,
  onReloadServer,
  onClose,
}) => {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'merge' | 'compare' | 'server'>('merge');

  // Compute merged text automatically
  const mergedPreview = useMemo(() => {
    return smartMergeFountain(
      localContentPreview,
      serverContentPreview,
      localRevisionNumber,
      serverRevisionNumber
    );
  }, [localContentPreview, serverContentPreview, localRevisionNumber, serverRevisionNumber]);

  if (!isOpen) return null;

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4 sm:p-6 overflow-y-auto">
      <div className="bg-[#11141c] border border-amber-500/40 rounded-2xl w-full max-w-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 text-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-[#232731] flex items-start justify-between bg-gradient-to-r from-amber-500/15 via-[#161a24] to-[#11141c]">
          <div className="flex items-start gap-4">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0 border border-amber-500/30">
              <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-bold text-white font-serif">Autosave Concurrency Conflict</h3>
                <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300 border border-red-500/30">
                  Multiple Writers / Sessions
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-1 font-sans">
                Another writer, tab, or device saved changes to this screenplay while you were editing.
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Revision Chips & Context */}
        <div className="p-5 border-b border-[#1e222b] bg-[#0c0e14] grid grid-cols-1 sm:grid-cols-3 gap-3 font-mono text-xs">
          <div className="p-3 bg-[#131722] rounded-xl border border-[#232836]">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">YOUR LOCAL BASE</span>
            <span className="text-amber-400 font-bold text-base">Rev #{localRevisionNumber}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate font-sans">Currently in your browser</span>
          </div>
          <div className="p-3 bg-[#131722] rounded-xl border border-[#232836]">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">SERVER REVISION</span>
            <span className="text-emerald-400 font-bold text-base">Rev #{serverRevisionNumber}</span>
            <span className="text-[10px] text-slate-400 block mt-0.5 truncate font-sans">
              {serverUpdatedAt ? new Date(serverUpdatedAt).toLocaleTimeString() : 'Latest saved draft'}
            </span>
          </div>
          <div className="p-3 bg-[#131722] rounded-xl border border-[#232836] flex flex-col justify-between">
            <span className="text-slate-400 block text-[10px] uppercase tracking-wider">PRECAUTION</span>
            <button
              onClick={() => handleCopy(localContentPreview)}
              className="flex items-center justify-center gap-1.5 py-1 px-2 rounded-lg bg-[#1f2533] hover:bg-[#283042] text-amber-300 text-xs font-mono transition-colors"
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copied ? 'Copied Local Script' : 'Copy Local Text'}</span>
            </button>
          </div>
        </div>

        {/* Tabbed Diff / Preview Explorer */}
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-mono uppercase tracking-wider text-slate-400">
              Inspect Conflict & Resolution:
            </span>
            <div className="flex items-center space-x-1 bg-[#090b10] p-1 rounded-lg border border-[#1e222b] text-xs font-mono">
              <button
                onClick={() => setActiveTab('merge')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all ${
                  activeTab === 'merge'
                    ? 'bg-amber-500 text-black font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <GitMerge className="w-3.5 h-3.5" />
                <span>Smart Merge</span>
              </button>
              <button
                onClick={() => setActiveTab('compare')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all ${
                  activeTab === 'compare'
                    ? 'bg-amber-500 text-black font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Columns className="w-3.5 h-3.5" />
                <span>Side-by-Side</span>
              </button>
              <button
                onClick={() => setActiveTab('server')}
                className={`flex items-center space-x-1.5 px-3 py-1 rounded-md transition-all ${
                  activeTab === 'server'
                    ? 'bg-amber-500 text-black font-bold shadow'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Server Content</span>
              </button>
            </div>
          </div>

          {/* Tab 1: Smart Merge Preview */}
          {activeTab === 'merge' && (
            <div className="rounded-xl border border-amber-500/30 bg-[#090b10] p-3 text-xs font-mono">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1c202a] text-[11px] text-slate-400">
                <span className="text-amber-400 flex items-center gap-1.5">
                  <GitMerge className="w-3.5 h-3.5" />
                  <span>Reconciled Screenplay (Zero Data Loss)</span>
                </span>
                <span>{mergedPreview.split('\n').length} lines</span>
              </div>
              <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap font-mono text-slate-300 leading-relaxed custom-scrollbar p-2 bg-[#06080c] rounded">
                {mergedPreview}
              </pre>
            </div>
          )}

          {/* Tab 2: Side-by-Side Comparison */}
          {activeTab === 'compare' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs font-mono">
              <div className="rounded-xl border border-amber-500/20 bg-[#090b10] p-3">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1c202a] text-amber-300 text-[11px]">
                  <span>YOUR LOCAL BASE (Rev #{localRevisionNumber})</span>
                </div>
                <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap font-mono text-slate-300 leading-relaxed custom-scrollbar p-2 bg-[#06080c] rounded">
                  {localContentPreview || '(empty)'}
                </pre>
              </div>

              <div className="rounded-xl border border-emerald-500/20 bg-[#090b10] p-3">
                <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1c202a] text-emerald-300 text-[11px]">
                  <span>SERVER REMOTE (Rev #{serverRevisionNumber})</span>
                </div>
                <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap font-mono text-slate-300 leading-relaxed custom-scrollbar p-2 bg-[#06080c] rounded">
                  {serverContentPreview || '(empty)'}
                </pre>
              </div>
            </div>
          )}

          {/* Tab 3: Server Content View */}
          {activeTab === 'server' && (
            <div className="rounded-xl border border-emerald-500/30 bg-[#090b10] p-3 text-xs font-mono">
              <div className="flex items-center justify-between pb-2 mb-2 border-b border-[#1c202a] text-[11px] text-emerald-400">
                <span>Server Document Content (Rev #{serverRevisionNumber})</span>
                <button
                  onClick={() => handleCopy(serverContentPreview)}
                  className="hover:underline flex items-center gap-1"
                >
                  <Copy className="w-3 h-3" />
                  <span>Copy Server Text</span>
                </button>
              </div>
              <pre className="max-h-52 overflow-y-auto whitespace-pre-wrap font-mono text-slate-300 leading-relaxed custom-scrollbar p-2 bg-[#06080c] rounded">
                {serverContentPreview || '(No server content retrieved)'}
              </pre>
            </div>
          )}
        </div>

        {/* Action Panel */}
        <div className="p-5 border-t border-[#232731] bg-[#0c0e14] space-y-3 font-mono">
          <div className="text-[11px] uppercase tracking-wider text-slate-400">
            Choose Resolution Strategy:
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {/* Primary Action 1: Smart Merge */}
            <button
              onClick={() => onSmartMerge(mergedPreview)}
              className="flex items-start gap-3 p-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-black transition-all group text-left shadow-lg shadow-amber-500/20"
            >
              <div className="p-2 rounded-lg bg-black/10 shrink-0 mt-0.5">
                <GitMerge className="w-4 h-4 stroke-[2.5]" />
              </div>
              <div>
                <span className="font-bold text-xs block">1. Smart Merge (Recommended)</span>
                <span className="text-[10px] text-black/80 font-sans block leading-tight mt-0.5">
                  Combines both writers' changes into one screenplay with zero data loss.
                </span>
              </div>
            </button>

            {/* Action 2: Fork as New Draft */}
            <button
              onClick={onForkDraft}
              className="flex items-start gap-3 p-3 rounded-xl bg-[#1b212e] hover:bg-[#232b3c] border border-blue-500/30 text-white transition-all text-left"
            >
              <div className="p-2 rounded-lg bg-blue-500/20 text-blue-400 shrink-0 mt-0.5">
                <GitBranch className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs block text-blue-300">2. Save Mine as New Draft (Fork)</span>
                <span className="text-[10px] text-slate-400 font-sans block leading-tight mt-0.5">
                  Saves your edits into a separate project in Dashboard, then loads server here.
                </span>
              </div>
            </button>

            {/* Action 3: Load Server Version */}
            <button
              onClick={onReloadServer}
              className="flex items-start gap-3 p-3 rounded-xl bg-[#161a22] hover:bg-[#1e232e] border border-slate-700 text-slate-300 transition-all text-left"
            >
              <div className="p-2 rounded-lg bg-slate-800 text-slate-300 shrink-0 mt-0.5">
                <RefreshCw className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs block text-slate-200">3. Load Server Version</span>
                <span className="text-[10px] text-slate-400 font-sans block leading-tight mt-0.5">
                  Replaces screen with server text. Auto-creates local safety backup first.
                </span>
              </div>
            </button>

            {/* Action 4: Force Overwrite Server */}
            <button
              onClick={onOverwrite}
              className="flex items-start gap-3 p-3 rounded-xl bg-[#1a1416] hover:bg-[#26181b] border border-red-500/30 text-red-200 transition-all text-left"
            >
              <div className="p-2 rounded-lg bg-red-500/20 text-red-400 shrink-0 mt-0.5">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div>
                <span className="font-bold text-xs block text-red-300">4. Overwrite Server (Save Mine)</span>
                <span className="text-[10px] text-red-400/80 font-sans block leading-tight mt-0.5">
                  Force-saves local edits over server draft. Safety backup saved first.
                </span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
