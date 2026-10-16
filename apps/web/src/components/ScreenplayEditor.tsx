import React, { useEffect } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { screenplayNodes, ScreenplayKeymap } from '@openscript/editor';

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

  if (!editor) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-mono text-xs">
        Loading OpenScript Studio Engine...
      </div>
    );
  }

  const activeNodeType = editor.state.selection.$from.parent.type.name;

  return (
    <div className="flex flex-col items-center w-full">
      {/* Quick Formatting Element Ribbon */}
      <div className="no-print sticky top-0 z-10 w-full max-w-[8.5in] mb-4 bg-[#181a1f]/95 backdrop-blur border border-[#2b2e35] rounded-lg p-2 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-1.5 overflow-x-auto">
          {[
            { type: 'sceneHeading', label: 'Scene Heading', shortcut: 'Enter on Heading' },
            { type: 'action', label: 'Action', shortcut: 'Enter' },
            { type: 'character', label: 'Character', shortcut: 'Tab' },
            { type: 'parenthetical', label: 'Parenthetical', shortcut: 'Tab on Dialogue' },
            { type: 'dialogue', label: 'Dialogue', shortcut: 'Enter on Character' },
            { type: 'transition', label: 'Transition', shortcut: 'Tab on Character' },
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
          <span>/</span>
          <kbd className="px-1.5 py-0.5 bg-[#252830] rounded border border-gray-700 text-gray-300">Enter</kbd>
          <span className="text-gray-500">to cycle</span>
        </div>
      </div>

      {/* Screenplay Page Canvas */}
      <div className="screenplay-page font-screenplay select-text">
        {/* Page Top Running Header */}
        <div className="text-right text-[10pt] text-gray-400 mb-6 border-b border-gray-100 pb-2 select-none no-print flex justify-between">
          <span className="italic">OPENSCRIPT - FIRST DRAFT</span>
          <span>1.</span>
        </div>

        {/* Tiptap Editable Area */}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
