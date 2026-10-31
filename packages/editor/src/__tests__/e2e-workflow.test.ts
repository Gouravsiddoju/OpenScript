import { describe, it, expect } from 'vitest';
import { parseFountain, serializeFountain, blocksToHtml } from '@openscript/fountain';
import { parseFdx, serializeFdx } from '@openscript/fdx';
import { 
  calculateLockedSceneNumber, 
  HOLLYWOOD_REVISION_SEQUENCE, 
  createScreenplayBlock 
} from '@openscript/screenplay-schema';
import { paginateScreenplay } from '../pagination/engine';

describe('OpenScript Complete End-to-End Screenplay Workflow', () => {
  const originalFountainScript = `INT. OBSIDIAN TOWER - NIGHT

Thunder shakes the reinforced panoramic glass. A lone desk lamp illuminates an open blueprint.

MARCUS
(whispering into the comms)
The perimeter grid is down. We have less than four minutes.

ELENA
I'm already in the server vault. Disabling security protocols now.

> CUT TO:

EXT. ROOFTOP HELIPAD - CONTINUOUS

Rain lashes against the helicopter blades. Rotors slowly spin up to speed.`;

  it('E2E Stage 1: parses Fountain into canonical AST blocks with element classification', () => {
    const blocks = parseFountain(originalFountainScript);

    expect(blocks.length).toBeGreaterThan(5);
    expect(blocks[0].type).toBe('sceneHeading');
    expect(blocks[0].text).toBe('INT. OBSIDIAN TOWER - NIGHT');

    const marcusIndex = blocks.findIndex((b) => b.type === 'character' && b.text === 'MARCUS');
    expect(marcusIndex).toBeGreaterThan(0);
    expect(blocks[marcusIndex + 1].type).toBe('parenthetical');
    expect(blocks[marcusIndex + 2].type).toBe('dialogue');

    const transitionBlock = blocks.find((b) => b.type === 'transition');
    expect(transitionBlock).toBeDefined();
    expect(transitionBlock?.text).toBe('CUT TO:');
  });

  it('E2E Stage 2: handles Mathematical Virtual Pagination (54-line budget)', () => {
    const longBlocks = [
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'sceneHeading', text: 'INT. CONTROL ROOM - DAY' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'action', text: 'An expansive mainframe hums softly in the background.' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'character', text: 'LEAD SCIENTIST' }),
      ...Array.from({ length: 60 }).map((_, i) =>
        createScreenplayBlock({
          id: crypto.randomUUID(),
          type: 'dialogue' as const,
          text: `Line ${i + 1}: The quantum stabilization cycle requires sustained power alignment.`,
        })
      ),
    ];

    const pages = paginateScreenplay(longBlocks);
    expect(pages.length).toBeGreaterThanOrEqual(2);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[1].pageNumber).toBe(2);
  });

  it('E2E Stage 3: executes Hollywood Locked Script Scene Numbering and A/B Inserts', () => {
    const existingLockedScenes = ['1', '2', '3'];

    // Insert between Scene 1 and 2
    const scene1A = calculateLockedSceneNumber(existingLockedScenes, 1);
    expect(scene1A).toBe('1A');

    // Insert between Scene 1A and 2
    const scene1B = calculateLockedSceneNumber(['1', '1A', '2', '3'], 2);
    expect(scene1B).toBe('1B');

    // Insert at end
    const scene4 = calculateLockedSceneNumber(existingLockedScenes, 3);
    expect(scene4).toBe('4');

    // Insert before first scene
    const sceneA1 = calculateLockedSceneNumber(existingLockedScenes, 0);
    expect(sceneA1).toBe('A1');
  });

  it('E2E Stage 4: verifies Hollywood 9-color Revision Hierarchy and Revision Asterisk Tracking', () => {
    expect(HOLLYWOOD_REVISION_SEQUENCE.length).toBe(9);
    expect(HOLLYWOOD_REVISION_SEQUENCE.map((r) => r.color)).toEqual([
      'white', 'blue', 'pink', 'yellow', 'green', 'goldenrod', 'buff', 'salmon', 'cherry'
    ]);

    const modifiedBlock = createScreenplayBlock({
      id: crypto.randomUUID(),
      type: 'dialogue',
      text: 'Revised line with right-margin tracking asterisk.',
      revisionMark: true,
      revisionColor: 'blue',
    });

    expect(modifiedBlock.revisionMark).toBe(true);
    expect(modifiedBlock.revisionColor).toBe('blue');
  });

  it('E2E Stage 5: performs full lossless round-trip into Final Draft FDX XML and back', () => {
    const initialAstBlocks = parseFountain(originalFountainScript);
    initialAstBlocks[0].sceneNumber = '1';

    // Serialize to FDX XML
    const fdxXml = serializeFdx({
      content: initialAstBlocks,
      metadata: {
        title: 'THE SILENT HOUR',
        credit: 'written by',
        authors: ['Gourav Siddoju'],
      },
    });

    expect(fdxXml).toContain('<FinalDraft DocumentType="Script"');
    expect(fdxXml).toContain('<SceneProperties Number="1" />');
    expect(fdxXml).toContain('THE SILENT HOUR');

    // Re-parse the FDX XML
    const { blocks: roundtripBlocks, metadata } = parseFdx(fdxXml);
    expect(roundtripBlocks.length).toBe(initialAstBlocks.length);
    expect(roundtripBlocks[0].text).toBe('INT. OBSIDIAN TOWER - NIGHT');
    expect(roundtripBlocks[0].sceneNumber).toBe('1');
    expect(metadata.title).toBe('THE SILENT HOUR');
    expect(metadata.authors).toEqual(['Gourav Siddoju']);
  });

  it('E2E Stage 6: verifies HTML paper rendering matches standard class hierarchy', () => {
    const blocks = parseFountain(originalFountainScript);
    const html = blocksToHtml(blocks);

    expect(html).toContain('class="script-scene-heading"');
    expect(html).toContain('class="script-action"');
    expect(html).toContain('class="script-character"');
    expect(html).toContain('class="script-dialogue"');
    expect(html).toContain('class="script-transition"');
  });
});
