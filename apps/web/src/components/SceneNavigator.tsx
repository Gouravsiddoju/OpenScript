import React, { useState, useMemo } from 'react';
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
  MapPin,
  Users,
  ListOrdered
} from 'lucide-react';

export interface SceneItem {
  id: number;
  slugline: string;
  setting: 'INT' | 'EXT' | 'INT/EXT';
  location: string;
  timeOfDay: string;
  fountainText: string;
  characters: string[];
  actionSnippet?: string;
  eighths?: string;
}

export interface SceneFolder {
  id: string;
  name: string;
  color: string;
}

interface SceneNavigatorProps {
  scenes: SceneItem[];
  onSelectScene: (sceneIndex: number) => void;
  onAddScene: () => void;
  onExportSelectedScenes: (selectedScenes: SceneItem[]) => void;
}

const DEFAULT_FOLDERS: SceneFolder[] = [
  { id: 'act-1', name: 'Act I — Setup', color: 'border-blue-500/40 text-blue-400' },
  { id: 'act-2', name: 'Act II — Confrontation', color: 'border-amber-500/40 text-amber-400' },
  { id: 'act-3', name: 'Act III — Resolution', color: 'border-emerald-500/40 text-emerald-400' },
];

export const SceneNavigator: React.FC<SceneNavigatorProps> = ({
  scenes,
  onSelectScene,
  onAddScene,
  onExportSelectedScenes,
}) => {
  // Navigation display mode: 'flat' (chronological scenes list) or 'acts' (folders)
  const [viewMode, setViewMode] = useState<'flat' | 'acts'>('flat');

  const [folders, setFolders] = useState<SceneFolder[]>(() => {
    const saved = localStorage.getItem('openscript_scene_folders');
    return saved ? JSON.parse(saved) : DEFAULT_FOLDERS;
  });

  const [sceneFolderMap, setSceneFolderMap] = useState<Record<number, string>>(() => {
    const saved = localStorage.getItem('openscript_scene_folder_map');
    return saved ? JSON.parse(saved) : {};
  });

  const [collapsedFolders, setCollapsedFolders] = useState<Record<string, boolean>>({});
  const [selectedSceneIds, setSelectedSceneIds] = useState<number[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterSetting, setFilterSetting] = useState<'ALL' | 'INT' | 'EXT' | 'INT/EXT'>('ALL');
  const [isAddingFolder, setIsAddingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [activeSceneId, setActiveSceneId] = useState<number | null>(1);

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

  const toggleSelectScene = (sceneId: number) => {
    setSelectedSceneIds((prev) =>
      prev.includes(sceneId) ? prev.filter((id) => id !== sceneId) : [...prev, sceneId]
    );
  };

  const selectAllInFolder = (sceneIds: number[]) => {
    const allSelected = sceneIds.every((id) => selectedSceneIds.includes(id));
    if (allSelected) {
      setSelectedSceneIds((prev) => prev.filter((id) => !sceneIds.includes(id)));
    } else {
      setSelectedSceneIds((prev) => Array.from(new Set([...prev, ...sceneIds])));
    }
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
      {/* 1. Header Toolbar */}
      <div className="p-3 border-b border-[#1c1e24] flex items-center justify-between gap-2 bg-[#0d0e12]">
        <div className="flex items-center gap-2">
          <Film className="w-4 h-4 text-amber-500" />
          <span className="font-mono text-xs text-white font-bold tracking-wide">
            OUTLINER ({scenes.length})
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={onAddScene}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold font-mono text-[11px] transition-all shadow-sm shadow-amber-500/20 active:scale-95"
            title="Add a new Scene Heading to your script"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>New Scene</span>
          </button>
        </div>
      </div>

      {/* 2. View Mode Tabs (Scenes vs Acts) */}
      <div className="px-3 pt-2.5 pb-1 border-b border-[#1c1e24] bg-[#0c0d10] flex items-center justify-between">
        <div className="flex items-center bg-[#15171e] p-0.5 rounded-lg border border-[#232631]">
          <button
            onClick={() => setViewMode('flat')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
              viewMode === 'flat'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Chronological scene order"
          >
            <ListOrdered className="w-3 h-3" />
            <span>Scenes</span>
          </button>
          <button
            onClick={() => setViewMode('acts')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-mono transition-colors ${
              viewMode === 'acts'
                ? 'bg-amber-500/20 text-amber-300 font-bold border border-amber-500/40 shadow-sm'
                : 'text-gray-400 hover:text-white'
            }`}
            title="Organize scenes into Acts and Folders"
          >
            <Folder className="w-3 h-3" />
            <span>Acts / Folders</span>
          </button>
        </div>

        {viewMode === 'acts' && (
          <button
            onClick={() => setIsAddingFolder(true)}
            className="flex items-center gap-1 text-[11px] font-mono text-purple-400 hover:text-purple-300 transition-colors"
            title="Create a new Act / Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
            <span>New Act</span>
          </button>
        )}
      </div>

      {/* 3. Search & Filter Bar */}
      <div className="p-2.5 border-b border-[#1a1c22] space-y-2 bg-[#0c0d0f]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-gray-500" />
          <input
            type="text"
            placeholder="Search scenes, characters, or text..."
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

      {/* 4. Selective Export Floating Bar (when scenes are checked) */}
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

      {/* 5. New Folder Input Form */}
      {isAddingFolder && (
        <div className="p-2 border-b border-purple-500/40 bg-purple-950/20 flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Act / Folder Name (e.g. Act I — The Inciting Incident)"
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

      {/* 6. Scene Sequence or Acts View */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {filteredScenes.length === 0 ? (
          <div className="h-48 flex flex-col items-center justify-center text-center p-4 text-gray-500">
            <Film className="w-8 h-8 text-gray-600 mb-2 stroke-1" />
            <p className="text-xs font-medium text-gray-400">No scenes in outline</p>
            <button
              onClick={onAddScene}
              className="mt-3 px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono font-medium transition-all"
            >
              + Create First Scene
            </button>
          </div>
        ) : viewMode === 'flat' ? (
          /* ========================================================== */
          /* FLAT CHRONOLOGICAL SCENE LIST (Clean & Intuitive)         */
          /* ========================================================== */
          <div className="space-y-1.5">
            {filteredScenes.map((scene) => (
              <SceneCardItem
                key={scene.id}
                scene={scene}
                isActive={activeSceneId === scene.id}
                isSelected={selectedSceneIds.includes(scene.id)}
                onToggleSelect={() => toggleSelectScene(scene.id)}
                onSelect={() => {
                  setActiveSceneId(scene.id);
                  onSelectScene(scene.id - 1);
                }}
                folders={folders}
                currentFolderId={sceneFolderMap[scene.id] || 'unassigned'}
                onMoveFolder={(fId) =>
                  saveFolderMap({ ...sceneFolderMap, [scene.id]: fId })
                }
              />
            ))}
          </div>
        ) : (
          /* ========================================================== */
          /* ACTS & FOLDERS VIEW                                       */
          /* ========================================================== */
          <div className="space-y-3">
            {folders.map((folder) => {
              const folderScenes = scenesByFolder[folder.id] || [];
              const isCollapsed = collapsedFolders[folder.id];

              return (
                <div key={folder.id} className="space-y-1">
                  <div className="flex items-center justify-between p-1.5 bg-[#131519] rounded-lg border border-[#20232a] group">
                    <button
                      onClick={() => toggleFolderCollapse(folder.id)}
                      className="flex items-center gap-1.5 font-mono text-[11px] font-bold text-gray-300 hover:text-white truncate flex-1 text-left"
                    >
                      {isCollapsed ? (
                        <ChevronRight className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      ) : (
                        <ChevronDown className="w-3.5 h-3.5 text-gray-500 flex-shrink-0" />
                      )}
                      <Folder className="w-3.5 h-3.5 text-amber-500/80 flex-shrink-0" />
                      <span className="truncate">{folder.name}</span>
                      <span className="text-[10px] font-normal text-gray-500">
                        ({folderScenes.length})
                      </span>
                    </button>
                  </div>

                  {!isCollapsed && (
                    <div className="pl-2 space-y-1">
                      {folderScenes.length === 0 ? (
                        <div className="text-[10px] text-gray-500 italic py-1 pl-3 bg-[#111317] rounded border border-dashed border-[#22252e]">
                          Drop or assign scenes to {folder.name}
                        </div>
                      ) : (
                        folderScenes.map((scene) => (
                          <SceneCardItem
                            key={scene.id}
                            scene={scene}
                            isActive={activeSceneId === scene.id}
                            isSelected={selectedSceneIds.includes(scene.id)}
                            onToggleSelect={() => toggleSelectScene(scene.id)}
                            onSelect={() => {
                              setActiveSceneId(scene.id);
                              onSelectScene(scene.id - 1);
                            }}
                            folders={folders}
                            currentFolderId={folder.id}
                            onMoveFolder={(fId) =>
                              saveFolderMap({ ...sceneFolderMap, [scene.id]: fId })
                            }
                          />
                        ))
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Unassigned Category in Acts View */}
            {(scenesByFolder['unassigned']?.length > 0) && (
              <div className="space-y-1">
                <div className="p-1.5 bg-[#111317] rounded-lg border border-[#1d2027] font-mono text-[11px] text-gray-400 font-semibold flex items-center gap-1.5">
                  <Layers className="w-3.5 h-3.5 text-gray-500" />
                  <span>Unassigned Scenes ({scenesByFolder['unassigned'].length})</span>
                </div>
                <div className="pl-2 space-y-1">
                  {scenesByFolder['unassigned'].map((scene) => (
                    <SceneCardItem
                      key={scene.id}
                      scene={scene}
                      isActive={activeSceneId === scene.id}
                      isSelected={selectedSceneIds.includes(scene.id)}
                      onToggleSelect={() => toggleSelectScene(scene.id)}
                      onSelect={() => {
                        setActiveSceneId(scene.id);
                        onSelectScene(scene.id - 1);
                      }}
                      folders={folders}
                      currentFolderId="unassigned"
                      onMoveFolder={(fId) =>
                        saveFolderMap({ ...sceneFolderMap, [scene.id]: fId })
                      }
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
  isActive: boolean;
  isSelected: boolean;
  onToggleSelect: () => void;
  onSelect: () => void;
  folders: SceneFolder[];
  currentFolderId: string;
  onMoveFolder: (folderId: string) => void;
}

const SceneCardItem: React.FC<SceneCardItemProps> = ({
  scene,
  isActive,
  isSelected,
  onToggleSelect,
  onSelect,
  folders,
  currentFolderId,
  onMoveFolder,
}) => {
  const isInt = scene.setting === 'INT';
  const isExt = scene.setting === 'EXT';

  return (
    <div
      onClick={onSelect}
      className={`group relative flex items-start gap-2 p-2 rounded-xl border cursor-pointer transition-all ${
        isActive
          ? 'bg-[#181b23] border-amber-500/50 shadow-md shadow-black/40 ring-1 ring-amber-500/20'
          : 'bg-[#111317] hover:bg-[#161820] border-[#1e222b] hover:border-[#2b303e]'
      }`}
    >
      {/* Checkbox */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        className="text-gray-500 hover:text-amber-400 transition-colors pt-0.5 shrink-0"
        title="Select scene for export"
      >
        {isSelected ? (
          <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Square className="w-3.5 h-3.5" />
        )}
      </button>

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
            <span className="font-mono text-[10px] text-gray-400 bg-[#16181f] px-1.5 py-0.5 rounded border border-[#262a34] shrink-0 font-medium" title="Estimated scene duration">
              {scene.eighths} pgs
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

      {/* Move to folder dropdown on hover */}
      <select
        value={currentFolderId}
        onChange={(e) => {
          e.stopPropagation();
          onMoveFolder(e.target.value);
        }}
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#161820] text-gray-400 hover:text-white border border-[#2b303d] rounded text-[10px] px-1 py-0.5 focus:outline-none shrink-0"
        title="Assign scene to Act / Folder"
      >
        <option value="unassigned">Act: None</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name.split(' — ')[0]}
          </option>
        ))}
      </select>
    </div>
  );
};
