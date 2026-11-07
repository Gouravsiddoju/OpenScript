import { RevisionColor } from '@openscript/screenplay-schema';

export type ScreenplayProjectTemplate = 'blank' | 'feature' | 'tv_drama' | 'sitcom' | 'short';
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
  contact?: string;
  sceneTakes?: any[];
  notes?: any[];
  metadata?: Record<string, any>;
}

const STORAGE_PROJECTS_KEY = 'openscript_studio_projects';
const STORAGE_ACTIVE_PROJECT_ID_KEY = 'openscript_active_project_id';

export function createDefaultStartingProject(authorName: string = 'Screenwriter'): ScreenplayProject {
  const scriptHtml = `
    <div class="script-scene-heading">EXT. CITY STREET - DAY</div>
    <div class="script-action">A quiet morning. Sunlight filters through the skyscrapers as the city begins to move.</div>
    <div class="script-character">WRITER</div>
    <div class="script-dialogue">Every story begins with a blank page.</div>
  `;

  const fountainText = `Title: UNTITLED SCREENPLAY
Author: ${authorName}
Draft date: First Draft

EXT. CITY STREET - DAY

A quiet morning. Sunlight filters through the skyscrapers as the city begins to move.

WRITER
Every story begins with a blank page.`;

  return {
    id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'project-default-001',
    title: 'UNTITLED SCREENPLAY',
    author: authorName,
    credit: 'written by',
    draftLabel: 'First Draft',
    draftColor: 'white',
    scriptHtml,
    fountainText,
    sceneCount: 1,
    wordCount: 22,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    isLocked: false,
    sceneTakes: [],
    notes: [],
  };
}

export function listProjects(): ScreenplayProject[] {
  try {
    const raw = localStorage.getItem(STORAGE_PROJECTS_KEY);
    if (!raw) {
      const initial = [createDefaultStartingProject()];
      localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(initial));
      return initial;
    }
    const parsed = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      // Purge legacy test sample projects & dummy 00000000-0000-0000-0000-000000000000 / Default Studio Project
      let clean = parsed.filter((p) => 
        p.id !== '00000000-0000-0000-0000-000000000000' && 
        p.title !== 'THE NEON DRIFT' && 
        p.title !== 'THE GLASS COUNTER' &&
        p.author !== 'Default Studio Project'
      );
      
      // If multiple THE LAST DOWNLOAD exist, keep only the rich one with content
      const tldProjects = clean.filter((p) => p.title === 'THE LAST DOWNLOAD');
      if (tldProjects.length > 1) {
        const bestTld = tldProjects.find((p) => (p.wordCount || 0) > 100 || (p.fountainText && p.fountainText.length > 100)) || tldProjects[0];
        clean = clean.filter((p) => p.title !== 'THE LAST DOWNLOAD' || p.id === bestTld.id);
      }

      if (!clean.some((p) => p.id === '6fcf7386-76c4-44a8-a24c-c11a1f21f353' || p.title === 'THE LAST DOWNLOAD')) {
        clean.unshift({
          id: '6fcf7386-76c4-44a8-a24c-c11a1f21f353',
          title: 'THE LAST DOWNLOAD',
          author: 'Gourav Siddarth Siddoju',
          credit: 'written by',
          draftLabel: 'First Draft',
          draftColor: 'white',
          scriptHtml: '',
          fountainText: '',
          sceneCount: 10,
          wordCount: 4252,
          createdAt: '2026-11-02T17:47:44.504Z',
          updatedAt: new Date().toISOString(),
          isLocked: false,
          sceneTakes: [],
          notes: [],
        });
      }
      if (clean.length > 0) {
        localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(clean));
        return clean;
      }
    }
    const initial = [createDefaultStartingProject()];
    localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(initial));
    return initial;
  } catch {
    return [createDefaultStartingProject()];
  }
}

export function getProject(id: string): ScreenplayProject | null {
  const projects = listProjects();
  return projects.find((p) => p.id === id) || null;
}

export function saveProject(project: ScreenplayProject): void {
  if (!project.id || project.id === '00000000-0000-0000-0000-000000000000' || project.author === 'Default Studio Project') {
    return;
  }
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
  const active = localStorage.getItem(STORAGE_ACTIVE_PROJECT_ID_KEY); if (active) return active; const projects = listProjects(); return projects[0]?.id || "project-default-001";
}

export function setActiveProjectId(id: string): void {
  localStorage.setItem(STORAGE_ACTIVE_PROJECT_ID_KEY, id);
}

export function createProject(
  title: string = 'Untitled Screenplay',
  author: string = 'Author Name',
  template: ScreenplayProjectTemplate = 'blank'
): ScreenplayProject {
  const id = crypto.randomUUID();
  let scriptHtml = '';
  let fountainText = '';
  let draftLabel = 'First Draft';

  if (template === 'feature') {
    draftLabel = 'First Draft - Feature Spec';
    scriptHtml = `
      <div class="script-scene-heading">EXT. LOS ANGELES SKYLINE - DAWN</div>
      <div class="script-action">Smog hangs over the sleeping metropolis like amber silk. Sirens whisper from five miles away.</div>
      <div class="script-scene-heading">INT. CLUTTERED WORKSHOP - CONTINUOUS</div>
      <div class="script-action">Vintage lens glass and micro-circuitry cover the workbench. MAYA CHEN (32), laser-focused, adjusts an antique optical scanner with a jeweler's screwdriver.</div>
      <div class="script-character">MAYA</div>
      <div class="script-parenthetical">(whispering)</div>
      <div class="script-dialogue">Almost there. Hold steady...</div>
      <div class="script-action">The front door bell chimes violently. A sealed black courier pouch slides through the brass mail slot.</div>
      <div class="script-scene-heading">INT. WORKSHOP HALLWAY - SECONDS LATER</div>
      <div class="script-action">Maya kneels, examines the package. Wax seal: an ouroboros clutching a key. Her hands freeze.</div>
      <div class="script-transition">CUT TO:</div>
      <div class="script-scene-heading">EXT. DOWNTOWN METRO PLATFORM - NIGHT</div>
      <div class="script-action">Rain washes over the concrete. Maya clutching her leather bag, waiting for the midnight express. She isn't alone.</div>
    `;
    fountainText = `EXT. LOS ANGELES SKYLINE - DAWN\n\nSmog hangs over the sleeping metropolis like amber silk. Sirens whisper from five miles away.\n\nINT. CLUTTERED WORKSHOP - CONTINUOUS\n\nVintage lens glass and micro-circuitry cover the workbench. MAYA CHEN (32), laser-focused, adjusts an antique optical scanner with a jeweler's screwdriver.\n\nMAYA\n(whispering)\nAlmost there. Hold steady...\n\nThe front door bell chimes violently. A sealed black courier pouch slides through the brass mail slot.\n\nINT. WORKSHOP HALLWAY - SECONDS LATER\n\nMaya kneels, examines the package. Wax seal: an ouroboros clutching a key. Her hands freeze.\n\nCUT TO:\n\nEXT. DOWNTOWN METRO PLATFORM - NIGHT\n\nRain washes over the concrete. Maya clutching her leather bag, waiting for the midnight express. She isn't alone.`;
  } else if (template === 'tv_drama') {
    draftLabel = 'Pilot Episode - Network Draft';
    scriptHtml = `
      <div class="script-scene-heading">EXT. ROOFTOP HELIPAD - NIGHT (TEASER)</div>
      <div class="script-action">Wind thrashes rain against industrial spotlight towers. A corporate helicopter touches down with engines roaring.</div>
      <div class="script-character">DETECTIVE REYES</div>
      <div class="script-parenthetical">(shouting over blades)</div>
      <div class="script-dialogue">Nobody leaves this roof until forensics confirms the vault breach!</div>
      <div class="script-action">A suited figure steps out, rain running off a titanium briefcase.</div>
      <div class="script-character">STRANGER</div>
      <div class="script-dialogue">It wasn't a breach, Detective. It was a trade.</div>
      <div class="script-transition">SMASH CUT TO:</div>
      <div class="script-scene-heading">INT. PRECINCT BULLPEN - NEXT MORNING (ACT I)</div>
      <div class="script-action">Fluorescent lights hum. Phones ring across twenty desks. Reyes pins a crime scene photo onto the glass murder board.</div>
    `;
    fountainText = `EXT. ROOFTOP HELIPAD - NIGHT (TEASER)\n\nWind thrashes rain against industrial spotlight towers. A corporate helicopter touches down with engines roaring.\n\nDETECTIVE REYES\n(shouting over blades)\nNobody leaves this roof until forensics confirms the vault breach!\n\nA suited figure steps out, rain running off a titanium briefcase.\n\nSTRANGER\nIt wasn't a breach, Detective. It was a trade.\n\nSMASH CUT TO:\n\nINT. PRECINCT BULLPEN - NEXT MORNING (ACT I)\n\nFluorescent lights hum. Phones ring across twenty desks. Reyes pins a crime scene photo onto the glass murder board.`;
  } else if (template === 'sitcom') {
    draftLabel = 'Showrunner Production Draft';
    scriptHtml = `
      <div class="script-scene-heading">INT. COZY APARTMENT KITCHEN - MORNING (COLD OPEN)</div>
      <div class="script-action">Smoke BILLOWS from the toaster. SAM (28) stands frozen with an oven mitt on one hand and a fire extinguisher in the other.</div>
      <div class="script-character">SAM</div>
      <div class="script-dialogue">Remain calm. The bagels are merely... caramelizing.</div>
      <div class="script-action">RILEY (29) enters in professional attire, sees the inferno, and calmly sips coffee.</div>
      <div class="script-character">RILEY</div>
      <div class="script-dialogue">Our landlord called. He smelled ambition and burnt sesame seeds.</div>
      <div class="script-transition">MAIN TITLES.</div>
      <div class="script-scene-heading">INT. DOWNTOWN DESIGN AGENCY - DAY (ACT I)</div>
      <div class="script-action">A sleek glass office. Riley rehearses her pitch to an empty conference table.</div>
    `;
    fountainText = `INT. COZY APARTMENT KITCHEN - MORNING (COLD OPEN)\n\nSmoke BILLOWS from the toaster. SAM (28) stands frozen with an oven mitt on one hand and a fire extinguisher in the other.\n\nSAM\nRemain calm. The bagels are merely... caramelizing.\n\nRILEY (29) enters in professional attire, sees the inferno, and calmly sips coffee.\n\nRILEY\nOur landlord called. He smelled ambition and burnt sesame seeds.\n\nMAIN TITLES.\n\nINT. DOWNTOWN DESIGN AGENCY - DAY (ACT I)\n\nA sleek glass office. Riley rehearses her pitch to an empty conference table.`;
  } else if (template === 'short') {
    draftLabel = 'Festival Submission Draft';
    scriptHtml = `
      <div class="script-scene-heading">EXT. LONELY HIGHWAY - TWILIGHT</div>
      <div class="script-action">Headlights cut a solitary cone of light through gathering fog. An antique station wagon hums down empty asphalt.</div>
      <div class="script-character">STRANGER</div>
      <div class="script-parenthetical">(into shortwave radio)</div>
      <div class="script-dialogue">Package is en route. Ensure the lighthouse dock is cleared.</div>
      <div class="script-scene-heading">INT. ROADSIDE DINER - NIGHT</div>
      <div class="script-action">Neon sign BUZZES outside: 'LAST CHANCE COFFEE'. The stranger takes a stool. The elderly waitress slides a handwritten napkin forward.</div>
    `;
    fountainText = `EXT. LONELY HIGHWAY - TWILIGHT\n\nHeadlights cut a solitary cone of light through gathering fog. An antique station wagon hums down empty asphalt.\n\nSTRANGER\n(into shortwave radio)\nPackage is en route. Ensure the lighthouse dock is cleared.\n\nINT. ROADSIDE DINER - NIGHT\n\nNeon sign BUZZES outside: 'LAST CHANCE COFFEE'. The stranger takes a stool. The elderly waitress slides a handwritten napkin forward.`;
  } else {
    // Blank Screenplay
    draftLabel = 'First Draft';
    scriptHtml = `
      <div class="script-scene-heading">INT. COFFEE SHOP - DAY</div>
      <div class="script-action">Rain drums steadily against tall glass windows. A hot cup of espresso cools on the counter.</div>
      <div class="script-character">WRITER</div>
      <div class="script-dialogue">Every great screenplay begins with a single line.</div>
    `;
    fountainText = `INT. COFFEE SHOP - DAY\n\nRain drums steadily against tall glass windows. A hot cup of espresso cools on the counter.\n\nWRITER\nEvery great screenplay begins with a single line.`;
  }

  const scenes = (fountainText.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/gim) || []).length;

  const newProject: ScreenplayProject = {
    id,
    title: title.trim() || 'Untitled Screenplay',
    author: author.trim() || 'Author Name',
    credit: 'written by',
    draftLabel,
    draftColor: 'white',
    scriptHtml,
    fountainText,
    sceneCount: Math.max(1, scenes),
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
  const original = getProject(id) || listProjects()[0] || createDefaultStartingProject();
  const newId = crypto.randomUUID();
  const copy: ScreenplayProject = {
    ...original,
    id: newId,
    title: `${original.title} (Copy)`,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  saveProject(copy);

  // Clone document-scoped metadata and notes to the duplicate
  const savedMeta = localStorage.getItem('openscript_title_metadata_' + id);
  if (savedMeta) {
    try {
      const parsedMeta = JSON.parse(savedMeta);
      parsedMeta.title = `${original.title} (Copy)`;
      localStorage.setItem('openscript_title_metadata_' + newId, JSON.stringify(parsedMeta));
    } catch {}
  }
  const savedNotes = localStorage.getItem('openscript_script_notes_' + id);
  if (savedNotes) localStorage.setItem('openscript_script_notes_' + newId, savedNotes);
  const savedTakes = localStorage.getItem('openscript_scene_takes_' + id);
  if (savedTakes) localStorage.setItem('openscript_scene_takes_' + newId, savedTakes);
  const savedFolders = localStorage.getItem('openscript_scene_folders_' + id);
  if (savedFolders) localStorage.setItem('openscript_scene_folders_' + newId, savedFolders);
  const savedFolderMap = localStorage.getItem('openscript_scene_folder_map_' + id);
  if (savedFolderMap) localStorage.setItem('openscript_scene_folder_map_' + newId, savedFolderMap);

  return copy;
}

export function deleteProject(id: string): ScreenplayProject[] {
  const projects = listProjects().filter((p) => p.id !== id);
  localStorage.setItem(STORAGE_PROJECTS_KEY, JSON.stringify(projects));

  if (getActiveProjectId() === id && projects.length > 0) {
    setActiveProjectId(projects[0].id);
  }
  if (localStorage.getItem('openscript_doc_id') === id && projects.length > 0) {
    localStorage.setItem('openscript_doc_id', projects[0].id);
  }

  // Clean up all document-scoped keys for the deleted project
  localStorage.removeItem('openscript_draft_html_' + id);
  localStorage.removeItem('openscript_draft_fountain_' + id);
  localStorage.removeItem('openscript_title_metadata_' + id);
  localStorage.removeItem('openscript_collaborators_' + id);
  localStorage.removeItem('openscript_script_notes_' + id);
  localStorage.removeItem('openscript_scene_takes_' + id);
  localStorage.removeItem('openscript_scene_folders_' + id);
  localStorage.removeItem('openscript_scene_folder_map_' + id);
  localStorage.removeItem('openscript_rev_' + id);

  return projects;
}
