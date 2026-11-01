import React, { useState, useEffect, useCallback } from 'react';
import {
  X,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Folder,
  Keyboard,
  FileText,
  Cloud,
} from 'lucide-react';

export interface TourStep {
  selector: string;
  title: string;
  badge: string;
  icon: React.ElementType;
  description: string;
  tip?: string;
  preferredPosition?: 'right' | 'bottom' | 'top' | 'left';
}

const TOUR_STEPS: TourStep[] = [
  {
    selector: '[data-tour="sidebar"]',
    title: 'Custom Folders & Binder',
    badge: 'Organization',
    icon: Folder,
    description:
      'Organize scenes into custom folders, acts, or sequences. Click any folder to isolate and write only those scenes, or click "All Acts" to view the full screenplay.',
    tip: 'Click "+ Scene" to append a new scene to any folder or unassigned section.',
    preferredPosition: 'right',
  },
  {
    selector: '[data-tour="format-bar"]',
    title: 'Floating Screenplay Format Island',
    badge: 'Toolbar',
    icon: Sparkles,
    description:
      'Instantly change block format: Scene Heading, Action, Character, Parenthetical, Dialogue, Transition, Dual Dialogue, and Revision asterisk (*).',
    tip: 'Shortcuts: Ctrl+1..6 or Tab to advance smoothly through writing states without touching your mouse.',
    preferredPosition: 'bottom',
  },
  {
    selector: '[data-tour="paper-canvas"]',
    title: 'Authentic 8.5" x 11" Paper Canvas',
    badge: 'Canvas',
    icon: FileText,
    description:
      'Industry-calibrated Courier Prime 12pt with true physical page separations, dark desk gaps, standard margins, and running page headers.',
    tip: 'Toggle Typewriter Mode from the header to keep your active typing line vertically centered.',
    preferredPosition: 'bottom',
  },
  {
    selector: '[data-tour="header-actions"]',
    title: 'Import, Export & Cloud Sync',
    badge: 'Production',
    icon: Cloud,
    description:
      'Import Final Draft (.fdx), PDF, and Fountain files. Export production PDFs or Final Draft files, and manage cloud snapshots seamlessly.',
    tip: 'All changes are automatically synced to the cloud backend as you type.',
    preferredPosition: 'bottom',
  },
];

interface InteractiveTourProps {
  isOpen: boolean;
  onClose: () => void;
}

export const InteractiveTour: React.FC<InteractiveTourProps> = ({ isOpen, onClose }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [targetRect, setTargetRect] = useState<DOMRect | null>(null);

  const step = TOUR_STEPS[currentStepIndex];

  const updateTargetRect = useCallback(() => {
    if (!isOpen || !step) return;
    const el = document.querySelector(step.selector);
    if (el) {
      const rect = el.getBoundingClientRect();
      setTargetRect(rect);
    } else {
      setTargetRect(null);
    }
  }, [isOpen, step]);

  useEffect(() => {
    if (!isOpen) {
      setCurrentStepIndex(0);
      setTargetRect(null);
      return;
    }
    updateTargetRect();
    const handleResize = () => updateTargetRect();
    window.addEventListener('resize', handleResize);
    window.addEventListener('scroll', handleResize, true);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('scroll', handleResize, true);
    };
  }, [isOpen, updateTargetRect]);

  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        localStorage.setItem('openscript_seen_guide_tour', 'true');
        onClose();
      } else if (e.key === 'ArrowRight') {
        if (currentStepIndex < TOUR_STEPS.length - 1) {
          setCurrentStepIndex((prev) => prev + 1);
        } else {
          localStorage.setItem('openscript_seen_guide_tour', 'true');
          onClose();
        }
      } else if (e.key === 'ArrowLeft') {
        if (currentStepIndex > 0) {
          setCurrentStepIndex((prev) => prev - 1);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, currentStepIndex, onClose]);

  if (!isOpen || !step) return null;

  const handleNext = () => {
    if (currentStepIndex < TOUR_STEPS.length - 1) {
      setCurrentStepIndex((prev) => prev + 1);
    } else {
      localStorage.setItem('openscript_seen_guide_tour', 'true');
      onClose();
    }
  };

  const handlePrev = () => {
    if (currentStepIndex > 0) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const handleSkip = () => {
    localStorage.setItem('openscript_seen_guide_tour', 'true');
    onClose();
  };

  // Compute Tooltip Coordinates
  let tooltipStyle: React.CSSProperties = {
    position: 'fixed',
    zIndex: 65,
  };

  if (targetRect) {
    const pad = 16;
    const tooltipWidth = Math.min(380, window.innerWidth - 32);

    if (step.preferredPosition === 'right' && targetRect.right + tooltipWidth + pad < window.innerWidth) {
      tooltipStyle = {
        position: 'fixed',
        left: targetRect.right + pad,
        top: Math.max(70, Math.min(window.innerHeight - 320, targetRect.top + 40)),
        width: tooltipWidth,
        zIndex: 65,
      };
    } else if (step.preferredPosition === 'bottom' && targetRect.bottom + 260 < window.innerHeight) {
      const centerX = targetRect.left + targetRect.width / 2;
      const left = Math.max(pad, Math.min(window.innerWidth - tooltipWidth - pad, centerX - tooltipWidth / 2));
      tooltipStyle = {
        position: 'fixed',
        left,
        top: targetRect.bottom + pad,
        width: tooltipWidth,
        zIndex: 65,
      };
    } else {
      // Fallback: Centered below or above
      const centerX = targetRect.left + targetRect.width / 2;
      const left = Math.max(pad, Math.min(window.innerWidth - tooltipWidth - pad, centerX - tooltipWidth / 2));
      const top = targetRect.top > 320 ? targetRect.top - 280 : targetRect.bottom + pad;
      tooltipStyle = {
        position: 'fixed',
        left,
        top: Math.max(70, top),
        width: tooltipWidth,
        zIndex: 65,
      };
    }
  } else {
    // Default center if target not visible
    tooltipStyle = {
      position: 'fixed',
      left: '50%',
      top: '50%',
      transform: 'translate(-50%, -50%)',
      width: Math.min(380, window.innerWidth - 32),
      zIndex: 65,
    };
  }

  const StepIcon = step.icon;

  return (
    <div className="no-print fixed inset-0 z-60 select-none overflow-hidden animate-in fade-in duration-200">
      {/* Dark overlay backdrop with click to skip */}
      <div 
        onClick={handleSkip}
        className="absolute inset-0 bg-black/75 backdrop-blur-[2px] transition-all"
      />

      {/* Spotlight cutout border over the active element */}
      {targetRect && (
        <div
          style={{
            position: 'fixed',
            left: Math.max(0, targetRect.left - 6),
            top: Math.max(0, targetRect.top - 6),
            width: targetRect.width + 12,
            height: targetRect.height + 12,
            pointerEvents: 'none',
            zIndex: 62,
          }}
          className="rounded-2xl border-2 border-amber-400 ring-8 ring-amber-500/20 shadow-[0_0_50px_rgba(245,158,11,0.35)] transition-all duration-300 ease-out"
        />
      )}

      {/* Floating Interactive Tooltip Card */}
      <div
        style={tooltipStyle}
        onClick={(e) => e.stopPropagation()}
        className="bg-[#12141a]/98 backdrop-blur-xl border border-amber-500/50 rounded-2xl p-5 shadow-2xl shadow-black flex flex-col gap-3.5 transition-all duration-300 ease-out animate-in zoom-in-95"
      >
        {/* Header row */}
        <div className="flex items-center justify-between border-b border-[#242838] pb-3">
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-400">
              <StepIcon className="w-4 h-4" />
            </span>
            <div>
              <span className="text-[10px] font-mono uppercase tracking-wider text-amber-400 font-bold block">
                {step.badge} • Step {currentStepIndex + 1} of {TOUR_STEPS.length}
              </span>
              <h3 className="text-sm font-bold text-white tracking-wide">
                {step.title}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSkip}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-[#202433] transition-colors"
            title="Close Tour (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content body */}
        <p className="text-xs text-gray-300 leading-relaxed font-sans">
          {step.description}
        </p>

        {step.tip && (
          <div className="p-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] font-mono text-amber-300 flex items-start gap-2">
            <Sparkles className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
            <span>{step.tip}</span>
          </div>
        )}

        {/* Footer controls & step dots */}
        <div className="flex items-center justify-between pt-2 border-t border-[#242838]">
          {/* Step dots */}
          <div className="flex items-center gap-1.5">
            {TOUR_STEPS.map((_, idx) => (
              <span
                key={idx}
                className={`w-2 h-2 rounded-full transition-all ${
                  idx === currentStepIndex
                    ? 'bg-amber-400 w-5'
                    : idx < currentStepIndex
                    ? 'bg-amber-500/40'
                    : 'bg-[#2b3040]'
                }`}
              />
            ))}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && (
              <button
                type="button"
                onClick={handlePrev}
                className="px-2.5 py-1.5 rounded-xl bg-[#181a22] hover:bg-[#222530] border border-[#2b303d] text-xs font-mono text-gray-300 hover:text-white transition-all flex items-center gap-1"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>Back</span>
              </button>
            )}

            <button
              type="button"
              onClick={handleNext}
              className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold transition-all shadow-md flex items-center gap-1.5"
            >
              {currentStepIndex === TOUR_STEPS.length - 1 ? (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Done</span>
                </>
              ) : (
                <>
                  <span>Next</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
