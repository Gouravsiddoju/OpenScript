import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, desc, asc } from 'drizzle-orm';
import { db, scriptNotes, scriptNoteReplies, documents } from '@openscript/database';

const CreateNoteSchema = z.object({
  blockId: z.string().uuid(),
  authorName: z.string().min(1),
  authorColor: z.string().default('#eab308'),
  category: z.enum(['general', 'dialogue', 'action', 'legal', 'production', 'director']).default('general'),
  content: z.string().min(1),
  authorId: z.string().uuid().optional(),
});

const AddReplySchema = z.object({
  authorName: z.string().min(1),
  authorColor: z.string().default('#3b82f6'),
  content: z.string().min(1),
  authorId: z.string().uuid().optional(),
});

const UpdateNoteSchema = z.object({
  content: z.string().min(1).optional(),
  category: z.enum(['general', 'dialogue', 'action', 'legal', 'production', 'director']).optional(),
  isResolved: z.boolean().optional(),
});

export const noteRoutes: FastifyPluginAsync = async (server) => {
  // List all notes for a document (including replies)
  server.get<{ Params: { id: string } }>('/api/v1/documents/:id/notes', async (request, reply) => {
    const { id } = request.params;

    const notesList = await db.query.scriptNotes.findMany({
      where: eq(scriptNotes.documentId, id),
      orderBy: [desc(scriptNotes.createdAt)],
    });

    const enrichedNotes = await Promise.all(
      notesList.map(async (n) => {
        const replies = await db.query.scriptNoteReplies.findMany({
          where: eq(scriptNoteReplies.noteId, n.id),
          orderBy: [asc(scriptNoteReplies.createdAt)],
        });
        return {
          ...n,
          replies,
        };
      })
    );

    return { notes: enrichedNotes };
  });

  // Create new ScriptNote anchored to a block
  server.post<{ Params: { id: string } }>('/api/v1/documents/:id/notes', async (request, reply) => {
    const { id } = request.params;
    const parseResult = CreateNoteSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, id),
    });
    if (!doc) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    const { blockId, authorName, authorColor, category, content, authorId } = parseResult.data;

    const [note] = await db.insert(scriptNotes).values({
      documentId: id,
      blockId,
      authorId,
      authorName,
      authorColor,
      category,
      content,
      isResolved: false,
    }).returning();

    return reply.status(201).send({ note: { ...note, replies: [] } });
  });

  // Add reply to note
  server.post<{ Params: { id: string } }>('/api/v1/notes/:id/replies', async (request, reply) => {
    const { id } = request.params;
    const parseResult = AddReplySchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const note = await db.query.scriptNotes.findFirst({
      where: eq(scriptNotes.id, id),
    });
    if (!note) {
      return reply.status(404).send({ error: 'Note not found' });
    }

    const { authorName, authorColor, content, authorId } = parseResult.data;

    const [replyItem] = await db.insert(scriptNoteReplies).values({
      noteId: id,
      authorId,
      authorName,
      authorColor,
      content,
    }).returning();

    return reply.status(201).send({ reply: replyItem });
  });

  // Toggle resolve status
  server.patch<{ Params: { id: string }; Body: { isResolved: boolean } }>(
    '/api/v1/notes/:id/resolve',
    async (request, reply) => {
      const { id } = request.params;
      const { isResolved } = request.body || {};

      const [updated] = await db.update(scriptNotes)
        .set({
          isResolved: Boolean(isResolved),
          resolvedAt: isResolved ? new Date() : null,
          updatedAt: new Date(),
        })
        .where(eq(scriptNotes.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'Note not found' });
      }

      return { note: updated };
    }
  );

  // Update note
  server.patch<{ Params: { id: string } }>('/api/v1/notes/:id', async (request, reply) => {
    const { id } = request.params;
    const parseResult = UpdateNoteSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { content, category, isResolved } = parseResult.data;

    const [updated] = await db.update(scriptNotes)
      .set({
        ...(content && { content }),
        ...(category && { category }),
        ...(isResolved !== undefined && {
          isResolved,
          resolvedAt: isResolved ? new Date() : null,
        }),
        updatedAt: new Date(),
      })
      .where(eq(scriptNotes.id, id))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: 'Note not found' });
    }

    return { note: updated };
  });

  // Delete note
  server.delete<{ Params: { id: string } }>('/api/v1/notes/:id', async (request, reply) => {
    const { id } = request.params;
    await db.delete(scriptNotes).where(eq(scriptNotes.id, id));
    return { success: true };
  });
};
