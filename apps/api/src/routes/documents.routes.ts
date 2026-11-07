import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ResilientStore } from '../services/store.service';
import { 
  CanonicalScreenplayDocumentSchema, 
  CanonicalScreenplayDocument,
  createScreenplayBlock 
} from '@openscript/screenplay-schema';
import { requireProjectAccess, requireDocumentAccess } from '../plugins/auth.middleware';

const CreateDocumentSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(1).default('Untitled Screenplay'),
});

export const documentRoutes: FastifyPluginAsync = async (server) => {
  // Create document in a project (Protected)
  server.post('/api/v1/projects/:projectId/documents', {
    preHandler: [requireProjectAccess()],
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const parseResult = CreateDocumentSchema.safeParse({ ...request.body as any, projectId });
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { title } = parseResult.data;
    const documentId = crypto.randomUUID();

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
        createScreenplayBlock({
          id: crypto.randomUUID(),
          type: 'sceneHeading',
          text: 'INT. COFFEE SHOP - DAY',
        }),
        createScreenplayBlock({
          id: crypto.randomUUID(),
          type: 'action',
          text: 'Rain drums against the tall glass windows. A steaming cup of espresso rests on the counter.',
        }),
      ],
    };

    const res = await ResilientStore.saveDocument(documentId, projectId, title, initialAst, 0);
    return reply.status(201).send({ document: res.doc });
  });

  // Get document by ID (Protected)
  server.get<{ Params: { id: string } }>('/api/v1/documents/:id', {
    preHandler: [requireDocumentAccess()],
  }, async (request, reply) => {
    const { id } = request.params;
    const doc = await ResilientStore.getDocument(id);

    if (!doc) {
      return reply.status(404).send({ error: 'Document not found' });
    }

    return { document: doc };
  });

  // Patch document with atomic concurrency lock (Protected)
  server.patch<{
    Params: { id: string };
    Body: { revisionNumber: number; content: any; title?: string };
  }>('/api/v1/documents/:id', {
    preHandler: [requireDocumentAccess()],
  }, async (request, reply) => {
    const { id } = request.params;
    const { revisionNumber, content, title } = request.body || {};

    if (typeof revisionNumber !== 'number') {
      return reply.status(400).send({ error: 'Missing revisionNumber for optimistic locking' });
    }

    // Strict RBAC: Read-only collaborators (readers, commenters, guests) cannot modify screenplay content
    if (request.userRole === 'reader' || request.userRole === 'commenter' || request.userRole === 'guest') {
      return reply.status(403).send({ error: 'Forbidden: Read-only collaborators cannot modify screenplay content' });
    }

    // Validate AST with schema
    const parsedDoc = CanonicalScreenplayDocumentSchema.safeParse(content);
    if (!parsedDoc.success) {
      return reply.status(400).send({ error: 'Invalid screenplay document AST', details: parsedDoc.error.flatten() });
    }

    const projectId = content.projectId || id;
    const docTitle = title || content.metadata?.title || 'Untitled Screenplay';

    const saveResult = await ResilientStore.saveDocument(id, projectId, docTitle, parsedDoc.data, revisionNumber);

    if (saveResult.isConflict) {
      return reply.status(409).send({
        error: 'Conflict: Document was modified by another session or tab',
        serverRevisionNumber: (saveResult as any).serverRevisionNumber,
      });
    }

    return {
      success: true,
      newRevisionNumber: saveResult.newRevisionNumber,
      updatedAt: (saveResult.doc as any)?.updatedAt || new Date(),
    };
  });
};
