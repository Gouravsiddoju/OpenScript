import React, { useEffect, useMemo } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { screenplayNodes, ScreenplayKeymap } from '@openscript/editor';
import { Sparkles } from 'lucide-react';

interface ScreenplayEditorProps {
  initialContent?: string;
  onUpdate?: (html: string, json: any) => void;
  onEditorReady?: (editor: any) => void;
}

const DEFAULT_SCRIPT_HTML = `
  <div class="script-scene-heading">INT. COFFEE SHOP - DAY</div>
  <div class="script-action">Rain drums against the tall glass windows. A steaming cup of espresso rests on the counter.</div>
  <div class="script-character">MAYA</div>
  <div class="script-parenthetical">(checking her watch)</div>
  <div class="script-dialogue">He should have been here twenty minutes ago. We don't have all day.</div>
  <div class="script-action">The front door chimes. A soaked figure in a black trench coat steps inside.</div>
  <div class="script-transition">CUT TO:</div>
`;

const STANDARD_TRANSITIONS = ['CUT TO:', 'FADE OUT.', 'DISSOLVE TO:', 'SMASH CUT TO:', 'MATCH CUT TO:'];
const SLUGLINE_PREFIXES = ['INT. ', 'EXT. ', 'INT/EXT. '];
const SLUGLINE_TIMES = [' - DAY', ' - NIGHT', ' - CONTINUOUS', ' - LATER', ' - DAWN', ' - DUSK'];

export const ScreenplayEditor: React.FC<ScreenplayEditorProps> = ({
  initialContent = DEFAULT_SCRIPT_HTML,
  onUpdate,
  onEditorReady,
}) => {
  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        codeBlock: false,
        heading: false,
      }),
      ...screenplayNodes,
      ScreenplayKeymap,
    ],
    content: initialContent,
    onUpdate: ({ editor }) => {
      if (onUpdate) {
        onUpdate(editor.getHTML(), editor.getJSON());
      }
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Extract known characters in the script for SmartType
  const knownCharacters = useMemo(() => {
    if (!editor) return ['MAYA'];
    const characters = new Set<string>();
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'character') {
        const text = node.textContent.trim().toUpperCase().replace(/\s*\(.*\)$/, '');
        if (text) characters.add(text);
      }
    });
    return Array.from(characters);
  }, [editor?.state.doc]);

  if (!editor) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-mono text-xs">
        Loading OpenScript Studio Engine...
      </div>
    );
  }

  const activeNodeType = editor.state.selection.$from.parent.type.name;
  const currentBlockText = editor.state.selection.$from.parent.textContent;

  const applySuggestion = (suggestion: string) => {
    const { selection } = editor.state;
    const from = selection.$from.start();
    const to = selection.$from.end();
    
    // If scene heading time of day, append
    if (activeNodeType === 'sceneHeading' && suggestion.startsWith(' - ')) {
      editor.chain().focus().insertContentAt(to, suggestion).run();
    } else {
      editor.chain().focus().insertContentAt({ from, to }, suggestion).run();
    }
  };

  return (
    <div className="flex flex-col items-center w-full">
      {/* 1. Quick Formatting Element Ribbon */}
      <div className="no-print sticky top-0 z-10 w-full max-w-[8.5in] mb-3 bg-[#181a1f]/95 backdrop-blur border border-[#2b2e35] rounded-lg p-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { type: 'sceneHeading', label: 'Scene Heading', shortcut: 'Ctrl+1' },
            { type: 'action', label: 'Action', shortcut: 'Ctrl+2' },
            { type: 'character', label: 'Character', shortcut: 'Ctrl+3' },
            { type: 'parenthetical', label: 'Parenthetical', shortcut: 'Ctrl+4' },
            { type: 'dialogue', label: 'Dialogue', shortcut: 'Ctrl+5' },
            { type: 'transition', label: 'Transition', shortcut: 'Ctrl+6' },
          ].map(({ type, label, shortcut }) => {
            const isActive = activeNodeType === type;
            return (
              <button
                key={type}
                onClick={() => editor.chain().focus().setNode(type).run()}
                title={`Shortcut: ${shortcut}`}
                className={`px-2.5 py-1 rounded text-xs font-mono transition-all flex items-center gap-1.5 ${
                  isActive
                    ? 'bg-amber-500 text-black font-bold shadow-sm'
                    : 'text-gray-300 hover:text-white hover:bg-[#252830]'
                }`}
              >
                <span>{label}</span>
                {isActive && (
                  <span className="text-[10px] bg-black/20 px-1 rounded uppercase font-sans">
                    active
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div className="hidden sm:flex items-center gap-2 text-[11px] text-gray-400 font-mono">
          <kbd className="px-1.5 py-0.5 bg-[#252830] rounded border border-gray-700 text-gray-300">Tab</kbd>
          <span className="text-gray-500">cycle elements</span>
          <span className="text-gray-600">|</span>
          <kbd className="px-1.5 py-0.5 bg-[#252830] rounded border border-gray-700 text-gray-300">Shift+Tab</kbd>
          <span className="text-gray-500">rev</span>
        </div>
      </div>

      {/* 2. SmartType™ Predictive Suggestion Bar */}
      {(activeNodeType === 'transition' || activeNodeType === 'sceneHeading' || activeNodeType === 'character') && (
        <div className="no-print w-full max-w-[8.5in] mb-3 p-2 bg-[#14161a] border border-amber-500/20 rounded-lg flex items-center gap-2 text-xs overflow-x-auto shadow-md">
          <div className="flex items-center gap-1 text-amber-400 font-mono text-[11px] px-1 font-semibold flex-shrink-0">
            <Sparkles className="w-3.5 h-3.5" />
            <span>SmartType™:</span>
          </div>

          <div className="flex items-center gap-1.5 overflow-x-auto">
            {/* Transition suggestions */}
            {activeNodeType === 'transition' &&
              STANDARD_TRANSITIONS.map((trans) => (
                <button
                  key={trans}
                  onClick={() => applySuggestion(trans)}
                  className="px-2.5 py-0.5 bg-[#1e2129] hover:bg-amber-500/20 hover:text-amber-300 text-gray-300 rounded font-mono text-[11px] border border-gray-700/60 transition-colors whitespace-nowrap"
                >
                  {trans}
                </button>
              ))}

            {/* Scene Heading suggestions */}
            {activeNodeType === 'sceneHeading' && (
              <>
                {!currentBlockText.trim() &&
                  SLUGLINE_PREFIXES.map((prefix) => (
                    <button
                      key={prefix}
                      onClick={() => applySuggestion(prefix)}
                      className="px-2.5 py-0.5 bg-[#1e2129] hover:bg-amber-500/20 hover:text-amber-300 text-gray-300 rounded font-mono text-[11px] border border-gray-700/60 transition-colors whitespace-nowrap"
                    >
                      {prefix}
                    </button>
                  ))}
                {currentBlockText.trim() &&
                  SLUGLINE_TIMES.map((time) => (
                    <button
                      key={time}
                      onClick={() => applySuggestion(time)}
                      className="px-2.5 py-0.5 bg-[#1e2129] hover:bg-amber-500/20 hover:text-amber-300 text-gray-300 rounded font-mono text-[11px] border border-gray-700/60 transition-colors whitespace-nowrap"
                    >
                      {time}
                    </button>
                  ))}
              </>
            )}

            {/* Character suggestions */}
            {activeNodeType === 'character' &&
              knownCharacters.map((char) => (
                <button
                  key={char}
                  onClick={() => applySuggestion(char)}
                  className="px-2.5 py-0.5 bg-[#1e2129] hover:bg-amber-500/20 hover:text-amber-300 text-gray-300 rounded font-mono text-[11px] border border-gray-700/60 transition-colors whitespace-nowrap"
                >
                  {char}
                </button>
              ))}
          </div>
        </div>
      )}

      {/* 3. Screenplay Paper Canvas */}
      <div className="screenplay-page font-screenplay select-text">
        {/* Page Top Running Header */}
        <div className="text-right text-[10pt] text-gray-400 mb-6 border-b border-gray-100 pb-2 select-none no-print flex justify-between">
          <span className="italic uppercase">OPENSCRIPT - FIRST DRAFT</span>
          <span>1.</span>
        </div>

        {/* Tiptap Editable Area */}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
