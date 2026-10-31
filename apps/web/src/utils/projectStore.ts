import { RevisionColor } from '@openscript/screenplay-schema';

export interface ScreenplayProject {
  id: string;
  title: string;
  author: string;
  credit: string;
  draftLabel: string;
  draftColor: RevisionColor;
  scriptHtml: string;
  fountainText: string;
  sceneCount: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
  isLocked?: boolean;
  sceneTakes?: any[];
  notes?: any[];
  metadata?: Record<string, any>;
}

const STORAGE_PROJECTS_KEY = 'openscript_studio_projects';
const STORAGE_ACTIVE_PROJECT_ID_KEY = 'openscript_active_project_id';

const DEFAULT_SAMPLE_PROJECT: ScreenplayProject = {
  id: '00000000-0000-0000-0000-000000000001',
  title: 'THE NEON DRIFT',
  author: 'Gourav (SSN)',
  credit: 'written by',
  draftLabel: 'Blue Production Draft',
  draftColor: 'blue',
  scriptHtml: `
    <div class="script-scene-heading">INT. COFFEE SHOP - DAY</div>
    <div class="script-action">Rain drums against the tall glass windows. A steaming cup of espresso rests on the counter.</div>
    <div class="script-character">MAYA</div>
    <div class="script-parenthetical">(checking her watch)</div>
    <div class="script-dialogue">He should have been here twenty minutes ago. We don't have all day.</div>
    <div class="script-action">The front door chimes. A soaked figure in a black trench coat steps inside.</div>
    <div class="script-transition">CUT TO:</div>
    <div class="script-scene-heading">EXT. ALLEYWAY - CONTINUOUS</div>
    <div class="script-action">Neon reflections shimmer in deep puddles. Sirens echo in the far distance.</div>
  `,
  fountainText: `Title: THE NEON DRIFT
Author: Gourav (SSN)
Draft date: Blue Production Draft

INT. COFFEE SHOP - DAY

Rain drums against the tall glass windows. A steaming cup of espresso rests on the counter.

MAYA
(checking her watch)
He should have been here twenty minutes ago. We don't have all day.

The front door chimes. A soaked figure in a black trench coat steps inside.

CUT TO:

EXT. ALLEYWAY - CONTINUOUS

Neon reflections shimmer in deep puddles. Sirens echo in the far distance.`,
  sceneCount: 2,
  wordCount: 56,
  createdAt: '2026-10-15T10:00:00.000Z',
  updatedAt: new Date().toISOString(),
  isLocked: false,
};

export function listProjects(): ScreenplayProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (!raw) {
      const initial = [DEFAULT_SAMPLE_PROJECT];
      localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed;
    }
    const initial = [DEFAULT_SAMPLE_PROJECT];
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(initial));
    return initial;
  } catch {
    return [DEFAULT_SAMPLE_PROJECT];
  }
}

export function getProject(id: string): ScreenplayProject | null {
  const projects = listProjects();
  return projects.find((p) => p.id === id) || null;
}

export function saveProject(project: ScreenplayProject): void {
  const projects = listProjects();
  const index = projects.findIndex((p) => p.id === project.id);
  const updated = {
    ...project,
    updatedAt: new Date().toISOString(),
  };

  if (index >= 0) {
    projects[index] = updated;
  } else {
    projects.unshift(updated);
  }

  localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));
}

export function getActiveProjectId(): string {
  return localStorage.getItem(STORAGE_ACTIVE_PROJECT_ID_KEY) || DEFAULT_SAMPLE_PROJECT.id;
}

export function setActiveProjectId(id: string): void {
  localStorage.setItem(STORAGE_ACTIVE_PROJECT_ID_KEY, id);
}

export function createProject(
  title: string = 'Untitled Screenplay',
  author: string = 'Author Name',
  template: 'blank' | 'feature' | 'short' = 'blank'
): ScreenplayProject {
  const id = crypto.randomUUID();
  let scriptHtml = '<div class="script-scene-heading">INT. NEW SCENE - DAY</div><div class="script-action">Describe the scene here.</div>';
  let fountainText = `INT. NEW SCENE - DAY\n\nDescribe the scene here.`;

  if (template === 'feature') {
    scriptHtml = `
      <div class="script-scene-heading">INT. PROTAGONIST APARTMENT - DAWN</div>
      <div class="script-action">Morning sun slices through blinds onto a cluttered desk. An alarm wails unanswered.</div>
      <div class="script-character">PROTAGONIST</div>
      <div class="script-dialogue">Five more minutes...</div>
      <div class="script-action">The phone rings—a call that will change everything.</div>
      <div class="script-transition">CUT TO:</div>
    `;
    fountainText = `INT. PROTAGONIST APARTMENT - DAWN\n\nMorning sun slices through blinds onto a cluttered desk. An alarm wails unanswered.\n\nPROTAGONIST\nFive more minutes...\n\nThe phone rings—a call that will change everything.\n\nCUT TO:`;
  } else if (template === 'short') {
    scriptHtml = `
      <div class="script-scene-heading">EXT. LONELY HIGHWAY - TWILIGHT</div>
      <div class="script-action">Headlights cut a solitary cone of light through gathering fog.</div>
      <div class="script-character">STRANGER</div>
      <div class="script-parenthetical">(into radio)</div>
      <div class="script-dialogue">Package is en route. Ensure the dock is clear.</div>
    `;
    fountainText = `EXT. LONELY HIGHWAY - TWILIGHT\n\nHeadlights cut a solitary cone of light through gathering fog.\n\nSTRANGER\n(into radio)\nPackage is en route. Ensure the dock is clear.`;
  }

  const newProject: ScreenplayProject = {
    id,
    title: title.trim() || 'Untitled Screenplay',
    author: author.trim() || 'Author Name',
    credit: 'written by',
    draftLabel: 'First Draft',
    draftColor: 'white',
    scriptHtml,
    fountainText,
    sceneCount: 1,
    wordCount: fountainText.split(/\s+/).filter(Boolean).length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isLocked: false,
    sceneTakes: [],
    notes: [],
  };

  saveProject(newProject);
  setActiveProjectId(id);
  return newProject;
}

export function duplicateProject(id: string): ScreenplayProject {
  const original = getProject(id) || DEFAULT_SAMPLE_PROJECT;
  const newId = crypto.randomUUID();
  const copy: ScreenplayProject = {
    ...original,
    id: newId,
    title: `${original.title} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveProject(copy);
  return copy;
}

export function deleteProject(id: string): ScreenplayProject[] {
  const projects = listProjects().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));

  if (getActiveProjectId() === id && projects.length > 0) {
    setActiveProjectId(projects[0].id);
  }

  return projects;
}
