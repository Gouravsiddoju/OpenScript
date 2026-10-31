import { describe, it, expect } from 'vitest';
import { parseFdx } from '../parser';
import { serializeFdx } from '../serializer';
import { createScreenplayBlock } from '@openscript/screenplay-schema';

describe('Final Draft FDX Parser & Serializer', () => {
  const sampleFdxXml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <Content>
    <Paragraph Type="Scene Heading">
      <SceneProperties Number="1" />
      <Text>INT. COFFEE SHOP - DAY</Text>
    </Paragraph>
    <Paragraph Type="Action">
      <Text>Rain drums against the glass window.</Text>
    </Paragraph>
    <Paragraph Type="Character">
      <Text>MAYA</Text>
    </Paragraph>
    <Paragraph Type="Parenthetical">
      <Text>(sighs)</Text>
    </Paragraph>
    <Paragraph Type="Dialogue">
      <Text>We don't have much time.</Text>
    </Paragraph>
    <Paragraph Type="Transition">
      <Text>CUT TO:</Text>
    </Paragraph>
  </Content>
  <TitlePage>
    <Content>
      <Paragraph Type="Title">
        <Text>THE GLASS COUNTER</Text>
      </Paragraph>
      <Paragraph Type="Credit">
        <Text>written by</Text>
      </Paragraph>
      <Paragraph Type="Author">
        <Text>Gourav Siddoju</Text>
      </Paragraph>
    </Content>
  </TitlePage>
</FinalDraft>`;

  it('parses Final Draft XML into canonical blocks and metadata', () => {
    const { blocks, metadata } = parseFdx(sampleFdxXml);

    expect(blocks.length).toBe(6);
    expect(blocks[0].type).toBe('sceneHeading');
    expect(blocks[0].text).toBe('INT. COFFEE SHOP - DAY');
    expect(blocks[0].sceneNumber).toBe('1');

    expect(blocks[1].type).toBe('action');
    expect(blocks[1].text).toBe('Rain drums against the glass window.');

    expect(blocks[2].type).toBe('character');
    expect(blocks[2].text).toBe('MAYA');

    expect(blocks[3].type).toBe('parenthetical');
    expect(blocks[3].text).toBe('(sighs)');

    expect(blocks[4].type).toBe('dialogue');
    expect(blocks[4].text).toBe("We don't have much time.");

    expect(blocks[5].type).toBe('transition');
    expect(blocks[5].text).toBe('CUT TO:');

    expect(metadata.title).toBe('THE GLASS COUNTER');
    expect(metadata.credit).toBe('written by');
    expect(metadata.authors).toEqual(['Gourav Siddoju']);
  });

  it('serializes canonical blocks into valid Final Draft FDX XML', () => {
    const blocks = [
      createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'sceneHeading',
        text: 'EXT. ROOFTOP - NIGHT',
        sceneNumber: '42',
      }),
      createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'action',
        text: 'The wind howls violently.',
      }),
      createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'character',
        text: 'DETECTIVE COLE',
      }),
      createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'dialogue',
        text: 'Step away from the edge!',
      }),
    ];

    const xml = serializeFdx({
      content: blocks,
      metadata: {
        title: 'NIGHT RUNNER',
        credit: 'screenplay by',
        authors: ['Jane Doe'],
      },
    });

    expect(xml).toContain('<FinalDraft DocumentType="Script"');
    expect(xml).toContain('<Paragraph Type="Scene Heading">');
    expect(xml).toContain('<SceneProperties Number="42" />');
    expect(xml).toContain('<Text>EXT. ROOFTOP - NIGHT</Text>');
    expect(xml).toContain('<Paragraph Type="Character">');
    expect(xml).toContain('<Text>DETECTIVE COLE</Text>');
    expect(xml).toContain('<Text>NIGHT RUNNER</Text>');

    // Round-trip parse
    const { blocks: parsedBlocks, metadata } = parseFdx(xml);
    expect(parsedBlocks.length).toBe(4);
    expect(parsedBlocks[0].text).toBe('EXT. ROOFTOP - NIGHT');
    expect(parsedBlocks[0].sceneNumber).toBe('42');
    expect(parsedBlocks[2].text).toBe('DETECTIVE COLE');
    expect(metadata.title).toBe('NIGHT RUNNER');
  });

  it('handles formatted text with inline styles (bold, italic)', () => {
    const styledXml = `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <Content>
    <Paragraph Type="Action">
      <Text>She stared in </Text>
      <Text Style="Bold">disbelief</Text>
      <Text> at the artifact.</Text>
    </Paragraph>
  </Content>
</FinalDraft>`;

    const { blocks } = parseFdx(styledXml);
    expect(blocks.length).toBe(1);
    expect(blocks[0].text).toBe('She stared in disbelief at the artifact.');
    expect(blocks[0].marks?.length).toBe(1);
    expect(blocks[0].marks?.[0].type).toBe('bold');
    expect(blocks[0].marks?.[0].from).toBe(14);
    expect(blocks[0].marks?.[0].to).toBe(23);
  });
});
