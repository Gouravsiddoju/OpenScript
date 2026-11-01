import React, { useState } from 'react';
import {
  X,
  Sparkles,
  Folder,
  FileText,
  LayoutGrid,
  Code,
  Cloud,
  Keyboard,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  BookOpen,
  Layers,
  Zap,
} from 'lucide-react';

interface StudioGuideModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface GuideStep {
  title: string;
  badge: string;
  icon: React.ElementType;
  iconColor: string;
  headline: string;
  description: string;
  bullets: { title: string; detail: string }[];
  tip?: string;
}

const GUIDE_STEPS: GuideStep[] = [
  {
    title: 'Custom Folders & Binder',
    badge: 'Organization',
    icon: Folder,
    iconColor: 'text-amber-400 bg-amber-500/10 border-amber-500/30',
    headline: 'Organize your script with custom folders and isolated scene editing.',
    description:
      'Unlike rigid software that forces strict formats, OpenScript lets you create your own arbitrary folders, sequences, acts, or chapters. Click any folder on the left to edit only those scenes.',
    bullets: [
      {
        title: 'Click to Focus',
        detail: 'Click any folder (or individual scene) in the sidebar to isolate only its scenes on the main screen.',
      },
      {
        title: 'Custom Structure',
        detail: 'Use "+ New Folder" to create chapters, sequences, acts, or research sheets tailored to your story.',
      },
      {
        title: 'Master Screenplay View',
        detail: 'Click "Full Screenplay (All)" anytime to see the complete continuous screenplay assembled together.',
      },
    ],
    tip: 'Different folders automatically open on brand new pages when assembling the full screenplay!',
  },
  {
    title: 'Screenplay Keystroke Engine',
    badge: 'Editor',
    icon: Keyboard,
    iconColor: 'text-blue-400 bg-blue-500/10 border-blue-500/30',
    headline: 'Industry-standard Courier Prime typography with natural keystroke transitions.',
    description:
      'Write without ever touching the mouse. OpenScript follows industry standard formatting conventions with automatic line wrapping and margins.',
    bullets: [
      {
        title: 'Tab ⇥ Navigation',
        detail: 'Press Tab on an Action line to switch to Character. Press Tab on Character for Parenthetical.',
      },
      {
        title: 'Enter ⏎ Continuity',
        detail: 'Press Enter on Character to jump to Dialogue. Press Enter on an empty line to return to Action.',
      },
      {
        title: 'Quick Format Shortcuts',
        detail: 'Ctrl+1 for Scene Heading, Ctrl+2 for Action, Ctrl+3 for Character, Ctrl+5 for Dialogue.',
      },
    ],
    tip: 'SmartType autocompletes character names as you type — press Enter or Tab to accept suggestions!',
  },
  {
    title: '4 Specialized Studio Modes',
    badge: 'Views',
    icon: LayoutGrid,
    iconColor: 'text-purple-400 bg-purple-500/10 border-purple-500/30',
    headline: 'Seamlessly switch perspectives as your story evolves.',
    description:
      'Work across four purpose-built interfaces from the left sidebar navigation, all synchronized in real-time.',
    bullets: [
      {
        title: 'Screenplay Paper',
        detail: 'Authentic 8.5" x 11" pages with real physical page boundaries and industry standard margins.',
      },
      {
        title: 'Beat Board',
        detail: 'Visual index corkboard to brainstorm, rearrange scenes via drag-and-drop, and track story beats.',
      },
      {
        title: 'Fountain Source',
        detail: 'Clean, distraction-free markdown screenplay text representation for fast drafting.',
      },
      {
        title: 'Production Reports',
        detail: 'Automated scene breakdown sheets, character dialogue counts, and location summaries.',
      },
    ],
  },
  {
    title: 'Cloud Backups & Auto-Revealing Bar',
    badge: 'Productivity',
    icon: Cloud,
    iconColor: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/30',
    headline: 'Zero-cloud-spend local fallback, S3/R2 backups, and a smart distraction-free header.',
    description:
      'Never worry about losing your work. OpenScript automatically saves local revisions and provides cloud snapshot backups.',
    bullets: [
      {
        title: 'Auto-Revealing Top Bar',
        detail: 'The top bar hides when scrolling down to give you full writing immersion. A slight scroll up brings it right back.',
      },
      {
        title: 'S3 / Cloudflare R2 / MinIO',
        detail: 'Connect S3 or R2 for encrypted snapshots, or use persistent local storage with zero cloud cost.',
      },
      {
        title: 'Drive & Dropbox Quick-Sync',
        detail: 'Export professional vector PDFs, FDX, and Fountain files, and sync directly to Google Drive or Dropbox.',
      },
    ],
    tip: 'Click the "Cloud" button in the top bar to inspect snapshot history or take an instant backup anytime!',
  },
];

export const StudioGuideModal: React.FC<StudioGuideModalProps> = ({ isOpen, onClose }) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);

  if (!isOpen) return null;

  const currentStep = GUIDE_STEPS[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === GUIDE_STEPS.length - 1;

  const handleNext = () => {
    if (isLastStep) {
      onClose();
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  };

  const IconComponent = currentStep.icon;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
      <div 
        className="w-full max-w-2xl bg-[#111318] border border-[#262a36] rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[#1f232e] flex items-center justify-between bg-[#0e1014]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <BookOpen className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-white flex items-center gap-2">
                <span>OpenScript Studio Tour</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {currentStep.badge}
                </span>
              </h2>
              <p className="text-[11px] text-gray-400 font-mono">
                Step {currentStepIndex + 1} of {GUIDE_STEPS.length} • Quick Feature Walkthrough
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1a1d26] transition-colors"
            title="Close guide"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Indicators */}
        <div className="px-6 pt-4 pb-1 grid grid-cols-4 gap-2">
          {GUIDE_STEPS.map((step, idx) => (
            <button
              key={step.title}
              onClick={() => setCurrentStepIndex(idx)}
              className={`h-1.5 rounded-full transition-all duration-200 cursor-pointer ${
                idx === currentStepIndex
                  ? 'bg-amber-400 shadow-sm shadow-amber-400/50'
                  : idx < currentStepIndex
                  ? 'bg-amber-500/40 hover:bg-amber-500/60'
                  : 'bg-[#222634] hover:bg-[#2d3244]'
              }`}
              title={`Jump to ${step.title}`}
            />
          ))}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {/* Headline with Icon */}
          <div className="flex items-start gap-4">
            <div className={`w-12 h-12 rounded-2xl border flex items-center justify-center shrink-0 ${currentStep.iconColor}`}>
              <IconComponent className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white leading-tight">
                {currentStep.title}
              </h3>
              <p className="text-xs text-amber-300/90 font-medium mt-1">
                {currentStep.headline}
              </p>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                {currentStep.description}
              </p>
            </div>
          </div>

          {/* Key Feature Bullets */}
          <div className="space-y-2.5 pt-1">
            {currentStep.bullets.map((b) => (
              <div 
                key={b.title}
                className="p-3 rounded-xl bg-[#151821] border border-[#212634] flex items-start gap-3 transition-colors hover:border-amber-500/30"
              >
                <CheckCircle2 className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-gray-200 font-mono">{b.title}</div>
                  <div className="text-xs text-gray-400 mt-0.5 leading-relaxed">{b.detail}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Pro Tip Callout (if available) */}
          {currentStep.tip && (
            <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center gap-2.5 text-xs text-amber-300">
              <Zap className="w-4 h-4 text-amber-400 shrink-0" />
              <span><strong>Pro Tip:</strong> {currentStep.tip}</span>
            </div>
          )}
        </div>

        {/* Modal Footer Controls */}
        <div className="px-6 py-4 border-t border-[#1f232e] bg-[#0e1014] flex items-center justify-between">
          <button
            onClick={onClose}
            className="text-xs font-mono text-gray-400 hover:text-white transition-colors"
          >
            Skip Tour
          </button>

          <div className="flex items-center gap-2">
            {!isFirstStep && (
              <button
                onClick={handlePrev}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#1a1d26] hover:bg-[#242834] text-gray-300 hover:text-white text-xs font-mono transition-colors border border-[#2c3242]"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                <span>Previous</span>
              </button>
            )}

            <button
              onClick={handleNext}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 to-amber-400 hover:brightness-110 active:scale-95 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all cursor-pointer"
            >
              <span>{isLastStep ? 'Start Writing' : 'Next Step'}</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
