import { describe, it, expect } from 'vitest';
import { paginateScreenplay, calculateBlockHeightInLines } from '../pagination/engine';
import { createScreenplayBlock } from '@openscript/screenplay-schema';

describe('Virtual Pagination Engine', () => {
  it('correctly calculates line heights for different screenplay elements', () => {
    const heading = createScreenplayBlock({
      id: crypto.randomUUID(),
      type: 'sceneHeading',
      text: 'INT. OFFICE - DAY',
    });
    expect(calculateBlockHeightInLines(heading)).toBe(3);

    const character = createScreenplayBlock({
      id: crypto.randomUUID(),
      type: 'character',
      text: 'SARAH',
    });
    expect(calculateBlockHeightInLines(character)).toBe(2);

    const parenthetical = createScreenplayBlock({
      id: crypto.randomUUID(),
      type: 'parenthetical',
      text: '(sighs)',
    });
    expect(calculateBlockHeightInLines(parenthetical)).toBe(1);
  });

  it('paginates blocks within the 54-line budget', () => {
    const blocks = [
      createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'sceneHeading',
        text: 'INT. LIVING ROOM - DAY',
      }),
      createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'action',
        text: 'Morning sunlight filters through the blinds, casting striped shadows across the hardwood floor.',
      }),
      createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'character',
        text: 'MARK',
      }),
      createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'dialogue',
        text: 'Did you hear that sound?',
      }),
    ];

    const pages = paginateScreenplay(blocks);
    expect(pages.length).toBe(1);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[0].blocks.length).toBe(4);
  });

  it('protects scene headings from being orphaned at the bottom of a page', () => {
    // Fill up 52 lines with actions
    const blocks = [];
    for (let i = 0; i < 26; i++) {
      blocks.push(createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'action',
        text: `Action line description number ${i + 1}.`,
      }));
    }

    // Now add a Scene Heading (which requires 3 lines, exceeding 54)
    blocks.push(createScreenplayBlock({
      id: crypto.randomUUID(),
      type: 'sceneHeading',
      text: 'EXT. ROOFTOP - NIGHT',
    }));

    const pages = paginateScreenplay(blocks);
    expect(pages.length).toBe(2);
    // Scene Heading should have moved to page 2 to avoid orphan
    expect(pages[1].blocks[0].type).toBe('sceneHeading');
    expect(pages[1].blocks[0].text).toBe('EXT. ROOFTOP - NIGHT');
  });
});
