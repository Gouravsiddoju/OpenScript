import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, desc } from 'drizzle-orm';
import { db, projects, documents } from '@openscript/database';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  ownerId: z.string().uuid(),
});

export const projectRoutes: FastifyPluginAsync = async (server) => {
  // List all projects
  server.get('/api/v1/projects', async (request, reply) => {
    const list = await db.query.projects.findMany({
      orderBy: [desc(projects.updatedAt)],
    });
    return { projects: list };
  });

  // Create new project
  server.post('/api/v1/projects', async (request, reply) => {
    const parseResult = CreateProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { name, description, ownerId } = parseResult.data;
    const [newProject] = await db.insert(projects).values({
      name,
      description,
      ownerId,
    }).returning();

    return reply.status(201).send({ project: newProject });
  });

  // Get project by ID
  server.get<{ Params: { id: string } }>('/api/v1/projects/:id', async (request, reply) => {
    const { id } = request.params;
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const projectDocs = await db.query.documents.findMany({
      where: eq(documents.projectId, id),
      orderBy: [desc(documents.updatedAt)],
    });

    return { project, documents: projectDocs };
  });

  // Update project
  server.patch<{ Params: { id: string }; Body: { name?: string; description?: string } }>(
    '/api/v1/projects/:id',
    async (request, reply) => {
      const { id } = request.params;
      const { name, description } = request.body;

      const [updated] = await db.update(projects)
        .set({
          ...(name && { name }),
          ...(description !== undefined && { description }),
          updatedAt: new Date(),
        })
        .where(eq(projects.id, id))
        .returning();

      if (!updated) {
        return reply.status(404).send({ error: 'Project not found' });
      }

      return { project: updated };
    }
  );

  // Delete project
  server.delete<{ Params: { id: string } }>('/api/v1/projects/:id', async (request, reply) => {
    const { id } = request.params;
    await db.delete(projects).where(eq(projects.id, id));
    return { success: true };
  });
};
