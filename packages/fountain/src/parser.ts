import {
  ScreenplayBlock,
  createScreenplayBlock,
  isNonCharacterCue,
  isSceneHeadingCandidate,
  isShotCandidate,
  isGenuineParenthetical,
} from '@openscript/screenplay-schema';

export function parseFountain(fountainText: string): ScreenplayBlock[] {
  const blocks: ScreenplayBlock[] = [];
  const lines = fountainText.split(/\r?\n/);

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (!line) continue;

    // 1. Scene Heading (slugline or forced . / super titles / numbered headings)
    if (isSceneHeadingCandidate(line) || line.startsWith('.')) {
      blocks.push(createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'sceneHeading',
        text: line.replace(/^\./, '').trim().toUpperCase(),
      }));
      continue;
    }

    // 2. Transition (forced > or standard transition ending in TO:)
    if (line.startsWith('>') || /( TO:$|^>(?:[^<]+)$)/i.test(line)) {
      blocks.push(createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'transition',
        text: line.replace(/^>/, '').trim().toUpperCase(),
      }));
      continue;
    }

    // 3. Shot cues (camera angles, directions, framing, backdrops)
    if (isShotCandidate(line)) {
      blocks.push(createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'shot',
        text: line.toUpperCase(),
      }));
      continue;
    }

    // 4. Character: uppercase, < 40 chars, NOT a non-character cue (time lapse, camera shot, etc.)
    if (!isNonCharacterCue(line) && /^([A-Z0-9\s_\-']+(\s*\(.*\))?)$/.test(line) && !line.endsWith(':') && line.length < 40 && !/[a-z]/.test(line.replace(/\([^)]*\)/g, ''))) {
      blocks.push(createScreenplayBlock({
        id: crypto.randomUUID(),
        type: 'character',
        text: line.toUpperCase(),
      }));

      // In Fountain, lines directly under character are parenthetical and dialogue
      let hasDialogue = false;
      let lastWasParen = false;

      while (i + 1 < lines.length) {
        const nextRaw = lines[i + 1];
        const nextLine = nextRaw.trim();

        if (!nextLine) {
          // If no dialogue has been spoken yet, or if previous line was a parenthetical,
          // check if the line following the blank line is spoken dialogue/parenthetical
          if ((!hasDialogue || lastWasParen) && i + 2 < lines.length) {
            const lookahead = lines[i + 2].trim();
            if (lookahead && !isSceneHeadingCandidate(lookahead) && !isNonCharacterCue(lookahead)) {
              const isLookaheadAnotherCharacter = /^([A-Z0-9\s_\-']+(\s*\(.*\))?)$/.test(lookahead) && !lookahead.endsWith(':') && lookahead.length < 40 && !/[a-z]/.test(lookahead.replace(/\([^)]*\)/g, ''));
              const isLookaheadTransition = /( TO:$|^>[^<]*$)/i.test(lookahead);
              if (!isLookaheadAnotherCharacter && !isLookaheadTransition) {
                // Skip the blank line to reach the character's spoken dialogue or parenthetical
                i++;
                continue;
              }
            }
          }
          // Empty line terminates the dialogue block once dialogue has been spoken
          break;
        }

        // Check if next line is a new scene heading or transition or shot
        if (isSceneHeadingCandidate(nextLine) || /( TO:$|^>[^<]*$)/i.test(nextLine) || isShotCandidate(nextLine)) {
          break;
        }

        // Check if next line is another character cue (all uppercase, no lowercase)
        if (hasDialogue && !isNonCharacterCue(nextLine) && /^([A-Z0-9\s_\-']+(\s*\(.*\))?)$/.test(nextLine) && !nextLine.endsWith(':') && nextLine.length < 40 && !/[a-z]/.test(nextLine.replace(/\([^)]*\)/g, ''))) {
          break;
        }

        if (nextLine.startsWith('(') && nextLine.endsWith(')')) {
          blocks.push(createScreenplayBlock({ id: crypto.randomUUID(), type: 'parenthetical', text: nextLine }));
          lastWasParen = true;
          i++;
        } else {
          blocks.push(createScreenplayBlock({ id: crypto.randomUUID(), type: 'dialogue', text: nextLine }));
          hasDialogue = true;
          lastWasParen = false;
          i++;
        }
      }
      continue;
    }

    // 5. Default to Action
    blocks.push(createScreenplayBlock({
      id: crypto.randomUUID(),
      type: 'action',
      text: line,
    }));
  }

  return blocks;
}
