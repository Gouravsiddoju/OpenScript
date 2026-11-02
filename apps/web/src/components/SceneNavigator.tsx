import { HoldButton } from './HoldButton';
import React, { useState, useMemo } from 'react';
import { CollaboratorRole, canReorderScenes } from '@openscript/screenplay-schema';
import { 
  Film, 
  Folder, 
  FolderPlus, 
  Plus, 
  ChevronDown, 
  ChevronRight, 
  CheckSquare, 
  Square, 
  Download, 
  Search, 
  Filter, 
  Layers, 
  Users, 
  ListOrdered,
  Trash2,
  GripVertical
} from 'lucide-react';

export interface SceneItem {
  id: number;
  slugline: string;
  setting: 'INT' | 'EXT' | 'INT/EXT';
  location: string;
  timeOfDay: string;
  fountainText: string;
  sceneHtml?: string;
  characters: string[];
  actionSnippet?: string;
  eighths?: string;
  hasRevisions?: boolean;
  revisedLines?: string[];
}

export interface SceneFolder {
  id: string;
  name: string;
  color: string;
}

interface SceneNavigatorProps {
  scenes: SceneItem[];
  onSelectScene: (sceneIndex: number) => void;
  onAddScene: (insertAfterSceneIndex?: number) => void;
  onDeleteScene: (sceneIndex: number) => void;
  onExportSelectedScenes: (selectedScenes: SceneItem[]) => void;
  currentUserRole?: CollaboratorRole;
  onOpenTakes?: (scene: SceneItem) => void;
  selectedActId?: string | null;
  onSelectAct?: (actId: string | null) => void;
  folders?: SceneFolder[];
  onFoldersChange?: (folders: SceneFolder[]) => void;
  sceneFolderMap?: Record<number, string>;
  onFolderMapChange?: (map: Record<number, string>) => void;
}

const DEFAULT_FOLDERS: SceneFolder[] = [];

export const SceneNavigator: React.FC<SceneNavigatorProps> = ({
  scenes,
  onSelectScene,
  onAddScene,
  onDeleteScene,
  onExportSelectedScenes,
  currentUserRole = 'owner',
  onOpenTakes,
  selectedActId = null,
  onSelectAct,
  folders: propFolders,
  onFoldersChange,
  sceneFolderMap: propSceneFolderMap,
  onFolderMapChange,
}) => {
  const canManageScenes = canReorderScenes(currentUserRole);
  // Navigation display mode preference: 'flat' (scenes only) or 'acts' (folders & acts)
  const [viewMode, setViewMode] = useState<'flat' | 'acts'>(() => {
    const saved = localStorage.getItem('openscript_outliner_view_mode');
    return saved === 'acts' ? 'acts' : 'flat';
  });

  const handleSetViewMode = (mode: 'flat' | 'acts') => {
    setViewMode(mode);
    localStorage.setItem('openscript_outliner_view_mode', mode);
  };

  const [internalFolders, setInternalFolders] = useState<SceneFolder[]>(() => {
    const saved = localStorage.getItem('openscript_scene_folders');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (
          Array.isArray(parsed) &&
          parsed.length === 3 &&
          parsed.some((p: any) => p.id === 'act-1' && p.name && p.name.includes('Act I')) &&
          parsed.some((p: any) => p.id === 'act-2' && p.name && p.name.includes('Act II')) &&
          parsed.some((p: any) => p.id === 'act-3' && p.name && p.name.includes('Act III'))
        ) {
          return [];
        }
        return parsed;
      } catch {}
    }
    return DEFAULT_FOLDERS;
  });

  const [internalSceneFolderMap, setInternalSceneFolderMap] = useState<Record<number, string>>(() => {
    const saved = localStorage.getItem('openscript_scene_folder_map');
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        if (parsed['1'] === 'act-1' && parsed['2'] === 'act-2' && Object.keys(parsed).length <= 2) {
          return {};
        }
        return parsed;
      } catch {}
    }
    return {};
  });

  const folders = propFolders ?? internalFolders;
  const setFolders = (f: SceneFolder[] | ((prev: SceneFolder[]) => SceneFolder[])) => {
    const resolved = typeof f === 'function' ? f(folders) : f;
    setInternalFolders(resolved);
    if (onFoldersChange) onFoldersChange(resolved);
  };

  const sceneFolderMap = propSceneFolderMap ?? internalSceneFolderMap;
  const setSceneFolderMap = (m: Record<number, string> | ((prev: Record<number, string>) => Record<number, string>)) => {
    const resolved = typeof m === 'function' ? m(sceneFolderMap) : m;
    setInternalSceneFolderMap(resolved);
    if (onFolderMapChange) onFolderMapChange(resolved);
  };

  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [selectedSceneIds, setSelectedSceneIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSetting, setFilterSetting] = useState<'ALL' | 'INT' | 'EXT' | 'INT/EXT'>('ALL');
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeSceneId, setActiveSceneId] = useState<number | null>(1);
  const [confirmingDeleteSceneId, setConfirmingDeleteSceneId] = useState<number | null>(null);
  const [confirmingDeleteFolderId, setConfirmingDeleteFolderId] = useState<string | null>(null);

  // Smooth Drag & Drop State between Acts & Folders
  const [draggedSceneId, setDraggedSceneId] = useState<number | null>(null);
  const [dragOverFolderId, setDragOverFolderId] = useState<string | null>(null);

  const saveFolders = (newFolders: SceneFolder[]) => {
    setFolders(newFolders);
    localStorage.setItem('openscript_scene_folders', JSON.stringify(newFolders));
  };

  const saveFolderMap = (newMap: Record<number, string>) => {
    setSceneFolderMap(newMap);
    localStorage.setItem('openscript_scene_folder_map', JSON.stringify(newMap));
  };

  const toggleFolderCollapse = (folderId: string) => {
    setCollapsedFolders((prev) => ({ ...prev, [folderId]: !prev[folderId] }));
  };

  const handleAddFolder = () => {
    if (!newFolderName.trim()) return;
    const newFolder: SceneFolder = {
      id: `folder-${Date.now()}`,
      name: newFolderName.trim(),
      color: 'border-purple-500/40 text-purple-400',
    };
    saveFolders([...folders, newFolder]);
    setNewFolderName('');
    setIsAddingFolder(false);
  };

  const handleDeleteFolder = (folderId: string) => {
    const nextFolders = folders.filter((f) => f.id !== folderId);
    saveFolders(nextFolders);
    const nextMap = { ...sceneFolderMap };
    Object.entries(nextMap).forEach(([k, fId]) => {
      if (fId === folderId) {
        delete nextMap[Number(k)];
      }
    });
    saveFolderMap(nextMap);
    setConfirmingDeleteFolderId(null);
  };

  const handleDeleteSceneConfirmed = (sceneId: number) => {
    const sceneIndex = sceneId - 1;
    const nextMap: Record<number, string> = {};
    Object.entries(sceneFolderMap).forEach(([k, fId]) => {
      const num = Number(k);
      if (num < sceneId) {
        nextMap[num] = fId;
      } else if (num > sceneId) {
        nextMap[num - 1] = fId;
      }
    });
    saveFolderMap(nextMap);

    setSelectedSceneIds((prev) =>
      prev.filter((id) => id !== sceneId).map((id) => (id > sceneId ? id - 1 : id))
    );

    if (activeSceneId === sceneId) {
      setActiveSceneId(Math.max(1, sceneId - 1));
    } else if (activeSceneId && activeSceneId > sceneId) {
      setActiveSceneId(activeSceneId - 1);
    }

    setConfirmingDeleteSceneId(null);
    onDeleteScene(sceneIndex);
  };

  const handleMoveSceneToFolder = (sceneId: number, targetFolderId: string) => {
    const nextMap = { ...sceneFolderMap };
    if (targetFolderId === 'unassigned') {
      delete nextMap[sceneId];
    } else {
      nextMap[sceneId] = targetFolderId;
    }
    saveFolderMap(nextMap);
  };

  const handleCreateSceneInFolder = (folderId: string) => {
    const folderScenes = scenesByFolder[folderId] || [];
    let insertAfterIndex: number | undefined = undefined;
    if (folderScenes.length > 0) {
      const lastScene = folderScenes[folderScenes.length - 1];
      const foundIdx = scenes.findIndex((s) => s.id === lastScene.id);
      if (foundIdx !== -1) {
        insertAfterIndex = foundIdx;
      }
    }

    const targetId = insertAfterIndex !== undefined ? insertAfterIndex + 2 : scenes.length + 1;
    const nextMap: Record<number, string> = {};
    Object.entries(sceneFolderMap).forEach(([k, fId]) => {
      const num = Number(k);
      if (insertAfterIndex !== undefined && num >= targetId) {
        nextMap[num + 1] = fId;
      } else {
        nextMap[num] = fId;
      }
    });
    nextMap[targetId] = folderId;
    saveFolderMap(nextMap);

    onAddScene(insertAfterIndex);
  };

  const toggleSelectScene = (sceneId: number) => {
    setSelectedSceneIds((prev) =>
      prev.includes(sceneId) ? prev.filter((id) => id !== sceneId) : [...prev, sceneId]
    );
  };

  const handleExportSelected = () => {
    const selected = scenes.filter((s) => selectedSceneIds.includes(s.id));
    if (selected.length > 0) {
      onExportSelectedScenes(selected);
    }
  };

  const filteredScenes = useMemo(() => {
    return scenes.filter((scene) => {
      const matchesSearch =
        scene.slugline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scene.characters.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (scene.actionSnippet && scene.actionSnippet.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesSetting =
        filterSetting === 'ALL' || scene.setting === filterSetting;
      return matchesSearch && matchesSetting;
    });
  }, [scenes, searchQuery, filterSetting]);

  const scenesByFolder = useMemo(() => {
    const grouped: Record<string, SceneItem[]> = {};
    folders.forEach((f) => {
      grouped[f.id] = [];
    });
    grouped['unassigned'] = [];

    filteredScenes.forEach((scene) => {
      const folderId = sceneFolderMap[scene.id] || 'unassigned';
      if (!grouped[folderId]) {
        grouped[folderId] = [];
      }
      grouped[folderId].push(scene);
    });

    return grouped;
  }, [filteredScenes, folders, sceneFolderMap]);

  return (
    <div className="flex flex-col h-full overflow-hidden text-xs bg-[#090a0c]">
      {/* 1. View Mode Switcher Header: Clean Choice Between Scenes or Acts / Folders */}
      <div className="p-2.5 border-b border-[#1c1e24] flex items-center justify-between gap-2 bg-[#0d0e12]">
        <div className="flex items-center bg-[#15171e] p-0.5 rounded-lg border border-[#232631]">
          <button
            onClick={() => handleSetViewMode('flat')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-mono transition-all ${
              viewMode === 'flat'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Clean chronological scenes list"
          >
            <ListOrdered className="w-3.5 h-3.5" />
            <span>Scenes</span>
          </button>
          <button
            onClick={() => handleSetViewMode('acts')}
            className={`flex items-center gap-1.5 px-3 py-1 rounded text-[11px] font-mono transition-all ${
              viewMode === 'acts'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Organize scenes into Acts and Folders via Drag and Drop"
          >
            <Folder className="w-3.5 h-3.5" />
            <span>Acts / Folders</span>
          </button>
        </div>

        {canManageScenes && (viewMode === 'flat' ? (
          <button
            onClick={() => onAddScene()}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold font-mono text-[11px] transition-all shadow-sm shadow-amber-500/20 active:scale-95"
            title="Add a new Scene Heading to script"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>New Scene</span>
          </button>
        ) : (
          <button
            onClick={() => setIsAddingFolder(true)}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-purple-600/30 hover:bg-purple-600/50 text-purple-300 border border-purple-500/40 font-mono text-[11px] font-semibold transition-all"
            title="Create a new Act / Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New Act</span>
          </button>
        ))}
      </div>
      {/* Act Filter Pills Bar: Instantly focus on Act 1, Act 2, Act 3 or All */}
      {viewMode === 'acts' && (
        <div className="px-2.5 pt-2 pb-1 border-b border-[#1c1e24] bg-[#0c0d10] flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <button
            onClick={() => onSelectAct && onSelectAct(null)}
            className={`shrink-0 px-2 py-0.5 rounded-md font-mono text-[10px] transition-all ${
              !selectedActId
                ? 'bg-amber-500 text-black font-bold shadow-sm'
                : 'bg-[#15171e] text-gray-400 hover:text-white border border-[#232733]'
            }`}
            title="Show complete script across all acts"
          >
            All Acts ({scenes.length})
          </button>
          {folders.map((f) => {
            const count = scenesByFolder[f.id]?.length || 0;
            const isActive = selectedActId === f.id;
            return (
              <button
                key={f.id}
                onClick={() => onSelectAct && onSelectAct(isActive ? null : f.id)}
                className={`shrink-0 px-2 py-0.5 rounded-md font-mono text-[10px] transition-all flex items-center gap-1 ${
                  isActive
                    ? 'bg-amber-500 text-black font-bold shadow-sm'
                    : 'bg-[#15171e] text-gray-400 hover:text-white border border-[#232733]'
                }`}
                title={`Focus on ${f.name} only on main screen`}
              >
                <span>{f.name.split(' —')[0]}</span>
                <span className={isActive ? 'text-black/70' : 'text-gray-500'}>({count})</span>
              </button>
            );
          })}
        </div>
      )}


      {/* 2. Search & Filter Bar */}
      <div className="p-2.5 border-b border-[#1a1c22] space-y-2 bg-[#0c0d0f]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-500" />
          <input
            type="text"
            placeholder={viewMode === 'flat' ? "Search scenes, characters, or text..." : "Filter scenes or drag across acts..."}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-2 py-1 bg-[#14161a] border border-[#23262e] rounded-lg text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/50 text-[11px]"
          />
        </div>

        <div className="flex items-center justify-between text-[10px] font-mono">
          <span className="text-gray-500 flex items-center gap-1">
            <Filter className="w-3 h-3" /> Filter:
          </span>
          <div className="flex items-center gap-1">
            {(['ALL', 'INT', 'EXT', 'INT/EXT'] as const).map((setting) => (
              <button
                key={setting}
                onClick={() => setFilterSetting(setting)}
                className={`px-1.5 py-0.5 rounded transition-colors ${
                  filterSetting === setting
                    ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {setting}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 3. Selective Export Floating Bar (when scenes are checked) */}
      {selectedSceneIds.length > 0 && (
        <div className="p-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between">
          <span className="text-[11px] font-mono text-amber-300 font-semibold">
            {selectedSceneIds.length} scene{selectedSceneIds.length > 1 ? 's' : ''} selected
          </span>
          <div className="flex items-center gap-1.5">
            <button
              onClick={handleExportSelected}
              className="flex items-center gap-1 px-2 py-0.5 bg-amber-500 hover:bg-amber-400 text-black font-semibold text-[11px] rounded transition-all"
              title="Download only the selected scenes as Fountain"
            >
              <Download className="w-3 h-3" />
              <span>Export</span>
            </button>
            <button
              onClick={() => setSelectedSceneIds([])}
              className="px-1.5 py-0.5 text-gray-400 hover:text-white text-[10px]"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      {/* 4. New Folder Input Form */}
      {isAddingFolder && (
        <div className="p-2 border-b border-purple-500/40 bg-purple-950/20 flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Act / Folder Name (e.g. Act IV — The Epilogue)"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
            autoFocus
            className="flex-1 px-2.5 py-1 bg-[#14161a] border border-purple-500/50 rounded text-gray-200 text-[11px] focus:outline-none"
          />
          <button
            onClick={handleAddFolder}
            className="px-2.5 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-mono text-[10px] font-bold"
          >
            Add
          </button>
          <button
            onClick={() => setIsAddingFolder(false)}
            className="px-2 py-1 text-gray-400 hover:text-white text-[10px]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 5. Scenes Sequence or Acts View */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredScenes.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-gray-500">
            <Film className="w-8 h-8 text-gray-600 mb-2 stroke-1" />
            <p className="text-xs font-medium text-gray-400">No scenes in outline</p>
            <button
              onClick={() => onAddScene()}
              className="mt-3 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono font-medium transition-all"
            >
              + Create First Scene
            </button>
          </div>
        ) : viewMode === 'flat' ? (
          /* ========================================================== */
          /* PURE SCENES LIST (Simple, Direct, Scene Deletion Support)  */
          /* ========================================================== */
          <div className="space-y-1.5">
            {filteredScenes.map((scene) => (
              <SceneCardItem
                key={scene.id}
                scene={scene}
                isActive={activeSceneId === scene.id}
                isSelected={selectedSceneIds.includes(scene.id)}
                isDraggable={false}
                isDragging={false}
                confirmingDelete={confirmingDeleteSceneId === scene.id}
                onRequestDelete={() => setConfirmingDeleteSceneId(scene.id)}
                onCancelDelete={() => setConfirmingDeleteSceneId(null)}
                onConfirmDelete={() => handleDeleteSceneConfirmed(scene.id)}
                canDelete={canManageScenes}
                onOpenTakes={onOpenTakes ? () => onOpenTakes(scene) : undefined}
                onToggleSelect={() => toggleSelectScene(scene.id)}
                onSelect={() => {
                  setActiveSceneId(scene.id);
                  onSelectScene(scene.id - 1);
                }}
              />
            ))}
          </div>
        ) : (
          /* ========================================================== */
          /* ACTS & FOLDERS VIEW (Drag & Drop Between Acts & Folders)    */
          /* ========================================================== */
          <div className="space-y-3">
            {folders.length === 0 ? (
              <div className="space-y-3">
                <div className="p-4 rounded-xl border border-dashed border-[#232733] bg-[#101217] text-center space-y-2.5 my-2">
                  <FolderPlus className="w-6 h-6 text-amber-400/80 mx-auto" />
                  <div className="text-xs font-semibold text-gray-200">No Custom Folders Yet</div>
                  <p className="text-[11px] text-gray-400 leading-relaxed">
                    Create custom folders or acts to organize scenes into your own structure (e.g. Sequences, Chapters, Acts).
                  </p>
                  <button
                    type="button"
                    onClick={() => setIsAddingFolder(true)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Create Folder / Act</span>
                  </button>
                </div>

                {/* All Scenes List when no folders are created */}
                <div className="space-y-1">
                  {scenes.map((scene) => (
                    <SceneCardItem
                      key={scene.id}
                      scene={scene}
                      canDelete={canManageScenes}
                      onOpenTakes={onOpenTakes ? () => onOpenTakes(scene) : undefined}
                      isActive={activeSceneId === scene.id}
                      isSelected={selectedSceneIds.includes(scene.id)}
                      isDraggable={false}
                      confirmingDelete={confirmingDeleteSceneId === scene.id}
                      onRequestDelete={() => setConfirmingDeleteSceneId(scene.id)}
                      onCancelDelete={() => setConfirmingDeleteSceneId(null)}
                      onConfirmDelete={() => handleDeleteSceneConfirmed(scene.id)}
                      onToggleSelect={() => toggleSelectScene(scene.id)}
                      onSelect={() => {
                        setActiveSceneId(scene.id);
                        onSelectScene(scene.id - 1);
                      }}
                    />
                  ))}
                </div>
              </div>
            ) : (
              folders.map((folder) => {
              const folderScenes = scenesByFolder[folder.id] || [];
              const isCollapsed = collapsedFolders[folder.id];
              const isCustom = true;
              const isDropTarget = dragOverFolderId === folder.id;

              return (
                <div 
                  key={folder.id} 
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.dataTransfer.dropEffect = 'move';
                    if (dragOverFolderId !== folder.id) {
                      setDragOverFolderId(folder.id);
                    }
                  }}
                  onDragLeave={(e) => {
                    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                      if (dragOverFolderId === folder.id) {
                        setDragOverFolderId(null);
                      }
                    }
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    const sceneIdStr = e.dataTransfer.getData('text/plain');
                    const targetId = Number(sceneIdStr || draggedSceneId);
                    if (!isNaN(targetId) && targetId > 0) {
                      handleMoveSceneToFolder(targetId, folder.id);
                    }
                    setDragOverFolderId(null);
                    setDraggedSceneId(null);
                  }}
                  className={`space-y-1 p-2 rounded-xl border transition-all duration-200 ${
                    selectedActId === folder.id
                      ? 'bg-amber-500/10 border-amber-500/80 ring-1 ring-amber-500/40 shadow-lg shadow-amber-500/5'
                      : isDropTarget
                      ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/50 shadow-lg shadow-amber-500/10'
                      : 'bg-[#101216]/60 border-[#1e2128] hover:border-[#282d38]'
                  }`}
                >
                  {/* Folder / Act Header */}
                  <div className="flex items-center justify-between gap-1 group">
                    <div className="flex items-center gap-1.5 flex-1 min-w-0">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleFolderCollapse(folder.id);
                        }}
                        className="p-0.5 text-gray-500 hover:text-white rounded cursor-pointer"
                        title={isCollapsed ? "Expand folder" : "Collapse folder"}
                      >
                        {isCollapsed ? (
                          <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                        ) : (
                          <ChevronDown className="w-3.5 h-3.5 flex-shrink-0" />
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          if (onSelectAct) {
                            onSelectAct(selectedActId === folder.id ? null : folder.id);
                          }
                        }}
                        className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-gray-300 hover:text-white truncate flex-1 text-left cursor-pointer"
                        title={selectedActId === folder.id ? `Exit ${folder.name} focus (show all scenes)` : `Focus only ${folder.name} on main screen`}
                      >
                        <Folder className={`w-3.5 h-3.5 flex-shrink-0 ${isDropTarget ? 'text-amber-400 animate-bounce' : selectedActId === folder.id ? 'text-amber-400' : 'text-amber-500/80'}`} />
                        <span className={`truncate ${selectedActId === folder.id ? 'text-amber-300 font-bold' : ''}`}>{folder.name}</span>
                        <span className="text-[10px] font-normal text-gray-500 font-mono">
                          ({folderScenes.length})
                        </span>
                      </button>
                    </div>

                    {/* Act Controls: Create Scene directly in Act + Delete custom folder */}
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (onSelectAct) {
                            onSelectAct(selectedActId === folder.id ? null : folder.id);
                          }
                        }}
                        className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                          selectedActId === folder.id
                            ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                            : 'bg-[#181a22] hover:bg-[#232736] text-gray-400 hover:text-amber-300 border border-[#232733]'
                        }`}
                        title={selectedActId === folder.id ? "Exit focused Act view" : `Focus only ${folder.name} on main screen`}
                      >
                        {selectedActId === folder.id ? 'Active' : 'Focus'}
                      </button>
                      <button
                        onClick={() => handleCreateSceneInFolder(folder.id)}
                        className="flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 text-[10px] font-mono font-semibold transition-all"
                        title={`Add a new scene directly into ${folder.name}`}
                      >
                        <Plus className="w-3 h-3 stroke-[2.5]" />
                        <span>Scene</span>
                      </button>

                      {isCustom && (
                        confirmingDeleteFolderId === folder.id ? (
                          <div className="flex items-center gap-1 bg-red-950/80 border border-red-500/50 rounded px-1 py-0.2">
                            <span className="text-[9px] text-red-300">Delete?</span>
                            <button
                              onClick={() => handleDeleteFolder(folder.id)}
                              className="px-1 bg-red-600 text-white rounded text-[9px] font-bold"
                            >
                              Yes
                            </button>
                            <button
                              onClick={() => setConfirmingDeleteFolderId(null)}
                              className="text-gray-400 hover:text-white text-[9px]"
                            >
                              X
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setConfirmingDeleteFolderId(folder.id)}
                            className="p-1 text-gray-500 hover:text-red-400 transition-colors rounded"
                            title="Delete this custom Act folder (scenes stay safe in script)"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )
                      )}
                    </div>
                  </div>

                  {/* Folder Scenes or Empty Drop Zone */}
                  {!isCollapsed && (
                    <div className="pt-1 pl-1 space-y-1">
                      {folderScenes.length === 0 ? (
                        <div
                          className={`w-full text-center text-[11px] font-mono py-3 px-2 rounded-lg border border-dashed transition-all ${
                            isDropTarget
                              ? 'bg-amber-500/20 text-amber-300 border-amber-400 font-semibold'
                              : 'bg-[#13151b] text-gray-500 border-[#242834]'
                          }`}
                        >
                          {isDropTarget ? (
                            <span>Release to drop scene into {folder.name}</span>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleCreateSceneInFolder(folder.id)}
                              className="text-amber-400/80 hover:text-amber-300 flex items-center justify-center gap-1.5 w-full"
                            >
                              <Plus className="w-3.5 h-3.5 text-amber-500" />
                              <span>Drag scene here or click to create</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        folderScenes.map((scene) => (
                          <SceneCardItem
                            key={scene.id}
                            scene={scene}
                            isActive={activeSceneId === scene.id}
                            isSelected={selectedSceneIds.includes(scene.id)}
                            isDraggable={canManageScenes}
                        canDelete={canManageScenes}
                        onOpenTakes={onOpenTakes ? () => onOpenTakes(scene) : undefined}
                            isDragging={draggedSceneId === scene.id}
                            onDragStart={(e) => {
                              e.dataTransfer.setData('text/plain', String(scene.id));
                              e.dataTransfer.effectAllowed = 'move';
                              setDraggedSceneId(scene.id);
                            }}
                            onDragEnd={() => {
                              setDraggedSceneId(null);
                              setDragOverFolderId(null);
                            }}
                            confirmingDelete={confirmingDeleteSceneId === scene.id}
                            onRequestDelete={() => setConfirmingDeleteSceneId(scene.id)}
                            onCancelDelete={() => setConfirmingDeleteSceneId(null)}
                            onConfirmDelete={() => handleDeleteSceneConfirmed(scene.id)}
                            onToggleSelect={() => toggleSelectScene(scene.id)}
                            onSelect={() => {
                              setActiveSceneId(scene.id);
                              onSelectScene(scene.id - 1);
                            }}
                          />
                        ))
                      )}

                      {/* Drop cue banner when dragging over an act that already has scenes */}
                      {isDropTarget && folderScenes.length > 0 && (
                        <div className="py-1 px-2 rounded border border-dashed border-amber-500/80 bg-amber-500/15 text-center text-amber-300 text-[10px] font-mono animate-pulse">
                          Drop to move scene into {folder.name}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })
          )}

            {/* Unassigned Category Drop Target in Acts View */}
            {folders.length > 0 && (
            <div 
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = 'move';
                if (dragOverFolderId !== 'unassigned') {
                  setDragOverFolderId('unassigned');
                }
              }}
              onDragLeave={(e) => {
                if (!e.currentTarget.contains(e.relatedTarget as Node)) {
                  if (dragOverFolderId === 'unassigned') {
                    setDragOverFolderId(null);
                  }
                }
              }}
              onDrop={(e) => {
                e.preventDefault();
                const sceneIdStr = e.dataTransfer.getData('text/plain');
                const targetId = Number(sceneIdStr || draggedSceneId);
                if (!isNaN(targetId) && targetId > 0) {
                  handleMoveSceneToFolder(targetId, 'unassigned');
                }
                setDragOverFolderId(null);
                setDraggedSceneId(null);
              }}
              className={`space-y-1 p-2 rounded-xl border transition-all duration-200 ${
                dragOverFolderId === 'unassigned'
                  ? 'bg-amber-500/10 border-amber-500 ring-2 ring-amber-500/40'
                  : 'bg-[#101216]/40 border-[#1b1d24]'
              }`}
            >
              <div className="p-1 font-mono text-[11px] text-gray-400 font-semibold flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-gray-500" />
                  <span>Unassigned Scenes ({scenesByFolder['unassigned']?.length || 0})</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      if (onSelectAct) {
                        onSelectAct(selectedActId === 'unassigned' ? null : 'unassigned');
                      }
                    }}
                    className={`px-2 py-0.5 rounded text-[10px] font-mono font-bold transition-all ${
                      selectedActId === 'unassigned'
                        ? 'bg-amber-500 text-black shadow-md shadow-amber-500/20'
                        : 'bg-[#181a22] hover:bg-[#232736] text-gray-400 hover:text-amber-300 border border-[#232733]'
                    }`}
                    title={selectedActId === 'unassigned' ? "Exit focused view" : "Focus unassigned scenes on main screen"}
                  >
                    {selectedActId === 'unassigned' ? 'Active' : 'Focus'}
                  </button>
                  <span className="text-[10px] text-gray-500 font-normal">Drop here to unassign</span>
                </div>
              </div>

              <div className="pl-1 space-y-1">
                {(scenesByFolder['unassigned'] || []).map((scene) => (
                  <SceneCardItem
                    key={scene.id}
                    scene={scene}
                    isActive={activeSceneId === scene.id}
                    isSelected={selectedSceneIds.includes(scene.id)}
                    isDraggable={true}
                    isDragging={draggedSceneId === scene.id}
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', String(scene.id));
                      e.dataTransfer.effectAllowed = 'move';
                      setDraggedSceneId(scene.id);
                    }}
                    onDragEnd={() => {
                      setDraggedSceneId(null);
                      setDragOverFolderId(null);
                    }}
                    confirmingDelete={confirmingDeleteSceneId === scene.id}
                    onRequestDelete={() => setConfirmingDeleteSceneId(scene.id)}
                    onCancelDelete={() => setConfirmingDeleteSceneId(null)}
                    onConfirmDelete={() => handleDeleteSceneConfirmed(scene.id)}
                    onToggleSelect={() => toggleSelectScene(scene.id)}
                    onSelect={() => {
                      setActiveSceneId(scene.id);
                      onSelectScene(scene.id - 1);
                    }}
                  />
                ))}
              </div>
            </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

interface SceneCardItemProps {
  scene: SceneItem;
  canDelete?: boolean;
  onOpenTakes?: () => void;
  isActive: boolean;
  isSelected: boolean;
  isDraggable?: boolean;
  isDragging?: boolean;
  onDragStart?: (e: React.DragEvent) => void;
  onDragEnd?: () => void;
  confirmingDelete: boolean;
  onRequestDelete: () => void;
  onCancelDelete: () => void;
  onConfirmDelete: () => void;
  onToggleSelect: () => void;
  onSelect: () => void;
}

const SceneCardItem: React.FC<SceneCardItemProps> = ({
  scene,
  isActive,
  isSelected,
  isDraggable = false,
  isDragging = false,
  onDragStart,
  onDragEnd,
  confirmingDelete,
  onRequestDelete,
  onCancelDelete,
  onConfirmDelete,
  onToggleSelect,
  onSelect,
  canDelete = true,
  onOpenTakes,
}) => {
  const isInt = scene.setting === 'INT';
  const isExt = scene.setting === 'EXT';

  return (
    <div
      onClick={onSelect}
      draggable={isDraggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      className={`group relative flex items-start gap-2 p-2 rounded-xl border transition-all ${
        isDraggable ? 'cursor-grab active:cursor-grabbing select-none' : 'cursor-pointer'
      } ${
        isDragging
          ? 'opacity-30 border-amber-500 border-dashed bg-amber-500/5'
          : isActive
          ? 'bg-[#181b23] border-amber-500/50 shadow-md shadow-black/40 ring-1 ring-amber-500/20'
          : 'bg-[#111317] hover:bg-[#161820] border-[#1e222b] hover:border-[#2b303e]'
      }`}
    >
      {/* Drag Grip Handle (in Acts view) or Checkbox */}
      <div className="flex items-center gap-1 shrink-0 pt-0.5">
        {isDraggable && (
          <GripVertical className="w-3.5 h-3.5 text-gray-600 group-hover:text-amber-400 transition-colors shrink-0" />
        )}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect();
          }}
          className="text-gray-500 hover:text-amber-400 transition-colors shrink-0"
          title="Select scene for export"
        >
          {isSelected ? (
            <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
        </button>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-1.5 mb-1">
          <div className="flex items-center gap-1.5 truncate">
            {/* Scene # Pill */}
            <span className="font-mono text-xs font-bold text-amber-400 bg-amber-500/10 px-1.5 py-0.2 rounded border border-amber-500/30 shrink-0">
              #{scene.id}
            </span>

            {/* INT/EXT Badge */}
            <span
              className={`text-[9px] font-mono px-1.5 py-0.2 rounded border font-semibold uppercase shrink-0 ${
                isInt
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : isExt
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-purple-500/10 text-purple-400 border-purple-500/30'
              }`}
            >
              {scene.setting}
            </span>

            {/* Slugline */}
            <span className="font-mono text-xs text-gray-200 group-hover:text-amber-300 font-semibold truncate">
              {scene.location || scene.slugline}
            </span>
          </div>

          {/* Page Duration in Eighths */}
          {scene.eighths && (
            <span 
              className="font-mono text-[10px] text-gray-400 bg-[#16181f] px-1.5 py-0.5 rounded border border-[#262a34] shrink-0 font-medium cursor-help" 
              title={`Scene Length: ${scene.eighths} page(s) — Measured in 1/8th page increments (Hollywood Production Standard)`}
            >
              {scene.eighths} pgs
            </span>
          )}
          {scene.hasRevisions && (
            <span className="font-mono text-[9px] font-bold text-red-400 bg-red-500/15 border border-red-500/30 px-1.5 py-0.5 rounded shrink-0 flex items-center gap-0.5" title="Contains revised lines (*)">
              <span>*</span>
              <span>REV</span>
            </span>
          )}
        </div>

        {/* Action Snippet Preview */}
        {scene.actionSnippet && (
          <p className="text-[11px] text-gray-400 line-clamp-1 italic font-sans mb-1">
            "{scene.actionSnippet}"
          </p>
        )}

        {/* Characters Bar */}
        {scene.characters.length > 0 && (
          <div className="flex items-center gap-1 text-[10px] text-gray-400 overflow-hidden">
            <Users className="w-3 h-3 text-gray-500 shrink-0" />
            <div className="flex items-center gap-1 overflow-x-auto truncate">
              {scene.characters.slice(0, 3).map((char) => (
                <span
                  key={char}
                  className="px-1 py-0.2 rounded bg-[#181a22] border border-[#262a35] text-gray-300 font-mono text-[9px] shrink-0"
                >
                  {char}
                </span>
              ))}
              {scene.characters.length > 3 && (
                <span className="text-[9px] text-gray-500 font-mono">
                  +{scene.characters.length - 3}
                </span>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Right Controls: Scene Takes & Deletion */}
      <div className="flex items-center gap-1 shrink-0" onClick={(e) => e.stopPropagation()}>
        {onOpenTakes && (
          <button
            type="button"
            onClick={onOpenTakes}
            className="p-1 rounded text-gray-500 hover:text-amber-400 hover:bg-amber-500/10 transition-colors"
            title="View & propose alternate scene takes"
          >
            <Film className="w-3.5 h-3.5" />
          </button>
        )}
        {canDelete && (
          <HoldButton
            onHold={onConfirmDelete}
            holdTime={1000}
            title="Hold to Delete Scene"
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </HoldButton>
        )}
      </div>
    </div>
  );
};
