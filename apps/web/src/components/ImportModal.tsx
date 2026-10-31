import React, { useState, useRef } from 'react';
import {
  Upload,
  FileCode,
  FileText,
  CheckCircle,
  AlertCircle,
  AlertTriangle,
  X,
  ArrowRight,
  Sparkles,
  Info,
} from 'lucide-react';
import { importScreenplayFile, ImportedScreenplayResult } from '../utils/importer';
import JSZip from 'jszip';

export interface ImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportScreenplay: (result: ImportedScreenplayResult) => void;
  droppedFile?: File | null;
}

export const ImportModal: React.FC<ImportModalProps> = ({
  isOpen,
  onClose,
  onImportScreenplay,
  droppedFile,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [previewResult, setPreviewResult] = useState<ImportedScreenplayResult | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Automatically process droppedFile if supplied
  React.useEffect(() => {
    if (droppedFile) {
      processFile(droppedFile);
    }
  }, [droppedFile]);

  if (!isOpen) return null;

  const processFile = async (file: File) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await importScreenplayFile(file);
      setPreviewResult(result);
    } catch (err: any) {
      setError(err?.message || 'Failed to parse file. Please verify it is a valid screenplay file.');
      setPreviewResult(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    // Check for directory items
    const items = e.dataTransfer.items;
    if (items && items.length > 0) {
      const firstEntry = items[0].webkitGetAsEntry?.();
      if (firstEntry && firstEntry.isDirectory) {
        // Folder dropped (e.g. MyProject.scriv)
        try {
          setIsLoading(true);
          const files: File[] = [];
          const readDirectory = async (dirEntry: any): Promise<void> => {
            const reader = dirEntry.createReader();
            const entries: any[] = await new Promise((res, rej) => reader.readEntries(res, rej));
            for (const entry of entries) {
              if (entry.isFile) {
                const f: File = await new Promise((res, rej) => entry.file(res, rej));
                files.push(f);
              } else if (entry.isDirectory) {
                await readDirectory(entry);
              }
            }
          };

          await readDirectory(firstEntry);

          // Find .scrivx file
          const scrivxFile = files.find((f) => f.name.toLowerCase().endsWith('.scrivx'));
          if (scrivxFile) {
            // Find all content.rtf or content.txt files
            const contentFiles = files.filter(
              (f) => f.name.toLowerCase() === 'content.rtf' || f.name.toLowerCase() === 'content.txt'
            );

            if (contentFiles.length > 0) {
              // Zip the files on the fly and parse
              const zip = new JSZip();
              for (const f of files) {
                const buffer = await f.arrayBuffer();
                zip.file(f.name, buffer);
              }
              const blob = await zip.generateAsync({ type: 'blob' });
              const virtualZip = new File([blob], `${firstEntry.name}.zip`, { type: 'application/zip' });
              return await processFile(virtualZip);
            } else {
              return await processFile(scrivxFile);
            }
          }
        } catch {}
      }
    }

    const file = e.dataTransfer.files?.[0];
    if (file) {
      processFile(file);
    }
  };

  const handleConfirmImport = () => {
    if (previewResult) {
      onImportScreenplay(previewResult);
      onClose();
      setPreviewResult(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#111319] border border-[#242838] rounded-2xl shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1f2b] bg-[#141622]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Upload className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white tracking-wide">
                Import Existing Screenplay Project
              </h2>
              <p className="text-xs text-gray-400 font-mono">
                Load scripts from Final Draft, Scrivener, Highland, Fountain, RTF, or Celtx
              </p>
            </div>
          </div>
          <button
            onClick={() => {
              onClose();
              setPreviewResult(null);
            }}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2333] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-5">
          
          <input
            ref={fileInputRef}
            type="file"
            accept=".fdx,.fountain,.spmd,.scrivx,.scriv,.zip,.rtf,.html,.htm,.txt,.json,.openscript"
            onChange={handleFileChange}
            className="hidden"
          />

          {/* Drag & Drop Zone */}
          {!previewResult ? (
            <div
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
              className={`border-2 border-dashed rounded-2xl p-8 flex flex-col items-center justify-center text-center cursor-pointer transition-all ${
                isDragging
                  ? 'border-amber-500 bg-amber-500/10 scale-[0.99]'
                  : 'border-[#282d3b] hover:border-amber-500/50 bg-[#151720]/50 hover:bg-[#181b25]'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mb-3 shadow-inner">
                <Upload className="w-6 h-6 animate-pulse" />
              </div>

              <h3 className="text-sm font-bold text-white mb-1">
                Drag & drop your screenplay file or folder here
              </h3>
              <p className="text-xs text-gray-400 max-w-sm mb-4">
                or click to browse. Drop .scriv folder, .zip, .fdx, .fountain, or .rtf files.
              </p>

              <button
                type="button"
                className="px-4 py-2 bg-[#202430] hover:bg-[#2a3040] text-amber-300 border border-amber-500/30 text-xs font-mono font-semibold rounded-xl transition-all shadow-sm"
              >
                Browse Files
              </button>
            </div>
          ) : (
            /* Parsed File Preview Card */
            <div className="space-y-4">
              <div className="p-4 rounded-xl bg-[#161822] border border-amber-500/40 space-y-3 shadow-md">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                    <span className="text-xs font-mono font-bold text-emerald-400 uppercase tracking-wider">
                      Ready to Import
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[11px] font-mono font-bold">
                    {previewResult.sourceApp}
                  </span>
                </div>

                <div className="border-t border-[#232733] pt-3 grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-gray-400 text-[11px] block font-mono">Title</span>
                    <span className="font-bold text-white font-screenplay truncate block">
                      {previewResult.title || 'Untitled Script'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[11px] block font-mono">Author</span>
                    <span className="font-semibold text-gray-200 truncate block">
                      {previewResult.author || 'Author'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[11px] block font-mono">Scenes Detected</span>
                    <span className="font-bold text-amber-400 font-mono">
                      {previewResult.sceneCount} {previewResult.sceneCount === 1 ? 'Scene' : 'Scenes'}
                    </span>
                  </div>
                  <div>
                    <span className="text-gray-400 text-[11px] block font-mono">Word Count</span>
                    <span className="font-semibold text-gray-300 font-mono">
                      ~{previewResult.wordCount} words
                    </span>
                  </div>
                </div>

                {/* Warnings Banner if present */}
                {previewResult.warnings && previewResult.warnings.length > 0 && (
                  <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-xs text-amber-200 space-y-1.5">
                    {previewResult.warnings.map((w, idx) => (
                      <div key={idx} className="flex items-start gap-2">
                        <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                        <span className="leading-relaxed">{w}</span>
                      </div>
                    ))}
                  </div>
                )}

                {/* Script Snippet Preview */}
                <div className="pt-2">
                  <span className="text-[10px] font-mono text-gray-500 uppercase tracking-wider block mb-1">
                    First Scene Content Preview:
                  </span>
                  <div className="p-3 rounded-lg bg-[#0e1015] border border-[#232632] max-h-36 overflow-y-auto font-mono text-[11px] leading-relaxed text-gray-300 whitespace-pre-wrap">
                    {previewResult.fountainText.slice(0, 350)}...
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setPreviewResult(null)}
                  className="px-3 py-1.5 rounded-lg text-xs font-mono text-gray-400 hover:text-white bg-[#1a1d26] transition-colors"
                >
                  Choose Different File
                </button>

                <button
                  type="button"
                  onClick={handleConfirmImport}
                  className="flex items-center gap-1.5 px-4 py-2 bg-amber-500 hover:bg-amber-400 text-black text-xs font-mono font-bold rounded-xl shadow-lg shadow-amber-500/20 transition-all"
                >
                  <span>Load into OpenScript</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {error && (
            <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-300 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Supported Apps Matrix */}
          <div className="p-4 rounded-xl bg-[#14161f] border border-[#222633] space-y-2.5">
            <span className="text-[11px] font-mono font-semibold text-gray-400 uppercase tracking-wider block">
              Supported Formats (Screenplay Content Only):
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs font-mono">
              <div className="p-2 rounded-lg bg-[#0e1015] border border-[#232733] flex items-center gap-1.5">
                <span className="text-amber-400">🎬</span>
                <div>
                  <span className="text-gray-200 block text-[11px] font-bold">Final Draft</span>
                  <span className="text-[10px] text-gray-500">.fdx</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#0e1015] border border-[#232733] flex items-center gap-1.5">
                <span className="text-blue-400">🖋️</span>
                <div>
                  <span className="text-gray-200 block text-[11px] font-bold">Scrivener</span>
                  <span className="text-[10px] text-gray-500">.scriv folder, .zip, .rtf</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#0e1015] border border-[#232733] flex items-center gap-1.5">
                <span className="text-purple-400">🏔️</span>
                <div>
                  <span className="text-gray-200 block text-[11px] font-bold">Highland / Duet</span>
                  <span className="text-[10px] text-gray-500">.fountain, .spmd</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#0e1015] border border-[#232733] flex items-center gap-1.5">
                <span className="text-emerald-400">📄</span>
                <div>
                  <span className="text-gray-200 block text-[11px] font-bold">Plain Text</span>
                  <span className="text-[10px] text-gray-500">.txt</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#0e1015] border border-[#232733] flex items-center gap-1.5">
                <span className="text-orange-400">🌐</span>
                <div>
                  <span className="text-gray-200 block text-[11px] font-bold">Celtx / Web</span>
                  <span className="text-[10px] text-gray-500">.html</span>
                </div>
              </div>

              <div className="p-2 rounded-lg bg-[#0e1015] border border-[#232733] flex items-center gap-1.5">
                <span className="text-rose-400">💾</span>
                <div>
                  <span className="text-gray-200 block text-[11px] font-bold">OpenScript</span>
                  <span className="text-[10px] text-gray-500">.openscript, .json</span>
                </div>
              </div>
            </div>
            <p className="text-[10px] text-gray-500 italic pt-1">
              * Note: Scrivener scripts can be imported by dropping the entire <code className="text-gray-400 font-mono">.scriv</code> folder, a <code className="text-gray-400 font-mono">.zip</code> of it, or an exported <code className="text-gray-400 font-mono">.rtf</code> / <code className="text-gray-400 font-mono">.fountain</code>.
            </p>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#20232e] bg-[#161821] flex justify-end">
          <button
            onClick={() => {
              onClose();
              setPreviewResult(null);
            }}
            className="px-4 py-2 bg-[#202430] hover:bg-[#2b3040] text-gray-200 text-xs font-mono rounded-lg transition-colors"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
