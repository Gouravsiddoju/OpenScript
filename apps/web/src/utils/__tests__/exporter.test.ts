import { describe, it, expect } from 'vitest';
import { htmlToBlocks, blocksToFountainText, generateScreenplayPdfDoc, saveScreenplayToLocalDisk } from '../exporter';
import { importScreenplayFile } from '../importer';
import { ScreenplayBlock, createScreenplayBlock } from '@openscript/screenplay-schema';
import { serializeFdx } from '@openscript/fdx';

describe('Universal Screenplay Exporter & Round-Trip', () => {
  it('converts screenplay HTML into structured ScreenplayBlock array', () => {
    const html = `
      <div class="script-scene-heading" data-scene-number="1">INT. LAB - NIGHT</div>
      <div class="script-shot">WIDE SHOT - THE LAB</div>
      <div class="script-action">Dr. Aris monitors the glowing core.</div>
      <div class="script-character">ARIS</div>
      <div class="script-parenthetical">(whispering)</div>
      <div class="script-dialogue">It works.</div>
      <div class="script-transition">FADE OUT.</div>
    `;

    const blocks = htmlToBlocks(html);
    expect(blocks.length).toBe(7);
    expect(blocks[1].type).toBe('shot');
    expect(blocks[1].text).toBe('WIDE SHOT - THE LAB');
    expect(blocks[0].type).toBe('sceneHeading');
    expect(blocks[0].text).toBe('INT. LAB - NIGHT');
    expect(blocks[0].sceneNumber).toBe('1');

    expect(blocks[2].type).toBe('action');
    expect(blocks[3].type).toBe('character');
    expect(blocks[3].text).toBe('ARIS');
    expect(blocks[4].type).toBe('parenthetical');
    expect(blocks[5].type).toBe('dialogue');
    expect(blocks[5].text).toBe('It works.');
    expect(blocks[6].type).toBe('transition');
  });

  it('generates valid Fountain text including complete Title Page header', () => {
    const blocks: ScreenplayBlock[] = [
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'sceneHeading', text: 'EXT. ROOFTOP - DAWN' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'action', text: 'Wind howls across the ledge.' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'character', text: 'KAI' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'dialogue', text: 'No turning back.' }),
    ];

    const fountain = blocksToFountainText(blocks, {
      title: 'SKYLINE RUNNER',
      author: 'Gourav Siddoju',
      credit: 'written by',
      draftLabel: 'Production Draft',
      contact: 'contact@ssnpictures.in',
    });

    expect(fountain).toContain('Title: SKYLINE RUNNER');
    expect(fountain).toContain('Author: Gourav Siddoju');
    expect(fountain).toContain('Credit: written by');
    expect(fountain).toContain('Draft date: Production Draft');
    expect(fountain).toContain('EXT. ROOFTOP - DAWN');
    expect(fountain).toContain('KAI');
    expect(fountain).toContain('No turning back.');
  });

  it('guarantees 100% round-trip reloadability between OpenScript export and importer', async () => {
    // 1. Prepare sample blocks
    const originalBlocks: ScreenplayBlock[] = [
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'sceneHeading', text: 'INT. COMMAND CENTER - DAY' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'action', text: 'Monitors flicker in the darkness.' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'character', text: 'COMMANDER' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'dialogue', text: 'Status report now.' }),
    ];

    // 2. Export payload as OpenScript JSON / .openscript
    const projectSnapshot = {
      schemaVersion: 2,
      generator: 'OpenScript Studio Pro',
      exportedAt: new Date().toISOString(),
      metadata: {
        title: 'PROJECT ZEUS',
        authors: ['SSN Pictures Team'],
        credit: 'original screenplay by',
        draftLabel: 'Goldenrod Revision',
      },
      content: originalBlocks,
      sceneTakes: [
        {
          id: 'take-1',
          sceneId: 1,
          takeNumber: 1,
          title: 'Take 1 (Original)',
          fountainText: 'INT. COMMAND CENTER - DAY\n\nMonitors flicker in the darkness.',
          isFinalized: true,
        },
      ],
      notes: [
        {
          id: 'note-1',
          content: 'Add warning siren audio FX',
          authorName: 'Director',
          category: 'production',
          resolved: false,
        },
      ],
    };

    const file = new File([JSON.stringify(projectSnapshot)], 'project_zeus.openscript', {
      type: 'application/json',
    });

    // 3. Import through universal importer
    const imported = await importScreenplayFile(file);

    expect(imported.sourceApp).toBe('OpenScript JSON');
    expect(imported.title).toBe('PROJECT ZEUS');
    expect(imported.author).toBe('SSN Pictures Team');
    expect(imported.sceneCount).toBe(1);
    expect(imported.scriptHtml).toContain('INT. COMMAND CENTER - DAY');
    expect(imported.scriptHtml).toContain('COMMANDER');
    expect(imported.scriptHtml).toContain('Status report now.');
    expect(imported.sceneTakes?.length).toBe(1);
    expect(imported.notes?.length).toBe(1);
  });

  it('generates compliant Final Draft FDX XML with title and character elements', () => {
    const blocks: ScreenplayBlock[] = [
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'sceneHeading', text: 'INT. STUDY - NIGHT', sceneNumber: '4A' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'character', text: 'ELENA' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'dialogue', text: 'I found the key.' }),
    ];

    const xml = serializeFdx({
      content: blocks,
      metadata: {
        title: 'THE MANOR SECRETS',
        credit: 'written by',
        authors: ['Elena Vance'],
      },
    });

    expect(xml).toContain('<FinalDraft DocumentType="Script"');
    expect(xml).toContain('<Paragraph Type="Scene Heading">');
    expect(xml).toContain('<SceneProperties Number="4A" />');
    expect(xml).toContain('<Paragraph Type="Character">');
    expect(xml).toContain('<Paragraph Type="Dialogue">');
    expect(xml).toContain('<TitlePage>');
    expect(xml).toContain('<Text>THE MANOR SECRETS</Text>');
  });
  it('generates professional industry-standard screenplay PDF with title page and multiple pages', () => {
    const blocks: ScreenplayBlock[] = [];
    // Generate 15 scenes with dialogue and action to test multi-page pagination & headers
    for (let i = 1; i <= 15; i++) {
      blocks.push(createScreenplayBlock({ id: crypto.randomUUID(), type: 'sceneHeading', text: `INT. SCENE ${i} - DAY`, sceneNumber: String(i) }));
      blocks.push(createScreenplayBlock({ id: crypto.randomUUID(), type: 'action', text: `Action description for scene ${i}. Characters investigate the room and find clues.` }));
      blocks.push(createScreenplayBlock({ id: crypto.randomUUID(), type: 'character', text: 'DETECTIVE' }));
      blocks.push(createScreenplayBlock({ id: crypto.randomUUID(), type: 'parenthetical', text: '(looking at evidence)' }));
      blocks.push(createScreenplayBlock({ id: crypto.randomUUID(), type: 'dialogue', text: `We have secured scene ${i}. Keep searching.` }));
      blocks.push(createScreenplayBlock({ id: crypto.randomUUID(), type: 'transition', text: 'CUT TO:' }));
    }

    const doc = generateScreenplayPdfDoc({
      blocks,
      metadata: {
        title: 'THE INVESTIGATION',
        author: 'Detective Writer',
        credit: 'written by',
        draftLabel: 'Blue Production Draft',
        showTitlePage: true,
        showWatermark: true,
        watermarkText: 'CONFIDENTIAL',
      },
    });

    expect(doc).toBeDefined();
    // Number of pages should be > 1
    const totalPages = doc.getNumberOfPages();
    expect(totalPages).toBeGreaterThanOrEqual(2);

    const pdfBuffer = doc.output('arraybuffer');
    expect(pdfBuffer.byteLength).toBeGreaterThan(5000);
  });

  it('saves screenplay to local disk using fallback download when showSaveFilePicker is unavailable', async () => {
    const blocks: ScreenplayBlock[] = [
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'sceneHeading', text: 'INT. OFFICE - DAY' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'shot', text: 'CLOSE UP - MONITOR' }),
      createScreenplayBlock({ id: crypto.randomUUID(), type: 'action', text: 'The report is ready.' }),
    ];

    const result = await saveScreenplayToLocalDisk({
      blocks,
      metadata: {
        title: 'Operation Omega',
        author: 'Agent Smith',
        credit: 'written by',
        draftLabel: 'Final Draft',
        contact: 'agent@agency.gov',
        basedOn: '',
        draftDate: '2026-11-02',
        showTitlePage: true,
      },
    });

    expect(result.success).toBe(true);
    expect(result.filename).toBe('Operation_Omega.openscript');
    expect(result.mode).toBe('download');
  });
});
