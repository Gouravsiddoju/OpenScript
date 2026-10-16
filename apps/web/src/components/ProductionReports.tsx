import React from 'react';
import { Users, MapPin, Film, Clock, BarChart3 } from 'lucide-react';

interface ProductionReportsProps {
  contentHtml: string;
}

export const ProductionReports: React.FC<ProductionReportsProps> = ({ contentHtml }) => {
  // Parse blocks from HTML
  const parser = new DOMParser();
  const doc = parser.parseFromString(contentHtml, 'text/html');

  // 1. Extract Characters & Dialogues
  const characterStats: Record<string, { lines: number; words: number }> = {};
  let currentCharacter = '';
  let totalWords = 0;

  const sceneHeadings: Array<{ text: string; setting: string; location: string }> = [];

  Array.from(doc.body.children).forEach((el) => {
    const text = el.textContent?.trim() || '';
    if (!text) return;

    if (el.classList.contains('script-scene-heading')) {
      const upper = text.toUpperCase();
      const isIntExt = /^(INT\/EXT|INT\.\/EXT\.|I\/E)(\.|\s|$)/i.test(upper);
      const isInt = !isIntExt && /^INT(\.|\s|$)/i.test(upper);
      const isExt = !isIntExt && /^EXT(\.|\s|$)/i.test(upper);
      const setting = isIntExt ? 'INT/EXT' : isInt ? 'INT' : isExt ? 'EXT' : 'INT';
      const location = upper.replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)\s*/i, '').replace(/\s*-\s*.*$/, '').trim();
      sceneHeadings.push({ text: upper, setting, location: location || upper });
    } else if (el.classList.contains('script-character')) {
      currentCharacter = text.replace(/\s*\(.*\)$/, '').trim().toUpperCase();
      if (!characterStats[currentCharacter]) {
        characterStats[currentCharacter] = { lines: 0, words: 0 };
      }
    } else if (el.classList.contains('script-dialogue') && currentCharacter) {
      const words = text.split(/\s+/).filter(Boolean).length;
      characterStats[currentCharacter].lines += 1;
      characterStats[currentCharacter].words += words;
      totalWords += words;
    }
  });

  const sortedCharacters = Object.entries(characterStats).sort(
    (a, b) => b[1].words - a[1].words
  );

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-8 font-sans">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="bg-[#181a1f] p-4 rounded-xl border border-[#26282e]">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Film className="w-4 h-4 text-amber-500" />
            <span>Total Scenes</span>
          </div>
          <div className="text-2xl font-bold text-white">{sceneHeadings.length}</div>
        </div>

        <div className="bg-[#181a1f] p-4 rounded-xl border border-[#26282e]">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Users className="w-4 h-4 text-sky-400" />
            <span>Speaking Characters</span>
          </div>
          <div className="text-2xl font-bold text-white">{sortedCharacters.length}</div>
        </div>

        <div className="bg-[#181a1f] p-4 rounded-xl border border-[#26282e]">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Dialogue Words</span>
          </div>
          <div className="text-2xl font-bold text-white">{totalWords}</div>
        </div>

        <div className="bg-[#181a1f] p-4 rounded-xl border border-[#26282e]">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Est. Screen Time</span>
          </div>
          <div className="text-2xl font-bold text-white">~{Math.max(1, Math.ceil(sceneHeadings.length * 1.5))} mins</div>
        </div>
      </div>

      {/* Cast Breakdown Table */}
      <div className="bg-[#181a1f] rounded-xl border border-[#26282e] p-6">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <Users className="w-4 h-4 text-amber-500" />
          Cast Speaking Breakdown Report
        </h3>

        {sortedCharacters.length === 0 ? (
          <p className="text-gray-500 text-sm">No speaking characters found in the screenplay yet.</p>
        ) : (
          <div className="space-y-4">
            {sortedCharacters.map(([name, stats]) => {
              const percentage = totalWords > 0 ? Math.round((stats.words / totalWords) * 100) : 0;
              return (
                <div key={name} className="space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="font-mono font-bold text-gray-200">{name}</span>
                    <span className="text-gray-400 font-mono">
                      {stats.lines} lines · {stats.words} words ({percentage}%)
                    </span>
                  </div>
                  <div className="w-full bg-[#242730] h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-amber-500 h-full rounded-full transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Locations Breakdown */}
      <div className="bg-[#181a1f] rounded-xl border border-[#26282e] p-6">
        <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
          <MapPin className="w-4 h-4 text-emerald-400" />
          Location & Sets Breakdown
        </h3>

        {sceneHeadings.length === 0 ? (
          <p className="text-gray-500 text-sm">No scene headings found in the screenplay yet.</p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {sceneHeadings.map((scene, idx) => (
              <div
                key={idx}
                className="p-3 bg-[#131417] rounded-lg border border-[#26282e] flex items-center justify-between"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono font-bold text-amber-500/80">#{idx + 1}</span>
                  <span className="text-xs font-mono text-gray-200 truncate">{scene.text}</span>
                </div>
                <span
                  className={`text-[10px] font-mono px-2 py-0.5 rounded font-bold ${
                    scene.setting === 'INT'
                      ? 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
                      : 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                  }`}
                >
                  {scene.setting}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
