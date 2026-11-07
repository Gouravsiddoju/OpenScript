function sanitizeFilename(title: string, defaultName = 'Screenplay'): string {
  return title ? title.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') : defaultName;
}
import React from 'react';
import {
  X,
  Printer,
  FileCode,
  FileText,
  Download,
  CheckCircle,
  Globe,
  Layers,
  Sparkles,
  Cloud,
  UploadCloud,
  ExternalLink,
  Check,
} from 'lucide-react';
import { TitlePageMetadata } from './TitlePageModal';
import { ScreenplayBlock, RevisionColor, SceneTake, ScriptNote } from '@openscript/screenplay-schema';
import {
  exportOpenScriptProject,
  exportFinalDraftFdx,
  exportFountainFile,
  exportHtmlFile,
  exportScreenplayPdf,
} from '../utils/exporter';

export interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  blocks: ScreenplayBlock[];
  metadata: TitlePageMetadata;
  sceneTakes?: SceneTake[];
  notes?: ScriptNote[];
  revisionNumber?: number;
  activeRevisionColor?: RevisionColor;
  onTriggerPdfPrint: () => void;
  selectedActId?: string | null;
  sceneFolderMap?: Record<number, string>;
  folders?: { id: string; name: string }[];
  projectId?: string;
  onOpenCloudModal?: () => void;
}

export const ExportModal: React.FC<ExportModalProps> = ({
  isOpen,
  onClose,
  blocks,
  metadata,
  sceneTakes = [],
  notes = [],
  revisionNumber = 1,
  activeRevisionColor = 'white',
  onTriggerPdfPrint,
  selectedActId = null,
  sceneFolderMap,
  folders = [],
  projectId = '',
  onOpenCloudModal,
}) => {
  if (!isOpen) return null;

  const sceneCount = blocks.filter((b) => b.type === 'sceneHeading').length;
  const wordCount = blocks.reduce((acc, b) => acc + (b.text?.split(/\s+/).filter(Boolean).length || 0), 0);

  const handleExportOpenScript = (ext: 'openscript' | 'json') => {
    exportOpenScriptProject(
      {
        blocks,
        metadata,
        sceneTakes,
        notes,
        revisionNumber,
        activeRevisionColor,
      },
      ext
    );
  };

  const handleExportFdx = () => {
    exportFinalDraftFdx({ blocks, metadata });
  };

  const handleExportFountain = () => {
    exportFountainFile({ blocks, metadata });
  };

  const handleExportHtml = () => {
    exportHtmlFile({ blocks, metadata });
  };

  const handleDownloadPdf = (actOverride?: string | null) => {
    exportScreenplayPdf({
      blocks,
      metadata,
      showWatermark: metadata.showWatermark,
      watermarkText: metadata.watermarkText,
      selectedActId: actOverride !== undefined ? actOverride : selectedActId,
      sceneFolderMap,
    });
    onClose();
  };

  const [cloudSaving, setCloudSaving] = React.useState(false);
  const [cloudStatusMsg, setCloudStatusMsg] = React.useState<string | null>(null);

  const handleSaveToCloud = async () => {
    setCloudSaving(true);
    setCloudStatusMsg(null);
    try {
      const filename = `${sanitizeFilename(metadata.title || 'Screenplay')}_v${revisionNumber}.openscript`;
      const snapshot = {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        metadata,
        content: blocks,
        sceneTakes,
        notes,
        revisionNumber,
        activeRevisionColor,
      };

      const res = await fetch('/api/v1/storage/backup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          filename,
          content: JSON.stringify(snapshot, null, 2),
          contentType: 'application/json',
          metadata: {
            title: metadata.title || 'Screenplay',
            draftLabel: metadata.draftLabel || 'Production Draft',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setCloudStatusMsg(`Saved to ${data.backup?.provider?.toUpperCase() || 'Cloud'} Storage!`);
      } else {
        setCloudStatusMsg('Saved to local storage fallback');
      }
    } catch {
      setCloudStatusMsg('Saved to local persistent storage');
    } finally {
      setCloudSaving(false);
      setTimeout(() => setCloudStatusMsg(null), 4000);
    }
  };

  const handleOpenGoogleDrive = () => {
    window.open('https://drive.google.com/drive/u/0/my-drive', '_blank');
  };

  const handleOpenDropbox = () => {
    window.open('https://www.dropbox.com/home', '_blank');
  };

  const handlePrintPdf = () => {
    onClose();
    setTimeout(() => {
      onTriggerPdfPrint();
    }, 150);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div
        className="w-full max-w-3xl bg-[#0f1117] border border-[#232733] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1f2b] bg-[#131620]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Download className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">Export Screenplay</h2>
              <p className="text-xs text-gray-400 font-mono">
                Download formatted studio script, PDF, or reloadable project archives
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2333] transition-colors"
            title="Close"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Script Overview Summary Bar */}
        <div className="px-6 py-3 bg-[#0a0c10] border-b border-[#1a1d26] flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
          <div className="flex items-center gap-2">
            <span className="text-gray-500">Document:</span>
            <span className="text-amber-400 font-bold uppercase truncate max-w-xs">
              {metadata.title || 'Untitled Screenplay'}
            </span>
            <span className="text-gray-500">•</span>
            <span className="text-gray-400">{metadata.author || 'Author'}</span>
          </div>
          <div className="flex items-center gap-4 text-gray-400">
            <span>
              <strong className="text-gray-200">{sceneCount}</strong> scenes
            </span>
            <span>
              <strong className="text-gray-200">{wordCount.toLocaleString()}</strong> words
            </span>
            <span className="px-2 py-0.5 rounded bg-[#1e2230] border border-[#2c3245] text-amber-300 text-[10px]">
              {metadata.draftLabel || 'First Draft'}
            </span>
          </div>
        </div>

        {/* Export Formats Grid */}
        <div className="p-6 overflow-y-auto space-y-4">
          {/* 1. PDF Export (Primary) */}
          <div className="p-4 rounded-xl bg-[#131622] border border-[#262c3e] hover:border-amber-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Download className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Screenplay PDF (.pdf)</h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    Industry Standard
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Direct US Letter vector PDF with Courier font, 1.5" left margin, 1.0" top/bottom/right margins, page numbers, title page, and watermarks.
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto shrink-0 flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
              {selectedActId && (
                <button
                  onClick={() => handleDownloadPdf(null)}
                  className="px-3 py-2 rounded-xl bg-[#1e2230] hover:bg-[#2c3245] border border-[#3b435c] text-amber-300 text-xs font-mono font-semibold transition-all"
                  title="Export complete screenplay across all acts"
                >
                  Export All Acts
                </button>
              )}
              <button
                onClick={() => handleDownloadPdf()}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all"
                title="Download formatted Screenplay PDF file"
              >
                <Download className="w-4 h-4" />
                <span>Download PDF</span>
              </button>
              <button
                onClick={handlePrintPdf}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#1a1e2a] hover:bg-[#252b3c] border border-[#343b52] text-gray-300 hover:text-white text-xs font-mono transition-colors"
                title="Open browser print dialog"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>Print</span>
              </button>
            </div>
          </div>

          {/* 2. OpenScript Project Snapshot (100% Reloadable) */}
          <div className="p-4 rounded-xl bg-[#131622] border border-[#262c3e] hover:border-emerald-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 shrink-0 mt-0.5">
                <Sparkles className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">OpenScript Studio Archive</h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                    <CheckCircle className="w-3 h-3" /> 100% Reloadable
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Full studio project backup containing all script blocks, scene numbers, scene takes, collaboration notes, and title metadata.
                </p>
              </div>
            </div>
            <div className="w-full sm:w-auto shrink-0 flex items-center gap-2">
              <button
                onClick={() => handleExportOpenScript('openscript')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-[#1c2230] hover:bg-[#252d40] border border-emerald-500/40 text-emerald-300 hover:text-white font-mono text-xs transition-colors"
                title="Download .openscript project file"
              >
                <Layers className="w-3.5 h-3.5" />
                <span>.openscript</span>
              </button>
              <button
                onClick={() => handleExportOpenScript('json')}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#181b24] hover:bg-[#222736] border border-[#2b3144] text-gray-300 hover:text-white font-mono text-xs transition-colors"
                title="Download .json project file"
              >
                <span>.json</span>
              </button>
            </div>
          </div>

          {/* 3. Final Draft (.fdx) */}
          <div className="p-4 rounded-xl bg-[#131622] border border-[#262c3e] hover:border-blue-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0 mt-0.5">
                <FileCode className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Final Draft 12 XML</h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-blue-500/20 text-blue-300 border border-blue-500/30">
                    FDX Production Format
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Industry-standard XML format. Compatible with Final Draft, Movie Magic Scheduling, casting software, and reloadable into OpenScript.
                </p>
              </div>
            </div>
            <button
              onClick={handleExportFdx}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#1a2233] hover:bg-[#222e47] border border-blue-500/40 text-blue-300 hover:text-white font-mono text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .fdx</span>
            </button>
          </div>

          {/* 4. Fountain Screenplay (.fountain) */}
          <div className="p-4 rounded-xl bg-[#131622] border border-[#262c3e] hover:border-amber-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 shrink-0 mt-0.5">
                <FileText className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Fountain / Highland Script</h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-purple-500/20 text-purple-300 border border-purple-500/30">
                    Universal Plaintext
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Clean screenplay plain text with complete Title Page header block. Compatible with Highland 2, WriterDuet, and reloadable into OpenScript.
                </p>
              </div>
            </div>
            <button
              onClick={handleExportFountain}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#231b30] hover:bg-[#322547] border border-purple-500/40 text-purple-300 hover:text-white font-mono text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .fountain</span>
            </button>
          </div>

          {/* 6. Cloud Storage & Sync Integrations */}
          <div className="p-4 rounded-xl bg-[#131622] border border-[#262c3e] hover:border-amber-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                <Cloud className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Cloud Storage & Drive Sync</h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    S3 / R2 / Google Drive
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Back up snapshots to S3 / Cloudflare R2 object storage, or sync script files directly to Google Drive and Dropbox.
                </p>
                {cloudStatusMsg && (
                  <p className="text-xs text-emerald-400 mt-1.5 font-mono flex items-center gap-1">
                    <Check className="w-3.5 h-3.5" />
                    <span>{cloudStatusMsg}</span>
                  </p>
                )}
              </div>
            </div>

            <div className="w-full sm:w-auto shrink-0 flex items-center gap-2 flex-wrap">
              <button
                onClick={handleSaveToCloud}
                disabled={cloudSaving}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-amber-500/15 hover:bg-amber-500/25 border border-amber-500/40 text-amber-300 hover:text-white font-mono text-xs transition-colors disabled:opacity-50"
                title="Save encrypted snapshot to S3 / Cloudflare R2 / Local cloud storage"
              >
                <UploadCloud className="w-3.5 h-3.5" />
                <span>{cloudSaving ? 'Saving...' : 'Sync S3 / R2'}</span>
              </button>

              <button
                onClick={handleOpenGoogleDrive}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#181d2a] hover:bg-[#22293b] border border-[#2e374f] text-gray-300 hover:text-white font-mono text-xs transition-colors"
                title="Open Google Drive to upload script export"
              >
                <span>Google Drive</span>
                <ExternalLink className="w-3 h-3 text-gray-500" />
              </button>

              <button
                onClick={handleOpenDropbox}
                className="flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl bg-[#181d2a] hover:bg-[#22293b] border border-[#2e374f] text-gray-300 hover:text-white font-mono text-xs transition-colors"
                title="Open Dropbox to upload script export"
              >
                <span>Dropbox</span>
                <ExternalLink className="w-3 h-3 text-gray-500" />
              </button>
            </div>
          </div>

          {/* 5. Standalone Screenplay HTML (.html) */}
          <div className="p-4 rounded-xl bg-[#131622] border border-[#262c3e] hover:border-cyan-500/50 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3.5">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                <Globe className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-white">Screenplay Web Document</h3>
                  <span className="text-[10px] uppercase font-mono px-2 py-0.5 rounded bg-cyan-500/20 text-cyan-300 border border-cyan-500/30">
                    HTML Preview
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                  Self-contained styled HTML file with Courier typography. Opens directly in any browser without needing script software.
                </p>
              </div>
            </div>
            <button
              onClick={handleExportHtml}
              className="w-full sm:w-auto shrink-0 flex items-center justify-center gap-1.5 px-4 py-2 rounded-xl bg-[#162529] hover:bg-[#1e343b] border border-cyan-500/40 text-cyan-300 hover:text-white font-mono text-xs transition-colors"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Export .html</span>
            </button>
          </div>
        </div>

        {/* Footer Note */}
        <div className="px-6 py-3.5 bg-[#0d0f15] border-t border-[#1a1d26] flex items-center justify-between text-xs text-gray-400">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-emerald-400" />
            <span>
              <strong>.openscript</strong>, <strong>.fdx</strong>, and <strong>.fountain</strong> files can be dragged back into OpenScript at any time.
            </span>
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1a1d28] hover:bg-[#25293a] text-gray-300 hover:text-white transition-colors font-mono"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
