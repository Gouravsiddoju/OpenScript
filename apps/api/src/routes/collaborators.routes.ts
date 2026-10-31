import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { eq, and } from 'drizzle-orm';
import { db, projectMembers, users, projects } from '@openscript/database';

const AddCollaboratorSchema = z.object({
  email: z.string().email(),
  role: z.enum(['owner', 'co-writer', 'commenter', 'reader']).default('co-writer'),
  invitedBy: z.string().uuid().optional(),
});

const UpdateRoleSchema = z.object({
  role: z.enum(['owner', 'co-writer', 'commenter', 'reader']),
});

export const collaboratorRoutes: FastifyPluginAsync = async (server) => {
  // List project collaborators
  server.get<{ Params: { id: string } }>('/api/v1/projects/:id/collaborators', async (request, reply) => {
    const { id } = request.params;

    const members = await db.query.projectMembers.findMany({
      where: eq(projectMembers.projectId, id),
    });

    const detailedMembers = await Promise.all(
      members.map(async (m) => {
        const u = await db.query.users.findFirst({
          where: eq(users.id, m.userId),
        });
        return {
          id: m.id,
          userId: m.userId,
          projectId: m.projectId,
          role: m.role,
          email: u?.email || 'unknown',
          displayName: u?.displayName || 'Collaborator',
          createdAt: m.createdAt,
        };
      })
    );

    return { collaborators: detailedMembers };
  });

  // Add / invite collaborator to project
  server.post<{ Params: { id: string } }>('/api/v1/projects/:id/collaborators', async (request, reply) => {
    const { id } = request.params;
    const parseResult = AddCollaboratorSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { email, role, invitedBy } = parseResult.data;

    // Check project exists
    const project = await db.query.projects.findFirst({
      where: eq(projects.id, id),
    });
    if (!project) {
      return reply.status(404).send({ error: 'Project not found' });
    }

    // Find or create user placeholder by email
    let user = await db.query.users.findFirst({
      where: eq(users.email, email),
    });

    if (!user) {
      const [created] = await db.insert(users).values({
        email,
        displayName: email.split('@')[0],
        passwordHash: 'placeholder',
      }).returning();
      user = created;
    }

    // Check if already a member
    const existing = await db.query.projectMembers.findFirst({
      where: and(
        eq(projectMembers.projectId, id),
        eq(projectMembers.userId, user.id)
      ),
    });

    if (existing) {
      return reply.status(409).send({ error: 'User is already a collaborator on this project' });
    }

    const [member] = await db.insert(projectMembers).values({
      projectId: id,
      userId: user.id,
      role,
      invitedBy,
    }).returning();

    return reply.status(201).send({
      collaborator: {
        id: member.id,
        userId: member.userId,
        projectId: member.projectId,
        role: member.role,
        email: user.email,
        displayName: user.displayName,
        createdAt: member.createdAt,
      },
    });
  });

  // Update collaborator role
  server.patch<{ Params: { id: string; userId: string } }>('/api/v1/projects/:id/collaborators/:userId', async (request, reply) => {
    const { id, userId } = request.params;
    const parseResult = UpdateRoleSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const [updated] = await db.update(projectMembers)
      .set({ role: parseResult.data.role })
      .where(and(
        eq(projectMembers.projectId, id),
        eq(projectMembers.userId, userId)
      ))
      .returning();

    if (!updated) {
      return reply.status(404).send({ error: 'Collaborator not found' });
    }

    return { success: true, collaborator: updated };
  });

  // Remove collaborator
  server.delete<{ Params: { id: string; userId: string } }>('/api/v1/projects/:id/collaborators/:userId', async (request, reply) => {
    const { id, userId } = request.params;
    await db.delete(projectMembers)
      .where(and(
        eq(projectMembers.projectId, id),
        eq(projectMembers.userId, userId)
      ));

    return { success: true };
  });
};
