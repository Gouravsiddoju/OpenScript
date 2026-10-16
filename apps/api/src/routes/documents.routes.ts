import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db, documents, documentRevisions } from '@scripto/database';
import { 
  CanonicalScreenplayDocumentSchema, 
  CanonicalScreenplayDocument 
} from '@scripto/screenplay-schema';

const CreateDocumentSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).default('Untitled Screenplay'),
});

export const documentRoutes: FastifyPluginAsync = async (server) => {
  // Create document in a project
  server.post('/api/v1/projects/:projectId/documents', async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const parseResult = CreateDocumentSchema.safeParse({ ...request.body as any, projectId });
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { title } = parseResult.data;
    const documentId = crypto.randomUUID();

    // Default starter screenplay AST
    const initialAst: CanonicalScreenplayDocument = {
      schemaVersion: 2,
      id: documentId,
      projectId,
      revisionNumber: 1,
      metadata: {
        title,
        credit: 'written by',
        authors: ['Writer'],
        draftLabel: 'First Draft',
        draftColor: 'White',
        isLocked: false,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      content: [
        {
          id: crypto.randomUUID(),
          type: 'sceneHeading',
          text: 'INT. COFFEE SHOP - DAY',
        },
        {
          id: crypto.randomUUID(),
          type: 'action',
          text: 'Rain drums against the tall glass windows. A steaming cup of espresso rests on the counter.',
        },
      ],
    };

    const [newDoc] = await db.insert(documents).values({
      id: documentId,
      projectId,
      title,
      schemaVersion: 2,
      contentJson: initialAst,
      revisionNumber: 1,
      isLocked: false,
    }).returning();

    // Initial revision snapshot
    await db.insert(documentRevisions).values({
      documentId,
      revisionNumber: 1,
      contentSnapshot: initialAst,
      reason: 'Initial creation',
    });

    return reply.status(201).send({ document: newDoc });
  });

  // Get document by ID
  server.get<{ Params: { id: string } }>('/api/v1/documents/:id', async (request, reply) => {
    const { id } = request.params;
    const doc = await db.query.documents.findFirst({
      where: eq(documents.id, id),
    });

    if (!doc) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    return { document: doc };
  });

  // Patch document with atomic concurrency lock
  server.patch<{
    Params: { id: string };
    Body: { revisionNumber: number; content: any; title?: string };
  }>('/api/v1/documents/:id', async (request, reply) => {
    const { id } = request.params;
    const { revisionNumber, content, title } = request.body;

    if (typeof revisionNumber !== 'number') {
      return reply.status(400).send({ error: 'Missing revisionNumber for optimistic locking' });
    }

    // Validate AST with schema
    const parsedDoc = CanonicalScreenplayDocumentSchema.safeParse(content);
    if (!parsedDoc.success) {
      return reply.status(400).send({ error: 'Invalid screenplay document AST', details: parsedDoc.error.flatten() });
    }

    // Atomic update with revision_number condition
    const updated = await db
      .update(documents)
      .set({
        contentJson: parsedDoc.data,
        revisionNumber: revisionNumber + 1,
        ...(title && { title }),
        updatedAt: new Date(),
      })
      .where(and(eq(documents.id, id), eq(documents.revisionNumber, revisionNumber)))
      .returning();

    // Conflict detection
    if (updated.length === 0) {
      const currentDoc = await db.query.documents.findFirst({ where: eq(documents.id, id) });
      return reply.status(409).send({
        error: 'Conflict: Document was modified by another session or tab',
        serverRevisionNumber: currentDoc?.revisionNumber,
      });
    }

    // Automated revision checkpoint every 10 updates
    if ((revisionNumber + 1) % 10 === 0) {
      await db.insert(documentRevisions).values({
        documentId: id,
        revisionNumber: revisionNumber + 1,
        contentSnapshot: parsedDoc.data,
        reason: 'Automated 10-revision checkpoint',
      });
    }

    return {
      success: true,
      newRevisionNumber: revisionNumber + 1,
      updatedAt: updated[0].updatedAt,
    };
  });

  // Delete document
  server.delete<{ Params: { id: string } }>('/api/v1/documents/:id', async (request, reply) => {
    const { id } = request.params;
    await db.delete(documents).where(eq(documents.id, id));
    return { success: true };
  });
};
