import './pdfPolyfill';
import { parseFdx } from '@openscript/fdx';
import { createScreenplayBlock, isNonCharacterCue, isSceneHeadingCandidate, isDateOrDraftStamp } from '@openscript/screenplay-schema';
import { fountainToHtml, blocksToHtml, parseFountain } from '@openscript/fountain';
import JSZip from 'jszip';
import * as pdfjsLib from 'pdfjs-dist';

// Configure PDF.js worker for Vite / browser environments
if (typeof window !== 'undefined' && (pdfjsLib as any).GlobalWorkerOptions) {
  try {
    (pdfjsLib as any).GlobalWorkerOptions.workerSrc = new URL(
      'pdfjs-dist/build/pdf.worker.min.mjs',
      import.meta.url
    ).toString();
  } catch {
    // Falls back to main-thread processing if URL resolution fails
  }
}

export interface ImportedScreenplayResult {
  title?: string;
  author?: string;
  scriptHtml: string;
  fountainText: string;
  sourceApp:
    | 'Final Draft'
    | 'Scrivener'
    | 'Fountain / Highland'
    | 'Plain Screenplay Text'
    | 'HTML Screenplay'
    | 'OpenScript JSON'
    | 'Rich Text Format (RTF)'
    | 'PDF Screenplay';
  sceneCount: number;
  wordCount: number;
  warnings?: string[];
  fullMetadata?: Record<string, any>;
  sceneTakes?: any[];
  notes?: any[];
}

export interface FileEntry {
  path: string;
  file: File;
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
 * Detects whether a snippet of text is Scrivener template instruction boilerplate
 * (such as the default novel/screenplay instruction manual sheets), preventing it
 * from being imported into the screenplay canvas.
 */
export function isScrivenerTemplateBoilerplate(text: string): boolean {
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('sketch sheets have been provided') ||
    lower.includes('documents > change icon') ||
    lower.includes('template sheets') ||
    lower.includes('information about locations can be stored in the "places"') ||
    lower.includes('information about characters can be stored') ||
    lower.includes('sample document <$scr') ||
    lower.includes('see the <$sample script>') ||
    lower.includes('folder, and information about locations') ||
    lower.includes('a note on paper and/or fonts') ||
    lower.includes('scrivener uses the "courier prime" font') ||
    (lower.includes('screenplay format') && (lower.includes('binder') || lower.includes('scrivener') || lower.includes('template')))
  );
}

/**
 * Fast & Robust RTF (Rich Text Format) & Scrivener Markup to Clean Screenplay Fountain Converter.
 * Safely strips RTF control codes, unpacks font/color tables, handles unicode/hex escapes,
 * and translates Scrivener screenplay element tags into standard industry format.
 */
export function rtfToText(rtf: string): string {
  if (!rtf) return '';

  // 1. Strip nested groups with brace counting (fonttbl, colortbl, stylesheet, info, generator, *)
  function stripGroup(str: string, prefix: string): string {
    let idx = str.indexOf('{\\' + prefix);
    while (idx !== -1) {
      let depth = 1;
      let i = idx + prefix.length + 2;
      while (i < str.length && depth > 0) {
        if (str[i] === '{' && str[i - 1] !== '\\') depth++;
        else if (str[i] === '}' && str[i - 1] !== '\\') depth--;
        i++;
      }
      str = str.slice(0, idx) + str.slice(i);
      idx = str.indexOf('{\\' + prefix);
    }
    return str;
  }

  let text = rtf;
  ['fonttbl', 'colortbl', 'stylesheet', 'info', 'generator', '*'].forEach((g) => {
    text = stripGroup(text, g);
  });

  // 2. Convert paragraph breaks and line breaks (ensure \par doesn't eat \pard)
  text = text.replace(/\\par(?![a-zA-Z])(?:\r\n|\n|\s)?/gi, '\n');
  text = text.replace(/\\line(?![a-zA-Z])(?:\r\n|\n|\s)?/gi, '\n');
  text = text.replace(/\\tab(?![a-zA-Z])(?:\r\n|\n|\s)?/gi, '    ');

  // 3. Convert hex character escapes \'hh
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // 4. Convert unicode escapes \uN
  text = text.replace(/\\u(-?\d+)\??/g, (_, code) => {
    const num = parseInt(code, 10);
    return String.fromCharCode(num < 0 ? num + 65536 : num);
  });

  // 5. Remove known RTF control words using length-sorted list (so e.g. \ulnone is matched before \ul)
  const rtfWords = [
    'rtf', 'ansi', 'mac', 'pc', 'pca', 'ansicpg', 'deff', 'deflang', 'fonttbl', 'colortbl', 'stylesheet', 'info',
    'generator', 'pard', 'plain', 'par', 'line', 'tab', 'b', 'i', 'ulnone', 'ul', 'v', 'strike', 'outl', 'shad',
    'caps', 'scaps', 'fs', 'f', 'cf', 'cb', 'cs', 'ds', 's', 'qc', 'qr', 'ql', 'qj', 'sb', 'sa', 'sl', 'slmult',
    'keepn', 'keep', 'widowctrl', 'fldinst', 'fldrslt', 'field', 'partightenfactor', 'cocoartf', 'cocoasubrtf',
    'expandedcolortbl', 'cssrgb', 'viewkind', 'paperw', 'paperh', 'margl', 'margr', 'margt', 'margb', 'additive'
  ].sort((a, b) => b.length - a.length);

  const rtfRegex = new RegExp(`\\\\(?:${rtfWords.join('|')})-?\\d*(?:[ \\t]|(?=[^a-zA-Z]))?`, 'gi');
  text = text.replace(rtfRegex, '');

  // Fallback for any other remaining control words: \xyz123
  text = text.replace(/\\(?:[a-zA-Z]{1,32})-?\d*(?:[ \t]|(?=[^a-zA-Z]))?/g, '');

  // 6. Remove leftover font definitions ending in semicolon (e.g. CourierPrime; or Courier;)
  text = text.replace(/^[a-zA-Z0-9\s_-]+;\s*/gm, '');
  text = text.replace(/;\s*[a-zA-Z0-9\s_-]+;\s*/g, '\n');

  // 7. Remove Scrivener tags like <NAME>, <Scene Heading>, etc.
  text = text.replace(/<NAME>\s*/gi, '');
  text = text.replace(/<\/?(?:Scene\s*Heading|Heading|General|Action|Dialogue|Text|Body)[^>]*>/gi, '');

  // 8. Transform Scrivener character & parenthetical tags into standard Fountain
  text = text.replace(/<Character>([^<]+)<\/Character>/gi, '\n\n$1\n');
  text = text.replace(/<speaker>([^<]+)<\/speaker>/gi, '\n\n$1\n');
  text = text.replace(/<Parenthetical>([^<]+)<\/Parenthetical>/gi, '\n($1)\n');

  // Handle specific Scrivener markup like <part> (parenthetical cue)
  text = text.replace(/<part>\s*/gi, '\n(');
  text = text.replace(/<\/part>\s*/gi, ')\n');

  // Any remaining <tag> where tag is words (e.g. <assistant>, <detective>): convert to Character Cue!
  text = text.replace(/<([a-zA-Z0-9_\s'-]+)>/g, (_, tag) => {
    const cleanTag = tag.trim();
    if (/^(c\d+|pt|\$scr)/i.test(cleanTag)) return '';
    return `\n\n${cleanTag.toUpperCase()}\n`;
  });

  // Ensure closed parentheticals
  text = text.replace(/\n\(([^\n\)]+)(?:\n|$)/g, '\n($1)\n');

  // 9. Strip Scrivener measurement remnants like 00pt, 12pt
  text = text.replace(/\b\d+pt\b/gi, '');
  text = text.replace(/\d+pt/gi, '');

  // 10. Strip any leftover XML/Scrivener tags
  text = text.replace(/<\/?[a-zA-Z0-9_\$#:-]+[^>]*>/g, '');

  // 11. Unescape escaped characters \{, \}, \\
  text = text.replace(/\\([{}\\])/g, '$1');
  text = text.replace(/[{}]/g, '');
  text = text.replace(/\\/g, '');

  // 12. Ensure Character Cues and Parentheticals are directly followed by Dialogue (no empty line separation)
  text = text.replace(/^([A-Z0-9\s_\-']+(\s*\(.*\))?)\n\n+(?=[a-zA-Z(])/gm, '$1\n');
  text = text.replace(/\(([^)]+)\)\n\n+(?=[a-zA-Z])/gm, '($1)\n');

  // 13. Normalize newlines
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Isolates the Draft / Screenplay folder subtree from Scrivener project.scrivx XML.
 * Scrivener stores non-manuscript items (Template Sheets, Research, Characters, Places, Trash)
 * outside the DraftFolder. We strictly extract only the draft manuscript items.
 */
function extractDraftFolderXml(xml: string): string | null {
  // 1. Look for BinderItem with Type="DraftFolder" or Type="Draft"
  const draftTypeMatch = /<BinderItem\s+[^>]*Type=["'](?:DraftFolder|Draft)["'][^>]*>/i.exec(xml);
  let startIndex = -1;
  if (draftTypeMatch) {
    startIndex = draftTypeMatch.index;
  } else {
    // 2. Look for BinderItem whose immediate Title is Screenplay, Draft, or Manuscript
    const candidateRegex = /<BinderItem\s+[^>]*>[\s\r\n]*<Title>(?:Screenplay|Draft|Manuscript)<\/Title>/gi;
    const match = candidateRegex.exec(xml);
    if (match) {
      startIndex = match.index;
    }
  }

  if (startIndex === -1) return null;

  // Track depth to find the matching </BinderItem> for the draft container
  let depth = 0;
  const tagRegex = /<(\/)?BinderItem\b[^>]*>/gi;
  tagRegex.lastIndex = startIndex;
  let tagMatch: RegExpExecArray | null;
  while ((tagMatch = tagRegex.exec(xml)) !== null) {
    const isClosing = tagMatch[1] === '/';
    const isSelfClosing = tagMatch[0].endsWith('/>');
    if (!isClosing) {
      if (!isSelfClosing) depth++;
    } else {
      depth--;
      if (depth === 0) {
        return xml.substring(startIndex, tagMatch.index + tagMatch[0].length);
      }
    }
  }
  return null;
}

export function extractScrivenerBinderItems(xmlContent: string): { id: string; title: string; synopsis?: string }[] {
  const items: { id: string; title: string; synopsis?: string }[] = [];

  // 1. Target the DraftFolder exclusively if present
  const targetXml = extractDraftFolderXml(xmlContent) || xmlContent;

  // 2. Parse BinderItems
  const itemTagRegex = /<BinderItem\s+([^>]*?)>([\s\S]*?)(?=<BinderItem|<\/Binder>|$)/gi;
  let match;

  while ((match = itemTagRegex.exec(targetXml)) !== null) {
    const attrs = match[1];
    const inner = match[2];

    const typeMatch = attrs.match(/Type="([^"]*)"/i);
    const idMatch = attrs.match(/(?:UUID|ID|Id)="([^"]*)"/i);
    if (!idMatch) continue;

    const id = idMatch[1].trim();
    const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';

    const titleMatch = inner.match(/<Title[^>]*>(.*?)<\/Title>/i);
    const synopsisMatch = inner.match(/<Synopsis[^>]*>(.*?)<\/Synopsis>/i);

    const title = titleMatch ? titleMatch[1].trim() : '';
    const synopsis = synopsisMatch ? synopsisMatch[1].trim() : undefined;

    // Filter out root containers or non-screenplay folders
    const isRootDraftContainer = /^(SCREENPLAY|MANUSCRIPT|DRAFT)$/i.test(title) && (type === 'draftfolder' || type === 'draft' || type === 'folder');
    if (isRootDraftContainer) continue;

    // Discard any template sheets, research, trash, characters, places
    const isTemplateOrTrash = /^(template sheets|templates?|research|trash|characters|places|notes)$/i.test(title);
    if (isTemplateOrTrash) continue;
    if (isScrivenerTemplateBoilerplate(title)) continue;

    // Only process text items or folders explicitly named as scene headings
    const isHeading = /^(INT|EXT|INT\/EXT|I\/E)[.\s]/i.test(title);
    if (id && (type === 'text' || isHeading)) {
      items.push({ id, title, synopsis });
    }
  }

  return items;
}

/**
 * Parses full Scrivener project entries (from dropped .scriv folder or unzipped .scriv.zip)
 */
export async function parseScrivenerFolderEntries(entries: FileEntry[], projectName?: string): Promise<ImportedScreenplayResult> {
  // 1. Locate .scrivx binder file
  const scrivxEntry = entries.find((e) => e.path.toLowerCase().endsWith('.scrivx'));

  let projectTitle = projectName?.replace(/\.scriv$/i, '').replace(/\.zip$/i, '') || 'Scrivener Project';
  let binderItems: { id: string; title: string; synopsis?: string }[] = [];

  if (scrivxEntry) {
    const xmlContent = await scrivxEntry.file.text();
    const titleMatch = xmlContent.match(/<ProjectTitle[^>]*>(.*?)<\/ProjectTitle>/i) ||
                       xmlContent.match(/<Title[^>]*>(.*?)<\/Title>/i);
    if (titleMatch) {
      projectTitle = titleMatch[1].trim();
    }
    binderItems = extractScrivenerBinderItems(xmlContent);
  }

  // 2. Index all content.rtf / content.txt files in entries
  const contentEntries = entries.filter((e) => {
    const p = e.path.toLowerCase();
    return p.endsWith('content.rtf') || p.endsWith('content.txt') || (p.includes('/docs/') && p.endsWith('.rtf'));
  });

  const fullFountainParts: string[] = [];
  let sceneNum = 1;
  const processedItemIds = new Set<string>();

  // Helper to find file entry matching an ID or UUID
  const findEntryForId = (id: string): FileEntry | undefined => {
    const idLower = id.toLowerCase();
    return contentEntries.find((e) => {
      const pathLower = e.path.toLowerCase();
      // Matches Files/Data/<UUID>/content.rtf or Files/Data/<ID>/content.rtf or Files/Docs/<ID>.rtf
      return (
        pathLower.includes(`/${idLower}/`) ||
        pathLower.includes(`\\${idLower}\\`) ||
        pathLower.endsWith(`/${idLower}.rtf`) ||
        pathLower.endsWith(`\\${idLower}.rtf`) ||
        pathLower.endsWith(`/${idLower}.txt`)
      );
    });
  };

  // 3. Process binder items in order
  for (const item of binderItems) {
    const entry = findEntryForId(item.id);
    let sceneBody = '';

    if (entry) {
      processedItemIds.add(item.id);
      const rawText = await entry.file.text();
      sceneBody = entry.path.toLowerCase().endsWith('.rtf') ? rtfToText(rawText) : rawText.trim();
    }

    // Skip template instruction boilerplate text
    if (isScrivenerTemplateBoilerplate(sceneBody) || isScrivenerTemplateBoilerplate(item.title)) {
      continue;
    }

    if (!item.title && !sceneBody) continue;

    const titleUpper = item.title.toUpperCase().trim();
    const isHeading = /^(INT|EXT|INT\/EXT|I\/E)[.\s]/i.test(titleUpper);
    const isGenericFolder = /^(SCREENPLAY FORMAT|SCREENPLAY|MANUSCRIPT|DRAFT|PROJECT|SCENES|CHAPTERS?|BINDER|RESEARCH|TRASH|TEMPLATE SHEETS)$/i.test(titleUpper);

    // If sceneBody already starts with a scene heading, don't double-add
    const bodyStartsWithHeading = /^(INT|EXT|INT\/EXT|I\/E)[.\s]/i.test(sceneBody.trim());

    if (isHeading) {
      fullFountainParts.push(`\n${titleUpper}\n`);
      sceneNum++;
    } else if (!bodyStartsWithHeading && item.title && !isGenericFolder) {
      fullFountainParts.push(`\nINT. SCENE ${sceneNum} - ${titleUpper} - DAY\n`);
      sceneNum++;
    }

    if (sceneBody) {
      fullFountainParts.push(`${sceneBody}\n`);
    } else if (item.synopsis && !isGenericFolder) {
      fullFountainParts.push(`${item.synopsis}\n`);
    }
  }

  // 4. Fallback: If no binder items matched, or if there are unprocessed content.rtf files
  if (fullFountainParts.length === 0 && contentEntries.length > 0) {
    // Sort content entries by directory path
    contentEntries.sort((a, b) => a.path.localeCompare(b.path, undefined, { numeric: true, sensitivity: 'base' }));

    for (const entry of contentEntries) {
      const rawText = await entry.file.text();
      const text = entry.path.toLowerCase().endsWith('.rtf') ? rtfToText(rawText) : rawText.trim();
      if (!text || isScrivenerTemplateBoilerplate(text)) continue;

      const startsWithHeading = /^(INT|EXT|INT\/EXT|I\/E)[.\s]/i.test(text.trim());
      if (!startsWithHeading) {
        fullFountainParts.push(`\nINT. SCENE ${sceneNum} - DAY\n`);
        sceneNum++;
      }
      fullFountainParts.push(`${text}\n`);
    }
  }

  let finalFountain = fullFountainParts.join('\n').replace(/\n{3,}/g, '\n\n').trim() ||
    `INT. SCENE 1 - DAY\n\nNo scene text found in Scrivener folder.`;

  // Normalize any double-spaced character-to-dialogue gaps
  finalFountain = finalFountain.replace(/^([A-Z0-9\s_\-']+(\s*\(.*\))?)\n\n+(?=[a-zA-Z(])/gm, '$1\n');
  finalFountain = finalFountain.replace(/\(([^)]+)\)\n\n+(?=[a-zA-Z])/gm, '($1)\n');

  const blocks = parseFountain(finalFountain);
  const scriptHtml = blocksToHtml(blocks);
  const words = finalFountain.split(/\s+/).filter(Boolean).length;
  const scenes = (finalFountain.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/gim) || []).length;

  return {
    title: projectTitle,
    author: 'Author Name',
    scriptHtml,
    fountainText: finalFountain,
    sourceApp: 'Scrivener',
    sceneCount: Math.max(1, scenes),
    wordCount: words,
  };
}

/**
 * Parse Scrivener (.scrivx) Project XML (standalone)
 */
function parseScrivenerXml(xmlString: string, fileName: string): ImportedScreenplayResult {
  const titleMatch = xmlString.match(/<ProjectTitle[^>]*>(.*?)<\/ProjectTitle>/i) ||
                     xmlString.match(/<Title[^>]*>(.*?)<\/Title>/i);
  const projectTitle = titleMatch ? titleMatch[1].trim() : fileName.replace(/\.scrivx$/i, '').replace(/\.scriv$/i, '');

  const binderItems = extractScrivenerBinderItems(xmlString);
  const fountainLines: string[] = [];

  if (projectTitle) {
    fountainLines.push(`Title: ${projectTitle.toUpperCase()}`);
    fountainLines.push(`Author: Scrivener Import\n\n`);
  }

  let sceneNum = 1;
  for (const item of binderItems) {
    if (!item.title && !item.synopsis) continue;
    if (isScrivenerTemplateBoilerplate(item.title) || (item.synopsis && isScrivenerTemplateBoilerplate(item.synopsis))) continue;

    const titleUpper = item.title.toUpperCase().trim();
    const isHeading = /^(INT|EXT|INT\/EXT|I\/E)[.\s]/i.test(titleUpper);
    const isGenericFolder = /^(SCREENPLAY FORMAT|SCREENPLAY|MANUSCRIPT|DRAFT|PROJECT|SCENES|CHAPTERS?|BINDER|RESEARCH|TRASH|TEMPLATE SHEETS)$/i.test(titleUpper);

    if (isHeading) {
      fountainLines.push(`\n${titleUpper}\n`);
    } else if (item.title && !isGenericFolder) {
      fountainLines.push(`\nINT. SCENE ${sceneNum} - ${titleUpper} - DAY\n`);
      sceneNum++;
    }

    if (item.synopsis && !isGenericFolder) {
      fountainLines.push(`${item.synopsis}\n`);
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
    warnings: [
      '⚠️ Notice: This .scrivx file contained only the project binder outline. In Scrivener, the full screenplay text (dialogues, character cues, actions) is stored in the project folder (Files/Data/).',
      '💡 To import your complete screenplay: Drop the entire .scriv folder (or a .zip of it), or in Scrivener select File > Export / Compile as Final Draft (.fdx), Fountain (.fountain), or Rich Text (.rtf).'
    ],
  };
}

/**
 * Parses full Scrivener Project Zip Archive (.scriv.zip or .zip)
 */
async function parseScrivenerZip(zipFile: File): Promise<ImportedScreenplayResult> {
  const zip = await JSZip.loadAsync(zipFile);

  const fileEntries: FileEntry[] = [];
  for (const path in zip.files) {
    if (!zip.files[path].dir) {
      const blob = await zip.files[path].async('blob');
      const filename = path.split('/').pop() || path;
      const file = new File([blob], filename);
      fileEntries.push({ path, file });
    }
  }

  // Check if .scrivx is present
  const hasScrivx = fileEntries.some((e) => e.path.toLowerCase().endsWith('.scrivx'));
  if (hasScrivx || fileEntries.some((e) => e.path.toLowerCase().endsWith('content.rtf'))) {
    return parseScrivenerFolderEntries(fileEntries, zipFile.name);
  }

  // Fallback: check for .fountain or .fdx
  for (const entry of fileEntries) {
    const lower = entry.path.toLowerCase();
    if (lower.endsWith('.fountain') || lower.endsWith('.spmd')) {
      const text = await entry.file.text();
      const { title, author, body } = extractFountainMetadata(text);
      return {
        title: title || zipFile.name.replace(/\.[^/.]+$/, ''),
        author: author || 'Unknown Author',
        scriptHtml: fountainToHtml(body),
        fountainText: body,
        sourceApp: 'Fountain / Highland',
        sceneCount: Math.max(1, (body.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/gim) || []).length),
        wordCount: body.trim().split(/\s+/).filter(Boolean).length,
      };
    }
    if (lower.endsWith('.fdx')) {
      const text = await entry.file.text();
      const { blocks, metadata } = parseFdx(text);
      return {
        title: metadata.title || zipFile.name.replace(/\.[^/.]+$/, ''),
        author: metadata.authors?.[0] || 'Unknown Author',
        scriptHtml: blocksToHtml(blocks),
        fountainText: blocks.map((b) => b.text).join('\n\n'),
        sourceApp: 'Final Draft',
        sceneCount: Math.max(1, blocks.filter((b) => b.type === 'sceneHeading').length),
        wordCount: blocks.reduce((acc, b) => acc + (b.text?.split(/\s+/).filter(Boolean).length || 0), 0),
      };
    }
  }

  throw new Error('No supported screenplay files found inside zip archive.');
}

/**
 * Parses generic screenplay HTML export (from Celtx, Fade In, etc.)
 */
function parseScreenplayHtml(html: string, fileName: string): ImportedScreenplayResult {
  const fountainLines: string[] = [];
  const tagRegex = /<([a-z0-9]+)\s+class="([^"]*)"[^>]*>([\s\S]*?)<\/\1>/gi;
  let match;

  while ((match = tagRegex.exec(html)) !== null) {
    const classNames = match[2];
    const rawContent = match[3];
    const text = rawContent.replace(/<[^>]+>/g, '').trim();
    if (!text) continue;

    if (classNames.includes('scene-heading') || classNames.includes('script-scene-heading')) {
      fountainLines.push(`\n${text.toUpperCase()}\n`);
    } else if ((classNames.includes('character') || classNames.includes('script-character')) && !isNonCharacterCue(text)) {
      fountainLines.push(`\n${text.toUpperCase()}`);
    } else if (classNames.includes('parenthetical') || classNames.includes('script-parenthetical')) {
      fountainLines.push(text.startsWith('(') ? text : `(${text})`);
    } else if (classNames.includes('dialogue') || classNames.includes('script-dialogue')) {
      fountainLines.push(`${text}\n`);
    } else if (classNames.includes('transition') || classNames.includes('script-transition')) {
      fountainLines.push(`\n> ${text.toUpperCase()}\n`);
    } else {
      fountainLines.push(`\n${text}\n`);
    }
  }

  const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
  const title = titleMatch ? titleMatch[1].replace(/- Screenplay.*$/i, '').trim() : fileName.replace(/\.[^/.]+$/, '');

  const fountainText = fountainLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() ||
    `INT. SCENE 1 - DAY\n\nContent imported from ${fileName}.`;

  const scriptHtml = fountainToHtml(fountainText);
  const words = fountainText.split(/\s+/).filter(Boolean).length;
  const scenes = (fountainText.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/gim) || []).length;

  return {
    title,
    author: 'Screenplay Import',
    scriptHtml,
    fountainText,
    sourceApp: 'HTML Screenplay',
    sceneCount: Math.max(1, scenes),
    wordCount: words,
  };
}

// ==========================================
// PDF SCREENPLAY DISSECTION & PARSING ENGINE
// ==========================================

export interface PdfTextLine {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  pageNum: number;
}

export type ScreenplayBlockType =
  | 'sceneHeading'
  | 'action'
  | 'character'
  | 'parenthetical'
  | 'dialogue'
  | 'transition';

export interface ScreenplayDissectedBlock {
  type: ScreenplayBlockType;
  text: string;
}

/**
 * Extracts and reconstructs horizontal text lines with spatial coordinates from each page of a PDF.
 */
export async function extractLinesFromPdf(file: File): Promise<{ pages: PdfTextLine[][]; totalTextItems: number }> {
  const arrayBuffer = await file.arrayBuffer();
  const pdfDoc = await pdfjsLib.getDocument({
    data: new Uint8Array(arrayBuffer),
    useSystemFonts: true,
  } as any).promise;

  const pages: PdfTextLine[][] = [];
  let totalTextItems = 0;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
    const page = await pdfDoc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const rawItems: { str: string; x: number; y: number; width: number; height: number }[] = [];

    for (const item of textContent.items as any[]) {
      if (!item.str || !item.str.trim()) continue;
      totalTextItems++;
      const x = item.transform ? item.transform[4] : item.x || 0;
      const y = item.transform ? item.transform[5] : item.y || 0;
      rawItems.push({
        str: item.str,
        x,
        y,
        width: item.width || 0,
        height: item.height || 0,
      });
    }

    if (rawItems.length === 0) {
      pages.push([]);
      continue;
    }

    // Sort by vertical position (Y descending from top of page), then X ascending (left to right)
    rawItems.sort((a, b) => b.y - a.y || a.x - b.x);

    const lines: PdfTextLine[] = [];
    let currentLine: { items: typeof rawItems; y: number } | null = null;

    for (const item of rawItems) {
      if (!currentLine) {
        currentLine = { items: [item], y: item.y };
      } else if (Math.abs(item.y - currentLine.y) <= 3.5) {
        currentLine.items.push(item);
      } else {
        lines.push(finalizeLine(currentLine.items, currentLine.y, pageNum));
        currentLine = { items: [item], y: item.y };
      }
    }
    if (currentLine) {
      lines.push(finalizeLine(currentLine.items, currentLine.y, pageNum));
    }

    pages.push(lines);
  }

  return { pages, totalTextItems };
}

function finalizeLine(
  items: { str: string; x: number; y: number; width: number; height: number }[],
  y: number,
  pageNum: number
): PdfTextLine {
  items.sort((a, b) => a.x - b.x);
  let text = '';
  const startX = items[0].x;
  let totalWidth = 0;
  const maxHeight = Math.max(...items.map((i) => i.height || 0));

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (i > 0) {
      const prev = items[i - 1];
      const gap = item.x - (prev.x + prev.width);
      if (gap > 2 && !text.endsWith(' ') && !item.str.startsWith(' ')) {
        text += ' ';
      }
    }
    text += item.str;
    totalWidth = item.x + item.width - startX;
  }

  return {
    text: text.trim(),
    x: startX,
    y,
    width: totalWidth,
    height: maxHeight,
    pageNum,
  };
}

/**
 * Filters out running headers and page numbers so they don't pollute the script blocks.
 */
function isPageHeaderOrNumber(line: PdfTextLine, _pageLines: PdfTextLine[]): boolean {
  const isTop = line.y > 700;
  const isBottom = line.y < 50;

  if (isTop || isBottom) {
    // Lone page numbers: "1.", "1", "PAGE 1", "12."
    if (/^(?:page\s*)?\d+\.?$/i.test(line.text)) return true;
    // Running header like "SCRIPT TITLE   1." or "EPISODE 1 - 2."
    if (line.x > 380 && /\d+\.?$/.test(line.text)) return true;
  }
  return false;
}

interface ExtractedTitlePage {
  title?: string;
  author?: string;
  draftDate?: string;
  contact?: string;
}

/**
 * Detects whether Page 1 of the PDF is a Cover / Title Page and extracts metadata.
 */
function detectTitlePage(page1Lines: PdfTextLine[]): { isTitlePage: boolean; metadata: ExtractedTitlePage } {
  const metadata: ExtractedTitlePage = {};
  if (!page1Lines || page1Lines.length === 0) return { isTitlePage: false, metadata };

  // If Page 1 contains standard scene headings, it is NOT a cover page (script starts on Page 1)
  const hasSceneHeading = page1Lines.some((l) => isSceneHeadingCandidate(l.text.trim()));
  if (hasSceneHeading) {
    return { isTitlePage: false, metadata };
  }

  const fullText = page1Lines.map((l) => l.text).join('\n');
  const hasWrittenBy = /written\s+by|screenplay\s+by|\bby\b/i.test(fullText);
  const hasContactOrDraft = /draft|revision|contact|@|copyright|all rights reserved/i.test(fullText);

  // If it doesn't look like a title page and has many lines, treat as normal page
  if (!hasWrittenBy && !hasContactOrDraft && page1Lines.length > 25) {
    return { isTitlePage: false, metadata };
  }

  for (let i = 0; i < page1Lines.length; i++) {
    const line = page1Lines[i];
    const text = line.text;

    // Detect Title: first prominent line before "written by", excluding date/draft stamps
    if (isDateOrDraftStamp(text)) {
      if (!metadata.draftDate && (/draft|revised|revision|dated?|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*/i.test(text) || /\d{1,2}:\d{2}/.test(text))) {
        metadata.draftDate = text;
      }
    } else if (!metadata.title && text.length > 1 && !/^(?:written by|by|draft|revision|contact|address)/i.test(text)) {
      metadata.title = text.replace(/['"]+/g, '');
      continue;
    }

    // Detect Author: follows "written by" or "by"
    if (/^(?:written\s+by|screenplay\s+by|by)$/i.test(text)) {
      if (i + 1 < page1Lines.length) {
        metadata.author = page1Lines[i + 1].text;
        i++;
      }
      continue;
    }
    const inlineWritten = text.match(/^(?:written\s+by|screenplay\s+by|by)\s*:\s*(.+)$/i);
    if (inlineWritten && !metadata.author) {
      metadata.author = inlineWritten[1].trim();
      continue;
    }

    // Detect Draft Date
    if (/draft|revised|revision|dated?|\b(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\s+\d{1,2},?\s+\d{4}\b/i.test(text)) {
      if (!metadata.draftDate) {
        metadata.draftDate = text;
      }
    }

    // Detect Contact Info
    if (/@|\b(?:phone|tel|email|contact|agent)\b/i.test(text)) {
      metadata.contact = metadata.contact ? `${metadata.contact}\n${text}` : text;
    }
  }

  return { isTitlePage: true, metadata };
}

/**
 * Converts dissected screenplay blocks into standard Fountain text.
 */
function blocksToFountain(blocks: ScreenplayDissectedBlock[]): string {
  const lines: string[] = [];
  for (const block of blocks) {
    switch (block.type) {
      case 'sceneHeading':
        lines.push(`\n${block.text}\n`);
        break;
      case 'character':
        lines.push(`\n${block.text}`);
        break;
      case 'parenthetical':
        lines.push(block.text);
        break;
      case 'dialogue':
        lines.push(`${block.text}\n`);
        break;
      case 'transition':
        lines.push(`\n> ${block.text}\n`);
        break;
      case 'action':
      default:
        lines.push(`\n${block.text}\n`);
        break;
    }
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Dissects and parses a vector PDF screenplay into structured screenplay blocks.
 * Extracts Title Page metadata from Page 1 (if present), categorizes lines by
 * horizontal coordinates (X indentation) and text semantics into:
 * sceneHeading, character, parenthetical, dialogue, transition, and action.
 */
export async function parseScreenplayPdf(file: File): Promise<ImportedScreenplayResult> {
  const { pages, totalTextItems } = await extractLinesFromPdf(file);

  if (totalTextItems === 0) {
    throw new Error(
      'This PDF contains no extractable text elements (scanned/raster image PDF). Please provide a standard vector PDF exported from screenwriting software (Final Draft, Scrivener, Highland, WriterDuet, Fade In).'
    );
  }

  // 1. Detect if Page 1 is a Cover / Title Page
  let scriptPages = pages;
  let detectedTitle = file.name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ');
  let detectedAuthor = 'Screenplay Author';
  let detectedDraftDate: string | undefined;
  let detectedContact: string | undefined;

  if (pages.length > 0) {
    const { isTitlePage, metadata } = detectTitlePage(pages[0]);
    if (isTitlePage) {
      if (metadata.title && !isDateOrDraftStamp(metadata.title)) detectedTitle = metadata.title;
      if (metadata.author) detectedAuthor = metadata.author;
      if (metadata.draftDate) detectedDraftDate = metadata.draftDate;
      if (metadata.contact) detectedContact = metadata.contact;
      // Skip page 1 from the script body so it cleanly starts with Scene 1
      scriptPages = pages.slice(1);
    }
  }

  // 2. Dissect screenplay script pages into structured blocks
  const blocks: ScreenplayDissectedBlock[] = [];

  for (const pageLines of scriptPages) {
    for (let i = 0; i < pageLines.length; i++) {
      const line = pageLines[i];
      if (isPageHeaderOrNumber(line, pageLines)) continue;

      const trimmed = line.text.trim();
      if (!trimmed) continue;

      const prevBlock = blocks[blocks.length - 1];
      const prevLine = i > 0 ? pageLines[i - 1] : null;

      // 2a. Scene Heading (slugline, super title, numbered sequence heading)
      const isSlugline =
        (line.x < 180 || /^(?:SUPER\s*TITLE|SUPER|TITLE\s*CARD|TITLE|INTERTITLE)[\s:.-]/i.test(trimmed)) &&
        isSceneHeadingCandidate(trimmed);

      if (isSlugline) {
        blocks.push({
          type: 'sceneHeading',
          text: trimmed.replace(/^\./, '').toUpperCase(),
        });
        continue;
      }

      // 2b. Transition (flush right or ends with TO:, or standard end/transition marker)
      const isTransition =
        (line.x >= 350 && /TO:$/i.test(trimmed)) ||
        /^(?:FADE\s+IN:|FADE\s+OUT\.?|CUT\s+TO:|DISSOLVE\s+TO:|MATCH\s+CUT:|SMASH\s+CUT:|FLASH\s+CUT:|FADE\s+TO\s+BLACK\.?|CUT\s+TO\s+BLACK\.?|THE\s+END|FIN)$/i.test(trimmed);

      if (isTransition) {
        blocks.push({
          type: 'transition',
          text: trimmed.toUpperCase(),
        });
        continue;
      }

      // 2c. Character Cue (must NOT be a non-character time marker or camera direction)
      const isCharacter =
        line.x >= 195 &&
        line.x <= 350 &&
        trimmed.length <= 40 &&
        !trimmed.startsWith('(') &&
        !trimmed.endsWith(':') &&
        !/[a-z]/.test(trimmed.replace(/\([^)]*\)/g, '')) &&
        !isNonCharacterCue(trimmed);

      if (isCharacter) {
        blocks.push({
          type: 'character',
          text: trimmed.toUpperCase(),
        });
        continue;
      }

      // 2d. Parenthetical
      const isParenthetical =
        line.x >= 160 &&
        line.x <= 320 &&
        (trimmed.startsWith('(') || trimmed.endsWith(')') ||
         (prevBlock && (prevBlock.type === 'character' || prevBlock.type === 'parenthetical')));

      if (isParenthetical && (trimmed.startsWith('(') || (prevBlock && prevBlock.type === 'character'))) {
        const formatted = trimmed.startsWith('(') ? trimmed : `(${trimmed})`;
        blocks.push({
          type: 'parenthetical',
          text: formatted,
        });
        continue;
      }

      // 2e. Dialogue
      // Case A: Directly under Character Cue or Parenthetical -> Spoken dialogue
      const isImmediateDialogue =
        prevBlock &&
        (prevBlock.type === 'character' || prevBlock.type === 'parenthetical') &&
        line.x >= 80 &&
        line.x <= 380;

      // Case B: Continuation of spoken dialogue (indented above action margin, or tightly-spaced continuation)
      const isContinuingDialogue =
        prevBlock &&
        prevBlock.type === 'dialogue' &&
        ((line.x >= 105 && line.x <= 380) || (prevLine && Math.abs(prevLine.y - line.y) < 18 && line.x >= 85));

      if (isImmediateDialogue || isContinuingDialogue) {
        if (prevBlock.type === 'dialogue' && prevLine && Math.abs(prevLine.y - line.y) < 18) {
          prevBlock.text += ' ' + trimmed;
        } else {
          blocks.push({
            type: 'dialogue',
            text: trimmed,
          });
        }
        continue;
      }

      // 2f. Action / Description (Default fallback for left-aligned body text)
      if (prevBlock && prevBlock.type === 'action' && prevLine) {
        const lineDelta = Math.abs(prevLine.y - line.y);
        // If lines are closely spaced vertically (< 18pt), merge into the same action paragraph
        if (lineDelta < 18) {
          prevBlock.text += ' ' + trimmed;
          continue;
        }
      }

      blocks.push({
        type: 'action',
        text: trimmed,
      });
    }
  }

  // 3. Format into standard Fountain & HTML
  const fountainText = blocksToFountain(blocks);
  const canonicalBlocks = blocks.map((b) =>
    createScreenplayBlock({
      id: crypto.randomUUID(),
      type: b.type,
      text: b.text,
    })
  );
  const scriptHtml = blocksToHtml(canonicalBlocks);
  const words = fountainText.split(/\s+/).filter(Boolean).length;
  const scenes = (fountainText.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/gim) || []).length;

  return {
    title: detectedTitle,
    author: detectedAuthor,
    scriptHtml,
    fountainText,
    sourceApp: 'PDF Screenplay',
    sceneCount: Math.max(1, scenes),
    wordCount: words,
    fullMetadata: {
      title: detectedTitle,
      author: detectedAuthor,
      draftDate: detectedDraftDate,
      contact: detectedContact,
    },
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

  // 2. Vector PDF Screenplay (.pdf)
  if (name.endsWith('.pdf')) {
    return await parseScreenplayPdf(file);
  }

  // 3. Scrivener Project Zip Archive (.zip, .scriv.zip)
  if (name.endsWith('.zip') || name.endsWith('.scriv')) {
    try {
      return await parseScrivenerZip(file);
    } catch {
      // Fall through to plain text/RTF parsing if not a zip
    }
  }

  // 4. Standalone Scrivener XML (.scrivx)
  if (name.endsWith('.scrivx')) {
    const xml = await file.text();
    return parseScrivenerXml(xml, file.name);
  }

  // 5. Standalone Rich Text Format (.rtf) - common Scrivener export
  if (name.endsWith('.rtf')) {
    const rtf = await file.text();
    const cleanText = rtfToText(rtf);
    const { title, author, body } = extractFountainMetadata(cleanText);
    const scriptHtml = fountainToHtml(body);
    const scenes = (body.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/gim) || []).length;
    const words = body.trim().split(/\s+/).filter(Boolean).length;

    return {
      title: title || file.name.replace(/\.[^/.]+$/, ''),
      author: author || 'Unknown Author',
      scriptHtml,
      fountainText: body,
      sourceApp: 'Rich Text Format (RTF)',
      sceneCount: Math.max(1, scenes),
      wordCount: words,
    };
  }

  // 6. HTML Screenplay (.html, .htm)
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const html = await file.text();
    return parseScreenplayHtml(html, file.name);
  }

  // 7. OpenScript JSON (.json, .openscript)
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

  // 8. Fountain, Highland, WriterDuet, Plain Text (.fountain, .spmd, .txt, .text)
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
