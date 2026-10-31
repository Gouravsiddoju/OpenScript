import { describe, it, expect } from 'vitest';
import { importScreenplayFile, rtfToText, parseScrivenerFolderEntries, FileEntry } from '../importer';
import JSZip from 'jszip';

// Helper to create mock File in Node environment
function createMockFile(content: string, name: string): File {
  return new File([content], name, { type: 'text/plain' });
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

    // 1. Add project.scrivx binder
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

    // 2. Add scene 1 content.rtf
    const scene1Rtf = `{\\rtf1\\ansi
\\pard Rain pours on neon pavement.\\par
\\pard JIN\\par
\\pard They found us.\\par
}`;
    zip.file('Files/Data/10/content.rtf', scene1Rtf);

    // 3. Add scene 2 content.rtf
    const scene2Rtf = `{\\rtf1\\ansi
\\pard Jin leaps over the dumpster into darkness.\\par
}`;
    zip.file('Files/Data/11/content.rtf', scene2Rtf);

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    const zipFile = new File([zipBlob], 'Neon_Syndicate.scriv.zip', { type: 'application/zip' });

    const result = await importScreenplayFile(zipFile);

    expect(result.sourceApp).toBe('Scrivener');
    expect(result.title).toBe('Neon Syndicate');
    expect(result.fountainText).toContain('INT. ALLEYWAY - NIGHT');
    expect(result.fountainText).toContain('Rain pours on neon pavement.');
    expect(result.fountainText).toContain('JIN');
    expect(result.fountainText).toContain('They found us.');
    expect(result.fountainText).toContain('Jin leaps over the dumpster');
  });

  it('parses modern Scrivener 3 project folders with UUID binder items and nested folders', async () => {
    const scriv3Xml = `<?xml version="1.0" encoding="UTF-8"?>
<ScrivenerProject Version="2.0">
  <ProjectTitle>SCREENPLAY FORMAT</ProjectTitle>
  <Binder>
    <BinderItem UUID="ROOT-FOLDER" Type="Folder">
      <Title>Screenplay</Title>
      <Children>
        <BinderItem UUID="E6290074-E01E-428E-B23B-9CE1A4697F7A" Type="Text">
          <Title>EXT. BANK - NIGHT</Title>
        </BinderItem>
        <BinderItem UUID="A8193402-9921-4EF1-A281-0182C3D4E5F6" Type="Text">
          <Title>INT. VAULT - CONTINUOUS</Title>
        </BinderItem>
      </Children>
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
});
