import { ScreenplayBlock, createScreenplayBlock, RevisionColor, SceneTake, ScriptNote } from '@openscript/screenplay-schema';
import { serializeFdx } from '@openscript/fdx';
import { TitlePageMetadata } from '../components/TitlePageModal';

/**
 * Converts Screenplay HTML into structured ScreenplayBlock array.
 * Works seamlessly in both browser DOM environment and Node test runners.
 */
export function htmlToBlocks(html: string): ScreenplayBlock[] {
  const blocks: ScreenplayBlock[] = [];
  if (!html || !html.trim()) return blocks;

  // Use DOMParser when available in browser, fallback to regex in tests
  if (typeof DOMParser !== 'undefined') {
    const parser = new DOMParser();
    const doc = parser.parseFromString(html, 'text/html');
    const children = Array.from(doc.body.children);

    for (const el of children) {
      const text = el.textContent?.trim() || '';
      if (!text) continue;

      let type: ScreenplayBlock['type'] = 'action';
      if (el.classList.contains('script-scene-heading')) type = 'sceneHeading';
      else if (el.classList.contains('script-character')) type = 'character';
      else if (el.classList.contains('script-parenthetical')) type = 'parenthetical';
      else if (el.classList.contains('script-dialogue')) type = 'dialogue';
      else if (el.classList.contains('script-transition')) type = 'transition';
      else if (el.classList.contains('script-action')) type = 'action';

      const sceneNumber = el.getAttribute('data-scene-number') || undefined;
      const revisionMark = el.getAttribute('data-revision-mark') === 'true' || el.classList.contains('revision-marker');
      const revisionColor = (el.getAttribute('data-revision-color') as RevisionColor) || undefined;
      const rawId = el.getAttribute('id');
      const isUuid = rawId && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(rawId);

      blocks.push(
        createScreenplayBlock({
          id: isUuid ? rawId : crypto.randomUUID(),
          type,
          text,
          sceneNumber,
          revisionMark,
          revisionColor,
        })
      );
    }

    return blocks;
  }

  // Regex fallback for non-DOM environments
  const tagRegex = /<div\s+class="([^"]*)"([^>]*)>([\s\S]*?)<\/div>/gi;
  let match;
  while ((match = tagRegex.exec(html)) !== null) {
    const classNames = match[1];
    const attrs = match[2];
    const rawContent = match[3];
    const text = rawContent.replace(/<[^>]+>/g, '').trim();
    if (!text) continue;

    let type: ScreenplayBlock['type'] = 'action';
    if (classNames.includes('script-scene-heading')) type = 'sceneHeading';
    else if (classNames.includes('script-character')) type = 'character';
    else if (classNames.includes('script-parenthetical')) type = 'parenthetical';
    else if (classNames.includes('script-dialogue')) type = 'dialogue';
    else if (classNames.includes('script-transition')) type = 'transition';

    const sceneNumMatch = attrs.match(/data-scene-number="([^"]*)"/i);
    const revMarkMatch = attrs.match(/data-revision-mark="true"/i) || classNames.includes('revision-marker');
    const revColorMatch = attrs.match(/data-revision-color="([^"]*)"/i);

    blocks.push(
      createScreenplayBlock({
        id: crypto.randomUUID(),
        type,
        text,
        sceneNumber: sceneNumMatch ? sceneNumMatch[1] : undefined,
        revisionMark: !!revMarkMatch,
        revisionColor: revColorMatch ? (revColorMatch[1] as RevisionColor) : undefined,
      })
    );
  }

  return blocks;
}

/**
 * Formats screenplay blocks into standard Fountain text with title page metadata
 */
export function blocksToFountainText(
  blocks: ScreenplayBlock[],
  metadata?: Partial<TitlePageMetadata>
): string {
  const parts: string[] = [];

  // Title page metadata block
  if (metadata?.title) {
    parts.push(`Title: ${metadata.title}`);
    if (metadata.credit) parts.push(`Credit: ${metadata.credit}`);
    if (metadata.author) parts.push(`Author: ${metadata.author}`);
    if (metadata.basedOn) parts.push(`Source: ${metadata.basedOn}`);
    if (metadata.draftLabel) parts.push(`Draft date: ${metadata.draftLabel}`);
    if (metadata.contact) parts.push(`Contact: ${metadata.contact.replace(/\n+/g, ' ')}`);
    if (metadata.copyright) parts.push(`Copyright: ${metadata.copyright}`);
    parts.push(''); // blank line separating metadata header
  }

  for (const block of blocks) {
    const text = block.text.trim();
    if (!text) continue;

    switch (block.type) {
      case 'sceneHeading': {
        const sceneNum = block.sceneNumber ? ` #${block.sceneNumber}#` : '';
        parts.push(`\n${text.toUpperCase()}${sceneNum}\n`);
        break;
      }
      case 'character':
        parts.push(`\n${text.toUpperCase()}`);
        break;
      case 'parenthetical':
        parts.push(text.startsWith('(') && text.endsWith(')') ? text : `(${text})`);
        break;
      case 'dialogue':
        parts.push(`${text}\n`);
        break;
      case 'transition':
        parts.push(text.endsWith('TO:') ? `\n${text.toUpperCase()}\n` : `\n> ${text.toUpperCase()}\n`);
        break;
      case 'action':
      default:
        parts.push(`\n${text}\n`);
        break;
    }
  }

  return parts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Safe download trigger helper
 */
function triggerBrowserDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: `${mimeType};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function sanitizeFilename(title: string, defaultName = 'Screenplay'): string {
  return title ? title.replace(/[^\w-]+/g, '_').replace(/^_+|_+$/g, '') : defaultName;
}

export interface ExportScreenplayOptions {
  blocks: ScreenplayBlock[];
  metadata: TitlePageMetadata;
  sceneTakes?: SceneTake[];
  notes?: ScriptNote[];
  revisionNumber?: number;
  activeRevisionColor?: RevisionColor;
}

/**
 * 1. OpenScript Native Project Export (.openscript / .json)
 * Full studio snapshot containing screenplay, takes, notes, and metadata.
 * 100% loss-free and reloadable into OpenScript.
 */
export function exportOpenScriptProject(options: ExportScreenplayOptions, extension: 'openscript' | 'json' = 'openscript'): void {
  const { blocks, metadata, sceneTakes = [], notes = [], revisionNumber = 1, activeRevisionColor = 'white' } = options;

  const projectSnapshot = {
    schemaVersion: 2,
    generator: 'OpenScript Studio Pro',
    exportedAt: new Date().toISOString(),
    revisionNumber,
    activeRevisionColor,
    metadata: {
      title: metadata.title || 'Untitled Screenplay',
      credit: metadata.credit || 'written by',
      authors: [metadata.author || 'Author Name'],
      draftLabel: metadata.draftLabel || 'First Draft',
      draftDate: metadata.draftDate || new Date().toISOString().split('T')[0],
      draftColor: activeRevisionColor,
      contact: metadata.contact || '',
      basedOn: metadata.basedOn || '',
      copyright: metadata.copyright || '',
      watermark: metadata.watermarkText || '',
      showTitlePage: metadata.showTitlePage ?? true,
      showWatermark: metadata.showWatermark ?? false,
    },
    content: blocks,
    sceneTakes,
    notes,
  };

  const filename = `${sanitizeFilename(metadata.title)}.${extension}`;
  triggerBrowserDownload(JSON.stringify(projectSnapshot, null, 2), filename, 'application/json');
}

/**
 * 2. Final Draft 12 FDX Export (.fdx)
 * Industry-standard XML format for Hollywood production, casting, and scheduling.
 */
export function exportFinalDraftFdx(options: Pick<ExportScreenplayOptions, 'blocks' | 'metadata'>): void {
  const { blocks, metadata } = options;
  const fdxXml = serializeFdx({
    content: blocks,
    metadata: {
      title: metadata.title || 'Untitled Screenplay',
      credit: metadata.credit || 'written by',
      authors: [metadata.author || 'Author Name'],
    },
  });

  const filename = `${sanitizeFilename(metadata.title)}.fdx`;
  triggerBrowserDownload(fdxXml, filename, 'application/xml');
}

/**
 * 3. Standard Fountain Screenplay Export (.fountain)
 * Universal plaintext format with Title Page header. Compatible with Highland, WriterDuet, and OpenScript.
 */
export function exportFountainFile(options: Pick<ExportScreenplayOptions, 'blocks' | 'metadata'>): void {
  const { blocks, metadata } = options;
  const fountainContent = blocksToFountainText(blocks, metadata);
  const filename = `${sanitizeFilename(metadata.title)}.fountain`;
  triggerBrowserDownload(fountainContent, filename, 'text/plain');
}

/**
 * 4. Standalone Screenplay HTML (.html)
 * Formatted HTML screenplay with Courier font, print styles, and metadata.
 */
export function exportHtmlFile(options: Pick<ExportScreenplayOptions, 'blocks' | 'metadata'>): void {
  const { blocks, metadata } = options;
  const title = metadata.title || 'Untitled Screenplay';
  const author = metadata.author || 'Author';

  let bodyHtml = '';
  for (const block of blocks) {
    const revMark = block.revisionMark ? ' *' : '';
    const sceneAttr = block.sceneNumber ? ` data-scene-number="${block.sceneNumber}"` : '';

    switch (block.type) {
      case 'sceneHeading':
        bodyHtml += `  <div class="scene-heading"${sceneAttr}>${block.text}${revMark}</div>\n`;
        break;
      case 'character':
        bodyHtml += `  <div class="character">${block.text}${revMark}</div>\n`;
        break;
      case 'parenthetical':
        bodyHtml += `  <div class="parenthetical">${block.text}</div>\n`;
        break;
      case 'dialogue':
        bodyHtml += `  <div class="dialogue">${block.text}${revMark}</div>\n`;
        break;
      case 'transition':
        bodyHtml += `  <div class="transition">${block.text}</div>\n`;
        break;
      case 'action':
      default:
        bodyHtml += `  <div class="action">${block.text}${revMark}</div>\n`;
        break;
    }
  }

  const fullHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>${title} - Screenplay</title>
  <style>
    body {
      font-family: 'Courier Prime', Courier, monospace;
      font-size: 12pt;
      line-height: 1.0;
      color: #000;
      background: #f3f4f6;
      margin: 0;
      padding: 40px 20px;
    }
    .screenplay-container {
      max-width: 8.5in;
      margin: 0 auto;
      background: #fff;
      padding: 1.0in 1.0in 1.0in 1.5in;
      box-shadow: 0 4px 20px rgba(0,0,0,0.1);
    }
    .title-page {
      min-height: 9.0in;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      text-align: center;
      page-break-after: always;
      break-after: page;
      padding-bottom: 2in;
    }
    .title { font-size: 18pt; font-weight: bold; text-decoration: underline; text-transform: uppercase; margin-top: 3.5in; }
    .credit { font-size: 12pt; margin: 16pt 0; font-style: italic; }
    .author { font-size: 14pt; font-weight: bold; }
    .scene-heading { font-weight: bold; text-transform: uppercase; margin-top: 24pt; margin-bottom: 12pt; break-after: avoid; }
    .action { margin-bottom: 12pt; }
    .character { text-transform: uppercase; margin-left: 2.0in; margin-top: 12pt; break-after: avoid; }
    .parenthetical { margin-left: 1.5in; max-width: 3.0in; }
    .dialogue { margin-left: 1.0in; margin-right: 1.5in; margin-bottom: 12pt; }
    .transition { text-align: right; text-transform: uppercase; margin-top: 12pt; margin-bottom: 12pt; }
    @media print {
      body { background: #fff; padding: 0; }
      .screenplay-container { box-shadow: none; padding: 0.5in 0.5in 0.5in 1.0in; }
    }
  </style>
</head>
<body>
  <div class="screenplay-container">
    ${metadata.showTitlePage ? `
    <div class="title-page">
      <div>
        <div class="title">${title}</div>
        <div class="credit">${metadata.credit || 'written by'}</div>
        <div class="author">${author}</div>
      </div>
      <div style="text-align: left; font-size: 10pt; color: #555;">
        ${metadata.contact || ''}
      </div>
    </div>` : ''}
${bodyHtml}
  </div>
</body>
</html>`;

  const filename = `${sanitizeFilename(metadata.title)}.html`;
  triggerBrowserDownload(fullHtml, filename, 'text/html');
}
