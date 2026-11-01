import React from 'react';
import { X, Keyboard, Command } from 'lucide-react';

interface KeyboardShortcutsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onStartTour?: () => void;
}

export const KeyboardShortcutsModal: React.FC<KeyboardShortcutsModalProps> = ({ isOpen, onClose, onStartTour }) => {
  if (!isOpen) return null;

  const shortcutSections = [
    {
      title: 'Element State Machine & Writing Flow',
      items: [
        {
          keys: ['Tab'],
          desc: 'Cycle forward through elements (Scene Heading → Action → Character → Parenthetical → Dialogue → Transition → Shot)',
        },
        {
          keys: ['Shift', 'Tab'],
          desc: 'Cycle backward through screenplay elements',
        },
        {
          keys: ['Enter'],
          desc: 'Smart advance: Scene → Action, Character → Dialogue, Paren → Dialogue, Dialogue → Action, Shot → Action, Empty Action → Character',
        },
        {
          keys: ['Ctrl / Alt', '1'],
          desc: 'Convert current block to Scene Heading',
        },
        {
          keys: ['Ctrl / Alt', '2'],
          desc: 'Convert current block to Action',
        },
        {
          keys: ['Ctrl / Alt', '3'],
          desc: 'Convert current block to Character Cue',
        },
        {
          keys: ['Ctrl / Alt', '4'],
          desc: 'Convert current block to Parenthetical',
        },
        {
          keys: ['Ctrl / Alt', '5'],
          desc: 'Convert current block to Dialogue',
        },
        {
          keys: ['Ctrl / Alt', '6'],
          desc: 'Convert current block to Transition (e.g. CUT TO:)',
        },
        {
          keys: ['Ctrl / Alt', '7'],
          desc: 'Convert current block to Shot (e.g. CLOSE UP, ANGLE ON, POV)',
        },
      ],
    },
    {
      title: 'Top Ribbon & Production Controls',
      items: [
        {
          keys: ['Alt', 'L'],
          desc: 'Toggle Script Lock (freezes scene numbering with A/B inserts)',
        },
        {
          keys: ['Alt', 'T'],
          desc: 'Toggle Revision Tracking (* asterisks on modified lines)',
        },
        {
          keys: ['Alt', 'N'],
          desc: 'Toggle ScriptNotes & Production Comments drawer',
        },
        {
          keys: ['Ctrl / Alt', 'S'],
          desc: 'Save Checkpoint to cloud & resilient local cache',
        },
        {
          keys: ['Alt', 'F'],
          desc: 'Toggle Distraction-Free Focus Mode',
        },
        {
          keys: ['Alt', 'W'],
          desc: 'Open Writing Sprint Stopwatch widget',
        },
        {
          keys: ['Ctrl / Alt', 'P'],
          desc: 'Print formatted screenplay / Export PDF',
        },
      ],
    },
    {
      title: 'Workspace View Navigation',
      items: [
        {
          keys: ['Alt', 'E'],
          desc: 'Switch to Screenplay Editor',
        },
        {
          keys: ['Alt', 'B'],
          desc: 'Switch to Beat Board (Index Cards)',
        },
        {
          keys: ['Alt', 'R'],
          desc: 'Switch to Production Reports (Eighths & Breakdowns)',
        },
        {
          keys: ['Alt', 'U'],
          desc: 'Switch to Fountain Plaintext View',
        },
        {
          keys: ['?'],
          desc: 'Open / Close this Keyboard Shortcuts Cheat Sheet',
        },
      ],
    },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-[#13151b] border border-[#2b2f3a] rounded-2xl shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#22252e]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-400">
              <Keyboard className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-100 flex items-center gap-2">
                OpenScript Keyboard Shortcuts
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  Editor Ergonomics
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                Seamless keyboard navigation designed for professional speed and flow
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#20232c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content list */}
        <div className="overflow-y-auto px-6 py-4 space-y-6">
          {shortcutSections.map((section) => (
            <div key={section.title} className="space-y-2">
              <h3 className="text-xs font-mono font-semibold text-amber-400/90 uppercase tracking-wider">
                {section.title}
              </h3>
              <div className="grid grid-cols-1 gap-2">
                {section.items.map((item, idx) => (
                  <div
                    key={idx}
                    className="flex items-center justify-between p-2 rounded-lg bg-[#181a22] border border-[#242733] hover:border-[#353949] transition-colors"
                  >
                    <span className="text-xs text-gray-300 pr-4">{item.desc}</span>
                    <div className="flex items-center gap-1 shrink-0">
                      {item.keys.map((k, kidx) => (
                        <React.Fragment key={kidx}>
                          <kbd className="px-2 py-1 text-[11px] font-mono font-semibold bg-[#0f1015] text-amber-300 border border-[#2d3240] rounded shadow-sm">
                            {k}
                          </kbd>
                          {kidx < item.keys.length - 1 && (
                            <span className="text-[11px] text-gray-500">+</span>
                          )}
                        </React.Fragment>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-[#22252e] bg-[#0f1015] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-1.5">
            <Command className="w-3.5 h-3.5 text-gray-500" />
            <span>Works on Mac (⌘), Windows (Ctrl), and Linux</span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold rounded-lg text-xs transition-colors"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
};
