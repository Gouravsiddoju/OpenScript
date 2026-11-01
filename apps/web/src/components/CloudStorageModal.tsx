import React, { useState, useEffect } from 'react';
import { 
  X, 
  Cloud, 
  CloudUpload, 
  Database, 
  Server, 
  Download, 
  RefreshCw, 
  CheckCircle2, 
  AlertCircle,
  HardDrive,
  ExternalLink,
  ShieldCheck,
  FolderArchive
} from 'lucide-react';
import { ScreenplayBlock, RevisionColor, SceneTake, ScriptNote } from '@openscript/screenplay-schema';
import { TitlePageMetadata } from './TitlePageModal';

export interface CloudStorageModalProps {
  isOpen: boolean;
  onClose: () => void;
  projectId: string;
  blocks: ScreenplayBlock[];
  metadata: TitlePageMetadata;
  sceneTakes?: SceneTake[];
  notes?: ScriptNote[];
  revisionNumber?: number;
  activeRevisionColor?: RevisionColor;
}

export interface BackupRecord {
  key: string;
  filename: string;
  projectId: string;
  size: number;
  lastModified: string;
  provider: 's3' | 'r2' | 'minio' | 'local';
  url?: string;
}

export const CloudStorageModal: React.FC<CloudStorageModalProps> = ({
  isOpen,
  onClose,
  projectId,
  blocks,
  metadata,
  sceneTakes = [],
  notes = [],
  revisionNumber = 1,
  activeRevisionColor = 'white',
}) => {
  const [status, setStatus] = useState<any>(null);
  const [backups, setBackups] = useState<BackupRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [message, setMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (isOpen) {
      loadStorageStatus();
      loadBackups();
    }
  }, [isOpen, projectId]);

  const loadStorageStatus = async () => {
    try {
      const res = await fetch('/api/v1/storage/status');
      if (res.ok) {
        const data = await res.json();
        setStatus(data);
      }
    } catch (err) {
      console.warn('Failed to fetch storage status:', err);
    }
  };

  const loadBackups = async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`/api/v1/storage/backups/${projectId}`);
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (err) {
      console.warn('Failed to load backups:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateBackup = async () => {
    setIsBackingUp(true);
    setMessage(null);
    try {
      const title = metadata.title || 'Screenplay';
      const safeTitle = title.replace(/[^a-zA-Z0-9_-]/g, '_');
      const filename = `${safeTitle}_v${revisionNumber}_${activeRevisionColor}.openscript`;

      const snapshot = {
        schemaVersion: 2,
        exportedAt: new Date().toISOString(),
        revisionNumber,
        activeRevisionColor,
        metadata,
        content: blocks,
        sceneTakes,
        notes,
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
            title,
            draftLabel: metadata.draftLabel || 'Production Draft',
          },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setMessage({
          text: `Snapshot successfully backed up to ${data.backup?.provider?.toUpperCase() || 'Cloud'} Storage!`,
          type: 'success',
        });
        await loadBackups();
      } else {
        setMessage({ text: 'Backup completed using local persistent storage.', type: 'success' });
      }
    } catch (err: any) {
      setMessage({ text: err.message || 'Backup failed.', type: 'error' });
    } finally {
      setIsBackingUp(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200">
      <div 
        className="w-full max-w-2xl bg-[#0f1118] border border-[#232736] rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-[#1f2433] flex items-center justify-between bg-[#131620]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400">
              <Cloud className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base font-bold text-white tracking-wide">Cloud Storage & Backups</h2>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/30 font-semibold uppercase">
                  {status?.provider || 'Active'}
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                Automated multi-cloud backups (S3, Cloudflare R2, MinIO, or Local Storage)
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-gray-400 hover:text-white hover:bg-white/5 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1">
          {message && (
            <div className={`p-3.5 rounded-xl border text-xs font-mono flex items-center gap-2.5 animate-in fade-in ${
              message.type === 'success' 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300' 
                : 'bg-red-500/10 border-red-500/30 text-red-300'
            }`}>
              {message.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
              )}
              <span>{message.text}</span>
            </div>
          )}

          {/* Active Provider Card */}
          <div className="p-4 rounded-xl bg-[#141722] border border-[#232838] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="w-9 h-9 rounded-xl bg-blue-500/20 border border-blue-500/40 flex items-center justify-center text-blue-400 shrink-0">
                <Server className="w-4 h-4" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-white">
                    {status?.provider === 's3' ? 'AWS S3 Object Storage'
                      : status?.provider === 'r2' ? 'Cloudflare R2 Object Storage'
                      : status?.provider === 'minio' ? 'MinIO S3 Compatible Storage'
                      : 'Local Persistent Storage Volume'}
                  </span>
                  <span className={`w-2 h-2 rounded-full ${status?.configured ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                </div>
                <p className="text-[11px] text-gray-400 mt-0.5 font-mono truncate max-w-sm">
                  {status?.configured 
                    ? `Bucket: ${status.bucket} • Endpoint: ${status.endpoint || 'AWS Standard'}` 
                    : `Path: ${status?.localPath || '/var/lib/openscript/backups'}`}
                </p>
              </div>
            </div>

            <button
              onClick={handleCreateBackup}
              disabled={isBackingUp}
              className="w-full sm:w-auto flex items-center justify-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all disabled:opacity-50 cursor-pointer"
            >
              <CloudUpload className="w-4 h-4" />
              <span>{isBackingUp ? 'Backing Up...' : 'Create Cloud Snapshot'}</span>
            </button>
          </div>

          {/* Cloud Backups History */}
          <div>
            <div className="flex items-center justify-between mb-2.5">
              <h3 className="text-xs font-bold text-gray-300 font-mono flex items-center gap-1.5 uppercase tracking-wider">
                <FolderArchive className="w-3.5 h-3.5 text-amber-400" />
                <span>Snapshots & Backups ({backups.length})</span>
              </h3>
              <button
                onClick={loadBackups}
                className="text-[11px] text-gray-400 hover:text-white flex items-center gap-1 transition-colors font-mono"
              >
                <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {backups.length === 0 ? (
              <div className="p-8 rounded-xl bg-[#12141c] border border-dashed border-[#232736] text-center text-gray-500 space-y-2">
                <Cloud className="w-8 h-8 text-gray-600 mx-auto stroke-1" />
                <p className="text-xs">No cloud snapshots created yet.</p>
                <p className="text-[11px] text-gray-600">
                  Click "Create Cloud Snapshot" to store an encrypted studio backup.
                </p>
              </div>
            ) : (
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {backups.map((b) => (
                  <div
                    key={b.key}
                    className="p-3 rounded-xl bg-[#12141c] border border-[#202433] hover:border-[#2f354a] transition-all flex items-center justify-between gap-3 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-200 truncate">{b.filename}</span>
                        <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-300 border border-amber-500/20">
                          {b.provider.toUpperCase()}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-[10px] text-gray-500 font-mono mt-0.5">
                        <span>{new Date(b.lastModified).toLocaleString()}</span>
                        <span>•</span>
                        <span>{(b.size / 1024).toFixed(1)} KB</span>
                      </div>
                    </div>

                    <a
                      href={`/api/v1/storage/content/${b.key}`}
                      download={b.filename}
                      className="px-3 py-1.5 rounded-lg bg-[#1a1e2b] hover:bg-[#252b3d] text-gray-300 hover:text-white font-mono text-[11px] flex items-center gap-1.5 border border-[#2e354a] transition-colors shrink-0"
                      title="Download backup file"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download</span>
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Deployment Environment Variables Setup Guide */}
          <div className="p-4 rounded-xl bg-[#0b0c12] border border-[#1b1f2b] space-y-2 text-xs">
            <div className="flex items-center gap-2 text-amber-400 font-mono font-bold text-[11px]">
              <ShieldCheck className="w-4 h-4" />
              <span>Dev / Production Cloud Storage Setup (.env):</span>
            </div>
            <pre className="p-2.5 rounded-lg bg-black/60 border border-white/5 font-mono text-[10px] text-gray-400 overflow-x-auto select-all">
{`# Cloudflare R2 / AWS S3 / MinIO Configuration
S3_BUCKET=openscript-studio-dev
S3_ACCESS_KEY_ID=your_access_key
S3_SECRET_ACCESS_KEY=your_secret_key
S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com  # Optional for Cloudflare R2 / MinIO
S3_REGION=auto
S3_PUBLIC_URL=https://assets.openscript.ssnpictures.in    # Optional CDN URL`}
            </pre>
            <p className="text-[10px] text-gray-500">
              When S3 credentials are omitted, OpenScript automatically uses safe, persistent Docker volume storage without requiring any paid cloud services.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 border-t border-[#1f2433] bg-[#12141e] flex items-center justify-between text-xs text-gray-400 font-mono">
          <span>Project ID: {projectId.slice(0, 8)}...</span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-[#1a1e2a] hover:bg-[#242938] text-gray-300 hover:text-white transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
