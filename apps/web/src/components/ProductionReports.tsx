import { isNonCharacterCue } from '@openscript/screenplay-schema';
import React, { useState } from 'react';
import { Users, MapPin, Film, Clock, BarChart3, Calendar, PieChart } from 'lucide-react';

interface ProductionReportsProps {
  contentHtml: string;
}

export interface ProductionReportData {
  sceneHeadings: Array<{ id: number; text: string; setting: string; location: string; characters: Set<string> }>;
  sortedCharacters: Array<[string, { lines: number; words: number; scenes: Set<number> }]>;
  sortedLocations: Array<[string, Array<{ id: number; text: string; setting: string; location: string; characters: Set<string> }>]>;
  totalWords: number;
  actionWords: number;
  dialogueWords: number;
  dialogueRatio: number;
  actionRatio: number;
}

export function computeProductionReportData(contentHtml: string): ProductionReportData {
  const characterStats: Record<string, { lines: number; words: number; scenes: Set<number> }> = {};
  let currentCharacter = '';
  let totalWords = 0;
  let actionWords = 0;
  let dialogueWords = 0;

  const sceneHeadings: Array<{ id: number; text: string; setting: string; location: string; characters: Set<string> }> = [];
  let currentSceneIdx = 0;

  const handleElement = (classNames: string, text: string) => {
    if (!text) return;

    if (classNames.includes('script-scene-heading') || classNames.includes('scene-heading')) {
      currentSceneIdx++;
      const upper = text.toUpperCase();
      const isIntExt = /^(INT\/EXT|INT\.\/EXT\.|I\/E)(\.|\s|$)/i.test(upper);
      const isInt = !isIntExt && /^INT(\.|\s|$)/i.test(upper);
      const isExt = !isIntExt && /^EXT(\.|\s|$)/i.test(upper);
      const setting = isIntExt ? 'INT/EXT' : isInt ? 'INT' : isExt ? 'EXT' : 'INT';
      const location = upper
        .replace(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.|EST\.|SUPER\s*TITLE:\s*|SUPER:\s*|TITLE\s*CARD:\s*|TITLE:\s*)\s*/i, '')
        .replace(/["']/g, '')
        .replace(/\s*-\s*.*$/, '')
        .trim();
      sceneHeadings.push({
        id: currentSceneIdx,
        text: upper,
        setting,
        location: location || upper,
        characters: new Set(),
      });
    } else if (classNames.includes('script-action') || classNames.includes('action')) {
      const words = text.split(/\s+/).filter(Boolean).length;
      actionWords += words;
      totalWords += words;
      currentCharacter = '';
    } else if (classNames.includes('script-shot') || classNames.includes('shot')) {
      const words = text.split(/\s+/).filter(Boolean).length;
      actionWords += words;
      totalWords += words;
      currentCharacter = '';
    } else if (classNames.includes('script-character') || classNames.includes('character')) {
      const candidate = text.replace(/\s*\(.*\)$/, '').trim().toUpperCase();
      if (!candidate || isNonCharacterCue(candidate)) {
        currentCharacter = '';
        return;
      }
      currentCharacter = candidate;
      if (!characterStats[currentCharacter]) {
        characterStats[currentCharacter] = { lines: 0, words: 0, scenes: new Set() };
      }
      if (currentSceneIdx > 0) {
        characterStats[currentCharacter].scenes.add(currentSceneIdx);
        sceneHeadings[currentSceneIdx - 1]?.characters.add(currentCharacter);
      }
    } else if (classNames.includes('script-parenthetical') || classNames.includes('parenthetical')) {
      if (currentCharacter) {
        const words = text.replace(/[\(\)]/g, '').split(/\s+/).filter(Boolean).length;
        if (characterStats[currentCharacter]) {
          characterStats[currentCharacter].words += words;
          if (characterStats[currentCharacter].lines === 0) {
            characterStats[currentCharacter].lines = 1;
          }
          dialogueWords += words;
          totalWords += words;
        }
      }
    } else if (classNames.includes('script-dialogue') || classNames.includes('dialogue')) {
      if (currentCharacter) {
        const words = text.split(/\s+/).filter(Boolean).length;
        characterStats[currentCharacter].lines += 1;
        characterStats[currentCharacter].words += words;
        dialogueWords += words;
        totalWords += words;
      }
    }
  };

  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(contentHtml, 'text/html');
    Array.from(doc.body.children).forEach((el) => {
      handleElement(el.className || '', el.textContent?.trim() || '');
    });
  } else {
    const tagRegex = /<([a-z0-9]+)\s+class="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/gi;
    let match;
    while ((match = tagRegex.exec(contentHtml)) !== null) {
      const classNames = match[2];
      const rawContent = match[3];
      const text = rawContent.replace(/<[^>]+>/g, '').trim();
      handleElement(classNames, text);
    }
  }

  const sortedCharacters = Object.entries(characterStats)
    .filter(([name, stats]) => stats.words > 0 && !isNonCharacterCue(name))
    .sort((a, b) => b[1].words - a[1].words);

  const locationGroups: Record<string, typeof sceneHeadings> = {};
  sceneHeadings.forEach((s) => {
    if (!locationGroups[s.location]) locationGroups[s.location] = [];
    locationGroups[s.location].push(s);
  });
  const sortedLocations = Object.entries(locationGroups).sort((a, b) => b[1].length - a[1].length);

  const dialogueRatio = totalWords > 0 ? Math.round((dialogueWords / totalWords) * 100) : 50;
  const actionRatio = totalWords > 0 ? 100 - dialogueRatio : 50;

  return {
    sceneHeadings,
    sortedCharacters,
    sortedLocations,
    totalWords,
    actionWords,
    dialogueWords,
    dialogueRatio,
    actionRatio,
  };
}

export const ProductionReports: React.FC<ProductionReportsProps> = ({ contentHtml }) => {
  const [activeReportTab, setActiveReportTab] = useState<'cast' | 'locations' | 'dood' | 'pacing'>('cast');

  const {
    sceneHeadings,
    sortedCharacters,
    sortedLocations,
    totalWords,
    actionWords,
    dialogueWords,
    dialogueRatio,
    actionRatio,
  } = computeProductionReportData(contentHtml);

  return (
    <div className="w-full max-w-5xl mx-auto p-6 space-y-6 font-sans">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
            <span>Speaking Cast</span>
          </div>
          <div className="text-2xl font-bold text-white">{sortedCharacters.length}</div>
        </div>

        <div className="bg-[#181a1f] p-4 rounded-xl border border-[#26282e]">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <BarChart3 className="w-4 h-4 text-emerald-400" />
            <span>Dialogue Words</span>
          </div>
          <div className="text-2xl font-bold text-white">{dialogueWords}</div>
        </div>

        <div className="bg-[#181a1f] p-4 rounded-xl border border-[#26282e]">
          <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
            <Clock className="w-4 h-4 text-purple-400" />
            <span>Est. Screen Time</span>
          </div>
          <div className="text-2xl font-bold text-white">~{Math.max(1, Math.ceil(totalWords / 220))} mins</div>
        </div>
      </div>

      {/* Report Tab Selector */}
      <div className="flex items-center gap-2 border-b border-[#26282e] pb-2 text-xs font-mono">
        {[
          { id: 'cast', label: 'Cast Breakdown', icon: Users },
          { id: 'locations', label: 'Locations & Sets', icon: MapPin },
          { id: 'dood', label: 'Day-Out-of-Days (DOOD)', icon: Calendar },
          { id: 'pacing', label: 'Pacing & Ratios', icon: PieChart },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveReportTab(id as any)}
            className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition-colors ${
              activeReportTab === id
                ? 'bg-amber-500/15 text-amber-400 font-bold border border-amber-500/30'
                : 'text-gray-400 hover:text-white hover:bg-[#181b22]'
            }`}
          >
            <Icon className="w-3.5 h-3.5" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Cast Breakdown Table */}
      {activeReportTab === 'cast' && (
        <div className="bg-[#181a1f] rounded-xl border border-[#26282e] p-6 animate-fadeIn">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <Users className="w-4 h-4 text-amber-500" />
            Cast Speaking Breakdown Report
          </h3>

          {sortedCharacters.length === 0 ? (
            <p className="text-gray-500 text-sm">No speaking characters found in the screenplay yet.</p>
          ) : (
            <div className="space-y-4">
              {sortedCharacters.map(([name, stats]) => {
                const percentage = dialogueWords > 0 ? Math.round((stats.words / dialogueWords) * 100) : 0;
                return (
                  <div key={name} className="space-y-1.5">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="font-bold text-gray-200">{name}</span>
                      <span className="text-gray-400">
                        {stats.scenes.size} scenes · {stats.lines} lines · {stats.words} words ({percentage}%)
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
      )}

      {/* Tab 2: Locations & Sets Breakdown */}
      {activeReportTab === 'locations' && (
        <div className="bg-[#181a1f] rounded-xl border border-[#26282e] p-6 animate-fadeIn">
          <h3 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
            <MapPin className="w-4 h-4 text-emerald-400" />
            Location & Sets Breakdown ({sortedLocations.length} unique sets)
          </h3>

          {sortedLocations.length === 0 ? (
            <p className="text-gray-500 text-sm">No locations found in the screenplay yet.</p>
          ) : (
            <div className="space-y-3">
              {sortedLocations.map(([locName, scenes]) => (
                <div key={locName} className="p-3 bg-[#131417] rounded-lg border border-[#26282e]">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-sm font-bold text-gray-200 uppercase">{locName}</span>
                    <span className="text-xs font-mono text-amber-400 font-semibold bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                      {scenes.length} {scenes.length === 1 ? 'Scene' : 'Scenes'}
                    </span>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {scenes.map((s) => (
                      <span
                        key={s.id}
                        className={`text-[10px] font-mono px-2 py-0.5 rounded border ${
                          s.setting === 'INT'
                            ? 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                            : s.setting === 'EXT'
                            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            : 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                        }`}
                      >
                        #{s.id} {s.setting}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Tab 3: Day-Out-of-Days (DOOD) Matrix (Section 5.3) */}
      {activeReportTab === 'dood' && (
        <div className="bg-[#181a1f] rounded-xl border border-[#26282e] p-6 animate-fadeIn">
          <h3 className="text-base font-semibold text-white mb-2 flex items-center gap-2">
            <Calendar className="w-4 h-4 text-sky-400" />
            Day-Out-of-Days (DOOD) Cast Schedule Matrix
          </h3>
          <p className="text-xs text-gray-400 mb-4 font-mono">
            Standard DOOD schedule: Work (W), Start-Work (SW), Finish-Work (FW), Hold (H) across scenes.
          </p>

          {sortedCharacters.length === 0 || sceneHeadings.length === 0 ? (
            <p className="text-gray-500 text-sm">Add scenes and speaking characters to view the DOOD matrix.</p>
          ) : (
            <div className="overflow-x-auto border border-[#26282e] rounded-lg">
              <table className="w-full text-left text-xs font-mono border-collapse">
                <thead>
                  <tr className="bg-[#131417] text-gray-400 border-b border-[#26282e]">
                    <th className="p-2.5 sticky left-0 bg-[#131417] z-10 border-r border-[#26282e] min-w-[140px]">
                      CHARACTER
                    </th>
                    {sceneHeadings.map((s) => (
                      <th key={s.id} className="p-2 text-center border-r border-[#26282e] min-w-[36px]">
                        #{s.id}
                      </th>
                    ))}
                    <th className="p-2.5 text-center font-bold text-amber-400 min-w-[60px]">
                      TOTAL
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedCharacters.map(([name, data]) => {
                    const sceneIds = Array.from(data.scenes).sort((a, b) => a - b);
                    const firstScene = sceneIds[0];
                    const lastScene = sceneIds[sceneIds.length - 1];

                    return (
                      <tr key={name} className="border-b border-[#26282e] hover:bg-[#15171c]">
                        <td className="p-2.5 font-bold text-gray-200 sticky left-0 bg-[#181a1f] z-10 border-r border-[#26282e] truncate">
                          {name}
                        </td>
                        {sceneHeadings.map((s) => {
                          const works = data.scenes.has(s.id);
                          const isHold = !works && s.id > firstScene && s.id < lastScene;
                          let label = '-';
                          let badgeClass = 'text-gray-600';

                          if (works) {
                            if (s.id === firstScene && s.id === lastScene) {
                              label = 'SWF';
                              badgeClass = 'bg-purple-500/20 text-purple-300 font-bold';
                            } else if (s.id === firstScene) {
                              label = 'SW';
                              badgeClass = 'bg-emerald-500/20 text-emerald-300 font-bold';
                            } else if (s.id === lastScene) {
                              label = 'FW';
                              badgeClass = 'bg-rose-500/20 text-rose-300 font-bold';
                            } else {
                              label = 'W';
                              badgeClass = 'bg-amber-500/20 text-amber-300 font-bold';
                            }
                          } else if (isHold) {
                            label = 'H';
                            badgeClass = 'text-gray-500 bg-gray-800/40';
                          }

                          return (
                            <td key={s.id} className="p-1.5 text-center border-r border-[#26282e]">
                              <span className={`inline-block px-1.5 py-0.5 rounded text-[10px] ${badgeClass}`}>
                                {label}
                              </span>
                            </td>
                          );
                        })}
                        <td className="p-2.5 text-center font-bold text-amber-400">
                          {data.scenes.size} sc
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Tab 4: Pacing & Ratio Statistics (Section 5.3) */}
      {activeReportTab === 'pacing' && (
        <div className="bg-[#181a1f] rounded-xl border border-[#26282e] p-6 animate-fadeIn space-y-6">
          <h3 className="text-base font-semibold text-white flex items-center gap-2">
            <PieChart className="w-4 h-4 text-emerald-400" />
            Pacing & Action/Dialogue Ratio Analysis
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 bg-[#131417] rounded-xl border border-[#26282e] space-y-3">
              <div className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                Dialogue vs. Action Balance
              </div>
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-amber-400 font-bold">Dialogue: {dialogueRatio}% ({dialogueWords} words)</span>
                <span className="text-sky-400 font-bold">Action: {actionRatio}% ({actionWords} words)</span>
              </div>
              <div className="w-full bg-[#242730] h-3 rounded-full overflow-hidden flex">
                <div className="bg-amber-500 h-full" style={{ width: `${dialogueRatio}%` }} />
                <div className="bg-sky-500 h-full" style={{ width: `${actionRatio}%` }} />
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
                Industry standard features typically land between 45%–60% dialogue. Your script currently trends toward {dialogueRatio > 60 ? 'dialogue-heavy drama' : dialogueRatio < 40 ? 'visual action-driven pacing' : 'balanced dramatic pacing'}.
              </p>
            </div>

            <div className="p-4 bg-[#131417] rounded-xl border border-[#26282e] space-y-3">
              <div className="text-xs font-mono text-gray-400 uppercase tracking-wider">
                Average Scene Length
              </div>
              <div className="text-2xl font-bold font-mono text-white">
                {sceneHeadings.length > 0 ? (totalWords / sceneHeadings.length / 220).toFixed(1) : 0} pages
              </div>
              <p className="text-[11px] text-gray-500 leading-relaxed font-sans">
                Average scene duration is approximately {sceneHeadings.length > 0 ? (totalWords / sceneHeadings.length / 220 * 60).toFixed(0) : 0} seconds. Rapid scene transitions sustain higher audience engagement.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
