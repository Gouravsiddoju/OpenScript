import { describe, it, expect, beforeEach } from 'vitest';

const memoryStore: Record<string, string> = {};
(globalThis as any).localStorage = {
  getItem: (key: string) => memoryStore[key] || null,
  setItem: (key: string, value: string) => { memoryStore[key] = value; },
  removeItem: (key: string) => { delete memoryStore[key]; },
  clear: () => {
    for (const k of Object.keys(memoryStore)) delete memoryStore[k];
  },
};

import { createProject, listProjects, getProject, deleteProject } from '../projectStore';

describe('Screenplay Project Templates & Store', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates distinct content for each project template type without cross-contamination', () => {
    const blank = createProject('My Blank Project', 'Writer A', 'blank');
    expect(blank.title).toBe('My Blank Project');
    expect(blank.scriptHtml).toContain('INT. COFFEE SHOP - DAY');
    expect(blank.fountainText).toContain('Every great screenplay begins with a single line.');

    const feature = createProject('Cyber Heist', 'Writer B', 'feature');
    expect(feature.title).toBe('Cyber Heist');
    expect(feature.draftLabel).toContain('Feature Spec');
    expect(feature.scriptHtml).toContain('EXT. LOS ANGELES SKYLINE - DAWN');
    expect(feature.scriptHtml).not.toContain('INT. COFFEE SHOP - DAY');

    const tvDrama = createProject('Neon Precinct', 'Writer C', 'tv_drama');
    expect(tvDrama.draftLabel).toContain('Pilot Episode');
    expect(tvDrama.scriptHtml).toContain('EXT. ROOFTOP HELIPAD - NIGHT');
    expect(tvDrama.scriptHtml).toContain('DETECTIVE REYES');

    const sitcom = createProject('Roommates', 'Writer D', 'sitcom');
    expect(sitcom.draftLabel).toContain('Production Draft');
    expect(sitcom.scriptHtml).toContain('INT. COZY APARTMENT KITCHEN - MORNING');
    expect(sitcom.scriptHtml).toContain('SAM');

    const shortProj = createProject('The Lighthouse', 'Writer E', 'short');
    expect(shortProj.draftLabel).toContain('Festival Submission');
    expect(shortProj.scriptHtml).toContain('EXT. LONELY HIGHWAY - TWILIGHT');

    // Verify all created projects persist in projectStore with unique UUIDs
    const all = listProjects();
    expect(all.length).toBeGreaterThanOrEqual(5);
    const ids = new Set([blank.id, feature.id, tvDrama.id, sitcom.id, shortProj.id]);
    expect(ids.size).toBe(5);
    ids.forEach((id) => {
      expect(all.some((p) => p.id === id)).toBe(true);
    });
  });

  it('retrieves distinct project by id without falling back to a hardcoded script', () => {
    const shortProj = createProject('Midnight Station', 'Author X', 'short');
    const fetched = getProject(shortProj.id);

    expect(fetched).not.toBeNull();
    expect(fetched?.title).toBe('Midnight Station');
    expect(fetched?.scriptHtml).toContain('EXT. LONELY HIGHWAY - TWILIGHT');
    expect(fetched?.scriptHtml).not.toContain('THE LAST DOWNLOAD');
  });
});
