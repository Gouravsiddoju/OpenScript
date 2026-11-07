import { HoldButton } from './HoldButton';
import React, { useState, useEffect } from 'react';
import {
  Film,
  Plus,
  Upload,
  Search,
  Clock,
  FileText,
  Copy,
  Trash2,
  FolderOpen,
  Sparkles,
  Layers,
  ChevronRight,
  Tv,
  Clapperboard,
  Video,
  Smile,
  X,
  LogIn,
} from 'lucide-react';
import { ScreenplayProject, ScreenplayProjectTemplate, listProjects, deleteProject, duplicateProject, createProject, getProject, saveProject } from '../utils/projectStore';
import { CollaboratorProfile, CollaboratorRole } from '@openscript/screenplay-schema';

export interface ProjectDashboardProps {
  onOpenProject: (projectId: string) => void;
  onOpenImportModal: () => void;
  currentUser: { displayName: string; role: CollaboratorRole };
  onOpenAuthModal?: (mode: 'login' | 'register') => void;
  onOpenProfileModal?: () => void;
}

export const ProjectDashboard: React.FC<ProjectDashboardProps> = ({
  onOpenProject,
  onOpenImportModal,
  currentUser,
  onOpenAuthModal,
  onOpenProfileModal,
}) => {
  const [projects, setProjects] = useState<ScreenplayProject[]>(() => listProjects());
  const [searchQuery, setSearchQuery] = useState('');
  const [isNewProjectModalOpen, setIsNewProjectModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newAuthor, setNewAuthor] = useState(currentUser.displayName || '');
  const [selectedTemplate, setSelectedTemplate] = useState<ScreenplayProjectTemplate>('blank');

  const refreshProjects = () => {
    setProjects(listProjects());
  };

  useEffect(() => {
    refreshProjects();

    // Fetch projects from server (includes projects user created or was invited to)
    const token = localStorage.getItem('openscript_auth_token');
    const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
    fetch('/api/v1/projects', { headers })
        .then((res) => (res.ok ? res.json() : null))
        .then((data) => {
          if (data?.projects && Array.isArray(data.projects)) {
            let hasNew = false;
            for (const srvProj of data.projects) {
              if (srvProj.id === '00000000-0000-0000-0000-000000000000' || srvProj.description === 'Default Studio Project') continue;
              const existing = getProject(srvProj.id);
              if (!existing) {
                // If a local project with the same name already exists, do not create a duplicate blank entry
                const projects = listProjects();
                const duplicate = projects.find((p) => p.title.trim().toLowerCase() === (srvProj.name || '').trim().toLowerCase());
                if (duplicate) {
                  continue;
                }
                saveProject({
                  id: srvProj.id,
                  title: srvProj.name || 'Screenplay Project',
                  author: srvProj.description || 'Collaborative Screenplay',
                  credit: 'written by',
                  draftLabel: 'First Draft',
                  draftColor: 'white',
                  scriptHtml: '',
                  fountainText: '',
                  sceneCount: 1,
                  wordCount: 0,
                  createdAt: srvProj.createdAt || new Date().toISOString(),
                  updatedAt: srvProj.updatedAt || new Date().toISOString(),
                });
                hasNew = true;
              }
            }
            if (hasNew) {
              refreshProjects();
            }
          }
        })
        .catch(() => {});
  }, []);

  const filteredProjects = projects.filter((p) => {
    const q = searchQuery.toLowerCase();
    return (
      p.title.toLowerCase().includes(q) ||
      p.author.toLowerCase().includes(q) ||
      p.draftLabel.toLowerCase().includes(q)
    );
  });

  const handleCreate = (e: React.FormEvent) => {
    e.preventDefault();
    const title = newTitle.trim() || 'Untitled Screenplay';
    const author = newAuthor.trim() || currentUser.displayName || 'Screenwriter';
    const created = createProject(title, author, selectedTemplate);
    refreshProjects();
    setIsNewProjectModalOpen(false);
    setNewTitle('');

    // If authenticated, also register the project on the server
    const token = localStorage.getItem('openscript_auth_token');
    if (token) {
      fetch('/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: created.id,
          name: title,
          description: `Screenplay by ${author} (${selectedTemplate})`,
        }),
      }).catch((err) => console.warn('Background server project registration:', err));
    }

    onOpenProject(created.id);
  };

  const handleDuplicate = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const copy = duplicateProject(id);
    refreshProjects();

    const token = localStorage.getItem('openscript_auth_token');
    if (token) {
      fetch('/api/v1/projects', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          id: copy.id,
          name: copy.title,
          description: copy.author || 'Screenplay Copy',
        }),
      }).catch((err) => console.warn('Server project duplicate registration:', err));
    }
  };

  const handleDelete = (id: string, title: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirm(`Are you sure you want to delete "${title}"? This cannot be undone.`)) {
      deleteProject(id);
      refreshProjects();

      const token = localStorage.getItem('openscript_auth_token');
      if (token) {
        fetch(`/api/v1/projects/${id}`, {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }).catch((err) => console.warn('Server project delete:', err));
      }
    }
  };

  const formatRelativeTime = (isoString: string) => {
    try {
      const diffMs = Date.now() - new Date(isoString).getTime();
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMins / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays === 1) return 'Yesterday';
      return `${diffDays}d ago`;
    } catch {
      return 'Recently';
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0b0e] text-gray-200 flex flex-col font-sans">
      {/* Top Navigation Bar */}
      <header className="h-16 border-b border-[#1c1f2b] bg-[#0e1017] px-6 sm:px-8 flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-500 to-amber-600 p-1.5 flex items-center justify-center shadow-lg shadow-amber-500/20">
            <img src="/favicon.svg" alt="OpenScript" className="w-full h-full object-contain" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-mono font-bold tracking-wider text-sm text-white">OPENSCRIPT</span>
              <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400 border border-amber-500/30">
                STUDIO PRO
              </span>
            </div>
            <span className="text-[10px] text-gray-500 block font-mono">Screenplay Project Hub</span>
          </div>
        </div>

        {/* Global Hub Action Buttons */}
        <div className="flex items-center gap-3">
          <button
            onClick={onOpenImportModal}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-[#161822] hover:bg-[#202433] border border-[#262c3e] text-xs font-mono text-gray-300 hover:text-white transition-all shadow-sm"
            title="Import existing screenplay project (Final Draft, Scrivener, Fountain, RTF)"
          >
            <Upload className="w-4 h-4 text-amber-500" />
            <span className="hidden sm:inline">Import Script</span>
          </button>

          <button
            onClick={() => setIsNewProjectModalOpen(true)}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs shadow-lg shadow-amber-500/20 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>New Screenplay</span>
          </button>

          {/* User Profile & Auth Trigger */}
          <div className="pl-3 border-l border-[#242838] flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenProfileModal}
              className="flex items-center gap-2.5 p-1 sm:pr-2.5 rounded-xl hover:bg-[#1a1d26] transition-colors group text-left cursor-pointer"
              title="Click to view profile, switch roles, or manage account"
            >
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-amber-600 to-amber-400 flex items-center justify-center text-black font-bold text-xs shadow-md group-hover:scale-105 transition-transform">
                {currentUser.displayName.charAt(0).toUpperCase()}
              </div>
              <div className="hidden lg:block text-left">
                <span className="text-xs font-bold text-gray-200 block truncate max-w-[120px] group-hover:text-amber-400 transition-colors">
                  {currentUser.displayName}
                </span>
                <span className="text-[10px] text-amber-400 uppercase font-mono block">
                  {currentUser.role}
                </span>
              </div>
            </button>

            {onOpenAuthModal && (
              <button
                type="button"
                onClick={() => onOpenAuthModal('login')}
                className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#14161d] hover:bg-[#1f222b] border border-[#242835] text-xs font-mono text-gray-300 hover:text-white transition-colors cursor-pointer shadow-sm"
                title="Sign in or create account"
              >
                <LogIn className="w-3.5 h-3.5 text-amber-500" />
                <span>Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 sm:p-8 space-y-8">
        
        {/* Hero Section & Quick Start Templates */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl font-black text-white tracking-tight">Your Screenplay Projects</h1>
              <p className="text-xs text-gray-400 font-mono mt-1">
                Select a screenplay to continue writing, or launch a new script from template
              </p>
            </div>

            {/* Search Bar */}
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-gray-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search scripts by title..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-[#12141c] border border-[#232738] rounded-xl pl-9 pr-8 py-2 text-xs font-mono text-gray-200 placeholder-gray-500 focus:outline-none focus:border-amber-500/60 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Quick Start Templates Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 pt-2">
            <button
              onClick={() => {
                setSelectedTemplate('blank');
                setIsNewProjectModalOpen(true);
              }}
              className="p-3.5 rounded-2xl bg-[#12141d] border border-[#222738] hover:border-amber-500/50 hover:bg-[#161925] text-left transition-all group flex flex-col justify-between shadow-sm"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 group-hover:scale-105 transition-transform shrink-0">
                  <FileText className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white group-hover:text-amber-400 transition-colors truncate">
                  Blank Spec
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono leading-tight">
                Pristine canvas with industry standard margins
              </span>
            </button>

            <button
              onClick={() => {
                setSelectedTemplate('feature');
                setIsNewProjectModalOpen(true);
              }}
              className="p-3.5 rounded-2xl bg-[#12141d] border border-[#222738] hover:border-blue-500/50 hover:bg-[#161925] text-left transition-all group flex flex-col justify-between shadow-sm"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 group-hover:scale-105 transition-transform shrink-0">
                  <Clapperboard className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white group-hover:text-blue-400 transition-colors truncate">
                  Feature Spec (3-Act)
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono leading-tight">
                Classic 3-Act Syd Field / Snyder beats
              </span>
            </button>

            <button
              onClick={() => {
                setSelectedTemplate('tv_drama');
                setIsNewProjectModalOpen(true);
              }}
              className="p-3.5 rounded-2xl bg-[#12141d] border border-[#222738] hover:border-emerald-500/50 hover:bg-[#161925] text-left transition-all group flex flex-col justify-between shadow-sm"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 group-hover:scale-105 transition-transform shrink-0">
                  <Video className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white group-hover:text-emerald-400 transition-colors truncate">
                  TV 1-Hour Drama
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono leading-tight">
                5-Act episodic format with Teaser & Cliffhanger
              </span>
            </button>

            <button
              onClick={() => {
                setSelectedTemplate('sitcom');
                setIsNewProjectModalOpen(true);
              }}
              className="p-3.5 rounded-2xl bg-[#12141d] border border-[#222738] hover:border-yellow-500/50 hover:bg-[#161925] text-left transition-all group flex flex-col justify-between shadow-sm"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 group-hover:scale-105 transition-transform shrink-0">
                  <Smile className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white group-hover:text-yellow-400 transition-colors truncate">
                  30-Min Sitcom
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono leading-tight">
                Cold Open, 3-Act comedic beats, and Tag
              </span>
            </button>

            <button
              onClick={() => {
                setSelectedTemplate('short');
                setIsNewProjectModalOpen(true);
              }}
              className="p-3.5 rounded-2xl bg-[#12141d] border border-[#222738] hover:border-purple-500/50 hover:bg-[#161925] text-left transition-all group flex flex-col justify-between shadow-sm"
            >
              <div className="flex items-center gap-2.5 mb-2">
                <div className="w-8 h-8 rounded-xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 group-hover:scale-105 transition-transform shrink-0">
                  <Tv className="w-4 h-4" />
                </div>
                <span className="text-xs font-bold text-white group-hover:text-purple-400 transition-colors truncate">
                  Dramatic Short
                </span>
              </div>
              <span className="text-[10px] text-gray-400 font-mono leading-tight">
                Compact 4-beat festival submission structure
              </span>
            </button>
          </div>
        </div>

        {/* Project Cards Grid */}
        <div className="space-y-4">
          <div className="flex items-center justify-between text-xs font-mono text-gray-400">
            <span>
              Showing <strong className="text-gray-200">{filteredProjects.length}</strong> {filteredProjects.length === 1 ? 'project' : 'projects'}
            </span>
          </div>

          {filteredProjects.length === 0 ? (
            <div className="p-12 rounded-2xl bg-[#10121a] border border-[#202434] text-center space-y-4">
              <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400 mx-auto">
                <FileText className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-white">No Screenplay Projects Found</h3>
                <p className="text-xs text-gray-400 font-mono mt-1">
                  {searchQuery ? `No projects match "${searchQuery}".` : 'Create your first project or import an existing script.'}
                </p>
              </div>
              <button
                onClick={() => setIsNewProjectModalOpen(true)}
                className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono shadow-md transition-all inline-flex items-center gap-2"
              >
                <Plus className="w-4 h-4" />
                <span>Create Screenplay</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {filteredProjects.map((project) => (
                <div
                  key={project.id}
                  onClick={() => onOpenProject(project.id)}
                  className="bg-[#12141c] border border-[#232738] hover:border-amber-500/50 rounded-2xl p-5 cursor-pointer transition-all hover:shadow-xl hover:shadow-amber-500/5 group flex flex-col justify-between space-y-4 relative overflow-hidden"
                >
                  {/* Card Header & Draft Badge */}
                  <div>
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <h2 className="text-base font-bold text-white group-hover:text-amber-400 transition-colors uppercase tracking-wide font-screenplay truncate">
                          {project.title}
                        </h2>
                        <p className="text-xs text-gray-400 font-mono truncate">
                          by {project.author || 'Author'}
                        </p>
                      </div>

                      <span className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded bg-[#1c202d] text-amber-300 border border-[#2c3247]">
                        {project.draftLabel || 'First Draft'}
                      </span>
                    </div>

                    {/* Script Snippet Courier Preview */}
                    <div className="mt-4 p-3 rounded-xl bg-[#090b0e] border border-[#1b1e2a] text-[11px] font-mono text-gray-400 line-clamp-3 leading-relaxed select-none">
                      {project.fountainText.replace(/^Title:.*?\n\n/is, '').slice(0, 220) || 'INT. SCENE 1 - DAY\nAction continues...'}
                    </div>
                  </div>

                  {/* Card Footer: Metrics & Actions */}
                  <div className="pt-3 border-t border-[#1c202d] flex items-center justify-between text-xs font-mono text-gray-400">
                    <div className="flex items-center gap-3">
                      <span className="text-gray-300">
                        <strong className="text-amber-400">{project.sceneCount}</strong> sc
                      </span>
                      <span>•</span>
                      <span>{project.wordCount} words</span>
                      <span>•</span>
                      <span className="text-gray-500 flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {formatRelativeTime(project.updatedAt)}
                      </span>
                    </div>

                    {/* Quick Card Controls */}
                    <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={(e) => handleDuplicate(project.id, e)}
                        className="p-1.5 rounded-lg hover:bg-[#1f2434] text-gray-400 hover:text-white transition-colors"
                        title="Duplicate Project"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                      <HoldButton
                        onHold={() => {
                          deleteProject(project.id);
                          refreshProjects();
                        }}
                        holdTime={1200}
                        title="Hold to Delete Project"
                        className="p-1.5 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </HoldButton>
                      <div className="w-7 h-7 rounded-lg bg-amber-500/10 group-hover:bg-amber-500 flex items-center justify-center text-amber-400 group-hover:text-black transition-all ml-1">
                        <ChevronRight className="w-4 h-4" />
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* New Project Creation Modal */}
      {isNewProjectModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div
            className="w-full max-w-md bg-[#11131a] border border-[#242838] rounded-2xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#1c1f2b] bg-[#141622]">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center text-amber-400">
                  <Plus className="w-4 h-4" />
                </div>
                <h2 className="text-sm font-bold text-white">Create New Screenplay</h2>
              </div>
              <button
                onClick={() => setIsNewProjectModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-[#1f2333] transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="text-xs font-mono text-gray-300 block mb-1.5 font-bold">
                  Screenplay Title
                </label>
                <input
                  type="text"
                  placeholder="e.g. THE FINAL ODYSSEY"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  autoFocus
                  className="w-full bg-[#0a0c10] border border-[#232736] rounded-xl px-3.5 py-2.5 text-xs font-screenplay uppercase text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/70"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-gray-300 block mb-1.5 font-bold">
                  Author / Writer Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Jane Doe"
                  value={newAuthor}
                  onChange={(e) => setNewAuthor(e.target.value)}
                  className="w-full bg-[#0a0c10] border border-[#232736] rounded-xl px-3.5 py-2.5 text-xs font-mono text-white placeholder-gray-600 focus:outline-none focus:border-amber-500/70"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-gray-300 block mb-1.5 font-bold">
                  Structure Template
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {[
                    { id: 'blank', label: 'Blank Spec' },
                    { id: 'feature', label: 'Feature (3-Act)' },
                    { id: 'tv_drama', label: 'TV 1-Hr Drama' },
                    { id: 'sitcom', label: '30-Min Sitcom' },
                    { id: 'short', label: 'Short Film' },
                  ].map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setSelectedTemplate(t.id as any)}
                      className={`py-2 px-2 rounded-xl text-[11px] font-mono border transition-all ${
                        selectedTemplate === t.id
                          ? 'bg-amber-500/20 text-amber-300 border-amber-500/50 font-bold'
                          : 'bg-[#0d0f15] text-gray-400 border-[#232736] hover:bg-[#151822]'
                      }`}
                    >
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2 border-t border-[#1c1f2b]">
                <button
                  type="button"
                  onClick={() => setIsNewProjectModalOpen(false)}
                  className="px-4 py-2 rounded-xl text-xs font-mono text-gray-400 hover:text-white bg-[#171922] transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs font-mono shadow-md transition-all"
                >
                  Create & Write
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

