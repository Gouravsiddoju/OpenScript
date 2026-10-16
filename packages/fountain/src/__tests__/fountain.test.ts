import { describe, it, expect } from 'vitest';
import { parseFountain } from '../parser';
import { serializeFountain } from '../serializer';
import { fountainToHtml } from '../html';
import { CanonicalScreenplayDocument } from '@openscript/screenplay-schema';

describe('Fountain Parser & Serializer', () => {
  it('parses standard scene headings correctly', () => {
    const text = `INT. COFFEE SHOP - DAY\n\nA barista steams milk behind the counter.`;
    const blocks = parseFountain(text);

    expect(blocks.length).toBe(2);
    expect(blocks[0].type).toBe('sceneHeading');
    expect(blocks[0].text).toBe('INT. COFFEE SHOP - DAY');
    expect(blocks[1].type).toBe('action');
    expect(blocks[1].text).toBe('A barista steams milk behind the counter.');
  });

  it('parses character cue and dialogue sequence', () => {
    const text = `JOHN\n(quietly)\nWe cannot stay here any longer.`;
    const blocks = parseFountain(text);

    expect(blocks.length).toBe(3);
    expect(blocks[0].type).toBe('character');
    expect(blocks[0].text).toBe('JOHN');
    expect(blocks[1].type).toBe('parenthetical');
    expect(blocks[1].text).toBe('(quietly)');
    expect(blocks[2].type).toBe('dialogue');
    expect(blocks[2].text).toBe('We cannot stay here any longer.');
  });

  it('parses transitions correctly', () => {
    const text = `SMASH CUT TO:\n> FADE OUT.`;
    const blocks = parseFountain(text);

    expect(blocks.length).toBe(2);
    expect(blocks[0].type).toBe('transition');
    expect(blocks[0].text).toBe('SMASH CUT TO:');
    expect(blocks[1].type).toBe('transition');
    expect(blocks[1].text).toBe('FADE OUT.');
  });

  it('serializes canonical screenplay documents to fountain format', () => {
    const doc: CanonicalScreenplayDocument = {
      schemaVersion: 2,
      id: crypto.randomUUID(),
      projectId: crypto.randomUUID(),
      revisionNumber: 1,
      metadata: {
        title: 'The Silent Hour',
        credit: 'written by',
        authors: ['Jane Doe'],
        draftLabel: 'First Draft',
        draftColor: 'White',
        isLocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      content: [
        {
          id: crypto.randomUUID(),
          type: 'sceneHeading',
          text: 'EXT. STREET - NIGHT',
          marks: [],
          isOmitted: false,
          revisionMark: false,
        },
        {
          id: crypto.randomUUID(),
          type: 'action',
          text: 'The pavement gleams under neon lights.',
          marks: [],
          isOmitted: false,
          revisionMark: false,
        },
        {
          id: crypto.randomUUID(),
          type: 'character',
          text: 'DETECTIVE COLE',
          marks: [],
          isOmitted: false,
          revisionMark: false,
        },
        {
          id: crypto.randomUUID(),
          type: 'dialogue',
          text: 'Look at the tire marks.',
          marks: [],
          isOmitted: false,
          revisionMark: false,
        },
        {
          id: crypto.randomUUID(),
          type: 'transition',
          text: 'CUT TO:',
          marks: [],
          isOmitted: false,
          revisionMark: false,
        },
      ],
    };

    const serialized = serializeFountain(doc);
    expect(serialized).toContain('EXT. STREET - NIGHT');
    expect(serialized).toContain('The pavement gleams under neon lights.');
    expect(serialized).toContain('DETECTIVE COLE');
    expect(serialized).toContain('Look at the tire marks.');
    expect(serialized).toContain('> CUT TO:');
  });

  it('converts fountain text to tiptap screenplay html correctly', () => {
    const text = `INT. WAREHOUSE - DAY\n\nA lone guard patrols the corridor.\n\nGUARD\nWho's there?\n\n> FADE OUT.`;
    const html = fountainToHtml(text);
    expect(html).toContain('<div class="script-scene-heading">INT. WAREHOUSE - DAY</div>');
    expect(html).toContain('<div class="script-action">A lone guard patrols the corridor.</div>');
    expect(html).toContain('<div class="script-character">GUARD</div>');
    expect(html).toContain('<div class="script-dialogue">Who&#039;s there?</div>');
    expect(html).toContain('<div class="script-transition">FADE OUT.</div>');
  });
});

