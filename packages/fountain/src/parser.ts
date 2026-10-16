import { ScreenplayBlock, createScreenplayBlock } from '@openscript/screenplay-schema';

export function parseFountain(fountainText: string): ScreenplayBlock[] {
  const lines = fountainText.split('\n');
  const blocks: ScreenplayBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Scene Heading: INT., EXT., INT/EXT, or forced with '.'
    if (/^(\.(?![.\s])|INT\.|EXT\.|INT\/EXT\.|I\/E\.)/i.test(line)) {
      blocks.push(createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'sceneHeading',
        text: line.replace(/^\./, '').toUpperCase(),
      }));
      continue;
    }

    // Transition: ends with 'TO:' or forced with '>'
    if (/( TO:$|^>[^<]*$)/.test(line)) {
      blocks.push(createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'transition',
        text: line.replace(/^>/, '').trim().toUpperCase(),
      }));
      continue;
    }

    // Character: uppercase, no lowercase letters, < 35 chars
    if (/^([A-Z0-9\s_\-']+(\s*\(.*\))?)$/.test(line) && !line.endsWith(':') && line.length < 35) {
      blocks.push(createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'character',
        text: line.toUpperCase(),
      }));

      // Following line could be parenthetical or dialogue
      if (i + 1 < lines.length) {
        const nextLine = lines[i + 1].trim();
        if (nextLine.startsWith('(') && nextLine.endsWith(')')) {
          blocks.push(createScreenplayBlock({ id: crypto.randomUUID(), type: 'parenthetical', text: nextLine }));
          i++;
        }
      }
      continue;
    }

    // Default to Action
    blocks.push(createScreenplayBlock({
      id: crypto.randomUUID(),
      type: 'action',
      text: line,
    }));
  }

  return blocks;
}
