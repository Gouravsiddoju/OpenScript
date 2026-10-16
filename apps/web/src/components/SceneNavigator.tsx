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
  Users
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
  const [folders, setFolders] = useState<SceneFolder[]>(() => {
    const saved = localStorage.getItem('openscript_scene_folders');
    return saved ? JSON.parse(saved) : DEFAULT_FOLDERS;
  });

  // Mapping from sceneId to folderId
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

  // Persist folders and mapping
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

  // Filtered scenes based on search and INT/EXT filter
  const filteredScenes = useMemo(() => {
    return scenes.filter((scene) => {
      const matchesSearch =
        scene.slugline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        scene.characters.some((c) => c.toLowerCase().includes(searchQuery.toLowerCase()));
      const matchesSetting =
        filterSetting === 'ALL' || scene.setting === filterSetting;
      return matchesSearch && matchesSetting;
    });
  }, [scenes, searchQuery, filterSetting]);

  // Group scenes by folder
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
    <div className="flex flex-col h-full overflow-hidden text-xs">
      {/* 1. Header Toolbar */}
      <div className="p-3 border-b border-[#1c1e24] flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 font-mono text-[11px] text-gray-300 font-semibold uppercase tracking-wider">
          <Film className="w-3.5 h-3.5 text-amber-500" />
          <span>Outliner ({scenes.length})</span>
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={onAddScene}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-amber-500 hover:bg-amber-400 text-black font-semibold font-mono text-[11px] transition-all shadow-sm"
            title="Add a new Scene Heading to your script"
          >
            <Plus className="w-3.5 h-3.5 stroke-[3]" />
            <span>Scene</span>
          </button>

          <button
            onClick={() => setIsAddingFolder(true)}
            className="p-1 rounded hover:bg-[#1a1c22] text-gray-400 hover:text-white transition-colors"
            title="Create a new Scene Folder / Act"
          >
            <FolderPlus className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* 2. Search & Filter Bar */}
      <div className="p-2 border-b border-[#1a1c22] space-y-2 bg-[#0c0d0f]">
        <div className="relative">
          <Search className="w-3.5 h-3.5 absolute left-2 top-2 text-gray-500" />
          <input
            type="text"
            placeholder="Search scenes or characters..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-7 pr-2 py-1 bg-[#14161a] border border-[#23262e] rounded text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/50 text-[11px]"
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
        <div className="p-2 bg-amber-500/10 border-b border-amber-500/30 flex items-center justify-between animate-fadeIn">
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

      {/* 4. New Folder Input Modal */}
      {isAddingFolder && (
        <div className="p-2 border-b border-purple-500/40 bg-purple-950/20 flex items-center gap-1.5">
          <input
            type="text"
            placeholder="Folder / Act Name (e.g. Act I - Setup)"
            value={newFolderName}
            onChange={(e) => setNewFolderName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddFolder()}
            autoFocus
            className="flex-1 px-2 py-1 bg-[#14161a] border border-purple-500/50 rounded text-gray-200 text-[11px] focus:outline-none"
          />
          <button
            onClick={handleAddFolder}
            className="px-2 py-1 bg-purple-600 hover:bg-purple-500 text-white rounded font-mono text-[10px] font-bold"
          >
            Add
          </button>
          <button
            onClick={() => setIsAddingFolder(false)}
            className="px-1.5 py-1 text-gray-400 hover:text-white text-[10px]"
          >
            Cancel
          </button>
        </div>
      )}

      {/* 5. Scene Folders & List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-3">
        {/* Render Defined Folders */}
        {folders.map((folder) => {
          const folderScenes = scenesByFolder[folder.id] || [];
          const isCollapsed = collapsedFolders[folder.id];
          const allSelected =
            folderScenes.length > 0 &&
            folderScenes.every((s) => selectedSceneIds.includes(s.id));

          return (
            <div key={folder.id} className="space-y-1">
              {/* Folder Row Header */}
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

                {folderScenes.length > 0 && (
                  <button
                    onClick={() => selectAllInFolder(folderScenes.map((s) => s.id))}
                    className="p-1 text-gray-500 hover:text-amber-400 transition-colors"
                    title={allSelected ? 'Deselect folder scenes' : 'Select all scenes in folder'}
                  >
                    {allSelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
                    ) : (
                      <Square className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>

              {/* Folder Scene Items */}
              {!isCollapsed && (
                <div className="pl-2 space-y-1">
                  {folderScenes.length === 0 ? (
                    <div className="text-[10px] text-gray-600 italic py-1 pl-4">
                      No scenes assigned to this folder.
                    </div>
                  ) : (
                    folderScenes.map((scene) => (
                      <SceneRowItem
                        key={scene.id}
                        scene={scene}
                        isSelected={selectedSceneIds.includes(scene.id)}
                        onToggleSelect={() => toggleSelectScene(scene.id)}
                        onSelect={() => onSelectScene(scene.id - 1)}
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

        {/* Unassigned Scenes Category */}
        {(scenesByFolder['unassigned']?.length > 0 || folders.length === 0) && (
          <div className="space-y-1">
            <div className="flex items-center justify-between p-1.5 bg-[#111317] rounded-lg border border-[#1d2027]">
              <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-gray-400">
                <Layers className="w-3.5 h-3.5 text-gray-500" />
                <span>Uncategorized Scenes ({scenesByFolder['unassigned']?.length || 0})</span>
              </div>
              {scenesByFolder['unassigned']?.length > 0 && (
                <button
                  onClick={() =>
                    selectAllInFolder((scenesByFolder['unassigned'] || []).map((s) => s.id))
                  }
                  className="p-1 text-gray-500 hover:text-amber-400 transition-colors"
                >
                  <Square className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="pl-2 space-y-1">
              {(scenesByFolder['unassigned'] || []).map((scene) => (
                <SceneRowItem
                  key={scene.id}
                  scene={scene}
                  isSelected={selectedSceneIds.includes(scene.id)}
                  onToggleSelect={() => toggleSelectScene(scene.id)}
                  onSelect={() => onSelectScene(scene.id - 1)}
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
    </div>
  );
};

interface SceneRowItemProps {
  scene: SceneItem;
  isSelected: boolean;
  onToggleSelect: () => void;
  onSelect: () => void;
  folders: SceneFolder[];
  currentFolderId: string;
  onMoveFolder: (folderId: string) => void;
}

const SceneRowItem: React.FC<SceneRowItemProps> = ({
  scene,
  isSelected,
  onToggleSelect,
  onSelect,
  folders,
  currentFolderId,
  onMoveFolder,
}) => {
  const settingBadge =
    scene.setting === 'INT'
      ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
      : scene.setting === 'EXT'
      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
      : 'bg-purple-500/10 text-purple-400 border-purple-500/30';

  return (
    <div className="group relative flex items-center gap-1.5 p-1.5 rounded-lg bg-[#0e1014] hover:bg-[#161920] border border-transparent hover:border-[#252832] transition-all">
      <button
        onClick={(e) => {
          e.stopPropagation();
          onToggleSelect();
        }}
        className="text-gray-600 hover:text-amber-400 transition-colors flex-shrink-0"
      >
        {isSelected ? (
          <CheckSquare className="w-3.5 h-3.5 text-amber-400" />
        ) : (
          <Square className="w-3.5 h-3.5" />
        )}
      </button>

      <button
        onClick={onSelect}
        className="flex-1 text-left flex items-start gap-1.5 truncate"
      >
        <span className="font-mono text-amber-500/80 font-bold text-[11px] mt-0.5 flex-shrink-0">
          #{scene.id}
        </span>
        <div className="flex-1 truncate">
          <div className="flex items-center gap-1.5">
            <span
              className={`text-[9px] px-1 py-0.2 rounded border font-mono uppercase ${settingBadge}`}
            >
              {scene.setting}
            </span>
            <span className="font-mono text-gray-200 group-hover:text-amber-300 truncate text-[11px] font-semibold">
              {scene.slugline}
            </span>
          </div>

          {scene.characters.length > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-gray-500 mt-0.5 truncate">
              <Users className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{scene.characters.join(', ')}</span>
            </div>
          )}
        </div>
      </button>

      {/* Move to folder quick selector */}
      <select
        value={currentFolderId}
        onChange={(e) => onMoveFolder(e.target.value)}
        onClick={(e) => e.stopPropagation()}
        className="opacity-0 group-hover:opacity-100 transition-opacity bg-[#181a20] text-gray-400 hover:text-white border border-[#2b2e38] rounded text-[10px] px-1 py-0.5 focus:outline-none"
        title="Assign scene to Folder / Act"
      >
        <option value="unassigned">Folder: None</option>
        {folders.map((f) => (
          <option key={f.id} value={f.id}>
            {f.name}
          </option>
        ))}
      </select>
    </div>
  );
};
