import React from 'react';
import { X, FileText, Check } from 'lucide-react';

export interface TitlePageMetadata {
  title: string;
  credit: string;
  author: string;
  basedOn: string;
  contact: string;
  draftLabel: string;
  draftDate: string;
  showTitlePage: boolean;
}

interface TitlePageModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: TitlePageMetadata;
  onChange: (metadata: TitlePageMetadata) => void;
}

export const TitlePageModal: React.FC<TitlePageModalProps> = ({
  isOpen,
  onClose,
  metadata,
  onChange,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="relative w-full max-w-lg bg-[#14161a] border border-[#2b2e38] rounded-2xl shadow-2xl p-6 text-gray-200">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-[#23262e]">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg border border-amber-500/20">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Title Page Configuration</h3>
              <p className="text-xs text-gray-400">Industry-standard Hollywood screenplay cover metadata</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-[#20232b] text-gray-400 hover:text-white transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Fields */}
        <div className="space-y-4 py-4 text-xs font-mono">
          <div>
            <label className="block text-gray-400 uppercase text-[10px] tracking-wider mb-1">
              Screenplay Title
            </label>
            <input
              type="text"
              value={metadata.title}
              onChange={(e) => onChange({ ...metadata, title: e.target.value })}
              placeholder="THE GLASS COUNTER"
              className="w-full px-3 py-2 bg-[#0c0d0f] border border-[#262933] rounded-lg text-white font-screenplay uppercase tracking-wider focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 uppercase text-[10px] tracking-wider mb-1">
                Credit Line
              </label>
              <select
                value={metadata.credit}
                onChange={(e) => onChange({ ...metadata, credit: e.target.value })}
                className="w-full px-3 py-2 bg-[#0c0d0f] border border-[#262933] rounded-lg text-gray-200 focus:outline-none focus:border-amber-500/50"
              >
                <option value="written by">written by</option>
                <option value="screenplay by">screenplay by</option>
                <option value="story by">story by</option>
                <option value="teleplay by">teleplay by</option>
              </select>
            </div>

            <div>
              <label className="block text-gray-400 uppercase text-[10px] tracking-wider mb-1">
                Author / Screenwriter(s)
              </label>
              <input
                type="text"
                value={metadata.author}
                onChange={(e) => onChange({ ...metadata, author: e.target.value })}
                placeholder="Gourav Siddoju"
                className="w-full px-3 py-2 bg-[#0c0d0f] border border-[#262933] rounded-lg text-white font-screenplay focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-400 uppercase text-[10px] tracking-wider mb-1">
              Based On (Optional)
            </label>
            <input
              type="text"
              value={metadata.basedOn}
              onChange={(e) => onChange({ ...metadata, basedOn: e.target.value })}
              placeholder="Based on an original story by..."
              className="w-full px-3 py-2 bg-[#0c0d0f] border border-[#262933] rounded-lg text-gray-200 font-screenplay focus:outline-none focus:border-amber-500/50"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-400 uppercase text-[10px] tracking-wider mb-1">
                Draft Label & Revision
              </label>
              <input
                type="text"
                value={metadata.draftLabel}
                onChange={(e) => onChange({ ...metadata, draftLabel: e.target.value })}
                placeholder="First Draft / White Shooting Draft"
                className="w-full px-3 py-2 bg-[#0c0d0f] border border-[#262933] rounded-lg text-gray-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>

            <div>
              <label className="block text-gray-400 uppercase text-[10px] tracking-wider mb-1">
                Date
              </label>
              <input
                type="text"
                value={metadata.draftDate}
                onChange={(e) => onChange({ ...metadata, draftDate: e.target.value })}
                placeholder={new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
                className="w-full px-3 py-2 bg-[#0c0d0f] border border-[#262933] rounded-lg text-gray-200 focus:outline-none focus:border-amber-500/50"
              />
            </div>
          </div>

          <div>
            <label className="block text-gray-400 uppercase text-[10px] tracking-wider mb-1">
              Contact / Representation Info
            </label>
            <textarea
              rows={3}
              value={metadata.contact}
              onChange={(e) => onChange({ ...metadata, contact: e.target.value })}
              placeholder="Contact: contact@ssnpictures.in&#10;Phone: +1 (555) 019-2831&#10;SSN Pictures"
              className="w-full px-3 py-2 bg-[#0c0d0f] border border-[#262933] rounded-lg text-gray-200 font-screenplay focus:outline-none focus:border-amber-500/50 resize-none"
            />
          </div>

          {/* Toggle */}
          <div className="pt-2 flex items-center justify-between">
            <span className="text-gray-300">Show Title Page in Script & PDF</span>
            <button
              type="button"
              onClick={() => onChange({ ...metadata, showTitlePage: !metadata.showTitlePage })}
              className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                metadata.showTitlePage ? 'bg-amber-500' : 'bg-gray-700'
              }`}
            >
              <span
                className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-black shadow-lg ring-0 transition duration-200 ease-in-out ${
                  metadata.showTitlePage ? 'translate-x-4' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 pt-3 border-t border-[#23262e]">
          <button
            onClick={onClose}
            className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs rounded-xl transition-all shadow-md shadow-amber-500/20"
          >
            <Check className="w-3.5 h-3.5 stroke-[3]" />
            <span>Done</span>
          </button>
        </div>
      </div>
    </div>
  );
};
