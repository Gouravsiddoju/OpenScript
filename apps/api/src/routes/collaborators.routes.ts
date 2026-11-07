import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { ResilientStore } from '../services/store.service';
import { requireProjectAccess } from '../plugins/auth.middleware';
import { EmailService } from '../services/email.service';

const AddCollaboratorSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'co-writer', 'commenter', 'reader']).default('co-writer'),
  invitedBy: z.string().uuid().optional(),
  documentId: z.string().optional(),
  projectName: z.string().optional(),
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

  // Add / invite collaborator to project with duplicate protection & direct screenplay join link
  server.post<{ Params: { id: string } }>('/api/v1/projects/:id/collaborators', {
    preHandler: [requireProjectAccess()],
  }, async (request, reply) => {
    const { id } = request.params;
    const parseResult = AddCollaboratorSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { email, role, invitedBy, documentId, projectName: passedProjectName } = parseResult.data;
    const { collaborator, isDuplicate } = await ResilientStore.addCollaborator(id, email, role, invitedBy);

    // Two-way email notification in background
    (async () => {
      try {
        const project = await ResilientStore.getProject(id);
        const projectName = passedProjectName || project?.name || 'Screenplay Project';
        const inviterName = request.user?.displayName || 'Screenwriter';
        const inviterEmail = request.user?.email;

        const appUrl = process.env.APP_URL || 'https://dev-openscript.ssnpictures.in';
        const targetDocId = documentId || id;
        const targetUrl = targetDocId ? `${appUrl}/?doc=${targetDocId}` : appUrl;

        // 1. Send invite email to the invited collaborator with direct document link
        await EmailService.sendInviteEmail(email, inviterName, projectName, role, targetUrl);

        // 2. Send two-way confirmation email to the user who sent the invite
        if (inviterEmail && inviterEmail !== email) {
          await EmailService.sendInviteConfirmationEmail(inviterEmail, email, projectName, role);
        }
      } catch (err) {
        console.warn('[Collaborators] Failed to send two-way notification emails:', err);
      }
    })();

    return reply.status(201).send({
      collaborator,
      isDuplicate,
      message: isDuplicate 
        ? `Invitation already exists for ${email}. Role updated to ${role}.`
        : `Invitation successfully dispatched to ${email}.`,
    });
  });

  // Resend invitation email
  server.post<{ Params: { id: string; userId: string } }>('/api/v1/projects/:id/collaborators/:userId/resend', {
    preHandler: [requireProjectAccess()],
  }, async (request, reply) => {
    const { id, userId } = request.params;
    const members = await ResilientStore.listCollaborators(id);
    const member = members.find((m: any) => m.userId === userId || m.id === userId);

    if (!member) {
      return reply.status(404).send({ error: 'Collaborator not found' });
    }

    const project = await ResilientStore.getProject(id);
    const projectName = project?.name || 'Screenplay Project';
    const inviterName = request.user?.displayName || 'Screenwriter';

    const appUrl = process.env.APP_URL || 'https://dev-openscript.ssnpictures.in';
    const targetDocId = id;
    const targetUrl = targetDocId ? `${appUrl}/?doc=${targetDocId}` : appUrl;

    await EmailService.sendInviteEmail(member.email, inviterName, projectName, member.role, targetUrl);

    return { success: true, message: `Invitation resent to ${member.email}` };
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
