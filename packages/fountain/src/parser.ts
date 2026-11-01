import {
  ScreenplayBlock,
  createScreenplayBlock,
  isNonCharacterCue,
  isSceneHeadingCandidate,
} from '@openscript/screenplay-schema';

export function parseFountain(fountainText: string): ScreenplayBlock[] {
  const lines = fountainText.split('\n');
  const blocks: ScreenplayBlock[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // 1. Scene Heading: standard sluglines, forced '.', super titles, or sequence headings
    if (isSceneHeadingCandidate(line)) {
      blocks.push(createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'sceneHeading',
        text: line.replace(/^\./, '').toUpperCase(),
      }));
      continue;
    }

    // 2. Transition: ends with 'TO:', forced with '>', or standard transition/end markers
    if (/( TO:$|^>[^<]*$)/.test(line) || /^(?:THE\s+END|FIN|FADE\s+OUT\.?|FADE\s+TO\s+BLACK\.?|CUT\s+TO\s+BLACK\.?)$/i.test(line)) {
      blocks.push(createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'transition',
        text: line.replace(/^>/, '').trim().toUpperCase(),
      }));
      continue;
    }

    // 3. Character: uppercase, < 40 chars, NOT a non-character cue (time lapse, camera shot, etc.)
    if (!isNonCharacterCue(line) && /^([A-Z0-9\s_\-']+(\s*\(.*\))?)$/.test(line) && !line.endsWith(':') && line.length < 40) {
      blocks.push(createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'character',
        text: line.toUpperCase(),
      }));

      // In Fountain, lines directly under character are parenthetical and dialogue
      while (i + 1 < lines.length) {
        const nextRaw = lines[i + 1];
        const nextLine = nextRaw.trim();
        if (!nextLine) {
          // Empty line terminates the dialogue block
          break;
        }

        // Check if next line is a new scene heading or transition
        if (isSceneHeadingCandidate(nextLine) || /( TO:$|^>[^<]*$)/.test(nextLine)) {
          break;
        }

        if (nextLine.startsWith('(') && nextLine.endsWith(')')) {
          blocks.push(createScreenplayBlock({ id: crypto.randomUUID(), type: 'parenthetical', text: nextLine }));
          i++;
        } else {
          blocks.push(createScreenplayBlock({ id: crypto.randomUUID(), type: 'dialogue', text: nextLine }));
          i++;
        }
      }
      continue;
    }

    // 4. Default to Action
    blocks.push(createScreenplayBlock({
      id: crypto.randomUUID(),
      type: 'action',
      text: line,
    }));
  }

  return blocks;
}
