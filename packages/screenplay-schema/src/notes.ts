import { z } from 'zod';

export const ScriptNoteCategorySchema = z.enum([
  'general',
  'dialogue',
  'action',
  'legal',
  'production',
  'director',
]);
export type ScriptNoteCategory = z.infer<typeof ScriptNoteCategorySchema>;

export const ScriptNoteReplySchema = z.object({
  id: z.string().uuid(),
  authorName: z.string(),
  authorColor: z.string().default('#3b82f6'),
  content: z.string().min(1),
  createdAt: z.string(),
});
export type ScriptNoteReply = z.infer<typeof ScriptNoteReplySchema>;

export const ScriptNoteSchema = z.object({
  id: z.string().uuid(),
  blockId: z.string().uuid(),
  documentId: z.string().uuid(),
  authorName: z.string(),
  authorColor: z.string().default('#eab308'),
  category: ScriptNoteCategorySchema.default('general'),
  content: z.string().min(1),
  createdAt: z.string(),
  resolved: z.boolean().default(false),
  resolvedAt: z.string().optional(),
  replies: z.array(ScriptNoteReplySchema).default([]),
});
export type ScriptNote = z.infer<typeof ScriptNoteSchema>;
