import React, { useEffect, useMemo, useRef } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { screenplayNodes, ScreenplayKeymap, ScreenplayUppercase } from '@openscript/editor';

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

export const ScreenplayEditor: React.FC<ScreenplayEditorProps> = ({
  initialContent = DEFAULT_SCRIPT_HTML,
  onUpdate,
  onEditorReady,
}) => {
  const knownCharactersRef = useRef<string[]>(['MAYA']);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        blockquote: false,
        codeBlock: false,
        heading: false,
      }),
      ...screenplayNodes,
      ScreenplayKeymap,
      ScreenplayUppercase,
    ],
    editorProps: {
      handleKeyDown(view, event) {
        if (event.key === 'Tab' && !event.shiftKey) {
          const { state } = view;
          const { selection } = state;
          const block = selection.$from.parent;
          const blockType = block.type.name;
          const text = block.textContent.trim();

          // Transition autocomplete on Tab
          if (blockType === 'transition' && text.length > 0) {
            const match = STANDARD_TRANSITIONS.find((t) =>
              t.toLowerCase().startsWith(text.toLowerCase())
            );
            if (match && match.toLowerCase() !== text.toLowerCase()) {
              const from = selection.$from.start();
              const to = selection.$from.end();
              view.dispatch(state.tr.insertText(match, from, to));
              return true;
            }
          }

          // Character autocomplete on Tab
          if (blockType === 'character' && text.length > 0) {
            const match = knownCharactersRef.current.find((c) =>
              c.toLowerCase().startsWith(text.toLowerCase())
            );
            if (match && match.toLowerCase() !== text.toLowerCase()) {
              const from = selection.$from.start();
              const to = selection.$from.end();
              view.dispatch(state.tr.insertText(match, from, to));
              return true;
            }
          }

          // Scene Heading prefix autocomplete on Tab
          if (blockType === 'sceneHeading' && text.length > 0 && !text.includes(' - ')) {
            const prefixMatch = SLUGLINE_PREFIXES.find((p) =>
              p.toLowerCase().startsWith(text.toLowerCase())
            );
            if (prefixMatch && prefixMatch.trim().toLowerCase() !== text.toLowerCase()) {
              const from = selection.$from.start();
              const to = selection.$from.end();
              view.dispatch(state.tr.insertText(prefixMatch, from, to));
              return true;
            }
          }
        }
        return false;
      },
    },
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

  // Extract known characters in the script for autocomplete
  const knownCharacters = useMemo(() => {
    if (!editor) return ['MAYA'];
    const characters = new Set<string>();
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'character') {
        const text = node.textContent.trim().toUpperCase().replace(/\s*\(.*\)$/, '');
        if (text) characters.add(text);
      }
    });
    const list = Array.from(characters);
    knownCharactersRef.current = list;
    return list;
  }, [editor?.state.doc]);

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
      {/* 1. Professional Studio Element Ribbon */}
      <div className="no-print sticky top-0 z-10 w-full max-w-[8.5in] mb-4 bg-[#111317]/95 backdrop-blur-md border border-[#22252e] rounded-xl px-2.5 py-1.5 flex items-center justify-between shadow-lg">
        <div className="flex items-center gap-1 overflow-x-auto">
          {[
            { type: 'sceneHeading', label: 'Scene Heading', shortcut: '1' },
            { type: 'action', label: 'Action', shortcut: '2' },
            { type: 'character', label: 'Character', shortcut: '3' },
            { type: 'parenthetical', label: 'Parenthetical', shortcut: '4' },
            { type: 'dialogue', label: 'Dialogue', shortcut: '5' },
            { type: 'transition', label: 'Transition', shortcut: '6' },
          ].map(({ type, label, shortcut }) => {
            const isActive = activeNodeType === type;
            return (
              <button
                key={type}
                onClick={() => editor.chain().focus().setNode(type).run()}
                title={`Shortcut: Ctrl+${shortcut} / ⌘${shortcut}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-2 whitespace-nowrap ${
                  isActive
                    ? 'bg-[#1e222b] text-white font-semibold border border-amber-500/40 shadow-sm'
                    : 'text-gray-400 hover:text-gray-200 hover:bg-[#181a20]'
                }`}
              >
                <span className={isActive ? 'text-amber-400' : 'text-gray-400'}>
                  {label}
                </span>
                <span className="text-[10px] text-gray-500 font-sans opacity-70">
                  ⌘{shortcut}
                </span>
              </button>
            );
          })}
        </div>

        <div className="hidden lg:flex items-center gap-3 text-[11px] text-gray-400 font-mono pr-1">
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[#1a1c22] rounded border border-[#2b2e38] text-gray-300 text-[10px]">Tab</kbd>
            <span className="text-gray-500">cycle</span>
          </span>
          <span className="text-gray-600">·</span>
          <span className="flex items-center gap-1.5">
            <kbd className="px-1.5 py-0.5 bg-[#1a1c22] rounded border border-[#2b2e38] text-gray-300 text-[10px]">Enter</kbd>
            <span className="text-gray-500">advance</span>
          </span>
        </div>
      </div>

      {/* 2. Authentic Screenplay Paper Canvas */}
      <div className="screenplay-page font-screenplay select-text">
        {/* Page Top Running Header */}
        <div className="text-right text-[10pt] text-gray-400 mb-6 border-b border-gray-100 pb-2 select-none no-print flex justify-between">
          <span className="italic uppercase">OPENSCRIPT — FIRST DRAFT</span>
          <span>1.</span>
        </div>

        {/* Tiptap Screenplay Content */}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
