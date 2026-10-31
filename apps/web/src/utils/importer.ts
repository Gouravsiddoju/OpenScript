import { parseFdx } from '@openscript/fdx';
import { fountainToHtml, blocksToHtml } from '@openscript/fountain';

export interface ImportedScreenplayResult {
  title?: string;
  author?: string;
  scriptHtml: string;
  fountainText: string;
  sourceApp: 'Final Draft' | 'Scrivener' | 'Fountain / Highland' | 'Plain Screenplay Text' | 'HTML Screenplay' | 'OpenScript JSON';
  sceneCount: number;
  wordCount: number;
  warnings?: string[];
  fullMetadata?: Record<string, any>;
  sceneTakes?: any[];
  notes?: any[];
}

/**
 * Extracts Fountain Title Page metadata if present
 */
function extractFountainMetadata(fountainText: string): { title?: string; author?: string; body: string } {
  const lines = fountainText.split('\n');
  let title: string | undefined;
  let author: string | undefined;
  let bodyStartIndex = 0;

  let inHeader = true;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inHeader) {
      if (!line.trim()) {
        bodyStartIndex = i + 1;
        inHeader = false;
        continue;
      }
      const match = line.match(/^([A-Za-z\s]+):\s*(.*)$/);
      if (match) {
        const key = match[1].trim().toLowerCase();
        const value = match[2].trim();
        if (key === 'title') title = value.replace(/['"]+/g, '');
        if (key === 'author' || key === 'authors') author = value;
      } else {
        bodyStartIndex = i;
        inHeader = false;
      }
    }
  }

  const body = inHeader ? fountainText : lines.slice(bodyStartIndex).join('\n');
  return { title, author, body };
}

/**
 * Parse Scrivener (.scrivx) Project XML
 * Parses binder items, scene titles, and synopses
 */
function parseScrivenerXml(xmlString: string, fileName: string): ImportedScreenplayResult {
  // Extract project title
  const titleMatch = xmlString.match(/<ProjectTitle[^>]*>(.*?)<\/ProjectTitle>/i) ||
                     xmlString.match(/<Title[^>]*>(.*?)<\/Title>/i);
  const projectTitle = titleMatch ? titleMatch[1].trim() : fileName.replace(/\.scrivx$/i, '').replace(/\.scriv$/i, '');

  const fountainLines: string[] = [];

  if (projectTitle) {
    fountainLines.push(`Title: ${projectTitle.toUpperCase()}`);
    fountainLines.push(`Author: Scrivener Import\n\n`);
  }

  // Find all BinderItems
  const binderRegex = /<BinderItem[^>]*Type="(?:Text|Folder)"[^>]*>([\s\S]*?)<\/BinderItem>/gi;
  let match;
  let sceneNum = 1;

  while ((match = binderRegex.exec(xmlString)) !== null) {
    const inner = match[1];
    const itemTitleMatch = inner.match(/<Title[^>]*>(.*?)<\/Title>/i);
    const itemSynopsisMatch = inner.match(/<Synopsis[^>]*>(.*?)<\/Synopsis>/i);

    const title = itemTitleMatch ? itemTitleMatch[1].trim() : '';
    const synopsis = itemSynopsisMatch ? itemSynopsisMatch[1].trim() : '';

    if (!title && !synopsis) continue;

    const isHeading = /^(INT|EXT|INT\/EXT|I\/E)[.\s]/i.test(title);
    if (isHeading) {
      fountainLines.push(`\n${title.toUpperCase()}\n`);
    } else if (title) {
      fountainLines.push(`\nINT. SCENE ${sceneNum} - ${title.toUpperCase()} - DAY\n`);
      sceneNum++;
    }

    if (synopsis) {
      fountainLines.push(`${synopsis}\n`);
    }
  }

  const fountainText = fountainLines.join('\n').trim() || `INT. SCENE 1 - DAY\n\nAction description from ${fileName}.`;
  const scriptHtml = fountainToHtml(fountainText);
  const words = fountainText.trim().split(/\s+/).filter(Boolean).length;
  const scenes = (fountainText.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/gim) || []).length;

  return {
    title: projectTitle,
    author: 'Scrivener Import',
    scriptHtml,
    fountainText,
    sourceApp: 'Scrivener',
    sceneCount: Math.max(1, scenes),
    wordCount: words,
  };
}

/**
 * Parses generic screenplay HTML export (from Celtx, Fade In, etc.)
 */
function parseScreenplayHtml(htmlString: string, fileName: string): ImportedScreenplayResult {
  const lines: string[] = [];
  const validHtmlPieces: string[] = [];

  // Match tags like <p>, <div>, <h1>-<h6>
  const tagRegex = /<(p|div|h[1-6])[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = tagRegex.exec(htmlString)) !== null) {
    // Strip HTML inner tags
    const rawText = match[2].replace(/<[^>]*>/g, '').trim();
    if (!rawText) continue;

    const upper = rawText.toUpperCase();
    if (/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(upper)) {
      lines.push(`\n${upper}\n`);
      validHtmlPieces.push(`<div class="script-scene-heading">${upper}</div>`);
    } else if (upper === rawText && rawText.length < 35 && !rawText.includes('.')) {
      lines.push(`\n${upper}`);
      validHtmlPieces.push(`<div class="script-character">${upper}</div>`);
    } else if (rawText.startsWith('(') && rawText.endsWith(')')) {
      lines.push(rawText);
      validHtmlPieces.push(`<div class="script-parenthetical">${rawText}</div>`);
    } else {
      lines.push(rawText);
      validHtmlPieces.push(`<div class="script-action">${rawText}</div>`);
    }
  }

  const fountainText = lines.join('\n').trim() || `INT. SCENE 1 - DAY\n\nAction imported from ${fileName}.`;
  const scriptHtml = validHtmlPieces.length > 0 ? validHtmlPieces.join('') : fountainToHtml(fountainText);
  const scenes = (fountainText.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/gim) || []).length;
  const words = fountainText.trim().split(/\s+/).filter(Boolean).length;

  return {
    title: fileName.replace(/\.[^/.]+$/, ''),
    scriptHtml,
    fountainText,
    sourceApp: 'HTML Screenplay',
    sceneCount: Math.max(1, scenes),
    wordCount: words,
  };
}

/**
 * Universal Screenplay File Importer
 */
export async function importScreenplayFile(file: File): Promise<ImportedScreenplayResult> {
  const name = file.name.toLowerCase();

  // 1. Final Draft (.fdx)
  if (name.endsWith('.fdx')) {
    const xml = await file.text();
    const { blocks, metadata } = parseFdx(xml);
    const scriptHtml = blocksToHtml(blocks);

    const fountainLines: string[] = [];
    for (const b of blocks) {
      if (b.type === 'sceneHeading') fountainLines.push(`\n${b.text}\n`);
      else if (b.type === 'character') fountainLines.push(`\n${b.text}`);
      else if (b.type === 'parenthetical') fountainLines.push(b.text);
      else if (b.type === 'dialogue') fountainLines.push(`${b.text}\n`);
      else if (b.type === 'transition') fountainLines.push(`\n> ${b.text}\n`);
      else fountainLines.push(`\n${b.text}\n`);
    }
    const fountainText = fountainLines.join('\n').trim();
    const scenes = blocks.filter((b) => b.type === 'sceneHeading').length;
    const words = blocks.reduce((acc, b) => acc + (b.text?.trim().split(/\s+/).filter(Boolean).length || 0), 0);

    return {
      title: metadata.title || file.name.replace(/\.fdx$/i, ''),
      author: metadata.authors?.[0] || 'Unknown Author',
      scriptHtml,
      fountainText,
      sourceApp: 'Final Draft',
      sceneCount: Math.max(1, scenes),
      wordCount: words,
    };
  }

  // 2. Scrivener (.scrivx, .scriv)
  if (name.endsWith('.scrivx') || name.endsWith('.scriv')) {
    const xml = await file.text();
    return parseScrivenerXml(xml, file.name);
  }

  // 3. HTML Screenplay (.html, .htm)
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const html = await file.text();
    return parseScreenplayHtml(html, file.name);
  }

  // 4. OpenScript JSON (.json, .openscript)
  if (name.endsWith('.json') || name.endsWith('.openscript')) {
    const jsonStr = await file.text();
    try {
      const parsed = JSON.parse(jsonStr);
      if (parsed.content && Array.isArray(parsed.content)) {
        const scriptHtml = blocksToHtml(parsed.content);
        const blocks = parsed.content;
        const scenes = blocks.filter((b: any) => b.type === 'sceneHeading').length;
        const fountainLines: string[] = [];
        for (const b of blocks) {
          if (b.type === 'sceneHeading') fountainLines.push(`\n${b.text}\n`);
          else if (b.type === 'character') fountainLines.push(`\n${b.text}`);
          else if (b.type === 'parenthetical') fountainLines.push(b.text);
          else if (b.type === 'dialogue') fountainLines.push(`${b.text}\n`);
          else if (b.type === 'transition') fountainLines.push(`\n> ${b.text}\n`);
          else fountainLines.push(`\n${b.text}\n`);
        }
        return {
          title: parsed.metadata?.title || file.name.replace(/\.[^/.]+$/, ''),
          author: parsed.metadata?.authors?.[0] || 'Unknown Author',
          scriptHtml,
          fountainText: fountainLines.join('\n').trim(),
          sourceApp: 'OpenScript JSON',
          sceneCount: Math.max(1, scenes),
          wordCount: parsed.content.reduce((acc: number, b: any) => acc + (b.text?.split(/\s+/).length || 0), 0),
          fullMetadata: parsed.metadata,
          sceneTakes: parsed.sceneTakes,
          notes: parsed.notes,
        };
      }
    } catch {}
  }

  // 5. Fountain, Highland, WriterDuet, Plain Text (.fountain, .spmd, .txt, .text)
  const rawText = await file.text();
  const { title, author, body } = extractFountainMetadata(rawText);
  const scriptHtml = fountainToHtml(body);
  const scenes = (body.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/gim) || []).length;
  const words = body.trim().split(/\s+/).filter(Boolean).length;

  return {
    title: title || file.name.replace(/\.[^/.]+$/, ''),
    author: author || 'Unknown Author',
    scriptHtml,
    fountainText: body,
    sourceApp: name.endsWith('.fountain') || name.endsWith('.spmd') ? 'Fountain / Highland' : 'Plain Screenplay Text',
    sceneCount: Math.max(1, scenes),
    wordCount: words,
  };
}
