import { XMLParser } from 'fast-xml-parser';
import { ScreenplayBlock, createScreenplayBlock, ScreenplayBlockType, InlineMark, CanonicalDocumentMetadata } from '@openscript/screenplay-schema';

export interface ParsedFdxResult {
  blocks: ScreenplayBlock[];
  metadata: Partial<CanonicalDocumentMetadata>;
}

const TYPE_MAP: Record<string, ScreenplayBlockType> = {
  'scene heading': 'sceneHeading',
  'sceneheading': 'sceneHeading',
  'action': 'action',
  'character': 'character',
  'parenthetical': 'parenthetical',
  'dialogue': 'dialogue',
  'transition': 'transition',
  'shot': 'shot',
  'general': 'general',
  'dual dialogue': 'dualDialogue',
};

function normalizeParagraphType(rawType: string = ''): ScreenplayBlockType {
  const lower = rawType.toLowerCase().trim();
  return TYPE_MAP[lower] || 'action';
}

interface TextSegment {
  text: string;
  marks: InlineMark[];
}

function extractTextAndMarks(textNode: any, baseOffset: number = 0): TextSegment {
  if (textNode === null || textNode === undefined) {
    return { text: '', marks: [] };
  }

  if (typeof textNode === 'string' || typeof textNode === 'number') {
    return { text: String(textNode), marks: [] };
  }

  const str = textNode['#text'] !== undefined ? String(textNode['#text']) : '';
  const marks: InlineMark[] = [];
  const style = String(textNode['@_Style'] || '').toLowerCase();
  const adornment = Number(textNode['@_AdornmentStyle'] || 0);

  const from = baseOffset;
  const to = baseOffset + str.length;

  if (style.includes('bold') || (adornment & 1)) {
    marks.push({ type: 'bold', from, to });
  }
  if (style.includes('italic') || (adornment & 2)) {
    marks.push({ type: 'italic', from, to });
  }
  if (style.includes('underline') || (adornment & 4)) {
    marks.push({ type: 'underline', from, to });
  }
  if (style.includes('strike') || (adornment & 8)) {
    marks.push({ type: 'strikethrough', from, to });
  }

  return { text: str, marks };
}

export function parseFdx(xmlString: string): ParsedFdxResult {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    parseAttributeValue: false,
    trimValues: false,
  });

  const parsed = parser.parse(xmlString);
  const root = parsed.FinalDraft || parsed.finaldraft || parsed;
  const content = root.Content || root.content;

  const rawParagraphs = content?.Paragraph || content?.paragraph || [];
  const paragraphList = Array.isArray(rawParagraphs) ? rawParagraphs : [rawParagraphs].filter(Boolean);

  const blocks: ScreenplayBlock[] = [];

  for (const para of paragraphList) {
    const rawType = para['@_Type'] || para['@_type'] || 'Action';
    const blockType = normalizeParagraphType(rawType);

    let fullText = '';
    const marks: InlineMark[] = [];

    const rawTextNodes = para.Text || para.text;
    if (rawTextNodes !== undefined) {
      const textNodesList = Array.isArray(rawTextNodes) ? rawTextNodes : [rawTextNodes];
      for (const tNode of textNodesList) {
        const segment = extractTextAndMarks(tNode, fullText.length);
        fullText += segment.text;
        marks.push(...segment.marks);
      }
    }

    // Check for scene properties (number)
    const sceneProps = para.SceneProperties || para.sceneproperties;
    const sceneNumber = sceneProps ? String(sceneProps['@_Number'] || sceneProps['@_number'] || '').trim() : undefined;

    blocks.push(
      createScreenplayBlock({
        id: crypto.randomUUID(),
        type: blockType,
        text: fullText,
        marks: marks.length > 0 ? marks : undefined,
        sceneNumber: sceneNumber || undefined,
      })
    );
  }

  // Parse title page metadata if present
  const titlePage = root.TitlePage || root.titlepage;
  const titleContent = titlePage?.Content || titlePage?.content;
  const rawTitleParas = titleContent?.Paragraph || titleContent?.paragraph || [];
  const titleParaList = Array.isArray(rawTitleParas) ? rawTitleParas : [rawTitleParas].filter(Boolean);

  const metadata: Partial<CanonicalDocumentMetadata> = {};

  for (const tPara of titleParaList) {
    const pType = String(tPara['@_Type'] || tPara['@_type'] || '').toLowerCase();
    const rawText = tPara.Text || tPara.text;
    let text = '';
    if (typeof rawText === 'string') {
      text = rawText.trim();
    } else if (rawText && rawText['#text']) {
      text = String(rawText['#text']).trim();
    }

    if (pType.includes('title') && text) {
      metadata.title = text;
    } else if (pType.includes('credit') && text) {
      metadata.credit = text;
    } else if (pType.includes('author') && text) {
      metadata.authors = [text];
    }
  }

  return { blocks, metadata };
}
