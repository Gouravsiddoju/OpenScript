import { z } from 'zod';

export const CollaboratorRoleSchema = z.enum([
  'owner',
  'co-writer',
  'guest',
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
  status: z.enum(['pending', 'active']).optional(),
  invitedAt: z.string().optional(),
});
export type CollaboratorProfile = z.infer<typeof CollaboratorProfileSchema>;

export const LivePresenceSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  color: z.string(),
  role: CollaboratorRoleSchema,
  activeBlockId: z.string().optional(),
  activeSceneHeading: z.string().optional(),
  activeBlockSnippet: z.string().optional(),
  cursorOffset: z.number().int().nonnegative().optional(),
  isTyping: z.boolean().default(false),
  lastPing: z.number(),
  isOnline: z.boolean().optional(),
});
export type LivePresence = z.infer<typeof LivePresenceSchema>;

/**
 * Checks if a given role is allowed to edit the screenplay body
 */
export function canEditScreenplay(role: CollaboratorRole): boolean {
  return role === 'owner' || role === 'co-writer';
}

/**
 * Checks if a given role is allowed to propose alternative scene takes
 */
export function canProposeSceneTakes(role: CollaboratorRole): boolean {
  return role === 'owner' || role === 'co-writer';
}

/**
 * Checks if a given role has the authority to finalize and choose the winning scene take
 */
export function canFinalizeSceneTake(role: CollaboratorRole): boolean {
  return role === 'owner';
}

/**
 * Checks if a given role is allowed to reorder or delete scenes in the Beat Board or Navigator
 */
export function canReorderScenes(role: CollaboratorRole): boolean {
  return role === 'owner' || role === 'co-writer';
}

/**
 * Checks if a given role is allowed to create or reply to ScriptNotes
 */
export function canAddNotes(role: CollaboratorRole): boolean {
  return role === 'owner' || role === 'co-writer' || role === 'guest' || role === 'commenter';
}

/**
 * Checks if a given role can invite collaborators and assign/change roles
 */
export function canManageTeam(role: CollaboratorRole): boolean {
  return role === 'owner';
}

/**
 * Checks if document security watermark is mandatory for this role
 */
export function isWatermarkRequired(role: CollaboratorRole): boolean {
  return role === 'reader';
}

/**
 * Alternate Scene Versions (Takes / Alts) Schema
 */
export const SceneTakeSchema = z.object({
  id: z.string().uuid(),
  sceneId: z.number(),
  takeNumber: z.number(),
  title: z.string(),
  fountainText: z.string(),
  sceneHtml: z.string().optional(),
  authorName: z.string(),
  authorRole: CollaboratorRoleSchema,
  createdAt: z.string(),
  isFinalized: z.boolean().default(false),
});
export type SceneTake = z.infer<typeof SceneTakeSchema>;
