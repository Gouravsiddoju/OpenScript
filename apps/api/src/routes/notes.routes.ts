import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ResilientStore } from '../services/store.service';

const CreateNoteSchema = z.object({
  blockId: z.string().uuid(),
  authorName: z.string().min(1),
  authorColor: z.string().default('#eab308'),
  category: z.enum(['dialogue', 'action', 'legal', 'production', 'director', 'general']).default('general'),
  content: z.string().min(1),
  authorId: z.string().uuid().optional(),
});

const AddReplySchema = z.object({
  authorName: z.string().min(1),
  authorColor: z.string().default('#3b82f6'),
  content: z.string().min(1),
  authorId: z.string().uuid().optional(),
});

export const noteRoutes: FastifyPluginAsync = async (server) => {
  // List all notes for a document
  server.get<{ Params: { id: string } }>('/api/v1/documents/:id/notes', async (request) => {
    const { id } = request.params;
    const notes = await ResilientStore.listNotes(id);
    return { notes };
  });

  // Create new ScriptNote anchored to a block
  server.post<{ Params: { id: string } }>('/api/v1/documents/:id/notes', async (request, reply) => {
    const { id } = request.params;
    const parseResult = CreateNoteSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { blockId, authorName, authorColor, category, content, authorId } = parseResult.data;
    const note = await ResilientStore.createNote(id, blockId, authorName, authorColor, category, content, authorId);
    return reply.status(201).send({ note });
  });

  // Add reply to note
  server.post<{ Params: { id: string } }>('/api/v1/notes/:id/replies', async (request, reply) => {
    const { id } = request.params;
    const parseResult = AddReplySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { authorName, authorColor, content, authorId } = parseResult.data;
    const replyItem = await ResilientStore.addReply(id, authorName, authorColor, content, authorId);
    return reply.status(201).send({ reply: replyItem });
  });

  // Toggle resolve status
  server.patch<{ Params: { id: string }; Body: { isResolved: boolean } }>(
    '/api/v1/notes/:id/resolve',
    async (request, reply) => {
      const { id } = request.params;
      const { isResolved } = request.body || {};
      const note = await ResilientStore.toggleResolve(id, Boolean(isResolved));
      if (!note) {
        return reply.status(404).send({ error: 'Note not found' });
      }
      return { note };
    }
  );

  // Delete note
  server.delete<{ Params: { id: string } }>('/api/v1/notes/:id', async (request) => {
    const { id } = request.params;
    await ResilientStore.deleteNote(id);
    return { success: true };
  });
};
