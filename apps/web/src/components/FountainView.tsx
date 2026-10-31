import React from 'react';
import { Code2, Copy, Check } from 'lucide-react';

interface FountainViewProps {
  fountainText: string;
  onChange: (newText: string) => void;
}

export const FountainView: React.FC<FountainViewProps> = ({ fountainText, onChange }) => {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(fountainText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="w-full max-w-4xl mx-auto p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm text-gray-300 font-mono">
          <Code2 className="w-4 h-4 text-amber-500" />
          <span>Fountain Plain-Text Mode</span>
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 px-3 py-1 bg-[#1e2025] hover:bg-[#282b32] text-xs font-mono text-gray-300 rounded border border-[#2f333c] transition-colors"
        >
          {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
          <span>{copied ? 'Copied' : 'Copy Fountain'}</span>
        </button>
      </div>

      <div className="relative">
        <textarea
          value={fountainText}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Type or paste Fountain script here..."
          className="w-full h-[650px] bg-[#121316] text-[#e5e5e5] font-screenplay text-[12pt] p-6 rounded-xl border border-[#252830] focus:border-amber-500/50 focus:outline-none resize-none leading-relaxed shadow-inner"
          spellCheck={false}
        />
      </div>
    </div>
  );
};
