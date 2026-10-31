import { describe, it, expect } from 'vitest';
import { importScreenplayFile } from '../importer';

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

  it('parses Scrivener (.scrivx) project XML structure into screenplay scenes', async () => {
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
