import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  FileText, 
  Code, 
  BarChart2, 
  Download, 
  Printer, 
  Save,
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
  Radio,
  Keyboard,
  Cloud,
  BookOpen,
} from 'lucide-react';
import { isNonCharacterCue, isSceneHeadingCandidate } from '@openscript/screenplay-schema';
import { InteractiveTour } from './components/InteractiveTour';
import { ScreenplayEditor } from './components/ScreenplayEditor';
import { FountainView } from './components/FountainView';
import { ProductionReports } from './components/ProductionReports';
import { SceneNavigator, SceneItem, SceneFolder } from './components/SceneNavigator';
import { BeatBoard } from './components/BeatBoard';
import { TitlePageModal, TitlePageMetadata } from './components/TitlePageModal';
import { ConflictModal } from './components/ConflictModal';
import { SprintWidget } from './components/SprintWidget';
import { ScriptNotesPanel } from './components/ScriptNotesPanel';
import { ShareModal } from './components/ShareModal';
import { CollaborationBar } from './components/CollaborationBar';
import { KeyboardShortcutsModal } from './components/KeyboardShortcutsModal';
import { UserProfileModal, UserProfileData } from './components/UserProfileModal';
import { AuthModal } from './components/AuthModal';
import { SceneTakesModal } from './components/SceneTakesModal';
import { ImportModal } from './components/ImportModal';
import { ExportModal } from './components/ExportModal';
import { CloudStorageModal } from './components/CloudStorageModal';
import { ProjectDashboard } from './components/ProjectDashboard';
import { listProjects, getProject, saveProject, createProject, getActiveProjectId, setActiveProjectId } from './utils/projectStore';
import { htmlToBlocks, exportScreenplayPdf, saveScreenplayToLocalDisk } from './utils/exporter';
import { ImportedScreenplayResult } from './utils/importer';
import { fountainToHtml, parseFountain, blocksToHtml } from '@openscript/fountain';
import { parseFdx, serializeFdx } from '@openscript/fdx';
import { 
  PRODUCTION_REVISION_SEQUENCE, 
  RevisionDraftInfo, 
  RevisionColor, 
  calculateLockedSceneNumber,
  createScreenplayBlock,
  ScriptNote,
  ScriptNoteCategory,
  CollaboratorRole,
  CollaboratorProfile,
  LivePresence,
  SceneTake,
  canFinalizeSceneTake
} from '@openscript/screenplay-schema';

const INITIAL_SCRIPT_HTML = `
  <div class="script-scene-heading">EXT. CITY STREET - DAY</div>
  <div class="script-action">A quiet morning. Sunlight filters through the skyscrapers as the city begins to move.</div>
  <div class="script-character">WRITER</div>
  <div class="script-dialogue">Every story begins with a blank page.</div>
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
  let currentFountainPieces: string[] = [];
  let currentHtmlPieces: string[] = [];
  let sceneIndex = 0;
  let lineCount = 0;

  for (const el of children) {
    const text = el.textContent?.trim() || '';
    if (!text && !el.classList.contains('script-dual-dialogue')) continue;

    if (el.classList.contains('script-scene-heading')) {
      if (currentScene) {
        currentScene.fountainText = currentFountainPieces.join('').trim();
        currentScene.sceneHtml = currentHtmlPieces.join('');
        currentScene.eighths = computeEighths(lineCount);
        scenes.push(currentScene);
      }
      sceneIndex++;
      const upper = text.toUpperCase();
      const isIntExt = /^(INT\/EXT|INT\.\/EXT\.|I\/E)(\.|\s|$)/i.test(upper);
      const isInt = !isIntExt && /^INT(\.|\s|$)/i.test(upper);
      const isExt = !isIntExt && /^EXT(\.|\s|$)/i.test(upper);
      const setting: 'INT' | 'EXT' | 'INT/EXT' = isIntExt ? 'INT/EXT' : isInt ? 'INT' : isExt ? 'EXT' : 'INT';
      
      const withoutPrefix = upper
        .replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.|SUPER\s*TITLE:\s*|SUPER:\s*|TITLE\s*CARD:\s*|TITLE:\s*)\s*/i, '')
        .replace(/["']/g, '');
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
        sceneHtml: '',
        characters: [],
        actionSnippet: '',
        hasRevisions: false,
        revisedLines: [],
      };
      currentFountainPieces = [upper + '\n\n'];
      currentHtmlPieces = [el.outerHTML];
      lineCount = 1;
    } else if (currentScene) {
      currentHtmlPieces.push(el.outerHTML);
      lineCount++;

      const isBlockRevised = el.classList.contains('revision-marker') || el.getAttribute('data-revision-mark') === 'true';
      if (isBlockRevised) {
        currentScene.hasRevisions = true;
        if (!currentScene.revisedLines) currentScene.revisedLines = [];
        currentScene.revisedLines.push(text);
      }
      const asteriskSuffix = isBlockRevised ? ' *' : '';

      if (el.classList.contains('script-action')) {
        if (!currentScene.actionSnippet) {
          currentScene.actionSnippet = text;
        }
        currentFountainPieces.push(text + asteriskSuffix + '\n\n');
      } else if (el.classList.contains('script-character')) {
        const charName = text.replace(/\s*\(.*\)$/, '').trim().toUpperCase();
        if (charName && !isNonCharacterCue(charName) && !currentScene.characters.includes(charName)) {
          currentScene.characters.push(charName);
        }
        // In Fountain spec: Character cue MUST be followed immediately by parenthetical or dialogue with \n (single newline)
        currentFountainPieces.push(charName + '\n');
      } else if (el.classList.contains('script-parenthetical')) {
        // Parenthetical must be followed by single \n before dialogue
        currentFountainPieces.push(text + '\n');
      } else if (el.classList.contains('script-dialogue')) {
        // Dialogue terminates character speech block with double newline \n\n
        currentFountainPieces.push(text + asteriskSuffix + '\n\n');
      } else if (el.classList.contains('script-transition')) {
        currentFountainPieces.push(`> ${text}\n\n`);
      } else if (el.classList.contains('script-dual-dialogue')) {
        el.querySelectorAll('.script-character').forEach((c) => {
          const name = c.textContent?.replace(/\s*\(.*\)$/, '').trim().toUpperCase();
          if (name && !isNonCharacterCue(name) && currentScene && !currentScene.characters.includes(name)) {
            currentScene.characters.push(name);
          }
        });
        currentFountainPieces.push(text + '\n\n');
      } else {
        currentFountainPieces.push(text + '\n\n');
      }
    }
  }

  if (currentScene) {
    currentScene.fountainText = currentFountainPieces.join('').trim();
    currentScene.sceneHtml = currentHtmlPieces.join('');
    currentScene.eighths = computeEighths(lineCount);
    scenes.push(currentScene);
  }

  return scenes;
}

export default function App() {
  const [documentId, setDocumentId] = useState<string>(() => {
    let id = localStorage.getItem('openscript_doc_id');
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem('openscript_doc_id', id);
    }
    return id;
  });
  const [isSaved, setIsSaved] = useState(true);
  const [localSaveNotification, setLocalSaveNotification] = useState<string | null>(null);
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
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState(false);
  // Smart Auto-revealing Header on Scroll & Studio Guide State
  const [isHeaderVisible, setIsHeaderVisible] = useState(true);
  const [isTourOpen, setIsTourOpen] = useState(false);
  const lastScrollTopRef = useRef(0);

  const handleWorkspaceScroll = (e: React.UIEvent<HTMLDivElement>) => {
    // Keep header & formatting bar docked and visible permanently across all pages
    if (!isHeaderVisible) {
      setIsHeaderVisible(true);
    }
  };


  // User Profile & Authentication state
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [authModalMode, setAuthModalMode] = useState<'login' | 'register'>('login');
  const [selectedPeerProfile, setSelectedPeerProfile] = useState<UserProfileData | null>(null);
  const [authToken, setAuthToken] = useState<string | null>(() => {
    return localStorage.getItem('openscript_auth_token');
  });
  const [currentUser, setCurrentUser] = useState<UserProfileData>(() => {
    const saved = localStorage.getItem('openscript_current_user');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return {
      id: '11111111-1111-1111-1111-111111111111',
      email: 'gourav@ssnpictures.in',
      displayName: 'Gourav (SSN)',
      role: 'owner',
      studio: 'SSN Pictures Studio',
      color: '#f59e0b',
    };
  });


  // Scene Takes & Alternate Versions (RBAC: Propose by Co-Writer, Finalize by Owner)
  const [selectedSceneForTakes, setSelectedSceneForTakes] = useState<SceneItem | null>(null);
  const [isSceneTakesModalOpen, setIsSceneTakesModalOpen] = useState(false);
  const [sceneTakes, setSceneTakes] = useState<SceneTake[]>(() => {
    const saved = localStorage.getItem('openscript_scene_takes');
    if (saved) {
      try { return JSON.parse(saved); } catch {}
    }
    return [
      {
        id: 'take-1-default',
        sceneId: 1,
        takeNumber: 1,
        title: 'Take 1 (Original Master)',
        fountainText: 'INT. SCENE 1 - DAY\n\nAction description begins here.',
        authorName: 'Gourav (SSN)',
        authorRole: 'owner',
        createdAt: new Date().toISOString(),
        isFinalized: true,
      },
    ];
  });


  const handleOpenSceneTakesForBlockText = (blockText: string) => {
    const textSnippet = blockText.trim();
    const matchingScene = scenes.find((s) => 
      s.fountainText.includes(textSnippet) || 
      (s.revisedLines && s.revisedLines.some(l => textSnippet.includes(l) || l.includes(textSnippet)))
    );
    if (matchingScene) {
      handleOpenSceneTakes(matchingScene);
    } else if (scenes.length > 0) {
      handleOpenSceneTakes(scenes[0]);
    }
  };

  const handleOpenSceneTakes = (scene: SceneItem) => {
    setSelectedSceneForTakes(scene);

    const existingTakesForScene = sceneTakes.filter((t) => t.sceneId === scene.id);

    if (existingTakesForScene.length === 0) {
      const newTakes: SceneTake[] = [];

      if (scene.hasRevisions) {
        // Take 1: Baseline before revisions
        const baselineFountain = scene.fountainText
          .split('\n')
          .map((line) => line.replace(/\s*\*$/, '').trimEnd())
          .join('\n');

        const baselineTake: SceneTake = {
          id: `take-${scene.id}-baseline`,
          sceneId: scene.id,
          takeNumber: 1,
          title: 'Take 1 (Original Baseline)',
          fountainText: baselineFountain,
          authorName: 'Master Script',
          authorRole: 'owner',
          createdAt: new Date(Date.now() - 3600000).toISOString(),
          isFinalized: false,
        };

        // Take 2: Active Revision Draft with asterisks
        const revisionTake: SceneTake = {
          id: `take-${scene.id}-revision`,
          sceneId: scene.id,
          takeNumber: 2,
          title: `Take 2 (${activeRevisionColor.toUpperCase()} Draft Revision) *`,
          fountainText: scene.fountainText,
          authorName: currentUser.displayName,
          authorRole: currentUserRole,
          createdAt: new Date().toISOString(),
          isFinalized: true,
        };

        newTakes.push(baselineTake, revisionTake);
      } else {
        const masterTake: SceneTake = {
          id: `take-${scene.id}-master`,
          sceneId: scene.id,
          takeNumber: 1,
          title: 'Take 1 (Original Master)',
          fountainText: scene.fountainText,
          authorName: currentUser.displayName,
          authorRole: currentUserRole,
          createdAt: new Date().toISOString(),
          isFinalized: true,
        };
        newTakes.push(masterTake);
      }

      const updated = [...sceneTakes, ...newTakes];
      setSceneTakes(updated);
      localStorage.setItem('openscript_scene_takes', JSON.stringify(updated));
    } else if (scene.hasRevisions) {
      // If takes exist, check if an active revision take with asterisk exists
      const hasRevTake = existingTakesForScene.some((t) => t.title.includes('*'));
      if (!hasRevTake) {
        const nextNum = existingTakesForScene.length + 1;
        const newRevTake: SceneTake = {
          id: `take-${scene.id}-rev-${Date.now()}`,
          sceneId: scene.id,
          takeNumber: nextNum,
          title: `Take ${nextNum} (${activeRevisionColor.toUpperCase()} Draft Revision) *`,
          fountainText: scene.fountainText,
          authorName: currentUser.displayName,
          authorRole: currentUserRole,
          createdAt: new Date().toISOString(),
          isFinalized: true,
        };
        const updated = sceneTakes.map((t) => t.sceneId === scene.id ? { ...t, isFinalized: false } : t);
        updated.push(newRevTake);
        setSceneTakes(updated);
        localStorage.setItem('openscript_scene_takes', JSON.stringify(updated));
      }
    }

    setIsSceneTakesModalOpen(true);
  };

  const handleProposeSceneTake = (sceneId: number, title: string, content: string) => {
    const nextTakeNumber = sceneTakes.filter((t) => t.sceneId === sceneId).length + 1;
    const newTake: SceneTake = {
      id: `take-${Date.now()}`,
      sceneId,
      takeNumber: nextTakeNumber,
      title,
      fountainText: content,
      authorName: currentUser.displayName,
      authorRole: currentUserRole,
      createdAt: new Date().toISOString(),
      isFinalized: false,
    };
    const updatedTakes = [...sceneTakes, newTake];
    setSceneTakes(updatedTakes);
    localStorage.setItem('openscript_scene_takes', JSON.stringify(updatedTakes));
  };

  const handleFinalizeSceneTake = (take: SceneTake) => {
    if (!canFinalizeSceneTake(currentUserRole)) {
      alert('Only the Project Owner has authority to finalize winning takes.');
      return;
    }

    const updatedTakes = sceneTakes.map((t) => {
      if (t.sceneId === take.sceneId) {
        return { ...t, isFinalized: t.id === take.id };
      }
      return t;
    });
    setSceneTakes(updatedTakes);
    localStorage.setItem('openscript_scene_takes', JSON.stringify(updatedTakes));

    // Update active scene in script with winning take's content
    const targetSceneIndex = scenes.findIndex((s) => s.id === take.sceneId);
    if (targetSceneIndex !== -1) {
      const updatedScenes = [...scenes];
      const htmlPiece = fountainToHtml(take.fountainText);
      updatedScenes[targetSceneIndex] = {
        ...updatedScenes[targetSceneIndex],
        fountainText: take.fountainText,
        sceneHtml: htmlPiece,
      };
      const newHtml = updatedScenes.map((s) => s.sceneHtml || fountainToHtml(s.fountainText)).join('');
      const newFountain = updatedScenes.map((s) => s.fountainText).join('\n\n');
      setScriptHtml(newHtml);
      setFountainText(newFountain);
      if (editorInstance) {
        editorInstance.commands.setContent(newHtml);
      }
      setIsSaved(false);
    }
  };


  // Screenplay Project Importer State (Final Draft, Scrivener, Highland, Text)
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isCloudStorageModalOpen, setIsCloudStorageModalOpen] = useState(false);
  const [isDashboardOpen, setIsDashboardOpen] = useState(false);
  const [droppedImportFile, setDroppedImportFile] = useState<File | null>(null);
  const [droppedFolderEntry, setDroppedFolderEntry] = useState<any>(null);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [documentTotalPages, setDocumentTotalPages] = useState<number>(1);
  // Act Selection & Organization State
  const [selectedActId, setSelectedActId] = useState<string | null>(null);
  const [sceneFolders, setSceneFolders] = useState<SceneFolder[]>(() => {
    const saved = localStorage.getItem('openscript_scene_folders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Purge legacy hardcoded default acts (Act I — Setup, Act II — Confrontation, Act III — Resolution)
        if (
          Array.isArray(parsed) &&
          parsed.length === 3 &&
          parsed.some((p: any) => p.id === 'act-1' && p.name && p.name.includes('Act I')) &&
          parsed.some((p: any) => p.id === 'act-2' && p.name && p.name.includes('Act II')) &&
          parsed.some((p: any) => p.id === 'act-3' && p.name && p.name.includes('Act III'))
        ) {
          localStorage.removeItem('openscript_scene_folders');
          localStorage.removeItem('openscript_scene_folder_map');
          return [];
        }
        return parsed;
      } catch {}
    }
    return [];
  });
  const [sceneFolderMap, setSceneFolderMap] = useState<Record<number, string>>(() => {
    const savedFolders = localStorage.getItem('openscript_scene_folders');
    if (!savedFolders) return {};
    const saved = localStorage.getItem('openscript_scene_folder_map');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed['1'] === 'act-1' && parsed['2'] === 'act-2' && Object.keys(parsed).length <= 2) {
          localStorage.removeItem('openscript_scene_folder_map');
          return {};
        }
        return parsed;
      } catch {}
    }
    return {};
  });

  const handleUpdateSceneFolders = (newFolders: SceneFolder[]) => {
    setSceneFolders(newFolders);
    localStorage.setItem('openscript_scene_folders', JSON.stringify(newFolders));
  };

  const handleUpdateSceneFolderMap = (newMap: Record<number, string>) => {
    setSceneFolderMap(newMap);
    localStorage.setItem('openscript_scene_folder_map', JSON.stringify(newMap));
  };

  const saveCurrentProject = () => {
    const activeId = getActiveProjectId();
    const existing = getProject(activeId);
    if (existing) {
      saveProject({
        ...existing,
        title: titleMetadata.title,
        author: titleMetadata.author,
        credit: titleMetadata.credit,
        draftLabel: titleMetadata.draftLabel,
        draftColor: activeRevisionColor,
        scriptHtml,
        fountainText,
        sceneCount: scenes.length,
        wordCount: metrics.words,
        isLocked: isScriptLocked,
        sceneTakes,
        notes,
      });
    }
  };

  const handleOpenProject = (projectId: string) => {
    saveCurrentProject();
    const proj = getProject(projectId);
    if (!proj) return;

    setActiveProjectId(projectId);
    setDocumentId(proj.id);
    setScriptHtml(proj.scriptHtml);
    setFountainText(proj.fountainText);
    if (editorInstance) {
      editorInstance.commands.setContent(proj.scriptHtml);
    }
    setTitleMetadata({
      title: proj.title,
      author: proj.author,
      credit: proj.credit || 'written by',
      draftLabel: proj.draftLabel || 'First Draft',
      draftDate: new Date(proj.updatedAt).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      showTitlePage: true,
      contact: 'SSN Pictures\ncontact@ssnpictures.in',
      basedOn: '',
      showWatermark: false,
      watermarkText: '',
    });
    if (proj.draftColor) {
      setActiveRevisionColor(proj.draftColor);
    }
    if (proj.isLocked !== undefined) {
      setIsScriptLocked(proj.isLocked);
    }
    if (proj.sceneTakes) {
      setSceneTakes(proj.sceneTakes);
    }
    if (proj.notes) {
      setNotes(proj.notes);
    }
    setIsSaved(true);
    setIsDashboardOpen(false);
  };


  const handleApplyImportedScreenplay = (result: ImportedScreenplayResult) => {
    // 1. Create and persist project into projectStore
    const newProj = createProject(result.title || 'Imported Screenplay', result.author || 'Author');
    newProj.scriptHtml = result.scriptHtml;
    newProj.fountainText = result.fountainText;
    newProj.sceneCount = result.sceneCount;
    newProj.wordCount = result.wordCount;
    if (result.sceneTakes) newProj.sceneTakes = result.sceneTakes;
    if (result.notes) newProj.notes = result.notes;
    saveProject(newProj);
    setActiveProjectId(newProj.id);

    // 2. Load into editor state
    setDocumentId(newProj.id);
    setScriptHtml(result.scriptHtml);
    setFountainText(result.fountainText);
    if (editorInstance) {
      editorInstance.commands.setContent(result.scriptHtml, { emitUpdate: true });
    }
    if (result.title || result.author || result.fullMetadata) {
      setTitleMetadata((prev) => ({
        ...prev,
        title: result.title || prev.title,
        author: result.author || prev.author,
        showTitlePage: result.hasTitlePage !== undefined ? result.hasTitlePage : (result.fullMetadata?.showTitlePage ?? prev.showTitlePage),
        ...(result.fullMetadata || {}),
      }));
    }
    if (result.sceneTakes && Array.isArray(result.sceneTakes)) {
      setSceneTakes(result.sceneTakes);
      localStorage.setItem('openscript_scene_takes', JSON.stringify(result.sceneTakes));
    }
    if (result.notes && Array.isArray(result.notes)) {
      setNotes(result.notes);
      localStorage.setItem('openscript_script_notes', JSON.stringify(result.notes));
    }
    setIsSaved(false);
    setIsDashboardOpen(false);
  };

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
        email: 'sarah.prod@studio.com',
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

  const [livePeers, setLivePeers] = useState<LivePresence[]>([]);

  // 0. Auto-sync authenticated profile from backend
  useEffect(() => {
    if (authToken) {
      fetch('/api/v1/auth/me', {
        headers: { 'Authorization': `Bearer ${authToken}` },
      })
        .then((r) => r.ok ? r.json() : null)
        .then((data) => {
          if (data?.user) {
            setCurrentUser((prev) => ({
              ...prev,
              id: data.user.id,
              email: data.user.email,
              displayName: data.user.displayName,
              role: data.user.role || prev.role,
            }));
            setCurrentUserRole(data.user.role || 'owner');
          }
        })
        .catch(() => {});
    }
  }, [authToken]);

  const handleUpdateDisplayName = async (newName: string) => {
    if (authToken) {
      try {
        await fetch('/api/v1/auth/profile', {
          method: 'PATCH',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${authToken}`,
          },
          body: JSON.stringify({ displayName: newName }),
        });
      } catch {}
    }
    setCurrentUser((prev) => {
      const updated = { ...prev, displayName: newName };
      localStorage.setItem('openscript_current_user', JSON.stringify(updated));
      return updated;
    });
  };

  const handleLogout = async () => {
    if (authToken) {
      try {
        await fetch('/api/v1/auth/logout', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${authToken}` },
        });
      } catch {}
    }
    localStorage.removeItem('openscript_auth_token');
    setAuthToken(null);
    setIsAuthModalOpen(true);
  };

  const handleAuthSuccess = (user: UserProfileData, token: string, isNewUser?: boolean) => {
    setCurrentUser(user);
    setAuthToken(token);
    setCurrentUserRole(user.role);
    localStorage.setItem('openscript_current_user', JSON.stringify(user));
    localStorage.setItem('openscript_auth_token', token);
    localStorage.setItem('openscript_user_role', user.role);

    // Interactive Guide is triggered JUST ONCE when a new user registers & logs in
    const userTourKey = `openscript_tour_seen_${user.id || user.email || 'user'}`;
    const globalTourSeen = localStorage.getItem('openscript_seen_guide_tour');
    const userTourSeen = localStorage.getItem(userTourKey);

    if (isNewUser && !userTourSeen && !globalTourSeen) {
      setTimeout(() => {
        setIsTourOpen(true);
      }, 700);
    }
  };

  // 1. Initial backend sync for Notes & Collaborators
  useEffect(() => {
    fetch(`/api/v1/documents/${documentId}/notes`)
      .then((r) => r.json())
      .then((data) => {
        if (data?.notes && Array.isArray(data.notes) && data.notes.length > 0) {
          setNotes(data.notes);
        }
      })
      .catch(() => {});

    fetch('/api/v1/projects/00000000-0000-0000-0000-000000000000/collaborators')
      .then((r) => r.json())
      .then((data) => {
        if (data?.collaborators && Array.isArray(data.collaborators) && data.collaborators.length > 0) {
          setCollaborators(data.collaborators);
        }
      })
      .catch(() => {});
  }, [documentId]);

  // 2. Realtime presence heartbeat to backend
  useEffect(() => {
    const sendHeartbeat = async () => {
      try {
        const res = await fetch('/api/v1/projects/00000000-0000-0000-0000-000000000000/presence', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            userId: currentUserRole === 'owner' ? '11111111-1111-1111-1111-111111111111' : '22222222-2222-2222-2222-222222222222',
            displayName: currentUserRole === 'owner' ? 'Gourav (SSN)' : 'Navateja',
            color: currentUserRole === 'owner' ? '#f59e0b' : '#3b82f6',
            role: currentUserRole,
            isTyping: !isSaved,
          }),
        });
        if (res.ok) {
          const data = await res.json();
          if (data?.peers && Array.isArray(data.peers)) {
            setLivePeers(data.peers);
          }
        }
      } catch {}
    };

    sendHeartbeat();
    const interval = setInterval(sendHeartbeat, 4000);
    return () => clearInterval(interval);
  }, [currentUserRole, isSaved]);

  const presencePeers: LivePresence[] = useMemo(() => {
    if (livePeers.length > 0) return livePeers;
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
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [serverRevision, setServerRevision] = useState<number | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const [titleMetadata, setTitleMetadata] = useState<TitlePageMetadata>(() => {
    const saved = localStorage.getItem('openscript_title_metadata');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed.title === 'THE GLASS COUNTER' || parsed.title === 'THE NEON DRIFT') {
          localStorage.removeItem('openscript_title_metadata');
        } else {
          return parsed;
        }
      } catch {}
    }
    return {
      title: 'UNTITLED SCREENPLAY',
      credit: 'written by',
      author: 'Author Name',
      basedOn: '',
      contact: '',
      draftLabel: 'First Draft',
      draftDate: new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      showTitlePage: true,
      watermarkText: 'CONFIDENTIAL',
      showWatermark: false,
    };
  });

  const [scriptHtml, setScriptHtml] = useState<string>(() => {
    const saved = localStorage.getItem('openscript_draft_html');
    if (saved) {
      if (saved.includes('MAYA') && saved.includes('twenty minutes ago')) {
        localStorage.removeItem('openscript_draft_html');
      } else {
        return saved;
      }
    }
    return INITIAL_SCRIPT_HTML;
  });

  const [fountainText, setFountainText] = useState<string>(() => {
    const saved = localStorage.getItem('openscript_draft_fountain');
    if (saved) {
      if (saved.includes('MAYA') && saved.includes('twenty minutes ago')) {
        localStorage.removeItem('openscript_draft_fountain');
      } else {
        return saved;
      }
    }
    return `EXT. CITY STREET - DAY\n\nA quiet morning. Sunlight filters through the skyscrapers as the city begins to move.\n\nWRITER\nEvery story begins with a blank page.`;
  });

  const [editorInstance, setEditorInstance] = useState<any>(null);
  const [sidebarOpen, setSidebarOpen] = useState(true);

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

        const res = await fetch(`/api/v1/documents/${documentId}`, {
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

  const handleAddNote = async (category: ScriptNoteCategory, content: string, blockId?: string, selectedText?: string) => {
    const authorName = currentUserRole === 'owner' ? 'Gourav (SSN)' : 'Navateja';
    const authorColor = currentUserRole === 'owner' ? '#f59e0b' : '#3b82f6';
    const blockTargetId = blockId || '00000000-0000-0000-0000-000000000001';

    try {
      const res = await fetch(`/api/v1/documents/${documentId}/notes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          blockId: blockTargetId,
          authorName,
          authorColor,
          category,
          content,
          selectedText,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.note) {
          setNotes((prev) => [data.note, ...prev]);
          return;
        }
      }
    } catch {}

    const newNote: ScriptNote = {
      id: crypto.randomUUID(),
      blockId: blockTargetId,
      documentId,
      authorName,
      authorColor,
      category,
      content,
      selectedText,
      createdAt: new Date().toISOString(),
      resolved: false,
      replies: [],
    };
    setNotes((prev) => [newNote, ...prev]);
    setIsNotesPanelOpen(true);
  };

  const handleAddReply = async (noteId: string, replyContent: string) => {
    const authorName = currentUserRole === 'owner' ? 'Gourav (SSN)' : 'Navateja';
    const authorColor = currentUserRole === 'owner' ? '#f59e0b' : '#3b82f6';

    try {
      const res = await fetch(`/api/v1/notes/${noteId}/replies`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ authorName, authorColor, content: replyContent }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.reply) {
          setNotes((prev) =>
            prev.map((n) => (n.id === noteId ? { ...n, replies: [...(n.replies || []), data.reply] } : n))
          );
          return;
        }
      }
    } catch {}

    const replyItem = {
      id: crypto.randomUUID(),
      authorName,
      authorColor,
      content: replyContent,
      createdAt: new Date().toISOString(),
    };
    setNotes((prev) =>
      prev.map((n) => (n.id === noteId ? { ...n, replies: [...(n.replies || []), replyItem] } : n))
    );
  };

  const handleToggleResolve = async (noteId: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    try {
      await fetch(`/api/v1/notes/${noteId}/resolve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isResolved: nextStatus }),
      });
    } catch {}

    setNotes((prev) =>
      prev.map((n) =>
        n.id === noteId
          ? { ...n, resolved: nextStatus, resolvedAt: nextStatus ? new Date().toISOString() : undefined }
          : n
      )
    );
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      await fetch(`/api/v1/notes/${noteId}`, { method: 'DELETE' });
    } catch {}
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
  };

  const handleInviteCollaborator = async (email: string, role: CollaboratorRole) => {
    try {
      const res = await fetch('/api/v1/projects/00000000-0000-0000-0000-000000000000/collaborators', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, role }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data?.collaborator) {
          setCollaborators((prev) => [...prev, data.collaborator]);
          return;
        }
      }
    } catch {}

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

  const handleUpdateCollaboratorRole = async (userId: string, role: CollaboratorRole) => {
    try {
      await fetch(`/api/v1/projects/00000000-0000-0000-0000-000000000000/collaborators/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ role }),
      });
    } catch {}

    setCollaborators((prev) =>
      prev.map((c) => (c.userId === userId ? { ...c, role } : c))
    );
  };

  const handleRemoveCollaborator = async (userId: string) => {
    try {
      await fetch(`/api/v1/projects/00000000-0000-0000-0000-000000000000/collaborators/${userId}`, {
        method: 'DELETE',
      });
    } catch {}
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

  const handleAddScene = (insertAfterSceneIndex?: number | any) => {
    const targetInsertIndex = typeof insertAfterSceneIndex === 'number' ? insertAfterSceneIndex : undefined;

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
    
    const newSceneNodes = [
      { 
        type: 'sceneHeading', 
        attrs: { 
          sceneNumber: sceneNumberAttr,
          revisionMark: false,
          revisionColor: null 
        },
        content: [{ type: 'text', text: defaultSlugline }] 
      },
      { 
        type: 'action', 
        attrs: { 
          revisionMark: false,
          revisionColor: null 
        },
        content: [{ type: 'text', text: 'Action description...' }] 
      }
    ];

    if (editorInstance) {
      if (
        targetInsertIndex !== undefined &&
        targetInsertIndex >= 0 &&
        targetInsertIndex < scenes.length - 1
      ) {
        let headingIndex = 0;
        let targetPos: number | null = null;
        editorInstance.state.doc.descendants((node: any, pos: number) => {
          if (node.type.name === 'sceneHeading') {
            if (headingIndex === targetInsertIndex + 1) {
              targetPos = pos;
              return false;
            }
            headingIndex++;
          }
        });

        if (targetPos !== null) {
          editorInstance.chain().focus().insertContentAt(targetPos, newSceneNodes).run();
          handleEditorUpdate(editorInstance.getHTML());
          setTimeout(() => {
            scrollToScene(targetInsertIndex + 1);
          }, 150);
          return;
        }
      }

      editorInstance.chain().focus('end').insertContent(newSceneNodes).run();
      handleEditorUpdate(editorInstance.getHTML());
    } else {
      const addedHtml = `<div class="script-scene-heading" data-scene-number="${sceneNumberAttr}">${defaultSlugline}</div><div class="script-action">Action description...</div>`;
      setScriptHtml((prev) => prev + addedHtml);
    }
    
    setTimeout(() => {
      scrollToScene(scenes.length);
    }, 150);
  };

  const handleDeleteScene = (sceneIndex: number) => {
    if (sceneIndex < 0 || sceneIndex >= scenes.length) return;

    if (editorInstance) {
      let headingIndex = 0;
      let targetStart: number | null = null;
      let targetEnd: number | null = null;

      editorInstance.state.doc.descendants((node: any, pos: number) => {
        if (node.type.name === 'sceneHeading') {
          if (headingIndex === sceneIndex) {
            targetStart = pos;
          } else if (headingIndex === sceneIndex + 1 && targetStart !== null && targetEnd === null) {
            targetEnd = pos;
            return false;
          }
          headingIndex++;
        }
      });

      if (targetStart !== null) {
        if (targetEnd === null) {
          targetEnd = editorInstance.state.doc.content.size;
        }

        if (scenes.length <= 1) {
          const defaultSlugline = 'INT. SCENE 1 - DAY';
          editorInstance.chain().focus().setContent([
            {
              type: 'sceneHeading',
              attrs: { sceneNumber: '1' },
              content: [{ type: 'text', text: defaultSlugline }],
            },
            {
              type: 'action',
              content: [{ type: 'text', text: 'Action description begins here.' }],
            },
          ]).run();
        } else {
          editorInstance.view.dispatch(editorInstance.state.tr.delete(targetStart, targetEnd));
        }

        handleEditorUpdate(editorInstance.getHTML());
        setIsSaved(false);
        return;
      }
    }

    const remainingScenes = scenes.filter((_, idx) => idx !== sceneIndex);
    const newHtml = remainingScenes.length > 0
      ? remainingScenes.map((s) => s.sceneHtml || fountainToHtml(s.fountainText)).join('')
      : fountainToHtml('INT. SCENE 1 - DAY\n\nAction description begins here.');
    const newFountain = remainingScenes.length > 0
      ? remainingScenes.map((s) => s.fountainText).join('\n\n')
      : 'INT. SCENE 1 - DAY\n\nAction description begins here.';
    setScriptHtml(newHtml);
    setFountainText(newFountain);
    setIsSaved(false);
  };

  // Reorder scenes directly from the Beat Board (Stories #11 & #16)
  const handleReorderScenes = (fromIndex: number, toIndex: number) => {
    if (fromIndex < 0 || fromIndex >= scenes.length || toIndex < 0 || toIndex >= scenes.length) return;
    const reordered = [...scenes];
    const [moved] = reordered.splice(fromIndex, 1);
    reordered.splice(toIndex, 0, moved);

    // Exact HTML preservation prevents lossy conversion of dialogues into action blocks
    const reorderedHtml = reordered.map((s) => s.sceneHtml || fountainToHtml(s.fountainText)).join('');
    const reorderedFountain = reordered.map((s) => s.fountainText).join('\n\n');
    setScriptHtml(reorderedHtml);
    setFountainText(reorderedFountain);
    if (editorInstance) {
      editorInstance.commands.setContent(reorderedHtml);
    }
    setIsSaved(false);
  };

  // Drag and Drop File Import (Supports Final Draft, Scrivener, Highland, etc.)
  const handleDropFile = async (e: React.DragEvent) => {
    e.preventDefault();
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const firstEntry = items[0].webkitGetAsEntry?.();
      if (firstEntry && firstEntry.isDirectory) {
        setDroppedFolderEntry(firstEntry);
        setDroppedImportFile(null);
        setIsImportModalOpen(true);
        return;
      }
    }

    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    setDroppedFolderEntry(null);
    setDroppedImportFile(file);
    setIsImportModalOpen(true);
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

  const handleSaveToLocalDisk = async () => {
    try {
      const blocks = htmlToBlocks(scriptHtml);
      const res = await saveScreenplayToLocalDisk({
        blocks,
        metadata: titleMetadata,
        sceneTakes,
        notes,
        revisionNumber,
        activeRevisionColor,
      });

      if (res.success && res.filename) {
        setLocalSaveNotification(res.filename);
        setTimeout(() => setLocalSaveNotification(null), 4000);
      }
    } catch (err) {
      console.error('Failed to save to local disk:', err);
    }
  };

  useEffect(() => {
    const handleGlobalSaveKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSaveToLocalDisk();
      }
    };
    window.addEventListener('keydown', handleGlobalSaveKey);
    return () => window.removeEventListener('keydown', handleGlobalSaveKey);
  }, [scriptHtml, titleMetadata, sceneTakes, notes, revisionNumber, activeRevisionColor]);

  const handleDownloadPdf = () => {
    try {
      const blocks = htmlToBlocks(scriptHtml);
      exportScreenplayPdf({
        blocks,
        metadata: titleMetadata,
        showWatermark: titleMetadata.showWatermark,
        watermarkText: titleMetadata.watermarkText,
        selectedActId,
        sceneFolderMap,
      });
    } catch (err) {
      console.error('PDF Export Error:', err);
      handlePrintPdf();
    }
  };

  const handlePrintPdf = () => {
    if (activeMode !== 'screenplay') {
      setActiveMode('screenplay');
      setTimeout(() => {
        window.print();
      }, 300);
      return;
    }
    window.print();
  };

  const handleSaveCheckpoint = async () => {
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

      const res = await fetch(`/api/v1/documents/${documentId}`, {
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
      setIsSaved(true);
    } catch {
      setIsSaved(true);
    }
  };

  // Global Studio Ergonomics & Shortcuts Engine (Lock, Track, Notes, Save, PDF, Views)
  useEffect(() => {
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      const isAlt = e.altKey;
      const isCtrlOrCmd = e.ctrlKey || e.metaKey;
      const isShift = e.shiftKey;

      // 1. Save Checkpoint: Ctrl+S or Alt+S
      if ((isCtrlOrCmd && key === 's') || (isAlt && key === 's')) {
        e.preventDefault();
        handleSaveCheckpoint();
        return;
      }

      // 2. Lock Script: Alt+L or Ctrl+Shift+L
      if ((isAlt && key === 'l') || (isCtrlOrCmd && isShift && key === 'l')) {
        e.preventDefault();
        setIsScriptLocked((prev) => !prev);
        return;
      }

      // 3. Track Revisions: Alt+T or Ctrl+Shift+T
      if ((isAlt && key === 't') || (isCtrlOrCmd && isShift && key === 't')) {
        e.preventDefault();
        setIsTrackingRevisions((prev) => !prev);
        return;
      }

      // 4. ScriptNotes Panel: Alt+N or Ctrl+Shift+N
      if ((isAlt && key === 'n') || (isCtrlOrCmd && isShift && key === 'n')) {
        e.preventDefault();
        setIsNotesPanelOpen((prev) => !prev);
        return;
      }

      // 5. Focus Mode: Alt+F
      if (isAlt && key === 'f') {
        e.preventDefault();
        setFocusMode((prev) => !prev);
        return;
      }

      // 6. Sprint Stopwatch Widget: Alt+W
      if (isAlt && key === 'w') {
        e.preventDefault();
        setIsSprintWidgetOpen((prev) => !prev);
        return;
      }

      // 7. Print / PDF Export: Alt+P
      if (isAlt && key === 'p') {
        e.preventDefault();
        handlePrintPdf();
        return;
      }

      // 8. View Navigation: Alt+E, Alt+B, Alt+R, Alt+U
      if (isAlt && key === 'e') {
        e.preventDefault();
        switchMode('screenplay');
        return;
      }
      if (isAlt && key === 'b') {
        e.preventDefault();
        switchMode('beats');
        return;
      }
      if (isAlt && key === 'r') {
        e.preventDefault();
        switchMode('reports');
        return;
      }
      if (isAlt && key === 'u') {
        e.preventDefault();
        switchMode('fountain');
        return;
      }

      // 9. Shortcuts Guide: Alt+/ or Ctrl+/ or ? (when not inside typing elements)
      if ((isAlt && key === '/') || (isCtrlOrCmd && key === '/')) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }
      const targetTag = (e.target as HTMLElement)?.tagName;
      const isEditable = (e.target as HTMLElement)?.isContentEditable;
      if (e.key === '?' && !['INPUT', 'TEXTAREA'].includes(targetTag) && !isEditable) {
        e.preventDefault();
        setIsShortcutsModalOpen((prev) => !prev);
        return;
      }
    };

    window.addEventListener('keydown', handleGlobalKeyDown);
    return () => window.removeEventListener('keydown', handleGlobalKeyDown);
  }, [documentId, fountainText, revisionNumber, titleMetadata, activeRevisionColor, isScriptLocked]);

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

  const currentRevDraft = PRODUCTION_REVISION_SEQUENCE.find((r) => r.color === activeRevisionColor) || PRODUCTION_REVISION_SEQUENCE[0];

  const handleSelectRevision = (rev: RevisionDraftInfo) => {
    setActiveRevisionColor(rev.color);
    setTitleMetadata((prev) => ({
      ...prev,
      draftLabel: `${rev.name.split(' (')[0]} Production Draft`,
    }));
    setIsRevisionMenuOpen(false);
  };

  const effectiveSidebarOpen = sidebarOpen && !focusMode;

  // Compulsory Authentication Gate: Users must sign up or sign in to access the application
  if (!authToken) {
    return (
      <div className="min-h-screen bg-[#0a0b0e] flex items-center justify-center p-4">
        <AuthModal
          isOpen={true}
          isCompulsory={true}
          onClose={() => {}}
          onAuthSuccess={handleAuthSuccess}
          defaultMode="register"
        />
      </div>
    );
  }

  if (isDashboardOpen) {
    return (
      <div className="min-h-screen bg-[#0a0b0e]">
        <ProjectDashboard
          onOpenProject={handleOpenProject}
          onOpenImportModal={() => {
            setDroppedImportFile(null);
            setIsImportModalOpen(true);
          }}
          onOpenAuthModal={(mode) => {
            setAuthModalMode(mode);
            setIsAuthModalOpen(true);
          }}
          onOpenProfileModal={() => {
            setSelectedPeerProfile(null);
            setIsProfileModalOpen(true);
          }}
          currentUser={currentUser || { displayName: 'Screenwriter', role: 'owner' }}
        />

        <ImportModal
          isOpen={isImportModalOpen}
          onClose={() => {
            setIsImportModalOpen(false);
            setDroppedImportFile(null);
            setDroppedFolderEntry(null);
          }}
          onImportScreenplay={handleApplyImportedScreenplay}
          droppedFile={droppedImportFile}
          droppedFolderEntry={droppedFolderEntry}
        />
      </div>
    );
  }

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
        data-tour="sidebar"
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
              onDeleteScene={handleDeleteScene}
              onExportSelectedScenes={handleExportSelectedScenes}
              currentUserRole={currentUserRole}
              onOpenTakes={handleOpenSceneTakes}
              selectedActId={selectedActId}
              onSelectAct={setSelectedActId}
              folders={sceneFolders}
              onFoldersChange={handleUpdateSceneFolders}
              sceneFolderMap={sceneFolderMap}
              onFolderMapChange={handleUpdateSceneFolderMap}
            />
          </div>

          {/* Sidebar Footer Scene & Word Stats */}
          <div className="p-3 border-t border-[#1c1e24] text-[11px] text-gray-400 flex items-center justify-between font-mono">
            <span className="text-gray-300 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>{scenes.length} {scenes.length === 1 ? 'Scene' : 'Scenes'}</span>
            </span>
            <span className="text-gray-500">{metrics.words} words</span>
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
        <header className={`no-print border-b border-[#1c1e24] bg-[#0c0d0f]/95 backdrop-blur-md px-4 flex items-center justify-between transition-all duration-300 ease-in-out z-40 shrink-0 ${
          isHeaderVisible
            ? 'h-14 translate-y-0 opacity-100 shadow-xl'
            : 'h-0 -translate-y-full opacity-0 pointer-events-none border-transparent overflow-hidden'
        }`}>
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

            <button
              onClick={() => {
                saveCurrentProject();
                setIsDashboardOpen(true);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#14161d] hover:bg-[#1f222b] border border-[#242835] text-xs font-mono text-gray-300 hover:text-white transition-colors shadow-sm"
              title="Open Project Dashboard (switch or create scripts)"
            >
              <Layers className="w-3.5 h-3.5 text-amber-500" />
              <span className="hidden sm:inline">Projects</span>
            </button>

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
                <span>Page {currentPage} of {documentTotalPages || metrics.estimatedPages} ({metrics.estimatedPages} mins)</span>
              </span>
            </div>
          </div>

          {/* Studio Header Toolbar & Action Clusters */}
          <div className="flex items-center gap-2">
            {/* 1. Writing Ergonomics Cluster */}
            <div className="hidden lg:flex items-center bg-[#14161d] border border-[#242835] rounded-xl p-0.5 shadow-sm">
              <button
                onClick={() => setIsSprintWidgetOpen(!isSprintWidgetOpen)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  isSprintWidgetOpen
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-[#1f222b]'
                }`}
                title="Writing Sprint Stopwatch & Goals (Alt+W)"
              >
                <Zap className="w-3.5 h-3.5 text-amber-400" />
                <span>Sprint</span>
              </button>

              <button
                onClick={() => setIsTypewriterMode(!isTypewriterMode)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  isTypewriterMode
                    ? 'bg-amber-500/20 text-amber-300 font-semibold'
                    : 'text-gray-400 hover:text-white hover:bg-[#1f222b]'
                }`}
                title="Typewriter Scrolling: Keep cursor vertically centered"
              >
                <span>Typewriter</span>
              </button>

              {allScriptCharacters.length > 0 && (
                <select
                  value={isolatedCharacter || ''}
                  onChange={(e) => setIsolatedCharacter(e.target.value || null)}
                  className="px-2 py-1 bg-transparent text-gray-300 text-xs font-mono focus:outline-none cursor-pointer border-l border-[#242835] ml-0.5 pl-2"
                  title="Dialogue Voice Isolator: Highlight a single character's dialogue"
                >
                  <option value="" className="bg-[#14161d]">Voice: All</option>
                  {allScriptCharacters.map((c) => (
                    <option key={c} value={c} className="bg-[#14161d]">{c}</option>
                  ))}
                </select>
              )}
            </div>

            {/* 2. Production Revision & Lock Cluster */}
            <div className="flex items-center bg-[#14161d] border border-[#242835] rounded-xl p-0.5 shadow-sm">
              {/* Revision Draft Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setIsRevisionMenuOpen(!isRevisionMenuOpen)}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#1f222b] text-xs font-mono transition-colors"
                  title="Select Revision Draft Color"
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
                      Production Revision Sequence
                    </div>
                    {PRODUCTION_REVISION_SEQUENCE.map((rev) => (
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

              <div className="h-4 w-[1px] bg-[#242835] mx-0.5" />

              {/* Lock Script Mode Toggle */}
              <button
                onClick={() => setIsScriptLocked(!isScriptLocked)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  isScriptLocked
                    ? 'bg-amber-500/20 text-amber-300 font-semibold border border-amber-500/40'
                    : 'text-gray-400 hover:text-white hover:bg-[#1f222b]'
                }`}
                title={isScriptLocked ? 'Script is locked: Scene numbers are frozen (Alt+L)' : 'Lock Script: Freeze scene numbers (Alt+L)'}
              >
                {isScriptLocked ? <Lock className="w-3.5 h-3.5 text-amber-400" /> : <Unlock className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{isScriptLocked ? 'Locked' : 'Lock'}</span>
              </button>

              {/* Track Revisions Toggle */}
              <button
                onClick={() => setIsTrackingRevisions(!isTrackingRevisions)}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-mono transition-all ${
                  isTrackingRevisions
                    ? 'bg-red-500/20 text-red-300 font-semibold border border-red-500/40'
                    : 'text-gray-400 hover:text-white hover:bg-[#1f222b]'
                }`}
                title={isTrackingRevisions ? 'Auto-marking edits with right-margin revision asterisks (*) (Alt+T)' : 'Track Revisions: Auto-mark asterisks (Alt+T)'}
              >
                <span className="text-red-400 font-bold leading-none text-base">*</span>
                <span className="hidden md:inline">{isTrackingRevisions ? 'Tracking' : 'Track'}</span>
              </button>
            </div>

            {/* 3. Export & File Cluster */}
            <div data-tour="header-actions" className="flex items-center bg-[#14161d] border border-[#242835] rounded-xl p-0.5 shadow-sm">
              <button
                onClick={() => {
                  setDroppedImportFile(null);
                  setIsImportModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#1f222b] text-xs font-mono text-gray-300 transition-colors"
                title="Import screenplay from Final Draft, Scrivener, Highland, or text"
              >
                <Upload className="w-3.5 h-3.5 text-amber-500" />
                <span>Import</span>
              </button>

              <button
                onClick={() => setIsExportModalOpen(true)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#1f222b] text-xs font-mono text-gray-300 hover:text-white transition-colors"
                title="Export screenplay (PDF, OpenScript, Final Draft .fdx, Fountain .fountain)"
              >
                <Download className="w-3.5 h-3.5 text-amber-500" />
                <span>Export</span>
              </button>

              {/* Save to Local Disk (Chromium File System Access / Native Disk Save) */}
              <button
                onClick={handleSaveToLocalDisk}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg hover:bg-[#1f222b] text-xs font-mono text-gray-300 hover:text-white transition-colors"
                title="Save directly to Local Disk (Ctrl+S / Chromium File System Access)"
              >
                <Save className="w-3.5 h-3.5 text-emerald-400" />
                <span className="hidden sm:inline">Save Disk</span>
              </button>

              {/* Primary PDF Export Button */}
              <button
                onClick={handleDownloadPdf}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-black shadow-md shadow-amber-500/20 transition-all ml-0.5"
                title="Download formatted Screenplay PDF (.pdf)"
              >
                <Download className="w-3.5 h-3.5 text-black" />
                <span>PDF</span>
              </button>
            </div>

            {/* Cloud Storage & Backup Snapshots */}
            <button
              onClick={() => setIsCloudStorageModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#14161d] hover:bg-[#1f222b] border border-[#242835] text-xs font-mono text-gray-300 hover:text-white transition-colors shadow-sm"
              title="Cloud Storage & Backup Snapshots (S3 / Cloudflare R2 / Local)"
            >
              <Cloud className="w-3.5 h-3.5 text-blue-400" />
              <span className="hidden sm:inline">Cloud</span>
            </button>

            

            {/* 4. Single Definitive Keyboard Shortcuts Button */}
            <button
              onClick={() => setIsShortcutsModalOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#14161d] hover:bg-[#1f222b] border border-[#242835] text-xs font-mono text-gray-300 hover:text-white transition-colors shadow-sm"
              title="View Complete Keyboard Shortcuts Guide (? or Alt+/)"
            >
              <Keyboard className="w-3.5 h-3.5 text-amber-400" />
              <span className="hidden xl:inline">Shortcuts</span>
              <kbd className="text-[10px] bg-[#0c0d11] text-amber-300 px-1.5 py-0.5 rounded border border-[#2b2e3b] font-mono">?</kbd>
            </button>

            {/* 5. Phase 3 Collaboration & User Profile Bar */}
            <div className="pl-1 border-l border-[#242835] ml-0.5">
              <CollaborationBar
                presencePeers={presencePeers}
                currentUserRole={currentUserRole}
                currentUser={currentUser}
                unresolvedNotesCount={notes.filter((n) => !n.resolved).length}
                isNotesPanelOpen={isNotesPanelOpen}
                onToggleNotesPanel={() => setIsNotesPanelOpen(!isNotesPanelOpen)}
                onOpenShareModal={() => setIsShareModalOpen(true)}
                onOpenProfileModal={() => {
                  setSelectedPeerProfile(null);
                  setIsProfileModalOpen(true);
                }}
                onSelectPeerProfile={(peer) => {
                  setSelectedPeerProfile({
                    id: peer.userId,
                    email: peer.userId === '11111111-1111-1111-1111-111111111111' ? 'gourav@ssnpictures.in' : peer.userId === '22222222-2222-2222-2222-222222222222' ? 'navateja@ssnpictures.in' : 'sarah.prod@studio.com',
                    displayName: peer.displayName,
                    role: peer.role,
                    color: peer.color,
                    studio: 'SSN Pictures Studio',
                  });
                  setIsProfileModalOpen(true);
                }}
              />
            </div>
          </div>
        </header>

        {/* Workspace Canvas Area */}
        <div 
          onScroll={handleWorkspaceScroll} 
          onMouseMove={(e) => {
            if (e.clientY < 75 && !isHeaderVisible) {
              setIsHeaderVisible(true);
            }
          }}
          className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-[#0d0e11]"
        >
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
              onAddNoteFromSelection={(selectedText, commentText, category) => handleAddNote(category, commentText, undefined, selectedText)}
              onOpenSceneTakesForBlock={handleOpenSceneTakesForBlockText}
              onPageChange={(page, totalPages) => {
                setCurrentPage(page);
                if (totalPages) setDocumentTotalPages(totalPages);
              }}
              selectedActId={selectedActId}
              sceneFolderMap={sceneFolderMap}
              folders={sceneFolders}
              onClearActFilter={() => setSelectedActId(null)}
              isToolbarVisible={true}
              isHeaderVisible={isHeaderVisible}
              onShowHeader={() => setIsHeaderVisible(true)}
            />
          )}

          {activeMode === 'beats' && (
            <BeatBoard
              scenes={scenes}
              onOpenScene={scrollToScene}
              onAddScene={handleAddScene}
              onDeleteScene={handleDeleteScene}
              onReorderScenes={handleReorderScenes}
              currentUserRole={currentUserRole}
              onOpenTakes={handleOpenSceneTakes}
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
            <span className="text-gray-200 font-semibold">Page {currentPage} of {documentTotalPages || metrics.estimatedPages}</span>
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
              <span>{localSaveNotification ? `Saved to ${localSaveNotification}` : (isSaved ? 'Cloud Synced' : 'Saving...')}</span>
            </span>
          </div>
        </footer>
      </main>

      {/* Local Disk Save Notification Toast */}
      {localSaveNotification && (
        <aside
          aria-label="Local disk save notification"
          className="fixed bottom-12 right-6 z-50 bg-[#141720]/95 backdrop-blur-md border border-emerald-500/50 text-white px-4 py-2.5 rounded-xl shadow-2xl shadow-black/80 flex items-center gap-2.5 animate-in fade-in slide-in-from-bottom-2 duration-200"
        >
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <div className="text-xs font-mono">
            <span className="text-emerald-400 font-bold">Saved to Local Disk: </span>
            <span className="text-gray-200">{localSaveNotification}</span>
          </div>
        </aside>
      )}

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
        documentTitle={titleMetadata.title}
      />

      {/* Keyboard Shortcuts Cheatsheet Modal */}
      <KeyboardShortcutsModal
        isOpen={isShortcutsModalOpen}
        onClose={() => setIsShortcutsModalOpen(false)}
      />

      {/* Universal Screenplay Import Modal (Final Draft, Scrivener, Highland, Text) */}
      <ImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          setDroppedImportFile(null);
          setDroppedFolderEntry(null);
        }}
        onImportScreenplay={handleApplyImportedScreenplay}
        droppedFile={droppedImportFile}
        droppedFolderEntry={droppedFolderEntry}
      />

      {/* Universal Screenplay Export Modal */}
      <ExportModal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        blocks={htmlToBlocks(scriptHtml)}
        metadata={titleMetadata}
        sceneTakes={sceneTakes}
        notes={notes}
        revisionNumber={revisionNumber}
        activeRevisionColor={activeRevisionColor}
        onTriggerPdfPrint={handlePrintPdf}
        selectedActId={selectedActId}
        sceneFolderMap={sceneFolderMap}
        folders={sceneFolders}
      />

            {/* Interactive On-Screen Spotlight Tour */}
      <InteractiveTour
        isOpen={isTourOpen}
        onClose={() => {
          localStorage.setItem('openscript_seen_guide_tour', 'true');
          if (currentUser?.id || currentUser?.email) {
            localStorage.setItem(`openscript_tour_seen_${currentUser.id || currentUser.email}`, 'true');
          }
          setIsTourOpen(false);
        }}
      />

      {/* Cloud Storage & Automated Snapshots Modal */}
      <CloudStorageModal
        isOpen={isCloudStorageModalOpen}
        onClose={() => setIsCloudStorageModalOpen(false)}
        projectId={getActiveProjectId()}
        blocks={htmlToBlocks(scriptHtml)}
        metadata={titleMetadata}
        sceneTakes={sceneTakes}
        notes={notes}
        revisionNumber={revisionNumber}
        activeRevisionColor={activeRevisionColor}
      />

      {/* Scene Takes & Alternate Drafts Modal */}
      <SceneTakesModal
        isOpen={isSceneTakesModalOpen}
        onClose={() => setIsSceneTakesModalOpen(false)}
        scene={selectedSceneForTakes}
        takes={sceneTakes}
        currentUserRole={currentUserRole}
        currentUserName={currentUser?.displayName || 'Screenwriter'}
        onFinalizeTake={handleFinalizeSceneTake}
        onProposeTake={handleProposeSceneTake}
      />

      {/* User Profile Modal */}
      <UserProfileModal
        isOpen={isProfileModalOpen}
        onClose={() => {
          setIsProfileModalOpen(false);
          setSelectedPeerProfile(null);
        }}
        user={selectedPeerProfile || currentUser || {
          id: 'user',
          email: '',
          displayName: 'Screenwriter',
          role: 'owner',
          studio: 'OpenScript Studio',
          color: '#f59e0b',
        }}
        onLogout={handleLogout}
        onOpenLogin={() => setIsAuthModalOpen(true)}
      />

      {/* Authentication & Login/Register Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        onAuthSuccess={handleAuthSuccess}
        defaultMode={authModalMode}
      />
    </div>
  );
}
