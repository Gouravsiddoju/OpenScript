import { z } from 'zod';

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
