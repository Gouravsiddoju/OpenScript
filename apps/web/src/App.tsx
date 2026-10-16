import React, { useState } from 'react';
import { 
  FileText, 
  LayoutGrid, 
  Code, 
  BarChart2, 
  Save, 
  CheckCircle2, 
  Clock, 
  Settings, 
  FolderGit2, 
  Sparkles,
  ChevronRight
} from 'lucide-react';

export default function App() {
  const [activeMode, setActiveMode] = useState<'screenplay' | 'fountain' | 'corkboard' | 'reports'>('screenplay');
  const [saveStatus, setSaveStatus] = useState<'saved' | 'saving' | 'unsaved'>('saved');

  return (
    <div className="flex h-screen bg-[#0d0e10] text-[#e0e2e5] overflow-hidden">
      {/* 1. Left Navigation Sidebar */}
      <aside className="w-64 border-r border-[#1e2024] bg-[#0a0a0c] flex flex-col justify-between">
        <div>
          {/* Logo */}
          <div className="p-4 border-b border-[#1e2024] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded bg-gradient-to-br from-amber-500 to-amber-700 flex items-center justify-center font-bold text-black text-sm">
                S
              </div>
              <div>
                <span className="font-bold tracking-wider text-sm block">OPENSCRIPT <span className="text-amber-500 text-xs font-mono">OSS</span></span>
                <span className="text-[10px] text-gray-500 block">OPENSCRIPT.ssnpictures.in</span>
              </div>
            </div>
          </div>

          {/* Project & Document info */}
          <div className="p-3 bg-[#131417] mx-3 my-3 rounded border border-[#22252a]">
            <div className="text-xs text-gray-400 font-medium truncate">PROJECT: SABROSA</div>
            <div className="text-sm font-semibold text-white truncate mt-0.5">Feature Script v1.0</div>
            <div className="text-[11px] text-amber-500/90 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
              White Production Draft
            </div>
          </div>

          {/* Mode Switcher */}
          <nav className="px-2 space-y-1">
            {[
              { id: 'screenplay', label: 'Screenplay Editor', icon: FileText },
              { id: 'fountain', label: 'Fountain Source', icon: Code },
              { id: 'corkboard', label: 'Corkboard / Cards', icon: LayoutGrid },
              { id: 'reports', label: 'Production Reports', icon: BarChart2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setActiveMode(id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded text-xs font-medium transition-colors ${
                  activeMode === id 
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30' 
                    : 'text-gray-400 hover:text-white hover:bg-[#16181c]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Footer status */}
        <div className="p-3 border-t border-[#1e2024] text-[11px] text-gray-500 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-emerald-400">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Saved to Local DB
          </span>
          <span className="font-mono">Rev #1</span>
        </div>
      </aside>

      {/* 2. Main Studio Canvas */}
      <main className="flex-1 flex flex-col bg-[#141518] overflow-hidden">
        {/* Top Studio Bar */}
        <header className="h-12 border-b border-[#1e2024] bg-[#0d0e10] px-6 flex items-center justify-between">
          <div className="flex items-center gap-3 text-xs text-gray-400 font-mono">
            <span>SCENE 1</span>
            <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
            <span className="text-gray-200">INT. APARTMENT - NIGHT</span>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <div className="flex items-center gap-2 text-gray-400 font-mono">
              <Clock className="w-3.5 h-3.5 text-amber-500" />
              <span>Page 1 of 1 (1 min)</span>
            </div>
            <button className="px-3 py-1 bg-amber-500 text-black font-semibold rounded text-xs hover:bg-amber-400 transition-colors">
              Export PDF
            </button>
          </div>
        </header>

        {/* Editor Viewport with Standard Screenplay Page Canvas */}
        <div className="flex-1 overflow-y-auto p-8 flex justify-center bg-[#111215]">
          <div className="w-[8.5in] min-h-[11in] bg-[#ffffff] text-[#000000] p-[1.0in_1.0in_1.0in_1.5in] shadow-2xl rounded-sm font-mono text-[12pt] leading-[1.0] select-text">
            {/* Standard Header */}
            <div className="text-right text-[10pt] text-gray-500 mb-8 border-b border-gray-100 pb-2">
              SABROSA - Draft 1.0 - 1.
            </div>

            {/* Scene Heading */}
            <div className="font-bold uppercase tracking-wider mb-4">
              INT. RESTAURANT KITCHEN - NIGHT
            </div>

            {/* Action */}
            <div className="max-w-[6.0in] leading-normal mb-4">
              Steam billows from copper pans. Pots rattle on high flame. MAYA (28) plates a delicate dessert with surgical precision.
            </div>

            {/* Character */}
            <div className="ml-[2.2in] uppercase tracking-wider font-semibold">
              MAYA
            </div>

            {/* Parenthetical */}
            <div className="ml-[1.6in] text-[11pt] text-gray-700">
              (without looking up)
            </div>

            {/* Dialogue */}
            <div className="ml-[1.0in] max-w-[3.5in] leading-normal mb-4">
              If the reduction isn't ready in two minutes, throw it out and start over.
            </div>

            {/* Transition */}
            <div className="text-right uppercase mt-6 mb-4">
              CUT TO:
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

