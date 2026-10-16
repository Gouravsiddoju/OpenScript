import { ScreenplayBlock, createScreenplayBlock } from '@openscript/screenplay-schema';

export interface CalculatedPage {
  pageNumber: number;
  blocks: ScreenplayBlock[];
}

const LINES_PER_PAGE = 54;

export function paginateScreenplay(blocks: ScreenplayBlock[]): CalculatedPage[] {
  const pages: CalculatedPage[] = [];
  let currentPageBlocks: ScreenplayBlock[] = [];
  let currentLineCount = 0;
  let pageNumber = 1;

  for (let i = 0; i < blocks.length; i++) {
    const block = blocks[i];
    const blockLines = calculateBlockHeightInLines(block);

    // Check if adding block exceeds page line budget
    if (currentLineCount + blockLines > LINES_PER_PAGE && currentPageBlocks.length > 0) {
      // WIDOW/ORPHAN PROTECTION:
      // If block is a Scene Heading or Character Cue, do not strand at bottom of page
      if (block.type === 'sceneHeading' || block.type === 'character') {
        pages.push({ pageNumber, blocks: currentPageBlocks });
        currentPageBlocks = [block];
        currentLineCount = blockLines;
        pageNumber++;
        continue;
      }

      // DIALOGUE SPLIT LOGIC:
      if (block.type === 'dialogue' && currentLineCount + 3 <= LINES_PER_PAGE) {
        const availableLines = LINES_PER_PAGE - currentLineCount - 1; // 1 line for (MORE)
        const { firstHalfText, secondHalfText } = splitDialogueText(block.text, availableLines);

        if (firstHalfText.trim()) {
          currentPageBlocks.push({ ...block, text: firstHalfText });
          currentPageBlocks.push(createScreenplayBlock({
            id: crypto.randomUUID(),
            type: 'parenthetical',
            text: '(MORE)',
          }));
          pages.push({ pageNumber, blocks: currentPageBlocks });

          // Carry over to next page
          const previousChar = findPreviousCharacter(blocks, i);
          currentPageBlocks = [
            createScreenplayBlock({
              id: crypto.randomUUID(),
              type: 'character',
              text: `${previousChar} (CONT'D)`,
            }),
            createScreenplayBlock({
              ...block,
              id: crypto.randomUUID(),
              text: secondHalfText,
            }),
          ];
          currentLineCount = 2 + calculateDialogueLines(secondHalfText);
          pageNumber++;
          continue;
        }
      }

      // Default: push whole block to next page
      pages.push({ pageNumber, blocks: currentPageBlocks });
      currentPageBlocks = [block];
      currentLineCount = blockLines;
      pageNumber++;
    } else {
      currentPageBlocks.push(block);
      currentLineCount += blockLines;
    }
  }

  if (currentPageBlocks.length > 0) {
    pages.push({ pageNumber, blocks: currentPageBlocks });
  }

  return pages;
}

export function calculateBlockHeightInLines(block: ScreenplayBlock): number {
  if (block.type === 'sceneHeading') return 3; // 2 blank lines + 1 text line
  if (block.type === 'action') return Math.max(1, Math.ceil(block.text.length / 60)) + 1; // text lines + 1 blank line
  if (block.type === 'character') return 2; // 1 blank line + 1 text line
  if (block.type === 'parenthetical') return 1;
  if (block.type === 'dialogue') return Math.max(1, Math.ceil(block.text.length / 35));
  if (block.type === 'transition') return 2;
  return 2;
}

export function calculateDialogueLines(text: string): number {
  return Math.max(1, Math.ceil(text.length / 35));
}

export function splitDialogueText(text: string, lines: number): { firstHalfText: string; secondHalfText: string } {
  const words = text.split(' ');
  const targetChars = lines * 35;
  let splitIndex = 0;
  let charCount = 0;

  for (let i = 0; i < words.length; i++) {
    charCount += words[i].length + 1;
    if (charCount >= targetChars) {
      splitIndex = Math.max(1, i);
      break;
    }
  }

  if (splitIndex === 0) {
    splitIndex = Math.max(1, Math.floor(words.length / 2));
  }

  return {
    firstHalfText: words.slice(0, splitIndex).join(' '),
    secondHalfText: words.slice(splitIndex).join(' '),
  };
}

export function findPreviousCharacter(blocks: ScreenplayBlock[], currentIndex: number): string {
  for (let i = currentIndex - 1; i >= 0; i--) {
    if (blocks[i].type === 'character') {
      return blocks[i].text.replace(/\s*\(CONT'D\)/gi, '').trim();
    }
  }
  return 'CHARACTER';
}
