import { z } from 'zod';

export const CollaboratorRoleSchema = z.enum([
  'owner',
  'co-writer',
  'commenter',
  'reader',
]);
export type CollaboratorRole = z.infer<typeof CollaboratorRoleSchema>;

export const CollaboratorProfileSchema = z.object({
  userId: z.string().uuid(),
  email: z.string().email(),
  displayName: z.string(),
  avatarUrl: z.string().optional(),
  color: z.string(),
  role: CollaboratorRoleSchema,
  lastSeenAt: z.string(),
});
export type CollaboratorProfile = z.infer<typeof CollaboratorProfileSchema>;

export const LivePresenceSchema = z.object({
  userId: z.string().uuid(),
  displayName: z.string(),
  color: z.string(),
  role: CollaboratorRoleSchema,
  activeBlockId: z.string().uuid().optional(),
  cursorOffset: z.number().int().nonnegative().optional(),
  isTyping: z.boolean().default(false),
  lastPing: z.number(),
});
export type LivePresence = z.infer<typeof LivePresenceSchema>;

/**
 * Checks if a given role is allowed to edit the screenplay body
 */
export function canEditScreenplay(role: CollaboratorRole): boolean {
  return role === 'owner' || role === 'co-writer';
}

/**
 * Checks if a given role is allowed to create or reply to ScriptNotes
 */
export function canAddNotes(role: CollaboratorRole): boolean {
  return role === 'owner' || role === 'co-writer' || role === 'commenter';
}
