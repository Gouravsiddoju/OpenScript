import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ResilientStore } from '../services/store.service';
import { requireProjectAccess } from '../plugins/auth.middleware';
import { EmailService } from '../services/email.service';

const AddCollaboratorSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'co-writer', 'commenter', 'reader']).default('co-writer'),
  invitedBy: z.string().uuid().optional(),
});

const UpdateRoleSchema = z.object({
  role: z.enum(['owner', 'co-writer', 'commenter', 'reader']),
});

export const collaboratorRoutes: FastifyPluginAsync = async (server) => {
  // List project collaborators (Protected)
  server.get<{ Params: { id: string } }>('/api/v1/projects/:id/collaborators', {
    preHandler: [requireProjectAccess()],
  }, async (request) => {
    const { id } = request.params;
    const members = await ResilientStore.listCollaborators(id);
    return { collaborators: members };
  });

  // Add / invite collaborator to project (Protected)
  server.post<{ Params: { id: string } }>('/api/v1/projects/:id/collaborators', {
    preHandler: [requireProjectAccess()],
  }, async (request, reply) => {
    const { id } = request.params;
    const parseResult = AddCollaboratorSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { email, role, invitedBy } = parseResult.data;
    const member = await ResilientStore.addCollaborator(id, email, role, invitedBy);

    // Send invitation email in background
    (async () => {
      try {
        const project = await ResilientStore.getProject(id);
        const inviter = request.user?.displayName || 'A team member';
        await EmailService.sendInviteEmail(email, inviter, project?.name || 'Screenplay Project', role);
      } catch (err) {
        console.warn('[Collaborators] Failed to send invite email:', err);
      }
    })();

    return reply.status(201).send({ collaborator: member });
  });

  // Update collaborator role (Protected)
  server.patch<{ Params: { id: string; userId: string } }>('/api/v1/projects/:id/collaborators/:userId', {
    preHandler: [requireProjectAccess()],
  }, async (request, reply) => {
    const { id, userId } = request.params;
    const parseResult = UpdateRoleSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const updated = await ResilientStore.updateCollaboratorRole(id, userId, parseResult.data.role);
    if (!updated) {
      return reply.status(404).send({ error: 'Collaborator not found' });
    }

    return { success: true, collaborator: updated };
  });

  // Remove collaborator (Protected)
  server.delete<{ Params: { id: string; userId: string } }>('/api/v1/projects/:id/collaborators/:userId', {
    preHandler: [requireProjectAccess()],
  }, async (request) => {
    const { id, userId } = request.params;
    await ResilientStore.removeCollaborator(id, userId);
    return { success: true };
  });
};
