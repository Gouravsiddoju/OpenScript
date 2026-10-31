import React, { useState, useEffect } from 'react';
import { Play, Pause, RotateCcw, Target, Zap, X, Award } from 'lucide-react';

interface SprintWidgetProps {
  isOpen: boolean;
  onClose: () => void;
  currentWordCount: number;
}

export const SprintWidget: React.FC<SprintWidgetProps> = ({
  isOpen,
  onClose,
  currentWordCount,
}) => {
  const [sprintDurationMinutes, setSprintDurationMinutes] = useState(25);
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(25 * 60);
  const [isRunning, setIsRunning] = useState(false);
  const [startWordCount, setStartWordCount] = useState(currentWordCount);
  const [targetWords, setTargetWords] = useState(300);

  // Update starting baseline when sprint starts
  const handleStart = () => {
    if (!isRunning) {
      setStartWordCount(currentWordCount);
    }
    setIsRunning(true);
  };

  const handlePause = () => {
    setIsRunning(false);
  };

  const handleReset = (mins = sprintDurationMinutes) => {
    setIsRunning(false);
    setSprintDurationMinutes(mins);
    setTimeLeftSeconds(mins * 60);
    setStartWordCount(currentWordCount);
  };

  // Timer countdown
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTimeLeftSeconds((prev) => {
        if (prev <= 1) {
          setIsRunning(false);
          // Audio chime or alert
          try {
            const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
            const osc = ctx.createOscillator();
            osc.frequency.setValueAtTime(587.33, ctx.currentTime); // D5 chime
            osc.connect(ctx.destination);
            osc.start();
            osc.stop(ctx.currentTime + 0.5);
          } catch (e) {}
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  if (!isOpen) return null;

  const minutes = Math.floor(timeLeftSeconds / 60);
  const seconds = timeLeftSeconds % 60;
  const formattedTime = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;

  const wordsWrittenInSprint = Math.max(0, currentWordCount - startWordCount);
  const progressPercent = Math.min(100, Math.round((wordsWrittenInSprint / targetWords) * 100));

  return (
    <div className="fixed top-16 right-4 z-40 w-80 bg-[#14161b] border border-amber-500/40 rounded-2xl shadow-2xl p-4 text-gray-200 animate-in fade-in slide-in-from-top-4 duration-200">
      {/* Header */}
      <div className="flex items-center justify-between pb-3 border-b border-[#232731]">
        <div className="flex items-center gap-2">
          <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-400">
            <Zap className="w-4 h-4 fill-amber-400/20" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white font-mono uppercase tracking-wider">
              Writing Sprint & Goals
            </h4>
            <span className="text-[10px] text-gray-400">Section 7 Ergonomics</span>
          </div>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded-lg hover:bg-[#1f232b] text-gray-400 hover:text-white transition-colors"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Timer Display */}
      <div className="py-4 text-center">
        <div className="text-4xl font-mono font-bold text-white tracking-widest">
          {formattedTime}
        </div>
        <div className="flex items-center justify-center gap-1.5 mt-2">
          {[15, 25, 45].map((m) => (
            <button
              key={m}
              onClick={() => handleReset(m)}
              className={`px-2 py-0.5 rounded text-[10px] font-mono transition-colors ${
                sprintDurationMinutes === m
                  ? 'bg-amber-500 text-black font-bold'
                  : 'bg-[#1b1e26] text-gray-400 hover:text-white'
              }`}
            >
              {m}m
            </button>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-center gap-3 pb-3">
        {isRunning ? (
          <button
            onClick={handlePause}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-[#222631] hover:bg-[#2c3240] text-amber-400 font-mono text-xs font-semibold border border-amber-500/30 transition-all"
          >
            <Pause className="w-3.5 h-3.5" />
            <span>Pause</span>
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-mono text-xs font-bold shadow-md shadow-amber-500/20 transition-all"
          >
            <Play className="w-3.5 h-3.5 fill-black" />
            <span>Start Sprint</span>
          </button>
        )}
        <button
          onClick={() => handleReset(sprintDurationMinutes)}
          className="p-1.5 rounded-xl bg-[#1b1e26] hover:bg-[#252a36] text-gray-400 hover:text-white border border-[#2b303c] transition-colors"
          title="Reset timer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Target Progress Bar */}
      <div className="pt-3 border-t border-[#232731] space-y-2">
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-gray-400 flex items-center gap-1">
            <Target className="w-3 h-3 text-amber-500" />
            <span>Sprint Output:</span>
          </span>
          <span className="text-white font-semibold">
            {wordsWrittenInSprint} / {targetWords} words ({progressPercent}%)
          </span>
        </div>

        <div className="w-full bg-[#1b1e26] h-1.5 rounded-full overflow-hidden">
          <div
            className="bg-gradient-to-r from-amber-500 to-amber-300 h-full transition-all duration-300 rounded-full"
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {progressPercent >= 100 && (
          <div className="flex items-center gap-1 text-[10px] text-emerald-400 font-mono">
            <Award className="w-3 h-3 text-emerald-400" />
            <span>Sprint Goal Achieved! Excellent writing session.</span>
          </div>
        )}
      </div>
    </div>
  );
};
