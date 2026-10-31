import React, { useState } from 'react';
import { 
  Plus, 
  MapPin, 
  Users, 
  Clock, 
  Search, 
  Sparkles,
  Layers,
  ArrowRight,
  GripVertical,
  Trash2
} from 'lucide-react';
import { SceneItem } from './SceneNavigator';

interface BeatBoardProps {
  scenes: SceneItem[];
  onOpenScene: (sceneIndex: number) => void;
  onAddScene: () => void;
  onDeleteScene?: (sceneIndex: number) => void;
  onReorderScenes?: (fromIndex: number, toIndex: number) => void;
}

export const BeatBoard: React.FC<BeatBoardProps> = ({
  scenes,
  onOpenScene,
  onAddScene,
  onDeleteScene,
  onReorderScenes,
}) => {
  const [search, setSearch] = useState('');
  const [filterSetting, setFilterSetting] = useState<'ALL' | 'INT' | 'EXT' | 'INT/EXT'>('ALL');
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  const filtered = scenes.filter((s) => {
    const matchesSearch =
      s.slugline.toLowerCase().includes(search.toLowerCase()) ||
      (s.actionSnippet && s.actionSnippet.toLowerCase().includes(search.toLowerCase())) ||
      s.characters.some((c) => c.toLowerCase().includes(search.toLowerCase()));
    const matchesSetting = filterSetting === 'ALL' || s.setting === filterSetting;
    return matchesSearch && matchesSetting;
  });

  const handleDragStart = (e: React.DragEvent, index: number) => {
    e.dataTransfer.setData('text/plain', String(index));
    e.dataTransfer.effectAllowed = 'move';
    setDraggedIndex(index);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    const sourceIndex = Number(e.dataTransfer.getData('text/plain'));
    if (!isNaN(sourceIndex) && sourceIndex !== targetIndex && onReorderScenes) {
      onReorderScenes(sourceIndex, targetIndex);
    }
    setDraggedIndex(null);
  };

  return (
    <section className="w-full max-w-7xl mx-auto p-4 sm:p-8 animate-fadeIn">
      {/* 1. Header Toolbar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 pb-4 border-b border-[#23262e]">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Visual Beat Board</span>
            <span className="text-xs font-mono font-normal px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
              {scenes.length} {scenes.length === 1 ? 'Scene' : 'Scenes'}
            </span>
          </h2>
          <p className="text-xs text-gray-400 mt-1">
            Story outline index cards. Drag and drop cards to reorder scenes directly across the screenplay.
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Search bar */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-gray-500" />
            <input
              type="text"
              placeholder="Search beats, cast, sets..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8 pr-3 py-1.5 bg-[#14161a] border border-[#262933] rounded-lg text-xs text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/50 w-52"
            />
          </div>

          {/* Setting filter */}
          <div className="flex items-center gap-1 bg-[#14161a] p-0.5 rounded-lg border border-[#262933]">
            {(['ALL', 'INT', 'EXT'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setFilterSetting(s)}
                className={`px-2 py-1 rounded text-[11px] font-mono transition-colors ${
                  filterSetting === s
                    ? 'bg-amber-500 text-black font-bold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                {s}
              </button>
            ))}
          </div>

          {/* Add Scene Card */}
          <button
            onClick={onAddScene}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-semibold text-xs transition-all shadow-md shadow-amber-500/10"
          >
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            <span>New Beat</span>
          </button>
        </div>
      </div>

      {/* 2. Grid of Index Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border border-dashed border-[#23262e] rounded-xl bg-[#0f1115]">
          <Layers className="w-8 h-8 text-gray-600 mx-auto mb-2" />
          <h3 className="text-sm font-semibold text-gray-300">No scene cards found</h3>
          <p className="text-xs text-gray-500 mt-1 max-w-sm mx-auto">
            {search ? 'Try clearing your search query or filter.' : 'Click "New Beat" or add a Scene Heading to create your first story card.'}
          </p>
          <button
            onClick={onAddScene}
            className="mt-4 px-3 py-1.5 bg-[#1c1f26] hover:bg-[#252832] text-amber-400 border border-amber-500/30 rounded-lg text-xs font-mono font-medium transition-all inline-flex items-center gap-1.5"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Add First Scene</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filtered.map((scene, idx) => {
            const originalIndex = scenes.findIndex((s) => s.id === scene.id);
            const settingBadge =
              scene.setting === 'INT'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : scene.setting === 'EXT'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-purple-500/10 text-purple-400 border-purple-500/30';

            const isDragging = draggedIndex === originalIndex;

            return (
              <div
                key={scene.id}
                draggable
                onDragStart={(e) => handleDragStart(e, originalIndex)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => handleDrop(e, originalIndex)}
                className={`group relative flex flex-col justify-between h-56 p-4 rounded-xl bg-[#131519] hover:bg-[#181b22] border transition-all cursor-grab active:cursor-grabbing shadow-sm hover:shadow-xl ${
                  isDragging ? 'opacity-40 border-amber-500 border-dashed' : 'border-[#23262f] hover:border-amber-500/50'
                }`}
              >
                {/* Card Top: Scene Number, Drag Grip & Setting */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-1.5">
                      <GripVertical className="w-3.5 h-3.5 text-gray-600 group-hover:text-amber-500 transition-colors" />
                      <span className="font-mono text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                        SCENE #{scene.id}
                      </span>
                    </div>

                    {confirmDeleteId === scene.id ? (
                      <div
                        onClick={(e) => e.stopPropagation()}
                        className="flex items-center gap-1 bg-red-950/90 border border-red-500/60 rounded px-1.5 py-0.5 z-10"
                      >
                        <span className="text-[10px] text-red-300 font-mono">Delete?</span>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteScene?.(originalIndex);
                            setConfirmDeleteId(null);
                          }}
                          className="px-1.5 py-0.5 bg-red-600 hover:bg-red-500 text-white rounded text-[9px] font-bold"
                        >
                          Yes
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setConfirmDeleteId(null);
                          }}
                          className="px-1 py-0.5 text-gray-400 hover:text-white text-[9px]"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${settingBadge}`}>
                          {scene.setting}
                        </span>
                        {onDeleteScene && (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDeleteId(scene.id);
                            }}
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-0.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded"
                            title="Delete scene"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Slugline */}
                  <h3 
                    onClick={() => onOpenScene(originalIndex)}
                    className="font-screenplay font-bold text-sm text-gray-100 group-hover:text-amber-300 transition-colors line-clamp-2 uppercase cursor-pointer"
                  >
                    {scene.slugline}
                  </h3>

                  {/* Action Snippet */}
                  <p className="mt-2 text-xs text-gray-400 line-clamp-3 leading-relaxed">
                    {scene.actionSnippet || <span className="italic text-gray-600">No action description written yet.</span>}
                  </p>
                </div>

                {/* Card Bottom: Cast & Jump Action */}
                <div className="pt-2 border-t border-[#1e2129] flex items-center justify-between text-[11px] text-gray-500">
                  <div className="flex items-center gap-1.5 truncate mr-2">
                    {scene.characters.length > 0 ? (
                      <>
                        <Users className="w-3 h-3 flex-shrink-0 text-amber-500/70" />
                        <span className="truncate font-screenplay text-[10px] text-gray-300 uppercase">
                          {scene.characters.join(' · ')}
                        </span>
                      </>
                    ) : (
                      <span className="text-[10px] italic text-gray-600">No characters</span>
                    )}
                  </div>

                  <button
                    onClick={() => onOpenScene(originalIndex)}
                    className="flex items-center gap-1 text-amber-400 font-mono text-[10px] font-semibold hover:underline"
                  >
                    <span>Jump</span>
                    <ArrowRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
