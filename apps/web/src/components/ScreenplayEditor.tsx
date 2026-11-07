import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Collaboration } from '@tiptap/extension-collaboration';
import { CollaborationCursor } from '@tiptap/extension-collaboration-cursor';
import type * as Y from 'yjs';
import { screenplayNodes, ScreenplayKeymap, ScreenplayUppercase, paginateScreenplay } from '@openscript/editor';
import { htmlToBlocks } from '../utils/exporter';
import { TitlePageMetadata } from './TitlePageModal';
import { Lock, Sparkles, Columns, Eye, Keyboard, MessageSquare, X } from 'lucide-react';
import { CollaboratorRole, ScriptNote, ScriptNoteCategory, LivePresence, canEditScreenplay, canAddNotes, isWatermarkRequired } from '@openscript/screenplay-schema';

interface ScreenplayEditorProps {
  initialContent?: string;
  ydoc?: Y.Doc | null;
  collabProvider?: any;
  currentUser?: {
    id?: string;
    displayName?: string;
    name?: string;
    color?: string;
  } | null;
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
  presencePeers?: LivePresence[];
  onCursorPositionChange?: (info: {
    sceneHeading?: string;
    blockType?: string;
    blockTextSnippet?: string;
  }) => void;
  onSelectBlockForNotes?: (blockId: string) => void;
  onAddNoteFromSelection?: (selectedText: string, commentText: string, category: ScriptNoteCategory) => void;
  onOpenSceneTakesForBlock?: (blockText: string) => void;
  onPageChange?: (currentPage: number, totalPages: number) => void;
  selectedActId?: string | null;
  sceneFolderMap?: Record<number, string>;
  folders?: { id: string; name: string; color: string }[];
  onClearActFilter?: () => void;
  isToolbarVisible?: boolean;
  isHeaderVisible?: boolean;
  isSidebarOpen?: boolean;
  onShowHeader?: () => void;
}

const DEFAULT_SCRIPT_HTML = `
  <div class="script-scene-heading">EXT. CITY STREET - DAY</div>
  <div class="script-action">A quiet morning. Sunlight filters through the skyscrapers as the city begins to move.</div>
  <div class="script-character">WRITER</div>
  <div class="script-dialogue">Every story begins with a blank page.</div>
`;

const STANDARD_TRANSITIONS = [
  'CUT TO:',
  'FADE IN:',
  'FADE OUT.',
  'DISSOLVE TO:',
  'SMASH CUT TO:',
  'MATCH CUT TO:',
  'JUMP CUT TO:',
  'BACK TO:',
];
const STANDARD_SHOTS = [
  'WIDE SHOT',
  'CLOSE UP',
  'EXTREME CLOSE UP',
  'MEDIUM SHOT',
  'POV',
  'AERIAL SHOT',
  'TRACKING SHOT',
  'PAN TO',
];
const SLUGLINE_PREFIXES = ['INT. ', 'EXT. ', 'INT/EXT. ', 'I/E. '];
const STANDARD_TIMES = ['DAY', 'NIGHT', 'DUSK', 'DAWN', 'CONTINUOUS', 'LATER', 'SAME TIME', 'MOMENTS LATER'];

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
  presencePeers = [],
  onCursorPositionChange,
  onSelectBlockForNotes,
  onAddNoteFromSelection,
  onOpenSceneTakesForBlock,
  onPageChange,
  selectedActId = null,
  sceneFolderMap = {},
  folders = [],
  onClearActFilter,
  isToolbarVisible = true,
  isHeaderVisible = true,
  isSidebarOpen = true,
  onShowHeader,
  ydoc = null,
  collabProvider = null,
  currentUser = null,
}) => {
  const initialKnownChars = useMemo(() => {
    const chars = new Set<string>();
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
  const typingTimeoutRef = useRef<any>(null);
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
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [currentSuggestionType, setCurrentSuggestionType] = useState<string>('Character Match');


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


  const knownLocationsRef = useRef<string[]>([]);

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
        setSelectedSuggestionIndex(0);
        setCurrentSuggestionType('Character Match');
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
        setSelectedSuggestionIndex(0);
        setCurrentSuggestionType('Transition Match');
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
    } else if (blockType === 'shot' && text.length > 0) {
      const matches = STANDARD_SHOTS.filter((s) =>
        s.toLowerCase().startsWith(text.toLowerCase()) && s.toLowerCase() !== text.toLowerCase()
      );
      if (matches.length > 0) {
        setMatchedSuggestions(matches);
        setActiveSuggestion(matches[0]);
        setSelectedSuggestionIndex(0);
        setCurrentSuggestionType('Shot Match');
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
    } else if (blockType === 'sceneHeading' && text.length > 0) {
      const matchingPrefix = SLUGLINE_PREFIXES.find((p) => text.toUpperCase().startsWith(p.toUpperCase()));

      if (!matchingPrefix) {
        const prefixMatches = SLUGLINE_PREFIXES.filter((p) =>
          p.toLowerCase().startsWith(text.toLowerCase()) && p.trim().toLowerCase() !== text.toLowerCase()
        );
        if (prefixMatches.length > 0) {
          setMatchedSuggestions(prefixMatches);
          setActiveSuggestion(prefixMatches[0]);
          setSelectedSuggestionIndex(0);
          setCurrentSuggestionType('Scene Heading Prefix');
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
      } else {
        const remainder = text.slice(matchingPrefix.length);
        if (remainder.includes(' - ')) {
          const dashIdx = remainder.indexOf(' - ');
          const loc = remainder.slice(0, dashIdx).trim();
          const timeQuery = remainder.slice(dashIdx + 3).trim();
          const timeMatches = STANDARD_TIMES.filter((t) =>
            t.toLowerCase().startsWith(timeQuery.toLowerCase()) && t.toLowerCase() !== timeQuery.toLowerCase()
          ).map((t) => `${matchingPrefix}${loc} - ${t}`);

          if (timeMatches.length > 0) {
            setMatchedSuggestions(timeMatches);
            setActiveSuggestion(timeMatches[0]);
            setSelectedSuggestionIndex(0);
            setCurrentSuggestionType('Time of Day');
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
        } else if (remainder.trim().length > 0) {
          const locQuery = remainder.trim();
          const locMatches = knownLocationsRef.current
            .filter((l) => l.toLowerCase().startsWith(locQuery.toLowerCase()) && l.toLowerCase() !== locQuery.toLowerCase())
            .map((l) => `${matchingPrefix}${l} - `);

          if (locMatches.length > 0) {
            setMatchedSuggestions(locMatches);
            setActiveSuggestion(locMatches[0]);
            setSelectedSuggestionIndex(0);
            setCurrentSuggestionType('Scene Location');
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
      }
    }

    setActiveSuggestion(null);
    setMatchedSuggestions([]);
    setSuggestionCoords(null);
    setSelectedSuggestionIndex(0);
  };

  const isCollabActive = Boolean(ydoc && collabProvider);

  const editorExtensions = useMemo(() => {
    const exts = [
      StarterKit.configure({
        blockquote: false,
        codeBlock: false,
        heading: false,
        history: isCollabActive ? false : undefined,
      }),
      ...screenplayNodes,
      ScreenplayKeymap,
      ScreenplayUppercase,
    ];

    if (ydoc && collabProvider) {
      exts.push(
        Collaboration.configure({
          document: ydoc,
          field: 'default',
        }) as any
      );
      exts.push(
        CollaborationCursor.configure({
          provider: collabProvider,
          user: {
            userId: currentUser?.id,
            name: currentUser?.displayName || currentUser?.name || 'Screenwriter',
            color: currentUser?.color || '#f59e0b',
            role: currentUserRole || 'co-writer',
          },
          render(user: any) {
            const cursor = document.createElement('span');
            cursor.classList.add('collaboration-cursor__caret');
            const userColor = user.color || '#3b82f6';
            cursor.style.color = userColor;
            cursor.style.borderLeftColor = userColor;

            const label = document.createElement('div');
            label.classList.add('collaboration-cursor__label');
            label.style.backgroundColor = userColor;

            // Microsoft Word Avatar Icon (Person silhouette)
            const icon = document.createElement('span');
            icon.classList.add('collaboration-cursor__icon');
            icon.innerHTML = `<svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor" style="display:inline-block;vertical-align:middle;"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`;
            label.appendChild(icon);

            // Collaborator Display Name
            const nameSpan = document.createElement('span');
            nameSpan.textContent = user.name || 'Collaborator';
            label.appendChild(nameSpan);

            // Active Typing Indicator
            if (user.isTyping) {
              const typingIndicator = document.createElement('span');
              typingIndicator.classList.add('collaboration-cursor__typing');
              typingIndicator.textContent = ' ✍️';
              label.appendChild(typingIndicator);
            }

            cursor.appendChild(label);

            // Zero-width non-breaking space guarantees inline span doesn't collapse in browser layout
            const nonbreakingSpace = document.createTextNode('\u2060');
            cursor.appendChild(nonbreakingSpace);

            return cursor;
          },
        }) as any
      );
    }

    return exts;
  }, [ydoc, collabProvider, isCollabActive, currentUser?.displayName, currentUser?.name, currentUser?.color]);

  const editor = useEditor({
    extensions: editorExtensions,
    content: (ydoc && collabProvider) ? undefined : initialContent,
    editorProps: {
      handleKeyDown(view, event) {
        // Broadcast active typing indicator to collaborators in real-time
        if (collabProvider?.awareness && !event.ctrlKey && !event.altKey && !event.metaKey && event.key !== 'Shift') {
          collabProvider.setAwarenessField('user', {
            userId: currentUser?.id,
            name: currentUser?.displayName || currentUser?.name || 'Screenwriter',
            color: currentUser?.color || '#f59e0b',
            role: currentUserRole || 'co-writer',
            isTyping: true,
          });
          if (typingTimeoutRef.current) clearTimeout(typingTimeoutRef.current);
          typingTimeoutRef.current = setTimeout(() => {
            if (collabProvider?.awareness) {
              collabProvider.setAwarenessField('user', {
                userId: currentUser?.id,
                name: currentUser?.displayName || currentUser?.name || 'Screenwriter',
                color: currentUser?.color || '#f59e0b',
                role: currentUserRole || 'co-writer',
                isTyping: false,
              });
            }
          }, 1500);
        }

        // 1. Escape key dismisses SmartType suggestions
        if (event.key === 'Escape') {
          setActiveSuggestion(null);
          setMatchedSuggestions([]);
          setSuggestionCoords(null);
          setSelectedSuggestionIndex(0);
          return false;
        }

        // Arrow navigation in suggestions
        if (matchedSuggestions.length > 0 && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
          event.preventDefault();
          if (event.key === 'ArrowDown') {
            setSelectedSuggestionIndex((prev) => (prev + 1) % matchedSuggestions.length);
          } else {
            setSelectedSuggestionIndex((prev) => (prev - 1 + matchedSuggestions.length) % matchedSuggestions.length);
          }
          return true;
        }

        // 2. Tab key completes active suggestion
        if (event.key === 'Tab' && !event.shiftKey) {
          if (matchedSuggestions.length > 0) {
            event.preventDefault();
            const chosen = matchedSuggestions[selectedSuggestionIndex] || activeSuggestion || '';
            const { state } = view;
            const { selection } = state;
            const from = selection.$from.start();
            const to = selection.$from.end();
            view.dispatch(state.tr.insertText(chosen, from, to));
            setActiveSuggestion(null);
            setMatchedSuggestions([]);
            setSuggestionCoords(null);
            setSelectedSuggestionIndex(0);
            return true;
          }
        }

        // 3. Enter key completes suggestion and advances appropriately
        if (event.key === 'Enter') {
          if (matchedSuggestions.length > 0) {
            event.preventDefault();
            const chosen = matchedSuggestions[selectedSuggestionIndex] || activeSuggestion || '';
            const { state } = view;
            const { selection } = state;
            const block = selection.$from.parent;
            const blockType = block?.type?.name;
            const from = selection.$from.start();
            const to = selection.$from.end();
            view.dispatch(state.tr.insertText(chosen, from, to));
            setActiveSuggestion(null);
            setMatchedSuggestions([]);
            setSuggestionCoords(null);
            setSelectedSuggestionIndex(0);

            if (blockType === 'character') {
              setTimeout(() => {
                if (editorRef.current) {
                  const currentSel = editorRef.current.state.selection;
                  editorRef.current.chain().insertContentAt(currentSel.$from.end(), { type: 'dialogue' }).focus().run();
                }
              }, 10);
            } else if (blockType === 'transition') {
              setTimeout(() => {
                if (editorRef.current) {
                  const currentSel = editorRef.current.state.selection;
                  editorRef.current.chain().insertContentAt(currentSel.$from.end(), { type: 'sceneHeading' }).focus().run();
                }
              }, 10);
            } else if (blockType === 'shot') {
              setTimeout(() => {
                if (editorRef.current) {
                  const currentSel = editorRef.current.state.selection;
                  editorRef.current.chain().insertContentAt(currentSel.$from.end(), { type: 'action' }).focus().run();
                }
              }, 10);
            } else if (blockType === 'sceneHeading') {
              if (chosen.includes(' - ')) {
                setTimeout(() => {
                  if (editorRef.current) {
                    const currentSel = editorRef.current.state.selection;
                    editorRef.current.chain().insertContentAt(currentSel.$from.end(), { type: 'action' }).focus().run();
                  }
                }, 10);
              }
            }
            return true;
          }
        }

        return false;
      },
    },
    onSelectionUpdate: ({ editor }) => {
      checkSmartType(editor);
      if (onShowHeader) {
        onShowHeader();
      }
      const { selection } = editor.state;
      try {
        const blockPos = selection.$from.before(1);
        if (blockPos !== currentBlockPosRef.current) {
          currentBlockPosRef.current = blockPos;
          currentBlockFocusTextRef.current = selection.$from.parent?.textContent?.trim() || '';
        }

        if (onCursorPositionChange) {
          const currentBlockType = selection.$from.parent?.type?.name;
          const currentText = selection.$from.parent?.textContent?.trim() || '';
          let nearestHeading = '';
          editor.state.doc.nodesBetween(0, selection.$from.pos, (node) => {
            if (node.type.name === 'sceneHeading') {
              nearestHeading = node.textContent.trim().toUpperCase();
            }
          });
          onCursorPositionChange({
            sceneHeading: nearestHeading,
            blockType: currentBlockType,
            blockTextSnippet: currentText.slice(0, 60),
          });
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
  }, [ydoc, collabProvider]);

  useEffect(() => {
    editorRef.current = editor;
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  // Sync initial content when document loads from remote server / join URL
  useEffect(() => {
    if (!editor || !initialContent || editor.isDestroyed) return;

    if (ydoc && collabProvider) {
      // In real-time collaboration, wait until provider is synced before inspecting document
      const seedIfEmpty = () => {
        const fragment = ydoc.getXmlFragment('default');
        if (fragment && fragment.length === 0 && initialContent) {
          console.log('[OpenScript Collab] Empty Yjs document detected. Seeding initialContent template into editor.');
          editor.commands.setContent(initialContent);
        }
      };

      if (collabProvider.isSynced) {
        seedIfEmpty();
      } else {
        collabProvider.once?.('synced', seedIfEmpty) || collabProvider.on('synced', seedIfEmpty);
      }
      return;
    }

    const currentHtml = editor.getHTML();
    if (initialContent && initialContent !== currentHtml) {
      editor.commands.setContent(initialContent);
    }
  }, [initialContent, editor, ydoc, collabProvider]);

  // Dynamic Pagination & Physical Page Break Slicing
  const [totalPages, setTotalPages] = useState<number>(1);
  const [currentPage, setCurrentPage] = useState<number>(1);

  const updatePagination = () => {
    if (!editor || !editor.state) return;
    const { doc, tr } = editor.state;
    if (!doc || doc.childCount === 0) {
      setTotalPages(1);
      return;
    }

    // Standard screenplay page content: 54 lines per page (9 inches of Courier Prime text)
    const PAGE_LINE_BUDGET = 54;
    let accumulatedLines = 0;
    let pageNum = 1;
    let currentSceneNum = 1;
    let sceneCounter = 0;
    let previousSceneActId: string | null = null;
    let hasChanges = false;

    doc.forEach((node: any, offset: number) => {
      let blockLines = 2;
      const text = node.textContent || '';
      const typeName = node.type.name;

      if (typeName === 'sceneHeading') {
        sceneCounter++;
        const numAttr = node.attrs.sceneNumber;
        if (numAttr) {
          const parsed = parseInt(String(numAttr), 10);
          currentSceneNum = !isNaN(parsed) && parsed > 0 ? parsed : sceneCounter;
        } else {
          currentSceneNum = sceneCounter;
        }
        blockLines = 3;
      } else if (typeName === 'action') {
        blockLines = Math.max(1, Math.ceil(text.length / 60)) + 1;
      } else if (typeName === 'character') {
        blockLines = 2;
      } else if (typeName === 'parenthetical') {
        blockLines = 1;
      } else if (typeName === 'dialogue') {
        blockLines = Math.max(1, Math.ceil(text.length / 35));
      } else if (typeName === 'transition') {
        blockLines = 2;
      } else if (typeName === 'shot') {
        blockLines = 2;
      }

      const actId = (sceneFolderMap && sceneFolderMap[currentSceneNum]) || 'unassigned';
      const isVisible = !selectedActId || actId === selectedActId;

      if (!isVisible) {
        if (node.attrs.pageBreak !== null || node.attrs.actBreak !== null) {
          tr.setNodeMarkup(offset, null, {
            ...node.attrs,
            pageBreak: null,
            actBreak: null,
          });
          hasChanges = true;
        }
        return;
      }

      const isSceneHeading = typeName === 'sceneHeading';
      const isShot = typeName === 'shot';
      const isActBreak = isSceneHeading && previousSceneActId !== null && actId && actId !== 'unassigned' && previousSceneActId !== 'unassigned' && actId !== previousSceneActId;
      if (isSceneHeading) {
        previousSceneActId = actId;
      }

      // Widow/orphan protection: Headings and shots shouldn't sit alone at bottom of page
      const isHeadingOrShot = isSceneHeading || isShot;
      const budget = isHeadingOrShot && accumulatedLines > PAGE_LINE_BUDGET - 4 ? 0 : PAGE_LINE_BUDGET;

      if ((isActBreak || accumulatedLines + blockLines > budget) && accumulatedLines > 0) {
        pageNum++;
        const pageStr = String(pageNum);
        const actStr = isActBreak ? 'true' : null;

        if (node.attrs.pageBreak !== pageStr || node.attrs.actBreak !== actStr) {
          tr.setNodeMarkup(offset, null, {
            ...node.attrs,
            pageBreak: pageStr,
            actBreak: actStr,
          });
          hasChanges = true;
        }
        accumulatedLines = blockLines;
      } else {
        if (node.attrs.pageBreak !== null || node.attrs.actBreak !== null) {
          tr.setNodeMarkup(offset, null, {
            ...node.attrs,
            pageBreak: null,
            actBreak: null,
          });
          hasChanges = true;
        }
        accumulatedLines += blockLines;
      }
    });

    if (hasChanges) {
      editor.view.dispatch(tr.setMeta('addToHistory', false));
    }

    const calculatedTotal = Math.max(1, pageNum);
    setTotalPages(calculatedTotal);
    if (onPageChange) {
      onPageChange(currentPage, calculatedTotal);
    }
  };

  const paginationTimerRef = useRef<any>(null);

  useEffect(() => {
    if (!editor) return;

    const runPagination = () => {
      if (paginationTimerRef.current) {
        clearTimeout(paginationTimerRef.current);
      }
      // 300ms debounce: eliminates page jumping while typing by letting keystrokes flow smoothly
      paginationTimerRef.current = setTimeout(updatePagination, 1000);
    };

    runPagination();
    editor.on('update', runPagination);
    editor.on('create', runPagination);

    return () => {
      if (paginationTimerRef.current) {
        clearTimeout(paginationTimerRef.current);
      }
      editor.off('update', runPagination);
      editor.off('create', runPagination);
    };
  }, [editor]);

  useEffect(() => {
    const timer = setTimeout(updatePagination, 150);
    return () => clearTimeout(timer);
  }, [initialContent]);

  useEffect(() => {
    updatePagination();
  }, [selectedActId, sceneFolderMap]);

  // Scroll Listener for Active Page Tracking
  useEffect(() => {
    const handleScroll = () => {
      if (!paperContainerRef.current) return;
      const pageBreaks = Array.from(
        paperContainerRef.current.querySelectorAll('[data-page-break]')
      ) as HTMLElement[];

      let activePage = 1;
      const scrollThreshold = window.innerHeight * 0.35;

      for (const el of pageBreaks) {
        const rect = el.getBoundingClientRect();
        if (rect.top <= scrollThreshold) {
          const num = parseInt(el.getAttribute('data-page-break') || '1', 10);
          if (num > activePage) {
            activePage = num;
          }
        }
      }

      // Height-based scroll fallback for rock-solid page tracking
      const containerRect = paperContainerRef.current.getBoundingClientRect();
      const scrollOffset = scrollThreshold - containerRect.top;
      if (scrollOffset > 0) {
        const pxPerPage = 11.0 * 96;
        const estimated = Math.min(totalPages, Math.floor(scrollOffset / pxPerPage) + 1);
        if (estimated > activePage) {
          activePage = estimated;
        }
      }

      setCurrentPage(activePage);
      if (onPageChange) {
        onPageChange(activePage, totalPages);
      }
    };

    const scrollContainer = paperContainerRef.current?.closest('.overflow-y-auto') || window;
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true });
    return () => scrollContainer.removeEventListener('scroll', handleScroll);
  }, [totalPages, onPageChange]);

  // Font loading & resize pagination triggers
  useEffect(() => {
    if (typeof document !== 'undefined' && 'fonts' in document) {
      document.fonts.ready.then(() => {
        updatePagination();
      });
    }
    const handleResize = () => {
      updatePagination();
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);



  useEffect(() => {
    if (editor) {
      editor.setEditable(canEditScreenplay(currentUserRole));
    }
  }, [editor, currentUserRole]);

  // Extract known characters in the script for autocomplete
  const knownCharacters = useMemo(() => {
    if (!editor) return initialKnownChars;
    const characters = new Set<string>(initialKnownChars);
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

  useMemo(() => {
    if (!editor?.state?.doc) return [];
    const locations = new Set<string>();
    editor.state.doc.descendants((node: any) => {
      if (node.type.name === 'sceneHeading') {
        const text = node.textContent.trim();
        const prefix = SLUGLINE_PREFIXES.find((p) => text.toUpperCase().startsWith(p.toUpperCase()));
        if (prefix) {
          const afterPrefix = text.slice(prefix.length).trim();
          const dashIdx = afterPrefix.indexOf(' - ');
          const loc = dashIdx !== -1 ? afterPrefix.slice(0, dashIdx).trim() : afterPrefix;
          if (loc.length > 1) {
            locations.add(loc.toUpperCase());
          }
        }
      }
    });
    const list = Array.from(locations);
    knownLocationsRef.current = list;
    return list;
  }, [editor?.state.doc]);

  const handleApplySuggestion = (suggestion: string) => {
    if (!editor) return;
    const { state } = editor;
    const { selection } = state;
    const block = selection.$from.parent;
    const blockType = block?.type?.name;
    const from = selection.$from.start();
    const to = selection.$from.end();
    editor.view.dispatch(state.tr.insertText(suggestion, from, to));
    setActiveSuggestion(null);
    setMatchedSuggestions([]);
    setSuggestionCoords(null);
    setSelectedSuggestionIndex(0);

    if (blockType === 'character') {
      setTimeout(() => {
        const currentSel = editor.state.selection;
        editor.chain().insertContentAt(currentSel.$from.end(), { type: 'dialogue' }).focus().run();
      }, 10);
    } else if (blockType === 'transition') {
      setTimeout(() => {
        const currentSel = editor.state.selection;
        editor.chain().insertContentAt(currentSel.$from.end(), { type: 'sceneHeading' }).focus().run();
      }, 10);
    } else if (blockType === 'shot') {
      setTimeout(() => {
        const currentSel = editor.state.selection;
        editor.chain().insertContentAt(currentSel.$from.end(), { type: 'action' }).focus().run();
      }, 10);
    } else if (blockType === 'sceneHeading' && suggestion.includes(' - ')) {
      setTimeout(() => {
        const currentSel = editor.state.selection;
        editor.chain().insertContentAt(currentSel.$from.end(), { type: 'action' }).focus().run();
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
    <div className="flex flex-col items-center w-full min-h-full pb-24">
      
      {/* Dynamic Act Filter Isolation Styles */}
      {selectedActId && (
        <style>{`
          .act-filter-active [data-act-id]:not([data-act-id="${selectedActId}"]) {
            display: none !important;
          }
        `}</style>
      )}
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

      {/* 1. Sleek Floating Island / Pill Ribbon (Fixed to Viewport, always accessible) */}
      {canEditScreenplay(currentUserRole) && (
      <div 
        data-tour="format-bar" 
        style={{
          position: 'fixed',
          left: typeof window !== 'undefined' && window.innerWidth >= 1024 && isSidebarOpen ? 'calc(50% + 160px)' : '50%',
          top: isHeaderVisible ? 66 : 14,
          transform: `translateX(-50%) translateY(${isToolbarVisible ? '0' : '-140%'})`,
          opacity: isToolbarVisible ? 1 : 0,
          pointerEvents: isToolbarVisible ? 'auto' : 'none',
          transition: 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.2s ease, top 0.25s ease, left 0.3s ease',
          zIndex: 35,
        }}
        className="no-print select-none"
      >
        <div className="bg-[#13151b]/95 backdrop-blur-md border border-[#272b38] rounded-2xl p-1 sm:p-1.5 shadow-2xl shadow-black/80 flex items-center gap-1 max-w-[96vw] overflow-x-auto scrollbar-none">
          {[
            { type: 'sceneHeading', label: 'Scene Heading', short: 'Scene', shortcut: '1' },
            { type: 'action', label: 'Action', short: 'Action', shortcut: '2' },
            { type: 'character', label: 'Character', short: 'Char', shortcut: '3' },
            { type: 'parenthetical', label: 'Parenthetical', short: 'Paren', shortcut: '4' },
            { type: 'dialogue', label: 'Dialogue', short: 'Dial', shortcut: '5' },
            { type: 'transition', label: 'Transition', short: 'Trans', shortcut: '6' },
            { type: 'shot', label: 'Shot', short: 'Shot', shortcut: '7' },
          ].map(({ type, label, short, shortcut }) => {
            const isActive = activeNodeType === type;
            return (
              <button
                key={type}
                onClick={() => editor.chain().focus().setNode(type).run()}
                title={`Switch to ${label} (Ctrl+${shortcut} / Alt+${shortcut} or Tab)`}
                className={`px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-mono transition-all flex items-center gap-1 sm:gap-1.5 shrink-0 whitespace-nowrap cursor-pointer active:scale-95 ${
                  isActive
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/50 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-[#1a1d26]'
                }`}
              >
                <span className={isActive ? 'text-amber-400 font-semibold' : 'text-gray-300'}>
                  <span className="hidden sm:inline">{label}</span>
                  <span className="sm:hidden">{short}</span>
                </span>
                <span className="hidden sm:inline text-[10px] text-gray-500 font-sans opacity-70">
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

          {/* Revision Asterisk Toggle */}
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
            title="Toggle revision asterisk (*) on current block (Alt+T)"
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
                <Sparkles className="w-3 h-3 text-amber-400 animate-pulse" /> {currentSuggestionType}
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
                    handleApplySuggestion(suggestion);
                  }}
                  className={`flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all text-left ${
                    idx === selectedSuggestionIndex
                      ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                      : 'text-gray-300 hover:bg-[#1e222d] hover:text-white'
                  }`}
                >
                  <span className="font-semibold">{suggestion}</span>
                  {idx === selectedSuggestionIndex && (
                    <span className="text-[10px] text-amber-400/90 font-sans">press Enter ⏎</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Industry Standard Title Page (if enabled) */}
      {metadata?.showTitlePage && !selectedActId && (
        <div className="screenplay-page screenplay-title-page font-screenplay select-text mb-8 relative flex flex-col justify-between print:break-after-page shadow-2xl">
          {metadata.showWatermark && metadata.watermarkText && (
            <div className="screenplay-watermark">{metadata.watermarkText}</div>
          )}
          <div className="mt-[3.5in] flex flex-col items-center gap-6 text-center w-full">
            <h1 className="text-xl font-bold uppercase tracking-wider font-screenplay text-black">
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

          <div className="mt-auto w-full flex justify-between items-end text-[10pt] text-gray-700 pb-4 pt-4">
            <div className="whitespace-pre-line text-left leading-relaxed">
              {metadata.contact || ''}
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
      
      {/* Active Act Focus Banner */}
      {selectedActId && (
        <div className="no-print w-full max-w-[8.5in] mb-4 p-3 rounded-xl bg-amber-500/10 border border-amber-500/40 flex items-center justify-between text-xs font-mono shadow-xl shadow-amber-500/5 select-none animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2.5 text-amber-300">
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shadow-md shadow-amber-400/50" />
            <span>
              Focused View: <strong className="text-white uppercase font-bold tracking-wide">
                {folders.find((f: { id: string; name: string }) => f.id === selectedActId)?.name || (selectedActId === 'unassigned' ? 'Unassigned Scenes' : selectedActId)}
              </strong>
            </span>
          </div>
          {onClearActFilter && (
            <button
              onClick={onClearActFilter}
              className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-[#181a22] hover:bg-[#232736] text-amber-400 hover:text-amber-300 border border-amber-500/40 text-xs font-bold transition-all shadow-sm"
              title="Return to viewing the full screenplay across all acts"
            >
              <span>Show All Acts</span>
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      )}
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
        style={{
          minHeight: `${Math.max(1, totalPages) * 11.0}in`,
          height: 'auto',
          backgroundColor: '#ffffff',
          color: '#000000',
        }}
        data-tour="paper-canvas"
        className={`screenplay-page font-screenplay select-text relative shrink-0 shadow-2xl ${isolatedCharacter ? 'isolating-active' : ''} ${selectedActId ? 'act-filter-active' : ''}`}
      >
        {(metadata?.showWatermark && metadata?.watermarkText) ? (
          <div className="screenplay-watermark">{metadata.watermarkText}</div>
        ) : isWatermarkRequired(currentUserRole) ? (
          <div className="screenplay-watermark">CONFIDENTIAL • FOR CAST/CREW READING ONLY</div>
        ) : null}

        {/* Page Top Running Header */}
        <div className="text-right text-[10pt] text-gray-400 mb-6 border-b border-gray-100 pb-2 select-none no-print flex justify-between items-center">
          <span className="italic uppercase">
            {metadata?.title ? `${metadata.title} — ${metadata.draftLabel || 'DRAFT'}` : 'OPENSCRIPT — FIRST DRAFT'}
          </span>
          <span className="font-mono text-xs font-semibold text-gray-600 bg-gray-100 px-2.5 py-0.5 rounded border border-gray-200">
            Page {currentPage} of {totalPages}
          </span>
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
