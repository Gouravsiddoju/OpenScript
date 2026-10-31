import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { screenplayNodes, ScreenplayKeymap, ScreenplayUppercase, paginateScreenplay } from '@openscript/editor';
import { htmlToBlocks } from '../utils/exporter';
import { TitlePageMetadata } from './TitlePageModal';
import { Lock, Sparkles, Columns, Eye, Keyboard, MessageSquare } from 'lucide-react';
import { CollaboratorRole, ScriptNote, ScriptNoteCategory, canEditScreenplay, canAddNotes, isWatermarkRequired } from '@openscript/screenplay-schema';

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
  onAddNoteFromSelection?: (selectedText: string, commentText: string, category: ScriptNoteCategory) => void;
  onOpenSceneTakesForBlock?: (blockText: string) => void;
  onPageChange?: (currentPage: number, totalPages: number) => void;
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
  onAddNoteFromSelection,
  onOpenSceneTakesForBlock,
  onPageChange,
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
  const currentBlockFocusTextRef = useRef<string>('');
  const currentBlockPosRef = useRef<number>(-1);

  isTypewriterRef.current = isTypewriterMode;

  const [activeSuggestion, setActiveSuggestion] = useState<string | null>(null);
  const [matchedSuggestions, setMatchedSuggestions] = useState<string[]>([]);
  const [suggestionCoords, setSuggestionCoords] = useState<{ top: number; left: number } | null>(null);


  // Floating Selection -> Comment trigger
  const [selectedTextSnippet, setSelectedTextSnippet] = useState<string>('');
  const [selectionCoords, setSelectionCoords] = useState<{ top: number; left: number } | null>(null);
  const [isCommentInputOpen, setIsCommentInputOpen] = useState(false);
  const [inlineCommentCategory, setInlineCommentCategory] = useState<ScriptNoteCategory>('general');
  const [inlineCommentText, setInlineCommentText] = useState('');
  const paperContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleSelectionChange = () => {
      if (isCommentInputOpen) return;

      const sel = window.getSelection();
      if (!sel || sel.isCollapsed) {
        setSelectionCoords(null);
        setSelectedTextSnippet('');
        return;
      }

      const text = sel.toString().trim();
      if (!text || text.length === 0) {
        setSelectionCoords(null);
        setSelectedTextSnippet('');
        return;
      }

      if (paperContainerRef.current && paperContainerRef.current.contains(sel.anchorNode)) {
        try {
          const range = sel.getRangeAt(0);
          const rect = range.getBoundingClientRect();
          if (rect.width > 0 && rect.height > 0) {
            setSelectionCoords({
              top: Math.max(10, rect.top - 44),
              left: Math.max(20, rect.left + rect.width / 2),
            });
            setSelectedTextSnippet(text);
          }
        } catch {
          setSelectionCoords(null);
        }
      } else {
        setSelectionCoords(null);
      }
    };

    document.addEventListener('selectionchange', handleSelectionChange);
    return () => {
      document.removeEventListener('selectionchange', handleSelectionChange);
    };
  }, [isCommentInputOpen]);

  const handlePostInlineNote = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inlineCommentText.trim()) return;
    if (onAddNoteFromSelection) {
      onAddNoteFromSelection(selectedTextSnippet, inlineCommentText.trim(), inlineCommentCategory);
    }
    setInlineCommentText('');
    setIsCommentInputOpen(false);
    setSelectionCoords(null);
    window.getSelection()?.removeAllRanges();
  };


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
      const { selection } = editor.state;
      try {
        const blockPos = selection.$from.before(1);
        if (blockPos !== currentBlockPosRef.current) {
          currentBlockPosRef.current = blockPos;
          currentBlockFocusTextRef.current = selection.$from.parent?.textContent?.trim() || '';
        }
      } catch {}
    },
    onUpdate: ({ editor, transaction }) => {
      // Auto-tag revision asterisk ONLY if an existing line with text was modified
      if (isTrackingRef.current && transaction.docChanged) {
        const { selection } = editor.state;
        const currentBlock = selection.$from.parent;
        const text = currentBlock?.textContent?.trim() || '';

        // Empty lines must never have an asterisk
        if (!text) {
          if (currentBlock?.attrs?.revisionMark) {
            setTimeout(() => {
              editor.commands.updateAttributes(currentBlock.type.name, {
                revisionMark: false,
                revisionColor: null,
              });
            }, 0);
          }
        } else if (
          // Only auto-mark if editing an EXISTING line that had text when focused
          currentBlockFocusTextRef.current &&
          currentBlockFocusTextRef.current !== text &&
          !currentBlock.attrs.revisionMark &&
          currentBlock.type.name !== 'doc'
        ) {
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
      editor.setEditable(canEditScreenplay(currentUserRole));
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

      {/* 1. Sleek Floating Island / Pill Ribbon (Sticky, elevated, beautifully formatted) */}
      {canEditScreenplay(currentUserRole) && (
      <div className="no-print sticky top-3 z-30 mb-6 flex justify-center pointer-events-none w-full animate-fadeIn select-none">
        <div className="pointer-events-auto bg-[#13151b]/95 backdrop-blur-md border border-[#272b38] rounded-2xl p-1.5 shadow-2xl shadow-black/70 flex items-center gap-1">
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
                className={`px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/50 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1d26]'
                }`}
              >
                <span className={isActive ? 'text-amber-400 font-semibold' : 'text-gray-300'}>
                  {label}
                </span>
                <span className="text-[10px] text-gray-500 font-sans opacity-70">
                  ⌘{shortcut}
                </span>
              </button>
            );
          })}

          <div className="h-4 w-[1px] bg-[#272b3a] mx-1" />

          {/* Dual Dialogue Quick Insert */}
          <button
            onClick={handleInsertDualDialogue}
            className="px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 text-gray-400 hover:text-white hover:bg-[#1a1d26] whitespace-nowrap"
            title="Insert Dual Dialogue (Simultaneous Speech Columns)"
          >
            <Columns className="w-3.5 h-3.5 text-amber-500/80" />
            <span>Dual</span>
          </button>

          {/* Hollywood Revision Asterisk Toggle */}
          <button
            onClick={() => {
              editor.chain().focus().updateAttributes(activeNodeType, {
                revisionMark: !isCurrentBlockMarked,
                revisionColor: activeRevisionColor,
              }).run();
            }}
            className={`px-2.5 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1.5 whitespace-nowrap ${
              isCurrentBlockMarked
                ? 'bg-red-500/20 text-red-300 border border-red-500/40 shadow-sm font-semibold'
                : 'text-gray-400 hover:text-white hover:bg-[#1a1d26]'
            }`}
            title="Toggle Hollywood revision asterisk (*) on current block (Alt+T)"
          >
            <span className="text-red-400 font-bold text-sm leading-none">*</span>
            <span>Revision</span>
          </button>
        </div>
      </div>
      )}

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

      
      {(currentUserRole === 'guest' || currentUserRole === 'commenter') && (
        <div className="w-full max-w-[8.5in] mb-3 px-4 py-2 bg-purple-500/10 border border-purple-500/30 rounded-xl flex items-center justify-between text-xs text-purple-300 font-mono no-print">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-purple-400" />
            <span>Viewing in Guest Mode — Screenplay is in Comment-Only mode. Highlighting text allows adding ScriptNotes.</span>
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
      <div 
        ref={paperContainerRef} 
        onClick={(e) => {
          const target = e.target as HTMLElement;
          const markerBlock = target?.closest('.revision-marker');
          if (markerBlock && onOpenSceneTakesForBlock) {
            const rect = markerBlock.getBoundingClientRect();
            // If click was near the right margin (asterisk zone)
            if (e.clientX >= rect.right - 60) {
              e.stopPropagation();
              onOpenSceneTakesForBlock(markerBlock.textContent || '');
            }
          }
        }}
        className={`screenplay-page font-screenplay select-text relative ${isolatedCharacter ? 'isolating-active' : ''}`}
      >
        {(metadata?.showWatermark && metadata?.watermarkText) ? (
          <div className="screenplay-watermark">{metadata.watermarkText}</div>
        ) : isWatermarkRequired(currentUserRole) ? (
          <div className="screenplay-watermark">CONFIDENTIAL • FOR CAST/CREW READING ONLY</div>
        ) : null}

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

      {/* Floating Selection -> Add ScriptNote Action Trigger */}
      {selectionCoords && canAddNotes(currentUserRole) && (
        <div
          style={{
            position: 'fixed',
            top: selectionCoords.top,
            left: selectionCoords.left,
            transform: 'translateX(-50%)',
            zIndex: 65,
          }}
          className="no-print animate-in fade-in zoom-in-95 duration-100 select-none pointer-events-auto"
        >
          {!isCommentInputOpen ? (
            <button
              type="button"
              onMouseDown={(e) => {
                e.preventDefault();
                setIsCommentInputOpen(true);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#12141a] hover:bg-[#1c1f28] text-amber-300 border border-amber-500/50 rounded-full shadow-2xl text-xs font-mono font-bold tracking-wide transition-transform hover:scale-105 active:scale-95 ring-2 ring-black/50"
            >
              <MessageSquare className="w-3.5 h-3.5 text-amber-400" />
              <span>Add Note</span>
            </button>
          ) : (
            <div 
              onMouseDown={(e) => e.stopPropagation()}
              className="w-80 p-3.5 bg-[#12141a]/95 backdrop-blur-md border border-amber-500/50 rounded-2xl shadow-2xl flex flex-col gap-2.5 animate-in fade-in duration-150"
            >
              <div className="flex items-center justify-between border-b border-[#222530] pb-2">
                <span className="text-[11px] font-mono font-bold text-amber-400 flex items-center gap-1">
                  <MessageSquare className="w-3.5 h-3.5" />
                  <span>ScriptNote on Selection</span>
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setIsCommentInputOpen(false);
                    setSelectionCoords(null);
                  }}
                  className="text-gray-400 hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              </div>

              {/* Quoted Text Preview */}
              <div className="text-[11px] font-mono text-gray-300 italic bg-[#0c0d11] p-2 rounded-lg border border-[#232733] max-h-16 overflow-y-auto line-clamp-2">
                "{selectedTextSnippet}"
              </div>

              {/* Category Selector */}
              <div className="flex items-center justify-between gap-1">
                <span className="text-[10px] font-mono text-gray-400">Category:</span>
                <select
                  value={inlineCommentCategory}
                  onChange={(e) => setInlineCommentCategory(e.target.value as ScriptNoteCategory)}
                  className="px-2 py-0.5 bg-[#0e1014] border border-[#2b303d] rounded text-[11px] text-amber-300 font-mono focus:outline-none"
                >
                  <option value="general">General</option>
                  <option value="dialogue">Dialogue</option>
                  <option value="action">Action</option>
                  <option value="production">Production</option>
                  <option value="director">Director</option>
                  <option value="legal">Legal</option>
                </select>
              </div>

              {/* Comment Input */}
              <textarea
                value={inlineCommentText}
                onChange={(e) => setInlineCommentText(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    handlePostInlineNote();
                  }
                  if (e.key === 'Escape') {
                    setIsCommentInputOpen(false);
                    setSelectionCoords(null);
                  }
                }}
                autoFocus
                placeholder="Type your note or feedback (Enter to post)..."
                rows={2}
                className="w-full px-2.5 py-1.5 bg-[#0e1014] border border-[#2b303d] rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:border-amber-500/60 resize-none font-sans"
              />

              <div className="flex items-center justify-between pt-1">
                <span className="text-[9px] text-gray-500 font-mono">Press Enter to save</span>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsCommentInputOpen(false);
                      setSelectionCoords(null);
                    }}
                    className="px-2 py-1 text-xs text-gray-400 hover:text-white rounded"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => handlePostInlineNote()}
                    disabled={!inlineCommentText.trim()}
                    className="px-3 py-1 bg-amber-500 hover:bg-amber-400 disabled:opacity-40 text-black text-xs font-mono font-bold rounded-lg shadow transition-all"
                  >
                    Post Note
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

    </div>
  );
};
