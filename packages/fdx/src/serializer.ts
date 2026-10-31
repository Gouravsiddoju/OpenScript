import { ScreenplayBlock, CanonicalDocumentMetadata, InlineMark } from '@openscript/screenplay-schema';

export interface SerializeFdxInput {
  content: ScreenplayBlock[];
  metadata?: Partial<CanonicalDocumentMetadata>;
}

function escapeXml(unsafe: string = ''): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

const REVERSE_TYPE_MAP: Record<string, string> = {
  sceneHeading: 'Scene Heading',
  action: 'Action',
  character: 'Character',
  parenthetical: 'Parenthetical',
  dialogue: 'Dialogue',
  transition: 'Transition',
  shot: 'Shot',
  general: 'General',
  dualDialogue: 'Dual Dialogue',
};

function renderTextWithMarks(text: string, marks?: InlineMark[]): string {
  if (!marks || marks.length === 0) {
    return `<Text>${escapeXml(text)}</Text>`;
  }

  // Identify boundary points
  const points = new Set<number>([0, text.length]);
  for (const mark of marks) {
    if (mark.from >= 0 && mark.from <= text.length) points.add(mark.from);
    if (mark.to >= 0 && mark.to <= text.length) points.add(mark.to);
  }
  const sortedPoints = Array.from(points).sort((a, b) => a - b);

  let xml = '';
  for (let i = 0; i < sortedPoints.length - 1; i++) {
    const from = sortedPoints[i];
    const to = sortedPoints[i + 1];
    const slice = text.slice(from, to);
    if (!slice) continue;

    const activeMarks = marks.filter(m => m.from <= from && m.to >= to);
    const styles: string[] = [];
    if (activeMarks.some(m => m.type === 'bold')) styles.push('Bold');
    if (activeMarks.some(m => m.type === 'italic')) styles.push('Italic');
    if (activeMarks.some(m => m.type === 'underline')) styles.push('Underline');
    if (activeMarks.some(m => m.type === 'strikethrough')) styles.push('Strike');

    if (styles.length > 0) {
      xml += `<Text Style="${styles.join('+')}">${escapeXml(slice)}</Text>`;
    } else {
      xml += `<Text>${escapeXml(slice)}</Text>`;
    }
  }

  return xml || `<Text>${escapeXml(text)}</Text>`;
}

export function serializeFdx(input: SerializeFdxInput): string {
  const { content, metadata } = input;

  let bodyXml = '';
  for (const block of content) {
    const typeAttr = REVERSE_TYPE_MAP[block.type] || 'Action';
    let inner = '';

    if (block.sceneNumber) {
      inner += `\n      <SceneProperties Number="${escapeXml(block.sceneNumber)}" />`;
    }

    const textNodes = renderTextWithMarks(block.text, block.marks);
    inner += `\n      ${textNodes}\n    `;

    bodyXml += `    <Paragraph Type="${typeAttr}">${inner}</Paragraph>\n`;
  }

  const title = escapeXml(metadata?.title || 'Untitled Screenplay');
  const credit = escapeXml(metadata?.credit || 'written by');
  const authors = escapeXml(metadata?.authors?.[0] || 'Author');

  return `<?xml version="1.0" encoding="UTF-8" standalone="no" ?>
<FinalDraft DocumentType="Script" Template="No" Version="1">
  <Content>
${bodyXml}  </Content>
  <TitlePage>
    <Content>
      <Paragraph Type="Title">
        <Text>${title}</Text>
      </Paragraph>
      <Paragraph Type="Credit">
        <Text>${credit}</Text>
      </Paragraph>
      <Paragraph Type="Author">
        <Text>${authors}</Text>
      </Paragraph>
    </Content>
  </TitlePage>
</FinalDraft>
`;
}
