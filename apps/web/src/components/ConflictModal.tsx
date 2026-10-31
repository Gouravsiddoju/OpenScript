import React from 'react';
import { AlertTriangle, Copy, Check, ArrowRight, RefreshCw } from 'lucide-react';

interface ConflictModalProps {
  isOpen: boolean;
  serverRevisionNumber?: number;
  localRevisionNumber?: number;
  onOverwrite: () => void;
  onReloadServer: () => void;
  onClose: () => void;
  localContentPreview?: string;
}

export const ConflictModal: React.FC<ConflictModalProps> = ({
  isOpen,
  serverRevisionNumber,
  localRevisionNumber,
  onOverwrite,
  onReloadServer,
  onClose,
  localContentPreview,
}) => {
  const [copied, setCopied] = React.useState(false);

  if (!isOpen) return null;

  const handleCopy = () => {
    if (localContentPreview) {
      navigator.clipboard.writeText(localContentPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#14161b] border border-amber-500/40 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-[#232731] flex items-start gap-4 bg-amber-500/10">
          <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
            <AlertTriangle className="w-6 h-6 stroke-[2.2]" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-white">Autosave Concurrency Conflict</h3>
            <p className="text-xs text-gray-400 mt-1">
              Another writer, device, or browser tab saved changes while you were editing.
            </p>
          </div>
        </div>

        {/* Details */}
        <div className="p-5 space-y-4 text-xs font-mono">
          <div className="grid grid-cols-2 gap-3 p-3 bg-[#0d0f12] rounded-xl border border-[#1e222b]">
            <div>
              <span className="text-gray-500 block text-[11px]">YOUR LOCAL BASE</span>
              <span className="text-amber-400 font-semibold text-sm">Rev #{localRevisionNumber ?? 1}</span>
            </div>
            <div>
              <span className="text-gray-500 block text-[11px]">SERVER REVISION</span>
              <span className="text-emerald-400 font-semibold text-sm">Rev #{serverRevisionNumber ?? 2}</span>
            </div>
          </div>

          <p className="text-gray-300 font-sans leading-relaxed">
            To prevent accidental data loss, choose how you want to resolve this conflict:
          </p>

          {localContentPreview && (
            <div className="flex items-center justify-between p-2.5 bg-[#1a1d24] rounded-lg border border-[#2b303c]">
              <span className="text-gray-400 text-[11px] truncate max-w-[280px]">
                Backup local text before resolving:
              </span>
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#242934] hover:bg-[#2e3442] text-gray-200 text-[11px] transition-colors"
              >
                {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copied ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="p-4 border-t border-[#232731] bg-[#0f1115] flex items-center justify-end gap-2.5">
          <button
            onClick={onReloadServer}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c2028] hover:bg-[#252b36] text-xs font-mono text-gray-300 border border-[#2f3542] transition-colors"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Load Server Version</span>
          </button>

          <button
            onClick={onOverwrite}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-xs font-mono font-bold text-black shadow-lg shadow-amber-500/20 transition-all"
          >
            <span>Overwrite Server (Save Mine)</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
};
