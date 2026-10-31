import React, { useState } from 'react';
import { X, Film, CheckCircle, Plus, Star, Lock, User, Clock } from 'lucide-react';
import { CollaboratorRole, SceneTake, canFinalizeSceneTake, canProposeSceneTakes } from '@openscript/screenplay-schema';
import { SceneItem } from './SceneNavigator';

interface SceneTakesModalProps {
  isOpen: boolean;
  onClose: () => void;
  scene: SceneItem | null;
  takes: SceneTake[];
  currentUserRole: CollaboratorRole;
  currentUserName: string;
  onFinalizeTake: (take: SceneTake) => void;
  onProposeTake: (sceneId: number, title: string, content: string) => void;
}

export const SceneTakesModal: React.FC<SceneTakesModalProps> = ({
  isOpen,
  onClose,
  scene,
  takes,
  currentUserRole,
  currentUserName,
  onFinalizeTake,
  onProposeTake,
}) => {
  const [isCreating, setIsCreating] = useState(false);
  const [takeTitle, setTakeTitle] = useState('');
  const [takeContent, setTakeContent] = useState('');

  if (!isOpen || !scene) return null;

  const canFinalize = canFinalizeSceneTake(currentUserRole);
  const canPropose = canProposeSceneTakes(currentUserRole);

  const sceneTakes = takes.filter((t) => t.sceneId === scene.id);

  const handleStartCreate = () => {
    setIsCreating(true);
    setTakeTitle(`Take ${sceneTakes.length + 1} (Alternate Cut)`);
    setTakeContent(scene.fountainText || '');
  };

  const handleSaveTake = (e: React.FormEvent) => {
    e.preventDefault();
    if (!takeTitle.trim() || !takeContent.trim()) return;
    onProposeTake(scene.id, takeTitle.trim(), takeContent.trim());
    setIsCreating(false);
    setTakeTitle('');
    setTakeContent('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-[#12141a] border border-[#242834] rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#20232e] bg-[#161821] flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400">
              <Film className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-amber-400 uppercase tracking-wider">
                  Scene {scene.id} Alternate Takes
                </span>
                <span className="px-2 py-0.5 rounded-full bg-[#202430] text-[10px] font-mono text-gray-400 border border-[#2b3040]">
                  {sceneTakes.length} {sceneTakes.length === 1 ? 'Take' : 'Takes'}
                </span>
              </div>
              <h2 className="text-sm font-bold text-white truncate max-w-md">
                {scene.slugline || 'Scene Heading'}
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#20232c] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          {/* Action Bar */}
          <div className="flex items-center justify-between">
            <p className="text-xs text-gray-400">
              {canFinalize
                ? 'Review takes below and select the winning take to activate in the master script.'
                : 'Co-writers can propose alternate scene drafts for the Owner to finalize.'}
            </p>
            {canPropose && !isCreating && (
              <button
                onClick={handleStartCreate}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Propose Take</span>
              </button>
            )}
          </div>


          {scene.hasRevisions && (
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 font-mono shadow-sm">
              <span className="text-base font-bold text-red-400 leading-none">*</span>
              <span><strong>Active Revision Draft:</strong> This scene contains lines revised with Hollywood right-margin asterisks (*). Compare with Take 1 Baseline below.</span>
            </div>
          )}

          {/* Create New Take Form */}
          {isCreating && (
            <form onSubmit={handleSaveTake} className="p-4 rounded-xl bg-[#171a24] border border-amber-500/40 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-300 font-mono">Propose New Alternate Scene Take</span>
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="text-gray-400 hover:text-white text-xs"
                >
                  Cancel
                </button>
              </div>
              <div>
                <label className="text-[11px] font-mono text-gray-400 block mb-1">Take Title / Variation Name</label>
                <input
                  type="text"
                  value={takeTitle}
                  onChange={(e) => setTakeTitle(e.target.value)}
                  placeholder="e.g., Take 2 (Faster Action Beat)"
                  className="w-full px-3 py-2 bg-[#0e1015] border border-[#272b38] rounded-lg text-xs text-white focus:outline-none focus:border-amber-500/50"
                  autoFocus
                />
              </div>
              <div>
                <label className="text-[11px] font-mono text-gray-400 block mb-1">Fountain Script Content</label>
                <textarea
                  rows={6}
                  value={takeContent}
                  onChange={(e) => setTakeContent(e.target.value)}
                  className="w-full px-3 py-2 bg-[#0e1015] border border-[#272b38] rounded-lg text-xs font-mono text-gray-200 focus:outline-none focus:border-amber-500/50 resize-y"
                  placeholder="Write alternate dialogue or action blocks here..."
                />
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setIsCreating(false)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono text-gray-400 hover:text-white bg-[#20232e]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={!takeTitle.trim() || !takeContent.trim()}
                  className="px-4 py-1.5 rounded-lg text-xs font-mono font-bold bg-amber-500 hover:bg-amber-400 text-black shadow disabled:opacity-40"
                >
                  Save & Propose Take
                </button>
              </div>
            </form>
          )}

          {/* Takes Roster */}
          <div className="space-y-3">
            {sceneTakes.length === 0 ? (
              <div className="p-8 text-center rounded-xl bg-[#161821] border border-[#20232e] space-y-2">
                <Film className="w-8 h-8 text-gray-500 mx-auto" />
                <p className="text-xs text-gray-400">No alternate takes recorded for this scene yet.</p>
                {canPropose && (
                  <button
                    onClick={handleStartCreate}
                    className="px-3 py-1.5 rounded-lg bg-[#202430] hover:bg-[#2b3040] text-amber-400 text-xs font-mono border border-amber-500/30 transition-colors"
                  >
                    + Create First Alternate Take
                  </button>
                )}
              </div>
            ) : (
              sceneTakes.map((take) => (
                <div
                  key={take.id}
                  className={`p-4 rounded-xl border transition-all space-y-3 ${
                    take.isFinalized
                      ? 'bg-[#181a24] border-amber-500/50 shadow-md ring-1 ring-amber-500/20'
                      : 'bg-[#14161e] border-[#222530] hover:border-[#303546]'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="w-2 h-2 rounded-full bg-amber-400"></span>
                      <h4 className="text-xs font-bold text-white font-mono">{take.title}</h4>
                    </div>

                    {take.isFinalized ? (
                      <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-black text-[10px] font-mono font-bold shadow-sm">
                        <Star className="w-3 h-3 fill-black" />
                        <span>WINNING TAKE (ACTIVE)</span>
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-[#1e222d] text-gray-400 border border-[#2b3040] text-[10px] font-mono">
                        Alternate Draft
                      </span>
                    )}
                  </div>

                  {/* Script Preview Snippet with Revision Highlights */}
                  <div className="p-3 rounded-lg bg-[#0d0e12] border border-[#1e2028] max-h-40 overflow-y-auto font-mono text-[11px] leading-relaxed text-gray-300 space-y-1">
                    {take.fountainText.split('\n').map((line, lineIdx) => {
                      const isLineRevised = line.includes(' *') || line.endsWith('*');
                      return (
                        <div
                          key={lineIdx}
                          className={`flex items-center justify-between ${
                            isLineRevised
                              ? 'bg-red-500/15 text-red-200 font-semibold px-2 py-0.5 rounded border-l-2 border-red-500 shadow-sm'
                              : 'text-gray-300'
                          }`}
                        >
                          <span>{line}</span>
                          {isLineRevised && (
                            <span className="px-1.5 py-0.2 rounded bg-red-500 text-white text-[9px] font-bold font-mono tracking-wider shrink-0 ml-2">
                              REVISED *
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Metadata and Controls */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-2 border-t border-[#1f222c] text-[11px] text-gray-400 font-mono">
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1">
                        <User className="w-3 h-3 text-amber-400" />
                        <span>{take.authorName} ({take.authorRole})</span>
                      </span>
                      <span className="flex items-center gap-1 text-gray-500">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(take.createdAt).toLocaleDateString()}</span>
                      </span>
                    </div>

                    <div>
                      {take.isFinalized ? (
                        <span className="text-emerald-400 font-semibold flex items-center gap-1">
                          <CheckCircle className="w-3.5 h-3.5" />
                          <span>Currently Live in Script</span>
                        </span>
                      ) : canFinalize ? (
                        <button
                          onClick={() => onFinalizeTake(take)}
                          className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow transition-all"
                        >
                          <Star className="w-3 h-3" />
                          <span>Set as Winning Take ⭐</span>
                        </button>
                      ) : (
                        <span className="text-gray-500 text-[10px] italic flex items-center gap-1">
                          <Lock className="w-3 h-3" />
                          <span>Owner Finalization Required</span>
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#20232e] bg-[#161821] flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-[#202430] hover:bg-[#2b3040] text-gray-200 text-xs font-mono rounded-lg transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
