import React, { useState } from 'react';
import { 
  Plus, 
  MapPin, 
  Users, 
  Clock, 
  Search, 
  Sparkles,
  Layers,
  ArrowRight
} from 'lucide-react';
import { SceneItem } from './SceneNavigator';

interface BeatBoardProps {
  scenes: SceneItem[];
  onOpenScene: (sceneIndex: number) => void;
  onAddScene: () => void;
}

export const BeatBoard: React.FC<BeatBoardProps> = ({
  scenes,
  onOpenScene,
  onAddScene,
}) => {
  const [search, setSearch] = useState('');
  const [filterSetting, setFilterSetting] = useState<'ALL' | 'INT' | 'EXT' | 'INT/EXT'>('ALL');

  const filtered = scenes.filter((s) => {
    const matchesSearch =
      s.slugline.toLowerCase().includes(search.toLowerCase()) ||
      (s.actionSnippet && s.actionSnippet.toLowerCase().includes(search.toLowerCase())) ||
      s.characters.some((c) => c.toLowerCase().includes(search.toLowerCase()));
    const matchesSetting = filterSetting === 'ALL' || s.setting === filterSetting;
    return matchesSearch && matchesSetting;
  });

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
            Story outline index cards synchronized directly with your screenplay document.
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
            const settingBadge =
              scene.setting === 'INT'
                ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                : scene.setting === 'EXT'
                ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
                : 'bg-purple-500/10 text-purple-400 border-purple-500/30';

            return (
              <div
                key={scene.id}
                onClick={() => onOpenScene(scene.id - 1)}
                className="group relative flex flex-col justify-between h-52 p-4 rounded-xl bg-[#131519] hover:bg-[#181b22] border border-[#23262f] hover:border-amber-500/40 transition-all cursor-pointer shadow-sm hover:shadow-lg hover:-translate-y-0.5"
              >
                {/* Card Top: Scene Number & Setting */}
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="font-mono text-xs font-bold text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      SCENE #{scene.id}
                    </span>
                    <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded border ${settingBadge}`}>
                      {scene.setting}
                    </span>
                  </div>

                  {/* Slugline */}
                  <h3 className="font-screenplay font-bold text-sm text-gray-100 group-hover:text-amber-300 transition-colors line-clamp-2 uppercase">
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

                  <span className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1 text-amber-400 font-mono text-[10px] font-semibold flex-shrink-0">
                    <span>Open</span>
                    <ArrowRight className="w-3 h-3" />
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </section>
  );
};
