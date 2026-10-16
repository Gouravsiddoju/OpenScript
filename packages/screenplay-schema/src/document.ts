import { z } from 'zod';
import { ScreenplayBlockSchema } from './blocks';

export const CanonicalDocumentMetadataSchema = z.object({
  title: z.string().default('Untitled Screenplay'),
  credit: z.string().default('written by'),
  authors: z.array(z.string()).default([]),
  source: z.string().optional(),
  draftLabel: z.string().default('First Draft'),
  draftColor: z.string().default('White'),
  contactInfo: z.string().optional(),
  copyright: z.string().optional(),
  isLocked: z.boolean().default(false),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});
export type CanonicalDocumentMetadata = z.infer<typeof CanonicalDocumentMetadataSchema>;

export const CanonicalScreenplayDocumentSchema = z.object({
  schemaVersion: z.literal(2),
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  revisionNumber: z.number().int().min(1),
  metadata: CanonicalDocumentMetadataSchema,
  content: z.array(ScreenplayBlockSchema),
});
export type CanonicalScreenplayDocument = z.infer<typeof CanonicalScreenplayDocumentSchema>;
