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
export function rtfToText(rtf: string): string {
  if (!rtf) return '';

  // 1. Remove font table, color table, stylesheet, generator info, etc.
  let text = rtf.replace(/\{\\(?:fonttbl|colortbl|stylesheet|info|generator)[\s\S]*?\}/g, '');

  // 2. Remove any other destination groups like {\*\expandedcolortbl...}
  text = text.replace(/\{\\\*[\s\S]*?\}/g, '');

  // 3. Convert \par and \line to line breaks
  text = text.replace(/\\par(?:\r\n|\n|\s)?/gi, '\n');
  text = text.replace(/\\line(?:\r\n|\n|\s)?/gi, '\n');

  // 4. Convert \tab to spaces
  text = text.replace(/\\tab(?:\r\n|\n|\s)?/gi, '    ');

  // 5. Convert hex character escapes \'hh
  text = text.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    return String.fromCharCode(parseInt(hex, 16));
  });

  // 6. Convert unicode escapes \uN
  text = text.replace(/\\u(-?\d+)\??/g, (_, code) => {
    const num = parseInt(code, 10);
    return String.fromCharCode(num < 0 ? num + 65536 : num);
  });

  // 7. Remove remaining control words like \b, \i, \fs24, \cf0, \qc, \scriptelement etc.
  text = text.replace(/\\[a-zA-Z]+-?\d*(?:\s)?/g, '');

  // 8. Unescape escaped characters \{, \}, \\
  text = text.replace(/\\([{}\\])/g, '$1');

  // 9. Remove outer { and }
  text = text.replace(/[{}]/g, '');

  // 10. Normalize newlines
  return text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}

/**
 * Parse Scrivener (.scrivx) Project XML
 * Handles standalone .scrivx file and warns if binder documents are missing
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
  const binderRegex = /<BinderItem[^>]*ID="([^"]*)"[^>]*Type="(?:Text|Folder)"[^>]*>([\s\S]*?)<\/BinderItem>/gi;
  let match;
  let sceneNum = 1;

  while ((match = binderRegex.exec(xmlString)) !== null) {
    const inner = match[2];
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
    warnings: [
      '⚠️ Notice: This .scrivx file contained only the project binder outline. In Scrivener, the full screenplay text (dialogues, character cues, actions) is stored in the project folder (Files/Data/).',
      '💡 To import your complete screenplay: Drop the entire .scriv folder (or a .zip of it), or in Scrivener select File > Export / Compile as Final Draft (.fdx), Fountain (.fountain), or Rich Text (.rtf).'
    ],
  };
}

/**
 * Parses full Scrivener Project Zip Archive (.scriv.zip or .zip)
 * Reads project.scrivx and merges all scene files from Files/Data/
 */
async function parseScrivenerZip(zipFile: File): Promise<ImportedScreenplayResult> {
  const zip = await JSZip.loadAsync(zipFile);

  // 1. Locate .scrivx binder file
  let scrivxPath: string | null = null;
  for (const relativePath in zip.files) {
    if (relativePath.toLowerCase().endsWith('.scrivx')) {
      scrivxPath = relativePath;
      break;
    }
  }

  // Fallback: If no .scrivx found, look for .fountain, .fdx, or .rtf files
  if (!scrivxPath) {
    for (const relativePath in zip.files) {
      const lower = relativePath.toLowerCase();
      if (lower.endsWith('.fountain') || lower.endsWith('.spmd')) {
        const text = await zip.files[relativePath].async('text');
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
        const text = await zip.files[relativePath].async('text');
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
    throw new Error('No supported screenplay files (.scrivx, .fountain, .fdx) found inside the zip archive.');
  }

  // 2. Read Scrivener XML binder
  const xmlContent = await zip.files[scrivxPath].async('text');
  const titleMatch = xmlContent.match(/<ProjectTitle[^>]*>(.*?)<\/ProjectTitle>/i) ||
                     xmlContent.match(/<Title[^>]*>(.*?)<\/Title>/i);
  const projectTitle = titleMatch ? titleMatch[1].trim() : zipFile.name.replace(/\.[^/.]+$/, '');

  const binderRegex = /<BinderItem[^>]*ID="([^"]*)"[^>]*Type="(?:Text|Folder)"[^>]*>([\s\S]*?)<\/BinderItem>/gi;
  let match;

  const fullFountainParts: string[] = [];
  if (projectTitle) {
    fullFountainParts.push(`Title: ${projectTitle.toUpperCase()}`);
    fullFountainParts.push(`Author: Scrivener Project Archive\n\n`);
  }

  let sceneNum = 1;
  let extractedScenesCount = 0;

  // Map all zip entries case-insensitively for fast lookup
  const zipFileMap = new Map<string, string>();
  for (const path in zip.files) {
    zipFileMap.set(path.toLowerCase(), path);
  }

  while ((match = binderRegex.exec(xmlContent)) !== null) {
    const itemId = match[1];
    const inner = match[2];
    const itemTitleMatch = inner.match(/<Title[^>]*>(.*?)<\/Title>/i);
    const title = itemTitleMatch ? itemTitleMatch[1].trim() : '';

    // Search for content file matching this item ID in Files/Data/<id>/content.rtf or Files/Docs/<id>.rtf
    const candidatePaths = [
      `files/data/${itemId}/content.rtf`,
      `files/data/${itemId}/content.txt`,
      `files/docs/${itemId}.rtf`,
      `files/docs/${itemId}.txt`,
    ];

    let foundPath: string | null = null;
    for (const [lowerPath, actualPath] of zipFileMap.entries()) {
      if (candidatePaths.some((c) => lowerPath.endsWith(c))) {
        foundPath = actualPath;
        break;
      }
    }

    let sceneBody = '';
    if (foundPath) {
      const rawContent = await zip.files[foundPath].async('text');
      if (foundPath.toLowerCase().endsWith('.rtf')) {
        sceneBody = rtfToText(rawContent);
      } else {
        sceneBody = rawContent.trim();
      }
    }

    if (!title && !sceneBody) continue;

    // Check if title is already a scene heading
    const isHeading = /^(INT|EXT|INT\/EXT|I\/E)[.\s]/i.test(title);
    if (isHeading) {
      fullFountainParts.push(`\n${title.toUpperCase()}\n`);
      sceneNum++;
      extractedScenesCount++;
    } else if (title) {
      // If title is "Scene 1", "Act 1", or a descriptive name
      fullFountainParts.push(`\nINT. SCENE ${sceneNum} - ${title.toUpperCase()} - DAY\n`);
      sceneNum++;
      extractedScenesCount++;
    }

    if (sceneBody) {
      fullFountainParts.push(`${sceneBody}\n`);
    }
  }

  const finalFountain = fullFountainParts.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  const scriptHtml = fountainToHtml(finalFountain);
  const words = finalFountain.split(/\s+/).filter(Boolean).length;
  const detectedScenes = (finalFountain.match(/^(INT\.|EXT\.|INT\/EXT\.|I\/E\.)/gim) || []).length;

  return {
    title: projectTitle,
    author: 'Scrivener Project Archive',
    scriptHtml,
    fountainText: finalFountain,
    sourceApp: 'Scrivener',
    sceneCount: Math.max(1, detectedScenes || extractedScenesCount),
    wordCount: words,
  };
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
