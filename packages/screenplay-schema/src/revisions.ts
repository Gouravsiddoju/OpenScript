import { z } from 'zod';
import { RevisionColor, RevisionColorSchema } from './blocks';

export const SaveDocumentPayloadSchema = z.object({
  revisionNumber: z.number().int().min(1),
  content: z.any(),
  title: z.string().optional(),
});
export type SaveDocumentPayload = z.infer<typeof SaveDocumentPayloadSchema>;

export const SaveDocumentResponseSchema = z.object({
  success: z.boolean(),
  newRevisionNumber: z.number().int(),
  updatedAt: z.string().datetime(),
});
export type SaveDocumentResponse = z.infer<typeof SaveDocumentResponseSchema>;

export const ConflictErrorResponseSchema = z.object({
  error: z.string(),
  serverRevisionNumber: z.number().int().optional(),
});
export type ConflictErrorResponse = z.infer<typeof ConflictErrorResponseSchema>;

export interface RevisionDraftInfo {
  name: string;
  color: RevisionColor;
  hex: string;
  bgClass: string;
  borderClass: string;
}

export const HOLLYWOOD_REVISION_SEQUENCE: RevisionDraftInfo[] = [
  { name: 'White (First Draft)', color: 'white', hex: '#ffffff', bgClass: 'bg-white', borderClass: 'border-gray-200' },
  { name: 'Blue (Revision 1)', color: 'blue', hex: '#60a5fa', bgClass: 'bg-blue-500/10', borderClass: 'border-blue-500/30' },
  { name: 'Pink (Revision 2)', color: 'pink', hex: '#f472b6', bgClass: 'bg-pink-500/10', borderClass: 'border-pink-500/30' },
  { name: 'Yellow (Revision 3)', color: 'yellow', hex: '#facc15', bgClass: 'bg-yellow-500/10', borderClass: 'border-yellow-500/30' },
  { name: 'Green (Revision 4)', color: 'green', hex: '#4ade80', bgClass: 'bg-green-500/10', borderClass: 'border-green-500/30' },
  { name: 'Goldenrod (Revision 5)', color: 'goldenrod', hex: '#fbbf24', bgClass: 'bg-amber-500/10', borderClass: 'border-amber-500/30' },
  { name: 'Buff (Revision 6)', color: 'buff', hex: '#d97706', bgClass: 'bg-amber-600/10', borderClass: 'border-amber-600/30' },
  { name: 'Salmon (Revision 7)', color: 'salmon', hex: '#fb923c', bgClass: 'bg-orange-500/10', borderClass: 'border-orange-500/30' },
  { name: 'Cherry (Revision 8)', color: 'cherry', hex: '#f87171', bgClass: 'bg-red-500/10', borderClass: 'border-red-500/30' },
];

/**
 * Calculates a standard locked Hollywood scene number when inserting a new scene into a locked script.
 * Rules:
 * - Empty list -> "1"
 * - Inserting after last scene "3" -> "4"
 * - Inserting between "1" and "2" -> "1A"
 * - Inserting between "1A" and "2" -> "1B"
 * - Inserting before "1" -> "A1"
 */
export function calculateLockedSceneNumber(existingNumbers: (string | undefined)[], insertIndex: number): string {
  const valid = existingNumbers.filter((n): n is string => Boolean(n && n.trim()));
  if (valid.length === 0) return '1';

  if (insertIndex <= 0) {
    const first = valid[0];
    const match = first.match(/^([A-Z]*)([0-9]+)/);
    if (!match) return 'A1';
    const letters = match[1];
    const num = match[2];
    if (!letters) return `A${num}`;
    const nextChar = String.fromCharCode(letters.charCodeAt(0) + 1);
    return `${nextChar}${num}`;
  }

  if (insertIndex >= valid.length) {
    const last = valid[valid.length - 1];
    const numMatch = last.match(/([0-9]+)/);
    if (numMatch) {
      const nextNum = parseInt(numMatch[1], 10) + 1;
      return String(nextNum);
    }
    return String(valid.length + 1);
  }

  const prev = valid[insertIndex - 1];
  const prevMatch = prev.match(/^([A-Z]*)([0-9]+)([A-Z]*)$/);
  if (!prevMatch) {
    return `${prev}A`;
  }

  const prefix = prevMatch[1];
  const num = prevMatch[2];
  const suffix = prevMatch[3];

  if (!suffix) {
    return `${prefix}${num}A`;
  }

  const lastChar = suffix[suffix.length - 1];
  const nextChar = String.fromCharCode(lastChar.charCodeAt(0) + 1);
  return `${prefix}${num}${suffix.slice(0, -1)}${nextChar}`;
}
