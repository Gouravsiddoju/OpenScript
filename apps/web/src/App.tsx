import React, { useState, useEffect, useMemo } from 'react';
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
  Plus
} from 'lucide-react';
import { ScreenplayEditor } from './components/ScreenplayEditor';
import { FountainView } from './components/FountainView';
import { ProductionReports } from './components/ProductionReports';
import { SceneNavigator, SceneItem } from './components/SceneNavigator';
import { fountainToHtml } from '@openscript/fountain';

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
      };
      currentLines = [upper];
    } else if (currentScene) {
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
    scenes.push(currentScene);
  }

  return scenes;
}

export default function App() {
  const [activeMode, setActiveMode] = useState<'screenplay' | 'fountain' | 'reports'>('screenplay');
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

  // Auto-save to localStorage
  useEffect(() => {
    localStorage.setItem('openscript_draft_html', scriptHtml);
    localStorage.setItem('openscript_draft_fountain', fountainText);
    setIsSaved(true);
  }, [scriptHtml, fountainText]);

  // Extract Scene Items for Final Draft Navigator
  const scenes = useMemo(() => {
    return extractScenes(scriptHtml);
  }, [scriptHtml]);

  // Word count & estimated pages
  const metrics = useMemo(() => {
    const parser = new DOMParser();
    const doc = parser.parseFromString(scriptHtml, 'text/html');
    const text = doc.body.textContent || '';
    const words = text.split(/\s+/).filter(Boolean).length;
    // Hollywood rule of thumb: ~200-250 words per page
    const estimatedPages = Math.max(1, Math.ceil(words / 220));
    return { words, estimatedPages };
  }, [scriptHtml]);

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

  const switchMode = (newMode: 'screenplay' | 'fountain' | 'reports') => {
    if (activeMode === 'fountain' && newMode === 'screenplay') {
      // Sync edits made in Fountain source back into Screenplay Paper HTML
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
    const newSceneNumber = scenes.length + 1;
    const defaultSlugline = `INT. SCENE ${newSceneNumber} - DAY`;
    
    if (editorInstance) {
      editorInstance.chain().focus('end').insertContent([
        { type: 'sceneHeading', content: [{ type: 'text', text: defaultSlugline }] },
        { type: 'action', content: [{ type: 'text', text: '' }] }
      ]).run();
    } else {
      const addedHtml = `<div class="script-scene-heading">${defaultSlugline}</div><div class="script-action"></div>`;
      setScriptHtml((prev) => prev + addedHtml);
    }
    
    setTimeout(() => {
      scrollToScene(scenes.length);
    }, 150);
  };

  const handleExportFountain = () => {
    const blob = new Blob([fountainText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'OpenScript_Screenplay.fountain';
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

  return (
    <div className="flex h-screen bg-[#0c0d0e] text-[#e5e5e5] overflow-hidden font-sans">
      {/* 1. Left Sidebar / Final Draft Outliner & Scene Navigator */}
      <aside
        className={`no-print border-r border-[#1e2025] bg-[#090a0c] flex flex-col justify-between transition-all duration-300 z-20 ${
          sidebarOpen ? 'w-80' : 'w-0 -translate-x-full overflow-hidden'
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
                  OPENSCRIPT <span className="text-amber-500 text-xs font-mono font-normal">v0.1</span>
                </span>
                <span className="text-[10px] text-gray-500 block font-mono">openscript.ssnpictures.in</span>
              </div>
            </div>
          </div>

          {/* Document Tag Card */}
          <div className="p-3 mx-3 my-3 bg-[#131418] rounded-xl border border-[#23262e]">
            <div className="text-[11px] font-mono text-gray-400 uppercase tracking-wider">PROJECT: FIRST FEATURE</div>
            <div className="text-sm font-semibold text-white mt-0.5 truncate">The Glass Counter</div>
            <div className="text-[11px] text-amber-400 mt-1.5 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></span>
              <span>White Production Draft</span>
            </div>
          </div>

          {/* Mode Switcher */}
          <nav className="px-3 space-y-1">
            {[
              { id: 'screenplay', label: 'Screenplay Paper', icon: FileText },
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
      <main className="flex-1 flex flex-col bg-[#111215] overflow-hidden">
        {/* Top Header Bar */}
        <header className="no-print h-14 border-b border-[#1c1e24] bg-[#0c0d0f] px-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className="p-1.5 rounded-lg hover:bg-[#1a1c22] text-gray-400 hover:text-white transition-colors"
              title="Toggle Navigator"
            >
              {sidebarOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
            </button>

            <div className="flex items-center gap-2 text-xs font-mono text-gray-400">
              <span className="text-gray-200 font-semibold">{scenes[0]?.slugline || 'SCENE 1'}</span>
              <ChevronRight className="w-3.5 h-3.5 text-gray-600" />
              <span className="text-amber-500/90 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                <span>Page 1 of {metrics.estimatedPages} ({metrics.estimatedPages} mins)</span>
              </span>
            </div>

            {/* Quick Header + Add Scene Button */}
            <button
              onClick={handleAddScene}
              className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded bg-[#1c1f26] hover:bg-[#252832] text-amber-400 hover:text-amber-300 border border-amber-500/30 text-xs font-mono font-medium transition-all ml-2"
              title="Add a new Scene to your screenplay"
            >
              <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Add Scene</span>
            </button>
          </div>

          {/* Export & Action Buttons */}
          <div className="flex items-center gap-2.5">
            <button
              onClick={handleExportFountain}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#181a1f] hover:bg-[#22252c] text-xs font-mono text-gray-200 border border-[#2b2e36] transition-colors"
              title="Download standard Fountain plain-text script"
            >
              <Download className="w-3.5 h-3.5 text-amber-500" />
              <span>Export Fountain</span>
            </button>

            <button
              onClick={handlePrintPdf}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-xs font-bold text-black shadow-md shadow-amber-500/20 transition-all"
              title="Print formatted script or save as PDF"
            >
              <Printer className="w-3.5 h-3.5 text-black" />
              <span>Export PDF</span>
            </button>
          </div>
        </header>

        {/* Workspace Canvas Area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-8 flex justify-center bg-[#0d0e11]">
          {activeMode === 'screenplay' && (
            <ScreenplayEditor
              initialContent={scriptHtml}
              onUpdate={handleEditorUpdate}
              onEditorReady={(editor) => setEditorInstance(editor)}
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
      </main>
    </div>
  );
}
