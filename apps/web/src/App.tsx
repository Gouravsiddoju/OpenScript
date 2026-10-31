import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, 
  Code, 
  BarChart2, 
  Download, 
  Printer, 
  CheckCircle2, 
  Clock, 
  ChevronRight, 
  Menu, 
  X, 
  Plus, 
  LayoutGrid, 
  Maximize2, 
  Minimize2, 
  Edit3,
  Upload,
  FileCode,
  Lock,
  Unlock,
  Layers,
  ChevronDown,
  AlertCircle,
  Zap,
  Radio
} from 'lucide-react';
import { ScreenplayEditor } from './components/ScreenplayEditor';
import { FountainView } from './components/FountainView';
import { ProductionReports } from './components/ProductionReports';
import { SceneNavigator, SceneItem } from './components/SceneNavigator';
import { BeatBoard } from './components/BeatBoard';
import { TitlePageModal, TitlePageMetadata } from './components/TitlePageModal';
import { ConflictModal } from './components/ConflictModal';
import { SprintWidget } from './components/SprintWidget';
import { ScriptNotesPanel } from './components/ScriptNotesPanel';
import { ShareModal } from './components/ShareModal';
import { CollaborationBar } from './components/CollaborationBar';
import { fountainToHtml, parseFountain, blocksToHtml } from '@openscript/fountain';
import { parseFdx, serializeFdx } from '@openscript/fdx';
import { 
  HOLLYWOOD_REVISION_SEQUENCE, 
  RevisionDraftInfo, 
  RevisionColor, 
  calculateLockedSceneNumber,
  createScreenplayBlock,
  ScriptNote,
  ScriptNoteCategory,
  CollaboratorRole,
  CollaboratorProfile,
  LivePresence
} from '@openscript/screenplay-schema';

const INITIAL_SCRIPT_HTML = `
  <div class="script-scene-heading">INT. COFFEE SHOP - DAY</div>
  <div class="script-action">Rain drums against the tall glass windows. A steaming cup of espresso rests on the counter.</div>
  <div class="script-character">MAYA</div>
  <div class="script-parenthetical">(checking her watch)</div>
  <div class="script-dialogue">He should have been here twenty minutes ago. We don't have all day.</div>
  <div class="script-action">The front door chimes. A soaked figure in a black trench coat steps inside.</div>
  <div class="script-transition">CUT TO:</div>
  <div class="script-scene-heading">EXT. ALLEYWAY - CONTINUOUS</div>
  <div class="script-action">Neon reflections shimmer in deep puddles. Sirens echo in the far distance.</div>
`;

function computeEighths(lineCount: number): string {
  const eighths = Math.max(1, Math.round((lineCount / 54) * 8));
  const pages = Math.floor(eighths / 8);
  const rem = eighths % 8;
  if (pages === 0) return `${rem}/8`;
  if (rem === 0) return `${pages}`;
  return `${pages} ${rem}/8`;
}

function extractScenes(html: string): SceneItem[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(html, 'text/html');
  const children = Array.from(doc.body.children);
  
  const scenes: SceneItem[] = [];
  let currentScene: SceneItem | null = null;
  let currentLines: string[] = [];
  let sceneIndex = 0;

  for (const el of children) {
    const text = el.textContent?.trim() || '';
    if (!text) continue;

    if (el.classList.contains('script-scene-heading')) {
      if (currentScene) {
        currentScene.fountainText = currentLines.join('\n\n').trim();
        currentScene.eighths = computeEighths(currentLines.length);
        scenes.push(currentScene);
      }
      sceneIndex++;
      const upper = text.toUpperCase();
      const isIntExt = /^(INT\/EXT|INT\.\/EXT\.|I\/E)(\.|\s|$)/i.test(upper);
      const isInt = !isIntExt && /^INT(\.|\s|$)/i.test(upper);
      const isExt = !isIntExt && /^EXT(\.|\s|$)/i.test(upper);
      const setting: 'INT' | 'EXT' | 'INT/EXT' = isIntExt ? 'INT/EXT' : isInt ? 'INT' : isExt ? 'EXT' : 'INT';
      
      const withoutPrefix = upper.replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*/i, '');
      const parts = withoutPrefix.split(/\s*-\s*/);
      const location = parts[0]?.trim() || upper;
      const timeOfDay = parts[1]?.trim() || 'DAY';

      currentScene = {
        id: sceneIndex,
        slugline: upper,
        setting,
        location,
        timeOfDay,
        fountainText: '',
        characters: [],
        actionSnippet: '',
      };
      currentLines = [upper];
    } else if (currentScene) {
      if (el.classList.contains('script-action') && !currentScene.actionSnippet) {
        currentScene.actionSnippet = text;
      }
      if (el.classList.contains('script-character')) {
        const charName = text.replace(/\s*\(.*\)$/, '').trim().toUpperCase();
        if (charName && !currentScene.characters.includes(charName)) {
          currentScene.characters.push(charName);
        }
        currentLines.push(charName);
      } else if (el.classList.contains('script-transition')) {
        currentLines.push(`> ${text}`);
      } else {
        currentLines.push(text);
      }
    }
  }

  if (currentScene) {
    currentScene.fountainText = currentLines.join('\n\n').trim();
    currentScene.eighths = computeEighths(currentLines.length);
    scenes.push(currentScene);
  }

  return scenes;
}

export default function App() {
  const [activeMode, setActiveMode] = useState<'screenplay' | 'beats' | 'fountain' | 'reports'>('screenplay');
  const [focusMode, setFocusMode] = useState(false);
  const [isTitleModalOpen, setIsTitleModalOpen] = useState(false);
  const [isRevisionMenuOpen, setIsRevisionMenuOpen] = useState(false);
  
  // Phase 2 Ergonomics state
  const [isSprintWidgetOpen, setIsSprintWidgetOpen] = useState(false);
  const [isTypewriterMode, setIsTypewriterMode] = useState(false);
  const [isolatedCharacter, setIsolatedCharacter] = useState<string | null>(null);

  // Phase 3 Realtime Collaboration & ScriptNotes state
  const [isNotesPanelOpen, setIsNotesPanelOpen] = useState(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState(false);
  const [currentUserRole, setCurrentUserRole] = useState<CollaboratorRole>(() => {
    return (localStorage.getItem('openscript_user_role') as CollaboratorRole) || 'owner';
  });

  const [collaborators, setCollaborators] = useState<CollaboratorProfile[]>(() => {
    const saved = localStorage.getItem('openscript_collaborators');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      {
        userId: '11111111-1111-1111-1111-111111111111',
        email: 'gourav@ssnpictures.in',
        displayName: 'Gourav (SSN)',
        color: '#f59e0b',
        role: 'owner',
        lastSeenAt: new Date().toISOString(),
      },
      {
        userId: '22222222-2222-2222-2222-222222222222',
        email: 'navateja@ssnpictures.in',
        displayName: 'Navateja',
        color: '#3b82f6',
        role: 'co-writer',
        lastSeenAt: new Date().toISOString(),
      },
      {
        userId: '33333333-3333-3333-3333-333333333333',
        email: 'sarah.prod@hollywood.com',
        displayName: 'Sarah (Producer)',
        color: '#ec4899',
        role: 'commenter',
        lastSeenAt: new Date().toISOString(),
      },
    ];
  });

  const [notes, setNotes] = useState<ScriptNote[]>(() => {
    const saved = localStorage.getItem('openscript_script_notes');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      {
        id: 'note-uuid-0001',
        blockId: '00000000-0000-0000-0000-000000000001',
        documentId: '00000000-0000-0000-0000-000000000000',
        authorName: 'Navateja',
        authorColor: '#3b82f6',
        category: 'dialogue',
        content: "Maya's line should sound more impatient here—maybe cut the second sentence?",
        createdAt: new Date().toISOString(),
        resolved: false,
        replies: [
          {
            id: 'reply-uuid-0001',
            authorName: 'Gourav (SSN)',
            authorColor: '#f59e0b',
            content: 'Agreed! Punchier rhythm fits the scene opening better.',
            createdAt: new Date().toISOString(),
          },
        ],
      },
      {
        id: 'note-uuid-0002',
        blockId: '00000000-0000-0000-0000-000000000002',
        documentId: '00000000-0000-0000-0000-000000000000',
        authorName: 'Sarah (Producer)',
        authorColor: '#ec4899',
        category: 'production',
        content: 'Check permit availability for rain FX in alleyway scene.',
        createdAt: new Date().toISOString(),
        resolved: false,
        replies: [],
      },
    ];
  });

  const presencePeers: LivePresence[] = useMemo(() => {
    return collaborators.map((c) => ({
      userId: c.userId,
      displayName: c.displayName,
      color: c.color,
      role: c.role,
      isTyping: c.role === 'co-writer',
      lastPing: Date.now(),
    }));
  }, [collaborators]);

  // Production revision state
  const [isScriptLocked, setIsScriptLocked] = useState<boolean>(() => {
    return localStorage.getItem('openscript_is_locked') === 'true';
  });
  const [isTrackingRevisions, setIsTrackingRevisions] = useState<boolean>(() => {
    return localStorage.getItem('openscript_tracking_revisions') === 'true';
  });
  const [activeRevisionColor, setActiveRevisionColor] = useState<RevisionColor>(() => {
    return (localStorage.getItem('openscript_active_rev_color') as RevisionColor) || 'white';
  });

  // Concurrency & Autosave state
  const [revisionNumber, setRevisionNumber] = useState<number>(() => {
    return Number(localStorage.getItem('openscript_revision_number')) || 1;
  });
  const [documentId] = useState<string>(() => {
    let id = localStorage.getItem('openscript_doc_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('openscript_doc_id', id);
    }
    return id;
  });
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [serverRevision, setServerRevision] = useState<number | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [titleMetadata, setTitleMetadata] = useState<TitlePageMetadata>(() => {
    const saved = localStorage.getItem('openscript_title_metadata');
    return saved ? JSON.parse(saved) : {
      title: 'THE GLASS COUNTER',
      credit: 'written by',
      author: 'Gourav Siddoju',
      basedOn: '',
      contact: 'SSN Pictures\ncontact@ssnpictures.in',
      draftLabel: 'White Production Draft',
      draftDate: 'October 2026',
      showTitlePage: true,
      watermarkText: 'CONFIDENTIAL',
      showWatermark: false,
    };
  });

  const [scriptHtml, setScriptHtml] = useState<string>(() => {
    return localStorage.getItem('openscript_draft_html') || INITIAL_SCRIPT_HTML;
  });
  const [fountainText, setFountainText] = useState<string>(() => {
    return localStorage.getItem('openscript_draft_fountain') || 
`INT. COFFEE SHOP - DAY

Rain drums against the tall glass windows. A steaming cup of espresso rests on the counter.

MAYA
(checking her watch)
He should have been here twenty minutes ago. We don't have all day.

The front door chimes. A soaked figure in a black trench coat steps inside.

> CUT TO:

EXT. ALLEYWAY - CONTINUOUS

Neon reflections shimmer in deep puddles. Sirens echo in the far distance.`;
  });

  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [isSaved, setIsSaved] = useState(true);

  // Sync state to localStorage & trigger resilient autosave
  useEffect(() => {
    localStorage.setItem('openscript_draft_html', scriptHtml);
    localStorage.setItem('openscript_draft_fountain', fountainText);
    localStorage.setItem('openscript_title_metadata', JSON.stringify(titleMetadata));
    localStorage.setItem('openscript_is_locked', String(isScriptLocked));
    localStorage.setItem('openscript_tracking_revisions', String(isTrackingRevisions));
    localStorage.setItem('openscript_active_rev_color', activeRevisionColor);
    localStorage.setItem('openscript_revision_number', String(revisionNumber));
    setIsSaved(true);
  }, [scriptHtml, fountainText, titleMetadata, isScriptLocked, isTrackingRevisions, activeRevisionColor, revisionNumber]);

  // Debounced API concurrency autosave
  useEffect(() => {
    const timer = setTimeout(async () => {
      try {
        const blocks = parseFountain(fountainText);
        const docPayload = {
          schemaVersion: 2,
          id: documentId,
          projectId: '00000000-0000-0000-0000-000000000000',
          revisionNumber,
          metadata: {
            title: titleMetadata.title,
            credit: titleMetadata.credit,
            authors: [titleMetadata.author],
            draftLabel: titleMetadata.draftLabel,
            draftColor: activeRevisionColor,
            isLocked: isScriptLocked,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
          },
          content: blocks,
        };

        const res = await fetch(`http://localhost:3000/api/v1/documents/${documentId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            revisionNumber,
            content: docPayload,
            title: titleMetadata.title,
          }),
        });

        if (res.status === 409) {
          const data = await res.json();
          setServerRevision(data.serverRevisionNumber);
          setConflictModalOpen(true);
        } else if (res.ok) {
          const data = await res.json();
          if (data.newRevisionNumber) {
            setRevisionNumber(data.newRevisionNumber);
          }
        }
      } catch (err) {
        // Backend not running / offline: graceful local preservation
      }
    }, 1500);

    return () => clearTimeout(timer);
  }, [scriptHtml, fountainText, revisionNumber, documentId, titleMetadata, activeRevisionColor, isScriptLocked]);

  // Extract Scene Items for Final Draft Navigator & Beat Board
  const scenes = useMemo(() => {
    return extractScenes(scriptHtml);
  }, [scriptHtml]);

  // Extract all characters across the script for the Voice Isolator
  const allScriptCharacters = useMemo(() => {
    const set = new Set<string>();
    scenes.forEach((s) => s.characters.forEach((c) => set.add(c)));
    return Array.from(set);
  }, [scenes]);

  // Word count & estimated pages
  const metrics = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(scriptHtml, 'text/html');
    const text = doc.body.textContent || '';
    const words = text.split(/\s+/).filter(Boolean).length;
    const estimatedPages = Math.max(1, Math.ceil(words / 220));
    return { words, estimatedPages };
  }, [scriptHtml]);

  const handleAddNote = (category: ScriptNoteCategory, content: string, blockId?: string) => {
    const newNote: ScriptNote = {
      id: crypto.randomUUID(),
      blockId: blockId || '00000000-0000-0000-0000-000000000001',
      documentId,
      authorName: currentUserRole === 'owner' ? 'Gourav (SSN)' : 'Navateja',
      authorColor: currentUserRole === 'owner' ? '#f59e0b' : '#3b82f6',
      category,
      content,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    };
    setNotes((prev) => [newNote, ...prev]);
  };

  const handleAddReply = (noteId: string, replyContent: string) => {
    const replyItem = {
      id: crypto.randomUUID(),
      authorName: currentUserRole === 'owner' ? 'Gourav (SSN)' : 'Navateja',
      authorColor: currentUserRole === 'owner' ? '#f59e0b' : '#3b82f6',
      content: replyContent,
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, replies: [...(n.replies || []), replyItem] } : n))
    );
  };

  const handleToggleResolve = (noteId: string, currentStatus: boolean) => {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? { ...n, resolved: !currentStatus, resolvedAt: !currentStatus ? new Date().toISOString() : undefined }
          : n
      )
    );
  };

  const handleDeleteNote = (noteId: string) => {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleInviteCollaborator = (email: string, role: CollaboratorRole) => {
    const newCollab: CollaboratorProfile = {
      userId: crypto.randomUUID(),
      email,
      displayName: email.split('@')[0],
      color: '#' + Math.floor(Math.random() * 16777215).toString(16).padStart(6, '0'),
      role,
      lastSeenAt: new Date().toISOString(),
    };
    setCollaborators((prev) => [...prev, newCollab]);
  };

  const handleUpdateCollaboratorRole = (userId: string, role: CollaboratorRole) => {
    setCollaborators((prev) =>
      prev.map((c) => (c.userId === userId ? { ...c, role } : c))
    );
  };

  const handleRemoveCollaborator = (userId: string) => {
    setCollaborators((prev) => prev.filter((c) => c.userId !== userId));
  };

  const handleEditorUpdate = (html: string) => {
    setIsSaved(false);
    setScriptHtml(html);

    // Convert HTML to simple Fountain text representation
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const lines: string[] = [];

    Array.from(doc.body.children).forEach((el) => {
      const text = el.textContent?.trim() || '';
      if (!text) return;
      if (el.classList.contains('script-scene-heading')) lines.push(`\n${text}\n`);
      else if (el.classList.contains('script-character')) lines.push(`\n${text}`);
      else if (el.classList.contains('script-parenthetical')) lines.push(text);
      else if (el.classList.contains('script-dialogue')) lines.push(`${text}\n`);
      else if (el.classList.contains('script-transition')) lines.push(`\n> ${text}\n`);
      else lines.push(`\n${text}\n`);
    });

    setFountainText(lines.join('\n').trim());
  };

  const switchMode = (newMode: 'screenplay' | 'beats' | 'fountain' | 'reports') => {
    if (activeMode === 'fountain' && newMode !== 'fountain') {
      const generatedHtml = fountainToHtml(fountainText);
      setScriptHtml(generatedHtml);
      if (editorInstance) {
        editorInstance.commands.setContent(generatedHtml);
      }
    }
    setActiveMode(newMode);
  };

  const handleAddScene = () => {
    if (activeMode !== 'screenplay') {
      setActiveMode('screenplay');
    }

    let defaultSlugline: string;
    let sceneNumberAttr: string;

    if (isScriptLocked) {
      const existingSceneNumbers = scenes.map((s) => String(s.id));
      sceneNumberAttr = calculateLockedSceneNumber(existingSceneNumbers, scenes.length);
      defaultSlugline = `INT. SCENE ${sceneNumberAttr} - DAY`;
    } else {
      sceneNumberAttr = String(scenes.length + 1);
      defaultSlugline = `INT. SCENE ${sceneNumberAttr} - DAY`;
    }
    
    if (editorInstance) {
      editorInstance.chain().focus('end').insertContent([
        { 
          type: 'sceneHeading', 
          attrs: { 
            sceneNumber: sceneNumberAttr,
            revisionMark: isTrackingRevisions,
            revisionColor: activeRevisionColor 
          },
          content: [{ type: 'text', text: defaultSlugline }] 
        },
        { 
          type: 'action', 
          attrs: { 
            revisionMark: isTrackingRevisions,
            revisionColor: activeRevisionColor 
          },
          content: [{ type: 'text', text: '' }] 
        }
      ]).run();
    } else {
      const addedHtml = `<div class="script-scene-heading" data-scene-number="${sceneNumberAttr}">${defaultSlugline}</div><div class="script-action"></div>`;
      setScriptHtml((prev) => prev + addedHtml);
    }
    
    setTimeout(() => {
      scrollToScene(scenes.length);
    }, 150);
  };

  // Reorder scenes directly from the Beat Board (Stories #11 & #16)
  const handleReorderScenes = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= scenes.length || toIndex < 0 || toIndex >= scenes.length) return;
    const reordered = [...scenes];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    const reorderedFountain = reordered.map((s) => s.fountainText).join('\n\n');
    const newHtml = fountainToHtml(reorderedFountain);
    setScriptHtml(newHtml);
    setFountainText(reorderedFountain);
    if (editorInstance) {
      editorInstance.commands.setContent(newHtml);
    }
    setIsSaved(false);
  };

  // Drag and Drop File Import (Story #29)
  const handleDropFile = async (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const fileName = file.name.toLowerCase();
    if (fileName.endsWith('.fdx')) {
      await handleFdxFileChange({ target: { files: [file] } } as any);
    } else if (fileName.endsWith('.fountain') || fileName.endsWith('.txt')) {
      const text = await file.text();
      const generatedHtml = fountainToHtml(text);
      setFountainText(text);
      setScriptHtml(generatedHtml);
      if (editorInstance) {
        editorInstance.commands.setContent(generatedHtml);
      }
      setIsSaved(false);
    }
  };

  // Final Draft FDX Import
  const handleFdxFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const xmlString = await file.text();
      const { blocks, metadata } = parseFdx(xmlString);
      const generatedHtml = blocksToHtml(blocks);

      setScriptHtml(generatedHtml);
      if (editorInstance) {
        editorInstance.commands.setContent(generatedHtml);
      }

      if (metadata.title || metadata.authors) {
        setTitleMetadata((prev) => ({
          ...prev,
          title: metadata.title || prev.title,
          credit: metadata.credit || prev.credit,
          author: metadata.authors?.[0] || prev.author,
        }));
      }

      // Convert blocks to Fountain string
      const lines: string[] = [];
      for (const block of blocks) {
        if (block.type === 'sceneHeading') lines.push(`\n${block.text}\n`);
        else if (block.type === 'character') lines.push(`\n${block.text}`);
        else if (block.type === 'parenthetical') lines.push(block.text);
        else if (block.type === 'dialogue') lines.push(`${block.text}\n`);
        else if (block.type === 'transition') lines.push(`\n> ${block.text}\n`);
        else lines.push(`\n${block.text}\n`);
      }
      setFountainText(lines.join('\n').trim());
      setIsSaved(false);
    } catch (err) {
      alert('Failed to parse Final Draft (.fdx) file: ' + String(err));
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  // Final Draft FDX Export
  const handleExportFdx = () => {
    const blocks = parseFountain(fountainText);
    const xml = serializeFdx({
      content: blocks,
      metadata: {
        title: titleMetadata.title,
        credit: titleMetadata.credit,
        authors: [titleMetadata.author],
      },
    });

    const blob = new Blob([xml], { type: 'application/xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${titleMetadata.title.replace(/[^\w-]+/g, '_') || 'Screenplay'}.fdx`;
    link.click();
    URL.revokeObjectURL(url);
  };

  // Standard Fountain Export
  const handleExportFountain = () => {
    const blob = new Blob([fountainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${titleMetadata.title.replace(/[^\w-]+/g, '_') || 'Screenplay'}.fountain`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportSelectedScenes = (selected: SceneItem[]) => {
    const text = selected.map((s) => s.fountainText).join('\n\n/* ==================== */\n\n');
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `OpenScript_Selected_${selected.length}_Scenes.fountain`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePrintPdf = () => {
    window.print();
  };

  const scrollToScene = (index: number) => {
    if (activeMode !== 'screenplay') {
      setActiveMode('screenplay');
    }
    setTimeout(() => {
      const elements = document.querySelectorAll('.script-scene-heading');
      if (elements[index]) {
        elements[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);
  };

  const currentRevDraft = HOLLYWOOD_REVISION_SEQUENCE.find((r) => r.color === activeRevisionColor) || HOLLYWOOD_REVISION_SEQUENCE[0];

  const handleSelectRevision = (rev: RevisionDraftInfo) => {
    setActiveRevisionColor(rev.color);
    setTitleMetadata((prev) => ({
      ...prev,
      draftLabel: `${rev.name.split(' (')[0]} Production Draft`,
    }));
    setIsRevisionMenuOpen(false);
  };

  const effectiveSidebarOpen = sidebarOpen && !focusMode;

  return (
    <div className="flex h-screen bg-[#0c0d0e] text-[#e5e5e5] overflow-hidden font-sans">
      <input
        ref={fileInputRef}
        type="file"
        accept=".fdx,application/xml,text/xml"
        onChange={handleFdxFileChange}
        className="hidden"
      />

      {/* 1. Left Sidebar / Final Draft Outliner & Scene Navigator */}
      <aside
        className={`no-print border-r border-[#1e2025] bg-[#090a0c] flex flex-col justify-between transition-all duration-300 z-20 ${
          effectiveSidebarOpen ? 'w-80' : 'w-0 -translate-x-full overflow-hidden'
        }`}
      >
        <div className="flex flex-col h-full">
          {/* Brand Header */}
          <div className="p-4 border-b border-[#1c1e24] flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center font-bold text-black text-sm shadow-md shadow-amber-500/20">
                O
              </div>
              <div>
                <span className="font-bold tracking-wider text-sm block text-white">
                  OPENSCRIPT <span className="text-amber-500 text-xs font-mono font-normal">v0.2</span>
                </span>
                <span className="text-[10px] text-gray-500 block font-mono">openscript.ssnpictures.in</span>
              </div>
            </div>
          </div>

          {/* Document Title & Production Tag Card */}
          <div 
            onClick={() => setIsTitleModalOpen(true)}
            className="p-3 mx-3 my-3 bg-[#131418] hover:bg-[#181a20] rounded-xl border border-[#23262e] hover:border-amber-500/30 transition-all cursor-pointer group"
            title="Click to configure screenplay title page & author metadata"
          >
            <div className="flex items-center justify-between text-[11px] font-mono text-gray-400 uppercase tracking-wider">
              <span>PROJECT METADATA</span>
              <Edit3 className="w-3 h-3 text-gray-500 group-hover:text-amber-400 transition-colors" />
            </div>
            <div className="text-sm font-semibold text-white mt-0.5 truncate font-screenplay uppercase">
              {titleMetadata.title}
            </div>
            <div className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>{titleMetadata.draftLabel}</span>
            </div>
          </div>

          {/* Mode Switcher */}
          <nav className="px-3 space-y-1">
            {[
              { id: 'screenplay', label: 'Screenplay Paper', icon: FileText },
              { id: 'beats', label: 'Beat Board', icon: LayoutGrid },
              { id: 'fountain', label: 'Fountain Source', icon: Code },
              { id: 'reports', label: 'Production Reports', icon: BarChart2 },
            ].map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => switchMode(id as any)}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                  activeMode === id
                    ? 'bg-amber-500/10 text-amber-400 border border-amber-500/30 shadow-sm'
                    : 'text-gray-400 hover:text-white hover:bg-[#16181d]'
                }`}
              >
                <Icon className="w-4 h-4" />
                <span>{label}</span>
              </button>
            ))}
          </nav>

          {/* Final Draft Scene Navigator Component */}
          <div className="flex-1 overflow-hidden mt-3 border-t border-[#1a1c22]">
            <SceneNavigator
              scenes={scenes}
              onSelectScene={scrollToScene}
              onAddScene={handleAddScene}
              onExportSelectedScenes={handleExportSelectedScenes}
            />
          </div>

          {/* Footer Metadata */}
          <div className="p-3 border-t border-[#1c1e24] text-[11px] text-gray-400 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {isSaved ? 'Saved locally' : 'Saving...'}
            </span>
            <span className="font-mono text-gray-500">{metrics.words} words</span>
          </div>
        </div>
      </aside>

      {/* 2. Main Studio Viewport */}
      <main 
        onDragOver={(e) => e.preventDefault()}
        onDrop={handleDropFile}
        className="flex-1 flex flex-col bg-[#111215] overflow-hidden"
      >
        {/* Top Header Bar */}
        <header className="no-print h-14 border-b border-[#1c1e24] bg-[#0c0d0f] px-4 flex items-center justify-between">
          <div className="flex items-center gap-2 sm:gap-3">
            {!focusMode && (
              <button
                onClick={() => setSidebarOpen(!sidebarOpen)}
                className="p-1.5 rounded-lg hover:bg-[#1a1c22] text-gray-400 hover:text-white transition-colors"
                title="Toggle Navigator"
              >
                {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
              </button>
            )}

            <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
              <button
                onClick={() => setIsTitleModalOpen(true)}
                className="text-gray-200 font-semibold hover:text-amber-400 transition-colors uppercase truncate max-w-[120px] sm:max-w-[160px]"
                title="Click to edit Title Page"
              >
                {titleMetadata.title}
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 hidden sm:inline" />
              <span className="text-gray-400 hidden sm:inline">{scenes[0]?.slugline || 'SCENE 1'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600 hidden md:inline" />
              <span className="text-amber-500/90 hidden md:flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Page 1 of {metrics.estimatedPages} ({metrics.estimatedPages} mins)</span>
              </span>
            </div>

            {/* Quick Header + Add Scene Button */}
            <button
              onClick={handleAddScene}
              className="hidden xl:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1c1f26] hover:bg-[#252832] text-amber-400 hover:text-amber-300 border border-amber-500/30 text-xs font-mono font-medium transition-all ml-1"
              title="Add a new Scene to your screenplay"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Scene</span>
            </button>
          </div>

          {/* Export & Action Buttons */}
          <div className="flex items-center gap-1.5 sm:gap-2">
            {/* Writing Sprint Stopwatch Button (Section 7) */}
            <button
              onClick={() => setIsSprintWidgetOpen(!isSprintWidgetOpen)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                isSprintWidgetOpen
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-[#181a1f] hover:bg-[#22252c] text-gray-400 hover:text-white border-[#2b2e36]'
              }`}
              title="Sprint Stopwatch & Output Goals"
            >
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden lg:inline">Sprint</span>
            </button>

            {/* Typewriter Mode Toggle (Section 7) */}
            <button
              onClick={() => setIsTypewriterMode(!isTypewriterMode)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                isTypewriterMode
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 shadow-sm'
                  : 'bg-[#181a1f] hover:bg-[#22252c] text-gray-400 hover:text-white border-[#2b2e36]'
              }`}
              title="Typewriter Scrolling (Keeps cursor centered at 45% screen height)"
            >
              <span className="hidden lg:inline">Typewriter</span>
            </button>

            {/* Dialogue Voice Isolator Selector (Section 7) */}
            {allScriptCharacters.length > 0 && (
              <select
                value={isolatedCharacter || ''}
                onChange={(e) => setIsolatedCharacter(e.target.value || null)}
                className="hidden xl:inline-block px-2 py-1.5 bg-[#181a1f] text-gray-300 border border-[#2b2e36] rounded-lg text-xs font-mono focus:outline-none"
                title="Dialogue Voice Isolator: Highlight a single character's dialogue"
              >
                <option value="">Voice: All</option>
                {allScriptCharacters.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {/* Hollywood Revision Draft Dropdown */}
            <div className="relative">
              <button
                onClick={() => setIsRevisionMenuOpen(!isRevisionMenuOpen)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181a1f] hover:bg-[#22252c] text-xs font-mono border border-[#2b2e36] transition-colors"
                title="Select Hollywood Production Revision Draft Color"
              >
                <span
                  className="w-2.5 h-2.5 rounded-full border border-black/40"
                  style={{ backgroundColor: currentRevDraft.hex }}
                />
                <span className="hidden sm:inline text-gray-300">{currentRevDraft.name.split(' (')[0]}</span>
                <ChevronDown className="w-3 h-3 text-gray-400" />
              </button>

              {isRevisionMenuOpen && (
                <div className="absolute right-0 mt-1 w-56 bg-[#16181f] border border-[#2b2f3a] rounded-xl shadow-2xl p-1.5 z-50">
                  <div className="px-2 py-1 text-[10px] font-mono text-gray-400 uppercase tracking-wider">
                    Hollywood Revision Sequence
                  </div>
                  {HOLLYWOOD_REVISION_SEQUENCE.map((rev) => (
                    <button
                      key={rev.color}
                      onClick={() => handleSelectRevision(rev)}
                      className={`w-full flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-xs font-mono text-left transition-colors ${
                        activeRevisionColor === rev.color
                          ? 'bg-amber-500/20 text-amber-300 font-semibold'
                          : 'text-gray-300 hover:bg-[#21242d]'
                      }`}
                    >
                      <span
                        className="w-2.5 h-2.5 rounded-full border border-black/40 shrink-0"
                        style={{ backgroundColor: rev.hex }}
                      />
                      <span className="truncate">{rev.name}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Lock Script Mode Toggle */}
            <button
              onClick={() => setIsScriptLocked(!isScriptLocked)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                isScriptLocked
                  ? 'bg-amber-500/20 text-amber-300 border-amber-500/50'
                  : 'bg-[#181a1f] hover:bg-[#22252c] text-gray-400 hover:text-white border-[#2b2e36]'
              }`}
              title={isScriptLocked ? 'Script is locked: Numbers will freeze' : 'Script is unlocked'}
            >
              {isScriptLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
              <span className="hidden md:inline">{isScriptLocked ? 'Locked' : 'Lock'}</span>
            </button>

            {/* Track Revisions Toggle */}
            <button
              onClick={() => setIsTrackingRevisions(!isTrackingRevisions)}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-mono border transition-all ${
                isTrackingRevisions
                  ? 'bg-red-500/20 text-red-300 border-red-500/50'
                  : 'bg-[#181a1f] hover:bg-[#22252c] text-gray-400 hover:text-white border-[#2b2e36]'
              }`}
              title={isTrackingRevisions ? 'Auto-marking edits with right-margin revision asterisks (*)' : 'Revision tracking inactive'}
            >
              <span className="text-red-400 font-bold leading-none text-base">*</span>
              <span className="hidden md:inline">{isTrackingRevisions ? 'Tracking' : 'Track'}</span>
            </button>

            {/* Final Draft FDX Import Button */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181a1f] hover:bg-[#22252c] text-xs font-mono text-gray-300 border border-[#2b2e36] transition-colors"
              title="Import Final Draft (.fdx) file"
            >
              <Upload className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden 2xl:inline">Import FDX</span>
            </button>

            {/* Final Draft FDX Export Button */}
            <button
              onClick={handleExportFdx}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181a1f] hover:bg-[#22252c] text-xs font-mono text-gray-300 border border-[#2b2e36] transition-colors"
              title="Export Final Draft (.fdx) file"
            >
              <FileCode className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden 2xl:inline">Export FDX</span>
            </button>

            {/* Fountain Export */}
            <button
              onClick={handleExportFountain}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#181a1f] hover:bg-[#22252c] text-xs font-mono text-gray-200 border border-[#2b2e36] transition-colors"
              title="Download standard Fountain plain-text script"
            >
              <Download className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Fountain</span>
            </button>

            {/* Print/PDF Export */}
            <button
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-black shadow-md shadow-amber-500/20 transition-all"
              title="Print formatted script or save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-black" />
              <span className="hidden sm:inline">PDF</span>
            </button>

            {/* Phase 3 Collaboration & ScriptNotes Roster */}
            <div className="pl-1 border-l border-[#262934] ml-1">
              <CollaborationBar
                presencePeers={presencePeers}
                currentUserRole={currentUserRole}
                unresolvedNotesCount={notes.filter((n) => !n.resolved).length}
                isNotesPanelOpen={isNotesPanelOpen}
                onToggleNotesPanel={() => setIsNotesPanelOpen(!isNotesPanelOpen)}
                onOpenShareModal={() => setIsShareModalOpen(true)}
              />
            </div>
          </div>
        </header>

        {/* Workspace Canvas Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-[#0d0e11]">
          {activeMode === 'screenplay' && (
            <ScreenplayEditor
              initialContent={scriptHtml}
              onUpdate={handleEditorUpdate}
              onEditorReady={(editor) => setEditorInstance(editor)}
              metadata={titleMetadata}
              isTrackingRevisions={isTrackingRevisions}
              activeRevisionColor={activeRevisionColor}
              isScriptLocked={isScriptLocked}
              isTypewriterMode={isTypewriterMode}
              isolatedCharacter={isolatedCharacter}
              currentUserRole={currentUserRole}
              notes={notes}
            />
          )}

          {activeMode === 'beats' && (
            <BeatBoard
              scenes={scenes}
              onOpenScene={scrollToScene}
              onAddScene={handleAddScene}
              onReorderScenes={handleReorderScenes}
            />
          )}

          {activeMode === 'fountain' && (
            <FountainView
              fountainText={fountainText}
              onChange={(newText) => {
                setFountainText(newText);
                setIsSaved(false);
              }}
            />
          )}

          {activeMode === 'reports' && (
            <ProductionReports contentHtml={scriptHtml} />
          )}
        </div>

        {/* Studio Status Bar (Lovable-calibrated metrics footer) */}
        <footer className="no-print h-8 shrink-0 border-t border-[#1c1e24] bg-[#0c0d0f] px-4 flex items-center justify-between text-[11px] font-mono text-gray-400 select-none">
          <div className="flex items-center gap-3">
            <span className="text-gray-200 font-semibold">{metrics.estimatedPages} {metrics.estimatedPages === 1 ? 'page' : 'pages'}</span>
            <span className="text-gray-600">·</span>
            <span>{scenes.length} {scenes.length === 1 ? 'scene' : 'scenes'}</span>
            <span className="text-gray-600">·</span>
            <span>{metrics.words} words</span>
            <span className="text-gray-600">·</span>
            <span className="text-amber-400/90 flex items-center gap-1">
              <Clock className="w-3 h-3" />
              <span>≈ {metrics.estimatedPages} min screen time</span>
            </span>
            {isScriptLocked && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-amber-400 flex items-center gap-1">
                  <Lock className="w-2.5 h-2.5" />
                  <span>Locked</span>
                </span>
              </>
            )}
            {isTypewriterMode && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-amber-400">Typewriter</span>
              </>
            )}
            {isolatedCharacter && (
              <>
                <span className="text-gray-600">·</span>
                <span className="text-amber-400">Voice: {isolatedCharacter}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-gray-500 uppercase">
              {activeMode === 'screenplay'
                ? 'Screenplay Paper'
                : activeMode === 'beats'
                ? 'Beat Board'
                : activeMode === 'fountain'
                ? 'Fountain Plain'
                : 'Production Reports'}
            </span>
            <span className="text-gray-700">|</span>
            <span className="flex items-center gap-1.5 text-emerald-400 font-mono">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSaved ? 'Saved locally' : 'Saving...'}</span>
            </span>
          </div>
        </footer>
      </main>

      {/* Title Page Modal */}
      <TitlePageModal
        isOpen={isTitleModalOpen}
        onClose={() => setIsTitleModalOpen(false)}
        metadata={titleMetadata}
        onChange={setTitleMetadata}
      />

      {/* Concurrency Conflict Resolution Modal */}
      <ConflictModal
        isOpen={conflictModalOpen}
        localRevisionNumber={revisionNumber}
        serverRevisionNumber={serverRevision}
        localContentPreview={fountainText}
        onClose={() => setConflictModalOpen(false)}
        onReloadServer={() => {
          setConflictModalOpen(false);
          if (serverRevision) setRevisionNumber(serverRevision);
        }}
        onOverwrite={() => {
          setConflictModalOpen(false);
          if (serverRevision) setRevisionNumber(serverRevision);
        }}
      />

      {/* Sprint Stopwatch & Writing Goals Widget (Section 7) */}
      <SprintWidget
        isOpen={isSprintWidgetOpen}
        onClose={() => setIsSprintWidgetOpen(false)}
        currentWordCount={metrics.words}
      />

      {/* Phase 3 ScriptNotes Flyout Panel */}
      <ScriptNotesPanel
        isOpen={isNotesPanelOpen}
        onClose={() => setIsNotesPanelOpen(false)}
        notes={notes}
        onAddNote={handleAddNote}
        onAddReply={handleAddReply}
        onToggleResolve={handleToggleResolve}
        onDeleteNote={handleDeleteNote}
        canEdit={currentUserRole !== 'reader'}
      />

      {/* Phase 3 Team Sharing & Permission Modal */}
      <ShareModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
        collaborators={collaborators}
        onInviteCollaborator={handleInviteCollaborator}
        onUpdateRole={handleUpdateCollaboratorRole}
        onRemoveCollaborator={handleRemoveCollaborator}
        currentUserRole={currentUserRole}
        onChangeUserRolePreview={setCurrentUserRole}
        documentTitle={titleMetadata.title}
      />
    </div>
  );
}
