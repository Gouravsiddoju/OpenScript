import { ScreenplayBlock, createScreenplayBlock, RevisionColor, SceneTake, ScriptNote } from '@openscript/screenplay-schema';
import { serializeFdx } from '@openscript/fdx';
import { jsPDF } from 'jspdf';
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
 * Industry-standard XML format for production, casting, and scheduling.
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


export interface PdfExportOptions {
  blocks: ScreenplayBlock[];
  metadata: Partial<TitlePageMetadata>;
  watermarkText?: string;
  showWatermark?: boolean;
  selectedActId?: string | null;
  sceneFolderMap?: Record<number, string>;
}

/**
 * 5. Professional Industry-Standard Screenplay PDF Document Generator
 * Generates an authentic US Letter screenplay PDF with Courier font, 1.5" left margin,
 * 1.0" top/bottom/right margins, page numbering at 0.5" top margin, widow/orphan protection,
 * and classic title page presentation.
 */
export function generateScreenplayPdfDoc(options: PdfExportOptions): jsPDF {
  const { blocks, metadata, watermarkText, showWatermark, selectedActId, sceneFolderMap } = options;

  // Filter blocks by active Act if selected
  let activeBlocks = blocks;
  if (selectedActId) {
    let currentScene = 0;
    activeBlocks = blocks.filter((b) => {
      if (b.type === 'sceneHeading') currentScene++;
      const actId = (sceneFolderMap && sceneFolderMap[currentScene]) || (currentScene === 1 ? 'act-1' : currentScene === 2 ? 'act-2' : 'unassigned');
      return actId === selectedActId;
    });
  }
  const doc = new jsPDF({
    unit: 'pt',
    format: 'letter',
    orientation: 'portrait',
  });

  const PAGE_WIDTH = 612; // 8.5 inches at 72 pt/in
  const PAGE_HEIGHT = 792; // 11.0 inches at 72 pt/in
  const LEFT_MARGIN = 108; // 1.5 inches left margin
  const RIGHT_MARGIN = 72; // 1.0 inch right margin
  const CONTENT_RIGHT = PAGE_WIDTH - RIGHT_MARGIN; // 540 pt
  const CONTENT_WIDTH = CONTENT_RIGHT - LEFT_MARGIN; // 432 pt (6.0 inches)
  const TOP_MARGIN = 72; // 1.0 inch top margin
  const BOTTOM_MARGIN = 720; // 10.0 inches (1.0 inch bottom margin)
  const LINE_HEIGHT = 14.4; // 12pt Courier with standard 1.2 line pitch (6 lines per inch)

  let currentY = TOP_MARGIN;
  let pageNumber = 1;

  const drawWatermark = () => {
    const wmText = watermarkText || metadata.watermarkText || (metadata.showWatermark ? 'CONFIDENTIAL' : '');
    if ((showWatermark || metadata.showWatermark) && wmText) {
      doc.saveGraphicsState();
      doc.setFont('courier', 'bold');
      doc.setFontSize(38);
      doc.setTextColor(225, 225, 230);
      doc.text(wmText, PAGE_WIDTH / 2, PAGE_HEIGHT / 2, {
        align: 'center',
        angle: 45,
      });
      doc.restoreGraphicsState();
    }
  };

  const drawPageHeader = (num: number) => {
    if (num > 1) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      doc.text(`${num}.`, CONTENT_RIGHT, 36, { align: 'right' });
    }
  };

  const addNewPage = () => {
    doc.addPage();
    pageNumber++;
    currentY = TOP_MARGIN;
    drawWatermark();
    drawPageHeader(pageNumber);
  };

  // 1. Render Screenplay Title Page
  if (metadata.showTitlePage !== false) {
    drawWatermark();

    const title = metadata.title || 'UNTITLED SCREENPLAY';
    const credit = metadata.credit || 'written by';
    const author = metadata.author || 'Author';

    // Title centered
    doc.setFont('courier', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(0, 0, 0);
    doc.text(title.toUpperCase(), PAGE_WIDTH / 2, 280, { align: 'center' });

    // Underline beneath title
    const titleWidth = doc.getTextWidth(title.toUpperCase());
    doc.setLineWidth(1.2);
    doc.line((PAGE_WIDTH - titleWidth) / 2, 286, (PAGE_WIDTH + titleWidth) / 2, 286);

    // Credit & Author
    doc.setFont('courier', 'normal');
    doc.setFontSize(12);
    doc.text(credit, PAGE_WIDTH / 2, 330, { align: 'center' });

    doc.setFont('courier', 'bold');
    doc.setFontSize(13);
    doc.text(author, PAGE_WIDTH / 2, 360, { align: 'center' });

    if (metadata.basedOn) {
      doc.setFont('courier', 'normal');
      doc.setFontSize(10);
      doc.text(`Based on: ${metadata.basedOn}`, PAGE_WIDTH / 2, 395, { align: 'center' });
    }

    // Title Page Bottom metadata
    // Left: Contact & Copyright
    const contactLines = (metadata.contact || 'SSN Pictures\ncontact@ssnpictures.in').split('\n');
    doc.setFont('courier', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(50, 50, 50);
    let contactY = 660;
    for (const line of contactLines) {
      doc.text(line.trim(), LEFT_MARGIN, contactY);
      contactY += 13;
    }
    if (metadata.copyright) {
      doc.text(metadata.copyright, LEFT_MARGIN, contactY + 4);
    }

    // Right: Draft Color / Draft Date
    const draftDate = metadata.draftDate || new Date().toISOString().split('T')[0];
    const draftLabel = metadata.draftLabel || 'White Production Draft';
    doc.setFont('courier', 'bold');
    doc.text(draftLabel, CONTENT_RIGHT, 660, { align: 'right' });
    doc.setFont('courier', 'normal');
    doc.text(draftDate, CONTENT_RIGHT, 674, { align: 'right' });

    // Advance to Page 1 of Screenplay text
    doc.addPage();
    pageNumber = 1;
  }

  drawWatermark();
  // Script Page 1 has no page number header by industry convention

  // 2. Render Screenplay Blocks
  let currentSceneCounter = 0;
  let prevSceneActId: string | null = null;

  for (let i = 0; i < activeBlocks.length; i++) {
    const block = activeBlocks[i];
    const text = block.text?.trim();
    if (!text) continue;

    switch (block.type) {
      case 'sceneHeading': {
        currentSceneCounter++;
        const actId = (sceneFolderMap && sceneFolderMap[currentSceneCounter]) || (currentSceneCounter === 1 ? 'act-1' : currentSceneCounter === 2 ? 'act-2' : 'unassigned');
        const isActBreak = !selectedActId && prevSceneActId !== null && actId !== prevSceneActId;
        prevSceneActId = actId;

        // Force Act boundaries to start on a new physical page
        if (isActBreak && currentY > TOP_MARGIN) {
          addNewPage();
        } else if (currentY + LINE_HEIGHT * 3 > BOTTOM_MARGIN) {
          addNewPage();
        } else if (currentY > TOP_MARGIN) {
          currentY += LINE_HEIGHT * 2;
        }

        doc.setFont('courier', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);

        const headingText = text.toUpperCase();
        // Scene numbers in margin gutters
        if (block.sceneNumber) {
          doc.setFont('courier', 'normal');
          doc.setFontSize(11);
          doc.text(block.sceneNumber, 72, currentY, { align: 'right' });
          doc.text(block.sceneNumber, CONTENT_RIGHT + 16, currentY, { align: 'left' });
          doc.setFont('courier', 'bold');
          doc.setFontSize(12);
        }

        const lines = doc.splitTextToSize(headingText, CONTENT_WIDTH);
        for (const line of lines) {
          if (currentY + LINE_HEIGHT > BOTTOM_MARGIN) addNewPage();
          doc.text(line, LEFT_MARGIN, currentY);
          currentY += LINE_HEIGHT;
        }
        currentY += LINE_HEIGHT * 0.4;
        break;
      }

      case 'action': {
        if (currentY > TOP_MARGIN) {
          currentY += LINE_HEIGHT;
        }
        doc.setFont('courier', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);

        const lines = doc.splitTextToSize(text, CONTENT_WIDTH);
        for (const line of lines) {
          if (currentY + LINE_HEIGHT > BOTTOM_MARGIN) addNewPage();
          doc.text(line, LEFT_MARGIN, currentY);
          currentY += LINE_HEIGHT;
        }
        break;
      }

      case 'character': {
        // Widow/orphan protection: character cue + dialogue needs at least 2 lines
        if (currentY + LINE_HEIGHT * 2 > BOTTOM_MARGIN) {
          addNewPage();
        } else if (currentY > TOP_MARGIN) {
          currentY += LINE_HEIGHT;
        }

        doc.setFont('courier', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);

        const charX = 266.4; // 3.7 inches from left edge
        doc.text(text.toUpperCase(), charX, currentY);
        currentY += LINE_HEIGHT;
        break;
      }

      case 'parenthetical': {
        doc.setFont('courier', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);

        const pX = 223.2; // 3.1 inches from left
        const pWidth = 216; // 3.0 inches wide (~30 chars)
        const formatted = text.startsWith('(') && text.endsWith(')') ? text : `(${text})`;
        const lines = doc.splitTextToSize(formatted, pWidth);
        for (const line of lines) {
          if (currentY + LINE_HEIGHT > BOTTOM_MARGIN) addNewPage();
          doc.text(line, pX, currentY);
          currentY += LINE_HEIGHT;
        }
        break;
      }

      case 'dialogue': {
        doc.setFont('courier', 'normal');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);

        const dX = 180; // 2.5 inches from left
        const dWidth = 252; // 3.5 inches wide (~35 characters)
        const lines = doc.splitTextToSize(text, dWidth);
        for (const line of lines) {
          if (currentY + LINE_HEIGHT > BOTTOM_MARGIN) addNewPage();
          doc.text(line, dX, currentY);
          currentY += LINE_HEIGHT;
        }
        break;
      }

      case 'transition': {
        if (currentY > TOP_MARGIN) {
          currentY += LINE_HEIGHT;
        }
        doc.setFont('courier', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(0, 0, 0);

        const tText = text.toUpperCase();
        doc.text(tText, CONTENT_RIGHT, currentY, { align: 'right' });
        currentY += LINE_HEIGHT;
        break;
      }
    }
  }

  return doc;
}

/**
 * Triggers instant browser download of the formatted Screenplay PDF file
 */
export function exportScreenplayPdf(options: PdfExportOptions): void {
  const doc = generateScreenplayPdfDoc(options);
  const title = options.metadata?.title || 'Screenplay';
  const filename = `${sanitizeFilename(title)}.pdf`;
  doc.save(filename);
}
