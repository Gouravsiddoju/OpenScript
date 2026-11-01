import '../pdfPolyfill';
import { describe, it, expect } from 'vitest';
import {
  importScreenplayFile,
  rtfToText,
  parseScrivenerFolderEntries,
  extractScrivenerBinderItems,
  isScrivenerTemplateBoilerplate,
  FileEntry,
} from '../importer';
import JSZip from 'jszip';

// Helper to create mock File in Node environment
function createMockFile(content: string, name: string): File {
  return new File([content], name, { type: 'text/plain' });
}

// Helper to generate a minimal valid PDF 1.4 buffer with text positioning
function createVectorScreenplayPdf(lines: { text: string; x: number; y: number }[], fileName: string = 'sample_screenplay.pdf'): File {
  const streamLines = lines
    .map((l) => `1 0 0 1 ${l.x} ${l.y} Tm (${l.text.replace(/([()\\])/g, '\\$1')}) Tj`)
    .join('\n');
  const contentStream = `BT\n/F1 12 Tf\n${streamLines}\nET`;
  const streamLen = Buffer.byteLength(contentStream);

  const pdf = `%PDF-1.4
1 0 obj
<< /Type /Catalog /Pages 2 0 R >>
endobj
2 0 obj
<< /Type /Pages /Kids [3 0 R] /Count 1 >>
endobj
3 0 obj
<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>
endobj
4 0 obj
<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>
endobj
5 0 obj
<< /Length ${streamLen} >>
stream
${contentStream}
endstream
endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000058 00000 n 
0000000115 00000 n 
0000000224 00000 n 
0000000289 00000 n 
trailer
<< /Size 6 /Root 1 0 R >>
startxref
450
%%EOF`;

  return new File([Buffer.from(pdf)], fileName, { type: 'application/pdf' });
}

describe('Universal Screenplay Importer', () => {
  it('parses standard Fountain / Highland screenplay files with title page metadata', async () => {
    const fountainContent = `Title: THE NEON DRIFT
Author: Gourav Siddoju
Draft date: November 2026

INT. DETECTIVE OFFICE - NIGHT

Rain lashes against the blinds.

GOURAV
We are running out of time.
`;

    const file = createMockFile(fountainContent, 'neon_drift.fountain');
    const result = await importScreenplayFile(file);

    expect(result.sourceApp).toBe('Fountain / Highland');
    expect(result.title).toBe('THE NEON DRIFT');
    expect(result.author).toBe('Gourav Siddoju');
    expect(result.sceneCount).toBe(1);
    expect(result.scriptHtml).toContain('script-scene-heading');
    expect(result.scriptHtml).toContain('INT. DETECTIVE OFFICE - NIGHT');
    expect(result.scriptHtml).toContain('GOURAV');
  });

  it('parses standalone Scrivener (.scrivx) project outline and includes guidance warnings', async () => {
    const scrivenerXml = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Version="1.0">
  <ProjectTitle>Cyberpunk Detective</ProjectTitle>
  <Binder>
    <BinderItem ID="1" Type="Text">
      <Title>INT. CYBER CAFE - DAY</Title>
      <MetaData>
        <Synopsis>Kai plugs his neural deck into the terminal.</Synopsis>
      </MetaData>
    </BinderItem>
    <BinderItem ID="2" Type="Text">
      <Title>EXT. ROOFTOP - NIGHT</Title>
      <MetaData>
        <Synopsis>Sirens wail as a hovercraft descends.</Synopsis>
      </MetaData>
    </BinderItem>
  </Binder>
</ScrivenerProject>`;

    const file = createMockFile(scrivenerXml, 'project.scrivx');
    const result = await importScreenplayFile(file);

    expect(result.sourceApp).toBe('Scrivener');
    expect(result.title).toBe('Cyberpunk Detective');
    expect(result.sceneCount).toBe(2);
    expect(result.fountainText).toContain('INT. CYBER CAFE - DAY');
    expect(result.fountainText).toContain('EXT. ROOFTOP - NIGHT');
    expect(result.fountainText).toContain('Kai plugs his neural deck');
    expect(result.warnings?.length).toBeGreaterThan(0);
  });

  it('converts RTF formatted text into clean screenplay text', () => {
    const sampleRtf = `{\\rtf1\\ansi\\ansicpg1252\\deff0\\nouicompat
{\\fonttbl{\\f0\\fnil\\fcharset0 Courier Prime;}}
{\\colortbl ;\\red0\\green0\\blue0;}
\\pard\\qc\\b\\f0\\fs24 INT. SUBWAY TUNNEL - NIGHT\\b0\\par
\\pard\\ql Water drips into rusted tracks.\\par
\\pard\\qc MARCUS\\par
\\pard\\qr Keep your flashlight pointed down.\\par
}`;

    const text = rtfToText(sampleRtf);
    expect(text).toContain('INT. SUBWAY TUNNEL - NIGHT');
    expect(text).toContain('Water drips into rusted tracks.');
    expect(text).toContain('MARCUS');
    expect(text).toContain('Keep your flashlight pointed down.');
  });

  it('parses full Scrivener zip archive (.scriv.zip) with binder XML and Files/Data content.rtf', async () => {
    const zip = new JSZip();

    const scrivx = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Version="1.0">
  <ProjectTitle>Neon Syndicate</ProjectTitle>
  <Binder>
    <BinderItem ID="10" Type="Text">
      <Title>INT. ALLEYWAY - NIGHT</Title>
    </BinderItem>
    <BinderItem ID="11" Type="Text">
      <Title>Scene 2</Title>
    </BinderItem>
  </Binder>
</ScrivenerProject>`;

    zip.file('project.scrivx', scrivx);

    const rtf1 = `{\\rtf1\\ansi
\\pard\\ql Kael ducks beneath the neon awning as chrome drones patrol above.\\par
\\pard\\qc KAEL\\par
\\pard\\ql The signal is jamming us.\\par
}`;
    zip.file('Files/Data/10/content.rtf', rtf1);

    const rtf2 = `{\\rtf1\\ansi
\\pard\\qc EXT. STREET - CONTINUOUS\\par
\\pard\\ql Tires screech across wet pavement.\\par
}`;
    zip.file('Files/Data/11/content.rtf', rtf2);

    const blob = await zip.generateAsync({ type: 'blob' });
    const zipFile = new File([blob], 'Neon Syndicate.scriv.zip');

    const result = await importScreenplayFile(zipFile);

    expect(result.sourceApp).toBe('Scrivener');
    expect(result.title).toBe('Neon Syndicate');
    expect(result.sceneCount).toBe(2);
    expect(result.fountainText).toContain('INT. ALLEYWAY - NIGHT');
    expect(result.fountainText).toContain('Kael ducks beneath the neon awning');
    expect(result.fountainText).toContain('KAEL');
    expect(result.fountainText).toContain('The signal is jamming us.');
    expect(result.fountainText).toContain('EXT. STREET - CONTINUOUS');
  });

  it('strictly filters out Scrivener non-draft folders (Template Sheets, Research, Trash) and instruction boilerplate', async () => {
    const complexScrivx = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Version="2.0">
  <ProjectTitle>Cyber Heist</ProjectTitle>
  <Binder>
    <BinderItem UUID="DRAFT-ROOT" Type="DraftFolder">
      <Title>Screenplay</Title>
      <Children>
        <BinderItem UUID="ACTUAL-SCENE-1" Type="Text">
          <Title>INT. SERVER ROOM - NIGHT</Title>
        </BinderItem>
      </Children>
    </BinderItem>
    <BinderItem UUID="RESEARCH-ROOT" Type="ResearchFolder">
      <Title>Research</Title>
      <Children>
        <BinderItem UUID="TEMPLATE-DOC" Type="Text">
          <Title>Screenplay Format</Title>
        </BinderItem>
      </Children>
    </BinderItem>
    <BinderItem UUID="TEMPLATE-ROOT" Type="Folder">
      <Title>Template Sheets</Title>
      <Children>
        <BinderItem UUID="SKETCH-DOC" Type="Text">
          <Title>Character Sketch Sheet</Title>
        </BinderItem>
      </Children>
    </BinderItem>
    <BinderItem UUID="TRASH-ROOT" Type="TrashFolder">
      <Title>Trash</Title>
    </BinderItem>
  </Binder>
</ScrivenerProject>`;

    // 1. Binder items extracted should ONLY contain the actual scene in the DraftFolder
    const items = extractScrivenerBinderItems(complexScrivx);
    expect(items.length).toBe(1);
    expect(items[0].id).toBe('ACTUAL-SCENE-1');
    expect(items[0].title).toBe('INT. SERVER ROOM - NIGHT');

    // 2. Test boilerplate detector
    const boilerplateText = `"Characters" folder, and information about locations can be stored in the "Places" folder. (These are just regular folders that have had custom icons assigned to them using the Documents > Change Icon... menu.) Character and setting sketch sheets have been provided which can be used for filling out information about the people and places in your novel. These are located in the "Template Sheets" folder... Sample document <$Scr_ps::1>`;
    expect(isScrivenerTemplateBoilerplate(boilerplateText)).toBe(true);

    // 3. Test full project folder entries parsing: boilerplate must not leak into script
    const sceneRtf = `{\\rtf1\\ansi\\pard\\ql Sparks shower from the main server rack.\\par}`;
    const templateRtf = `{\\rtf1\\ansi\\pard\\ql ${boilerplateText}\\par}`;

    const entries: FileEntry[] = [
      { path: 'Cyber Heist.scriv/project.scrivx', file: createMockFile(complexScrivx, 'project.scrivx') },
      { path: 'Cyber Heist.scriv/Files/Data/ACTUAL-SCENE-1/content.rtf', file: createMockFile(sceneRtf, 'content.rtf') },
      { path: 'Cyber Heist.scriv/Files/Data/TEMPLATE-DOC/content.rtf', file: createMockFile(templateRtf, 'content.rtf') },
    ];

    const result = await parseScrivenerFolderEntries(entries, 'Cyber Heist.scriv');
    expect(result.fountainText).toContain('INT. SERVER ROOM - NIGHT');
    expect(result.fountainText).toContain('Sparks shower from the main server rack.');
    expect(result.fountainText).not.toContain('Characters" folder');
    expect(result.fountainText).not.toContain('sketch sheets have been provided');
    expect(result.fountainText).not.toContain('SCREENPLAY FORMAT');
  });

  it('parses Scrivener 3 UUID-based folders with content.rtf', async () => {
    const scriv3Xml = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Version="2.0">
  <ProjectTitle>SCREENPLAY FORMAT</ProjectTitle>
  <Binder>
    <BinderItem UUID="E6290074-E01E-428E-B23B-9CE1A4697F7A" Type="Text">
      <Title>EXT. BANK - NIGHT</Title>
    </BinderItem>
    <BinderItem UUID="A8193402-9921-4EF1-A281-0182C3D4E5F6" Type="Text">
      <Title>INT. VAULT - CONTINUOUS</Title>
    </BinderItem>
  </Binder>
</ScrivenerProject>`;

    const scene1Rtf = `{\\rtf1\\ansi\\ansicpg1252\\deff0
\\pard\\ql Rain hammers the armored truck parked out front.\\par
\\pard\\qc VINCENT\\par
\\pard\\ql We only have four minutes.\\par
}`;

    const scene2Rtf = `{\\rtf1\\ansi\\ansicpg1252\\deff0
\\pard\\ql The heavy vault door groans open, revealing stacks of bearer bonds.\\par
\\pard\\qc GAIUS\\par
\\pard\\ql Grab the duffel bags.\\par
}`;

    const entries: FileEntry[] = [
      { path: 'Screenplay Format.scriv/project.scrivx', file: createMockFile(scriv3Xml, 'project.scrivx') },
      { path: 'Screenplay Format.scriv/Files/Data/E6290074-E01E-428E-B23B-9CE1A4697F7A/content.rtf', file: createMockFile(scene1Rtf, 'content.rtf') },
      { path: 'Screenplay Format.scriv/Files/Data/A8193402-9921-4EF1-A281-0182C3D4E5F6/content.rtf', file: createMockFile(scene2Rtf, 'content.rtf') },
    ];

    const result = await parseScrivenerFolderEntries(entries, 'Screenplay Format.scriv');

    expect(result.sourceApp).toBe('Scrivener');
    expect(result.title).toBe('SCREENPLAY FORMAT');
    expect(result.sceneCount).toBe(2);
    expect(result.fountainText).toContain('EXT. BANK - NIGHT');
    expect(result.fountainText).toContain('Rain hammers the armored truck');
    expect(result.fountainText).toContain('VINCENT');
    expect(result.fountainText).toContain('We only have four minutes.');
    expect(result.fountainText).toContain('INT. VAULT - CONTINUOUS');
    expect(result.fountainText).toContain('GAIUS');
    expect(result.fountainText).toContain('Grab the duffel bags.');
  });

  it('parses HTML screenplay exports (Celtx / Web exports)', async () => {
    const htmlContent = `
      <div class="scene-heading">EXT. SUBWAY ENTRANCE - DAWN</div>
      <p class="action">Steam rises from the grates into the cold air.</p>
      <div class="character">ALEX</div>
      <p class="dialogue">Did you get the drive?</p>
    `;

    const file = createMockFile(htmlContent, 'celtx_export.html');
    const result = await importScreenplayFile(file);

    expect(result.sourceApp).toBe('HTML Screenplay');
    expect(result.sceneCount).toBe(1);
    expect(result.scriptHtml).toContain('EXT. SUBWAY ENTRANCE - DAWN');
    expect(result.scriptHtml).toContain('ALEX');
  });

  it('parses Final Draft XML (.fdx) files', async () => {
    const fdxContent = `<?xml version="1.0" encoding="UTF-8"?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <Content>
    <Paragraph Type="Scene Heading">
      <Text>INT. SAFE HOUSE - NIGHT</Text>
    </Paragraph>
    <Paragraph Type="Action">
      <Text>A flickering light bulb buzzes overhead.</Text>
    </Paragraph>
    <Paragraph Type="Character">
      <Text>SARAH</Text>
    </Paragraph>
    <Paragraph Type="Dialogue">
      <Text>Don't turn on the radio.</Text>
    </Paragraph>
  </Content>
</FinalDraft>`;

    const file = createMockFile(fdxContent, 'mission.fdx');
    const result = await importScreenplayFile(file);

    expect(result.sourceApp).toBe('Final Draft');
    expect(result.sceneCount).toBe(1);
    expect(result.scriptHtml).toContain('INT. SAFE HOUSE - NIGHT');
    expect(result.scriptHtml).toContain('SARAH');
    expect(result.scriptHtml).toContain('Don&#039;t turn on the radio.');
  });

  it('dissects and parses vector PDF screenplays into structured blocks', async () => {
    const pdfFile = createVectorScreenplayPdf([
      { text: 'INT. DETECTIVE OFFICE - DAY', x: 72, y: 700 },
      { text: 'Rain lashes against the glass.', x: 72, y: 660 },
      { text: 'DETECTIVE', x: 260, y: 620 },
      { text: '(leaning forward)', x: 220, y: 600 },
      { text: 'We found the missing phone.', x: 180, y: 580 },
      { text: 'CUT TO:', x: 400, y: 540 },
    ]);

    const result = await importScreenplayFile(pdfFile);

    expect(result.sourceApp).toBe('PDF Screenplay');
    expect(result.sceneCount).toBe(1);
    expect(result.fountainText).toContain('INT. DETECTIVE OFFICE - DAY');
    expect(result.fountainText).toContain('Rain lashes against the glass.');
    expect(result.fountainText).toContain('DETECTIVE');
    expect(result.fountainText).toContain('(leaning forward)');
    expect(result.fountainText).toContain('We found the missing phone.');
    expect(result.fountainText).toContain('CUT TO:');
    expect(result.scriptHtml).toContain('script-scene-heading');
    expect(result.scriptHtml).toContain('script-character');
    expect(result.scriptHtml).toContain('script-dialogue');
  });

  it('throws a friendly descriptive error on scanned or image-only PDFs without vector text', async () => {
    // Generate a valid PDF with no text elements (simulating a scanned image-only PDF)
    const scannedFile = createVectorScreenplayPdf([]);
    await expect(importScreenplayFile(scannedFile)).rejects.toThrow(/no extractable text elements/i);
  });

  it('cleans complex Scrivener RTF markup, nested font tables, and style tags', () => {
    const rawRtf = '{\\rtf1\\ansi{\\fonttbl{\\f0\\fnil\\fcharset0 CourierPrime;}{\\f1 Arial;}}\\pard\\sb240 <c450>00pt</c450>INT. DETECTIVE OFFICE - MORNING\\par The assistant is typing on the laptop.\\par}';
    const cleaned = rtfToText(rawRtf);
    expect(cleaned).not.toContain('CourierPrime');
    expect(cleaned).not.toContain('c450');
    expect(cleaned).not.toContain('00pt');
    expect(cleaned).toContain('INT. DETECTIVE OFFICE - MORNING');
    expect(cleaned).toContain('The assistant is typing on the laptop.');
  });

  it('cleans inline Scrivener screenplay RTF control codes, custom character tags, and preserves scene headings', () => {
    const rawRtf = `getting his hands touch keyboard...
\\cs40\\v\\f0\\fs24\\cf1\\ul\\b\\ulnone\\b0\\cf0\\fs24\\b<assistant>\\cf0\\fs24<part> rohit, you should see this!
\\cs40\\v\\f0\\fs24\\cf1\\ul\\b\\ulnone\\b0\\cf0\\fs24\\b<detective> comes to him and watches it.
DOUF TO:
\\cs40\\v\\f0\\fs24\\cf1\\fs24\\bEXT. RAIN SCENE - MINUTES LATER
CourierPrime;
\\cs40\\v\\f0\\fs24\\b<NAME> INT. DETECTIVE OFFICE - MORNING`;

    const cleaned = rtfToText(rawRtf);
    expect(cleaned).not.toContain('\\cs40');
    expect(cleaned).not.toContain('ulnone');
    expect(cleaned).not.toContain('CourierPrime;');
    expect(cleaned).not.toContain('<NAME>');
    expect(cleaned).not.toContain('<assistant>');
    expect(cleaned).toContain('ASSISTANT');
    expect(cleaned).toContain('rohit, you should see this!');
    expect(cleaned).toContain('DETECTIVE');
    expect(cleaned).toContain('EXT. RAIN SCENE - MINUTES LATER');
    expect(cleaned).toContain('INT. DETECTIVE OFFICE - MORNING');
  });
  it('parses super titles and numbered headings as scene headings from vector PDF', async () => {
    const pdfFile = createVectorScreenplayPdf([
      { text: 'SUPER TITLE: "3. THE CASE"', x: 72, y: 700 },
      { text: 'Vasudev inspects the crime scene.', x: 72, y: 660 },
      { text: '4. THE DEATH', x: 72, y: 620 },
      { text: 'A shadow moves silently.', x: 72, y: 580 },
    ]);

    const result = await importScreenplayFile(pdfFile);
    expect(result.fountainText).toContain('SUPER TITLE: "3. THE CASE"');
    expect(result.fountainText).toContain('4. THE DEATH');
    expect(result.scriptHtml).toContain('script-scene-heading');
  });

  it('filters out temporal cues, camera shots, and end markers from becoming characters', async () => {
    const pdfFile = createVectorScreenplayPdf([
      { text: 'INT. POLICE STATION - DAY', x: 72, y: 700 },
      { text: 'THE NEXT DAY', x: 260, y: 660 },
      { text: 'Papers are scattered everywhere.', x: 72, y: 620 },
      { text: 'ZOOM OUT SLOWLY', x: 260, y: 580 },
      { text: 'IN THE NIGHT', x: 260, y: 540 },
      { text: 'AFTER FEW MONTHS', x: 260, y: 500 },
      { text: 'THE END', x: 260, y: 460 },
    ]);

    const result = await importScreenplayFile(pdfFile);
    // Ensure none of the non-character lines were wrapped in script-character
    expect(result.scriptHtml).not.toContain('<div class="script-character">THE NEXT DAY</div>');
    expect(result.scriptHtml).not.toContain('<div class="script-character">ZOOM OUT SLOWLY</div>');
    expect(result.scriptHtml).not.toContain('<div class="script-character">IN THE NIGHT</div>');
    expect(result.scriptHtml).not.toContain('<div class="script-character">AFTER FEW MONTHS</div>');
    expect(result.scriptHtml).not.toContain('<div class="script-character">THE END</div>');
  });

  it('rejects date/timestamp header from PDF title and falls back cleanly to file name', async () => {
    const pdfFile = createVectorScreenplayPdf([
      { text: '31 DECEMBER 2025 AT 14:30', x: 200, y: 700 },
      { text: 'written by', x: 260, y: 640 },
      { text: 'Gourav Siddarth Siddoju', x: 220, y: 600 },
      { text: 'Blue Production Draft', x: 380, y: 120 },
      { text: 'November 1, 2026', x: 380, y: 100 },
    ], 'The_Last_Download.pdf');

    const result = await importScreenplayFile(pdfFile);
    expect(result.title).toBe('The Last Download');
    expect(result.author).toBe('Gourav Siddarth Siddoju');
    expect(result.title).not.toContain('31 DECEMBER 2025');
  });
});
