import { CanonicalScreenplayDocument } from '@scripto/screenplay-schema';

export function serializeFountain(doc: CanonicalScreenplayDocument): string {
  return doc.content.map(block => {
    switch (block.type) {
      case 'sceneHeading': return `\n${block.text}\n`;
      case 'character': return `\n${block.text}`;
      case 'parenthetical': return `${block.text}`;
      case 'dialogue': return `${block.text}\n`;
      case 'transition': return `\n> ${block.text}\n`;
      case 'action':
      default: return `${block.text}\n`;
    }
  }).join('\n');
}
