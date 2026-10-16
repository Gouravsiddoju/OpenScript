import { ScreenplayBlock } from '@openscript/screenplay-schema';
import { parseFountain } from './parser';

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

export function blocksToHtml(blocks: ScreenplayBlock[]): string {
  return blocks.map(block => {
    const text = escapeHtml(block.text || '');
    switch (block.type) {
      case 'sceneHeading':
        return `<div class="script-scene-heading">${text}</div>`;
      case 'character':
        return `<div class="script-character">${text}</div>`;
      case 'parenthetical':
        return `<div class="script-parenthetical">${text}</div>`;
      case 'dialogue':
        return `<div class="script-dialogue">${text}</div>`;
      case 'transition':
        return `<div class="script-transition">${text}</div>`;
      case 'action':
      default:
        return `<div class="script-action">${text}</div>`;
    }
  }).join('\n');
}

export function fountainToHtml(fountainText: string): string {
  const blocks = parseFountain(fountainText);
  return blocksToHtml(blocks);
}
