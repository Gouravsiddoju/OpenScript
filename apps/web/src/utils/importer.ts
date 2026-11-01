import { parseFdx } from '@openscript/fdx';
import { fountainToHtml, blocksToHtml } from '@openscript/fountain';
import JSZip from 'jszip';

export interface ImportedScreenplayResult {
  title?: string;
  author?: string;
  scriptHtml: string;
  fountainText: string;
  sourceApp: 'Final Draft' | 'Scrivener' | 'Fountain / Highland' | 'Plain Screenplay Text' | 'HTML Screenplay' | 'OpenScript JSON' | 'Rich Text Format (RTF)';
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
 * Fast & Robust RTF (Rich Text Format) to Plain Text / Fountain Converter.
 * Unpacks font/color tables, handles unicode/hex escapes, and formats line breaks.
 */
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

  // 10. Unescape escaped characters \{, \}, \\
  text = text.replace(/\\([{}\\])/g, '$1');
  text = text.replace(/[{}]/g, '');
  text = text.replace(/\\/g, '');

  // 11. Normalize newlines
  return text.replace(/\r\n/g, '\n').replace(/[ \t]+/g, ' ').replace(/\n{3,}/g, '\n\n').trim();
}

export function extractScrivenerBinderItems(xmlContent: string): { id: string; title: string; synopsis?: string }[] {
  const items: { id: string; title: string; synopsis?: string }[] = [];

  // Match all <BinderItem ...> tags
  // Scrivener 3: <BinderItem UUID="99C0D304-4B29-4786-9A15-081B1556C47C" Type="Text" ...>
  // Scrivener 1/2: <BinderItem ID="10" Type="Text" ...>
  const itemTagRegex = /<BinderItem\s+([^>]*?)>([\s\S]*?)(?=<BinderItem|<\/Binder>|$)/gi;
  let match;

  while ((match = itemTagRegex.exec(xmlContent)) !== null) {
    const attrs = match[1];
    const inner = match[2];

    const typeMatch = attrs.match(/Type="(Text|Folder)"/i);
    const idMatch = attrs.match(/(?:UUID|ID|Id)="([^"]*)"/i);
    if (!idMatch) continue;

    const id = idMatch[1].trim();
    const type = typeMatch ? typeMatch[1].toLowerCase() : 'text';

    const titleMatch = inner.match(/<Title[^>]*>(.*?)<\/Title>/i);
    const synopsisMatch = inner.match(/<Synopsis[^>]*>(.*?)<\/Synopsis>/i);

    const title = titleMatch ? titleMatch[1].trim() : '';
    const synopsis = synopsisMatch ? synopsisMatch[1].trim() : undefined;

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

    if (!item.title && !sceneBody) continue;

    const titleUpper = item.title.toUpperCase().trim();
    const isHeading = /^(INT|EXT|INT\/EXT|I\/E)[.\s]/i.test(titleUpper);
    const isGenericFolder = /^(SCREENPLAY FORMAT|SCREENPLAY|MANUSCRIPT|DRAFT|PROJECT|SCENES|CHAPTERS?|BINDER|RESEARCH|TRASH)$/i.test(titleUpper);

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
      const isTemplateInstruction = isGenericFolder && /scrivener|template|binder/i.test(sceneBody);
      if (!isTemplateInstruction) {
        fullFountainParts.push(`${sceneBody}\n`);
      }
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
      if (!text) continue;

      const startsWithHeading = /^(INT|EXT|INT\/EXT|I\/E)[.\s]/i.test(text.trim());
      if (!startsWithHeading) {
        fullFountainParts.push(`\nINT. SCENE ${sceneNum} - DAY\n`);
        sceneNum++;
      }
      fullFountainParts.push(`${text}\n`);
    }
  }

  const finalFountain = fullFountainParts.join('\n').replace(/\n{3,}/g, '\n\n').trim() ||
    `INT. SCENE 1 - DAY\n\nNo scene text found in Scrivener folder.`;

  const scriptHtml = fountainToHtml(finalFountain);
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

  const binderItems = extractScrivenerBinderItems(xmlContentOrXml(xmlString));
  const fountainLines: string[] = [];

  if (projectTitle) {
    fountainLines.push(`Title: ${projectTitle.toUpperCase()}`);
    fountainLines.push(`Author: Scrivener Import\n\n`);
  }

  let sceneNum = 1;
  for (const item of binderItems) {
    if (!item.title && !item.synopsis) continue;

    const isHeading = /^(INT|EXT|INT\/EXT|I\/E)[.\s]/i.test(item.title);
    if (isHeading) {
      fountainLines.push(`\n${item.title.toUpperCase()}\n`);
    } else if (item.title) {
      fountainLines.push(`\nINT. SCENE ${sceneNum} - ${item.title.toUpperCase()} - DAY\n`);
      sceneNum++;
    }

    if (item.synopsis) {
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

function xmlContentOrXml(xml: string): string {
  return xml;
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
    } else if (classNames.includes('character') || classNames.includes('script-character')) {
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

  // 2. Scrivener Project Zip Archive (.zip, .scriv.zip)
  if (name.endsWith('.zip') || name.endsWith('.scriv')) {
    try {
      return await parseScrivenerZip(file);
    } catch {
      // Fall through to plain text/RTF parsing if not a zip
    }
  }

  // 3. Standalone Scrivener XML (.scrivx)
  if (name.endsWith('.scrivx')) {
    const xml = await file.text();
    return parseScrivenerXml(xml, file.name);
  }

  // 4. Standalone Rich Text Format (.rtf) - common Scrivener export
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

  // 5. HTML Screenplay (.html, .htm)
  if (name.endsWith('.html') || name.endsWith('.htm')) {
    const html = await file.text();
    return parseScreenplayHtml(html, file.name);
  }

  // 6. OpenScript JSON (.json, .openscript)
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

  // 7. Fountain, Highland, WriterDuet, Plain Text (.fountain, .spmd, .txt, .text)
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
