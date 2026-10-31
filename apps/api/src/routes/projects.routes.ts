import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ResilientStore, memStore } from '../services/store.service';

const CreateProjectSchema = z.object({
  name: z.string().min(1, 'Project name is required'),
  description: z.string().optional(),
  ownerId: z.string().uuid().optional(),
});

export const projectRoutes: FastifyPluginAsync = async (server) => {
  // List all projects
  server.get('/api/v1/projects', async () => {
    const list = await ResilientStore.listProjects();
    return { projects: list };
  });

  // Create new project
  server.post('/api/v1/projects', async (request, reply) => {
    const parseResult = CreateProjectSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { name, description, ownerId } = parseResult.data;
    const newProject = await ResilientStore.createProject(name, description, ownerId);

    return reply.status(201).send({ project: newProject });
  });

  // Get project by ID
  server.get<{ Params: { id: string } }>('/api/v1/projects/:id', async (request, reply) => {
    const { id } = request.params;
    const project = await ResilientStore.getProject(id);

    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    const projectDocs = Array.from(memStore.documents.values()).filter((d) => d.projectId === id);
    return { project, documents: projectDocs };
  });
};
