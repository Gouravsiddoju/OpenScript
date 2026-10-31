import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { screenplayNodes, ScreenplayKeymap, ScreenplayUppercase } from '@openscript/editor';
import { TitlePageMetadata } from './TitlePageModal';
import { Lock, Sparkles, Columns, Eye, Keyboard } from 'lucide-react';
import { CollaboratorRole, ScriptNote } from '@openscript/screenplay-schema';

interface ScreenplayEditorProps {
  initialContent?: string;
  onUpdate?: (html: string, json: any) => void;
  onEditorReady?: (editor: any) => void;
  metadata?: TitlePageMetadata;
  isTrackingRevisions?: boolean;
  activeRevisionColor?: string;
  isScriptLocked?: boolean;
  isTypewriterMode?: boolean;
  isolatedCharacter?: string | null;
  currentUserRole?: CollaboratorRole;
  notes?: ScriptNote[];
  onSelectBlockForNotes?: (blockId: string) => void;
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
  metadata,
  isTrackingRevisions = false,
  activeRevisionColor = 'blue',
  isScriptLocked = false,
  isTypewriterMode = false,
  isolatedCharacter = null,
  currentUserRole = 'owner',
  notes = [],
  onSelectBlockForNotes,
}) => {
  const initialKnownChars = useMemo(() => {
    const chars = new Set<string>(['MAYA', 'GOURAV']);
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(initialContent, 'text/html');
      doc.querySelectorAll('.script-character').forEach((el) => {
        const name = el.textContent?.trim().toUpperCase().replace(/\s*\(.*\)$/, '');
        if (name) chars.add(name);
      });
    } catch {}
    return Array.from(chars);
  }, [initialContent]);

  const knownCharactersRef = useRef<string[]>(initialKnownChars);
  const editorRef = useRef<any>(null);
  const isTrackingRef = useRef(isTrackingRevisions);
  isTrackingRef.current = isTrackingRevisions;
  const activeColorRef = useRef(activeRevisionColor);
  activeColorRef.current = activeRevisionColor;
  const isTypewriterRef = useRef(isTypewriterMode);
  isTypewriterRef.current = isTypewriterMode;

  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [matchedSuggestions, setMatchedSuggestions] = useState<string[]>([]);
  const [suggestionCoords, setSuggestionCoords] = useState<{ top: number; left: number } | null>(null);

  const checkSmartType = (currentEditor: any) => {
    if (!currentEditor || currentEditor.isDestroyed) return;
    const { state, view } = currentEditor;
    const { selection } = state;
    const block = selection.$from.parent;
    const blockType = block?.type?.name;
    const text = block?.textContent?.trim() || '';

    if (blockType === 'character' && text.length > 0) {
      const matches = knownCharactersRef.current.filter((c) =>
        c.toLowerCase().startsWith(text.toLowerCase()) && c.toLowerCase() !== text.toLowerCase()
      );
      if (matches.length > 0) {
        setMatchedSuggestions(matches);
        setActiveSuggestion(matches[0]);
        try {
          const coords = view.coordsAtPos(selection.from);
          setSuggestionCoords({
            top: coords.bottom + 6,
            left: coords.left,
          });
        } catch {
          setSuggestionCoords(null);
        }
        return;
      }
    } else if (blockType === 'transition' && text.length > 0) {
      const matches = STANDARD_TRANSITIONS.filter((t) =>
        t.toLowerCase().startsWith(text.toLowerCase()) && t.toLowerCase() !== text.toLowerCase()
      );
      if (matches.length > 0) {
        setMatchedSuggestions(matches);
        setActiveSuggestion(matches[0]);
        try {
          const coords = view.coordsAtPos(selection.from);
          setSuggestionCoords({
            top: coords.bottom + 6,
            left: coords.left,
          });
        } catch {
          setSuggestionCoords(null);
        }
        return;
      }
    } else if (blockType === 'sceneHeading' && text.length > 0 && !text.includes(' - ')) {
      const matches = SLUGLINE_PREFIXES.filter((p) =>
        p.toLowerCase().startsWith(text.toLowerCase()) && p.trim().toLowerCase() !== text.toLowerCase()
      );
      if (matches.length > 0) {
        setMatchedSuggestions(matches);
        setActiveSuggestion(matches[0]);
        try {
          const coords = view.coordsAtPos(selection.from);
          setSuggestionCoords({
            top: coords.bottom + 6,
            left: coords.left,
          });
        } catch {
          setSuggestionCoords(null);
        }
        return;
      }
    }

    setActiveSuggestion(null);
    setMatchedSuggestions([]);
    setSuggestionCoords(null);
  };

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
        // 1. Escape key dismisses SmartType suggestions
        if (event.key === 'Escape') {
          setActiveSuggestion(null);
          setMatchedSuggestions([]);
          setSuggestionCoords(null);
          return false;
        }

        // 2. Tab key completes character, transition, or scene heading
        if (event.key === 'Tab' && !event.shiftKey) {
          const { state } = view;
          const { selection } = state;
          const block = selection.$from.parent;
          const blockType = block.type.name;
          const text = block.textContent.trim();

          // Character autocomplete on Tab
          if (blockType === 'character' && text.length > 0) {
            const match = knownCharactersRef.current.find((c) =>
              c.toLowerCase().startsWith(text.toLowerCase()) && c.toLowerCase() !== text.toLowerCase()
            );
            if (match) {
              const from = selection.$from.start();
              const to = selection.$from.end();
              view.dispatch(state.tr.insertText(match, from, to));
              setActiveSuggestion(null);
              setMatchedSuggestions([]);
              setSuggestionCoords(null);
              return true;
            }
          }

          // Transition autocomplete on Tab
          if (blockType === 'transition' && text.length > 0) {
            const match = STANDARD_TRANSITIONS.find((t) =>
              t.toLowerCase().startsWith(text.toLowerCase()) && t.toLowerCase() !== text.toLowerCase()
            );
            if (match) {
              const from = selection.$from.start();
              const to = selection.$from.end();
              view.dispatch(state.tr.insertText(match, from, to));
              setActiveSuggestion(null);
              setMatchedSuggestions([]);
              setSuggestionCoords(null);
              return true;
            }
          }

          // Scene Heading prefix autocomplete on Tab
          if (blockType === 'sceneHeading' && text.length > 0 && !text.includes(' - ')) {
            const prefixMatch = SLUGLINE_PREFIXES.find((p) =>
              p.toLowerCase().startsWith(text.toLowerCase()) && p.trim().toLowerCase() !== text.toLowerCase()
            );
            if (prefixMatch) {
              const from = selection.$from.start();
              const to = selection.$from.end();
              view.dispatch(state.tr.insertText(prefixMatch, from, to));
              setActiveSuggestion(null);
              setMatchedSuggestions([]);
              setSuggestionCoords(null);
              return true;
            }
          }
        }

        // 3. Enter key completes character name and advances directly to Dialogue!
        if (event.key === 'Enter') {
          const { state } = view;
          const { selection } = state;
          const block = selection.$from.parent;
          const blockType = block.type.name;
          const text = block.textContent.trim();

          if (blockType === 'character' && text.length > 0) {
            const match = knownCharactersRef.current.find((c) =>
              c.toLowerCase().startsWith(text.toLowerCase()) && c.toLowerCase() !== text.toLowerCase()
            );
            if (match) {
              event.preventDefault();
              const from = selection.$from.start();
              const to = selection.$from.end();
              view.dispatch(state.tr.insertText(match, from, to));
              setActiveSuggestion(null);
              setMatchedSuggestions([]);
              setSuggestionCoords(null);

              setTimeout(() => {
                if (editorRef.current) {
                  const currentSel = editorRef.current.state.selection;
                  editorRef.current.chain().insertContentAt(currentSel.$from.end(), { type: 'dialogue' }).focus().run();
                }
              }, 10);
              return true;
            }
          }
        }

        return false;
      },
    },
    content: initialContent,
    onSelectionUpdate: ({ editor }) => {
      checkSmartType(editor);
    },
    onUpdate: ({ editor, transaction }) => {
      // Auto-tag revision asterisk if revision tracking is active
      if (isTrackingRef.current && transaction.docChanged) {
        const { selection } = editor.state;
        const currentBlock = selection.$from.parent;
        if (currentBlock && !currentBlock.attrs.revisionMark && currentBlock.type.name !== 'doc') {
          setTimeout(() => {
            editor.commands.updateAttributes(currentBlock.type.name, {
              revisionMark: true,
              revisionColor: activeColorRef.current,
            });
          }, 0);
        }
      }

      // Typewriter scrolling (Section 7)
      if (isTypewriterRef.current && transaction.docChanged) {
        setTimeout(() => {
          const domSelection = window.getSelection();
          if (domSelection && domSelection.focusNode) {
            const el = domSelection.focusNode.parentElement;
            if (el) {
              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            }
          }
        }, 30);
      }

      checkSmartType(editor);

      if (onUpdate) {
        onUpdate(editor.getHTML(), editor.getJSON());
      }
    },
  });

  useEffect(() => {
    editorRef.current = editor;
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (editor) {
      editor.setEditable(currentUserRole !== 'reader');
    }
  }, [editor, currentUserRole]);

  // Extract known characters in the script for autocomplete
  const knownCharacters = useMemo(() => {
    if (!editor) return initialKnownChars;
    const characters = new Set<string>(['MAYA', 'GOURAV']);
    editor.state.doc.descendants((node) => {
      if (node.type.name === 'character') {
        const text = node.textContent.trim().toUpperCase().replace(/\s*\(.*\)$/, '');
        if (text) characters.add(text);
      }
    });
    const list = Array.from(characters);
    knownCharactersRef.current = list;
    return list;
  }, [editor?.state.doc, initialKnownChars]);

  const handleApplySuggestion = (suggestion: string, advanceToDialogue: boolean = false) => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const from = selection.$from.start();
    const to = selection.$from.end();
    editor.view.dispatch(state.tr.insertText(suggestion, from, to));
    setActiveSuggestion(null);
    setMatchedSuggestions([]);
    setSuggestionCoords(null);

    if (advanceToDialogue) {
      setTimeout(() => {
        const currentSel = editor.state.selection;
        editor.chain().insertContentAt(currentSel.$from.end(), { type: 'dialogue' }).focus().run();
      }, 10);
    } else {
      editor.commands.focus();
    }
  };

  const handleInsertDualDialogue = () => {
    if (!editor) return;
    const dualHtml = `
      <div class="script-dual-dialogue">
        <div>
          <div class="script-character">CHARACTER 1</div>
          <div class="script-dialogue">Simultaneous speech.</div>
        </div>
        <div>
          <div class="script-character">CHARACTER 2</div>
          <div class="script-dialogue">Overlapping dialogue.</div>
        </div>
      </div>
    `;
    editor.chain().focus().insertContent(dualHtml).run();
  };

  if (!editor) {
    return (
      <div className="flex items-center justify-center p-12 text-gray-500 font-mono text-xs">
        Loading OpenScript Studio Engine...
      </div>
    );
  }

  const currentSelectionParent = editor.state.selection.$from.parent;
  const activeNodeType = currentSelectionParent.type.name;
  const isCurrentBlockMarked = Boolean(currentSelectionParent.attrs.revisionMark);

  return (
    <div className="flex flex-col items-center w-full">
      {/* Dynamic Dialogue Isolator Styles */}
      {isolatedCharacter && (
        <style>{`
          .isolating-active .script-character,
          .isolating-active .script-dialogue,
          .isolating-active .script-parenthetical {
            opacity: 0.3 !important;
            filter: grayscale(80%);
            transition: all 0.2s ease;
          }
          .isolating-active [data-speaker="${isolatedCharacter}"],
          .isolating-active .isolated-match {
            opacity: 1.0 !important;
            filter: none !important;
            background-color: rgba(245, 158, 11, 0.08);
            border-radius: 4px;
          }
        `}</style>
      )}

      {/* 1. Professional Studio Element Ribbon */}
      <div className="no-print sticky top-0 z-10 w-full max-w-[8.5in] mb-4 bg-[#111317]/95 backdrop-blur-md border border-[#22252e] rounded-xl px-2 py-1.5 flex items-center justify-center gap-1.5 shadow-lg">
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
              title={`Switch to ${label} (Ctrl+${shortcut} / Alt+${shortcut} or Tab)`}
              className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 whitespace-nowrap ${
                isActive
                  ? 'bg-[#1e222b] text-white font-semibold border border-amber-500/40 shadow-sm'
                  : 'text-gray-400 hover:text-gray-200 hover:bg-[#181a20]'
              }`}
            >
              <span className={isActive ? 'text-amber-400 font-bold' : 'text-gray-300'}>
                {label}
              </span>
              <span className="text-[10px] text-gray-500 font-sans opacity-70">
                ⌘{shortcut}
              </span>
            </button>
          );
        })}

        {/* Dual Dialogue Quick Insert */}
        <button
          onClick={handleInsertDualDialogue}
          className="px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 text-gray-400 hover:text-gray-200 hover:bg-[#181a20]"
          title="Insert Dual Dialogue (Simultaneous Speech Columns)"
        >
          <Columns className="w-3.5 h-3.5 text-amber-500/80" />
          <span>Dual</span>
        </button>

        <div className="h-4 w-[1px] bg-[#2a2d37] mx-0.5" />

        {/* Hollywood Revision Asterisk Toggle */}
        <button
          onClick={() => {
            editor.chain().focus().updateAttributes(activeNodeType, {
              revisionMark: !isCurrentBlockMarked,
              revisionColor: activeRevisionColor,
            }).run();
          }}
          className={`px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all flex items-center gap-1.5 ${
            isCurrentBlockMarked
              ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm'
              : 'text-gray-400 hover:text-gray-200 hover:bg-[#181a20]'
          }`}
          title="Toggle Hollywood revision asterisk (*) on current block (Alt+T)"
        >
          <span className="text-red-400 font-bold text-sm leading-none">*</span>
          <span>Revision</span>
        </button>
      </div>

      {/* SmartType Floating Autocomplete Popup positioned right at the typing cursor */}
      {activeSuggestion && (
        <div
          style={{
            position: 'fixed',
            top: suggestionCoords ? Math.min(window.innerHeight - 150, suggestionCoords.top) : 100,
            left: suggestionCoords ? Math.max(20, Math.min(window.innerWidth - 240, suggestionCoords.left - 20)) : '50%',
            transform: suggestionCoords ? undefined : 'translateX(-50%)',
            zIndex: 60,
          }}
          className="no-print animate-fadeIn select-none"
        >
          <div className="bg-[#141720]/95 backdrop-blur-md border border-amber-500/50 rounded-xl shadow-2xl p-1.5 flex flex-col gap-1 min-w-[220px]">
            <div className="flex items-center justify-between px-2 py-0.5 border-b border-[#252836] text-[10px] font-mono text-gray-400">
              <span className="flex items-center gap-1 text-amber-400 font-semibold">
                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" /> Character Match
              </span>
              <div className="flex items-center gap-1">
                <kbd className="px-1.5 py-0.5 bg-[#0d0e13] rounded border border-[#2e3342] text-amber-300 text-[9px] shadow-sm">Tab ⇥</kbd>
                <span className="text-[9px] text-gray-500">or</span>
                <kbd className="px-1.5 py-0.5 bg-[#0d0e13] rounded border border-[#2e3342] text-amber-300 text-[9px] shadow-sm">Enter ⏎</kbd>
              </div>
            </div>

            <div className="flex flex-col gap-0.5 max-h-36 overflow-y-auto">
              {matchedSuggestions.map((suggestion, idx) => (
                <button
                  key={suggestion}
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleApplySuggestion(suggestion, true);
                  }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all text-left ${
                    idx === 0
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                      : 'text-gray-300 hover:bg-[#1e222d] hover:text-white'
                  }`}
                >
                  <span className="font-semibold">{suggestion}</span>
                  {idx === 0 && (
                    <span className="text-[10px] text-amber-400/90 font-sans">press Enter ⏎</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Industry Standard Title Page (if enabled) */}
      {metadata?.showTitlePage && (
        <div className="screenplay-page screenplay-title-page font-screenplay select-text mb-8 relative flex flex-col justify-between print:break-after-page shadow-2xl">
          {metadata.showWatermark && metadata.watermarkText && (
            <div className="screenplay-watermark">{metadata.watermarkText}</div>
          )}
          <div className="mt-[3.0in] flex flex-col items-center gap-6 text-center w-full">
            <h1 className="text-xl font-bold uppercase underline tracking-wider font-screenplay text-black">
              {metadata.title || 'UNTITLED SCREENPLAY'}
            </h1>
            <div className="text-sm italic text-gray-700">
              {metadata.credit || 'written by'}
            </div>
            <div className="text-base font-semibold font-screenplay text-gray-900">
              {metadata.author || 'Author Name'}
            </div>
            {metadata.basedOn && (
              <div className="text-xs text-gray-600 max-w-md mx-auto mt-2 italic">
                {metadata.basedOn}
              </div>
            )}
          </div>

          <div className="mt-auto w-full flex justify-between items-end text-[10pt] text-gray-700 pb-4 border-t border-gray-100 pt-4">
            <div className="whitespace-pre-line text-left leading-relaxed">
              {metadata.contact || 'SSN Pictures\ncontact@ssnpictures.in'}
            </div>
            <div className="text-right leading-relaxed">
              <div className="font-semibold text-gray-900">{metadata.draftLabel || 'First Draft'}</div>
              <div>{metadata.draftDate || new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div>
            </div>
          </div>
        </div>
      )}

      {currentUserRole === 'reader' && (
        <div className="w-full max-w-[8.5in] mb-3 px-4 py-2 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center justify-between text-xs text-red-300 font-mono no-print">
          <div className="flex items-center gap-2">
            <Eye className="w-4 h-4 text-red-400" />
            <span>Viewing in Read-Only Mode (Reader Role) — Editing and formatting controls are disabled.</span>
          </div>
        </div>
      )}

      {/* 3. Authentic Screenplay Paper Canvas */}
      <div className={`screenplay-page font-screenplay select-text relative ${isolatedCharacter ? 'isolating-active' : ''}`}>
        {metadata?.showWatermark && metadata?.watermarkText && (
          <div className="screenplay-watermark">{metadata.watermarkText}</div>
        )}

        {/* Page Top Running Header */}
        <div className="text-right text-[10pt] text-gray-400 mb-6 border-b border-gray-100 pb-2 select-none no-print flex justify-between">
          <span className="italic uppercase">
            {metadata?.title ? `${metadata.title} — ${metadata.draftLabel || 'DRAFT'}` : 'OPENSCRIPT — FIRST DRAFT'}
          </span>
          <span>1.</span>
        </div>

        {/* Tiptap Screenplay Content */}
        <EditorContent editor={editor} />
      </div>
    </div>
  );
};
