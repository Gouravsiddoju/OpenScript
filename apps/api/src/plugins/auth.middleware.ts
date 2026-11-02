import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService } from '../services/auth.service';
import { ResilientStore, InMemUser } from '../services/store.service';

declare module 'fastify' {
  interface FastifyRequest {
    user?: InMemUser;
    userRole?: string;
  }
}

export async function authenticateToken(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return reply.status(401).send({ error: 'Unauthorized: Missing or invalid Authorization header' });
  }

  const rawToken = authHeader.substring(7);
  const tokenHash = AuthService.hashToken(rawToken);

  const session = await ResilientStore.findSession(tokenHash);
  if (!session || new Date() > new Date(session.expiresAt)) {
    return reply.status(401).send({ error: 'Unauthorized: Session expired or invalid' });
  }

  const user = await ResilientStore.findUserById(session.userId);
  if (!user) {
    return reply.status(401).send({ error: 'Unauthorized: User not found' });
  }

  request.user = user;
}

export function requireProjectAccess() {
  return async (request: FastifyRequest<{ Params: { id?: string; projectId?: string } }>, reply: FastifyReply) => {
    const targetProjectId = request.params.projectId || request.params.id;

    // Default sandbox workspace
    if (!targetProjectId || targetProjectId === '00000000-0000-0000-0000-000000000000') {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized: Authorization header required to access this screenplay project' });
    }

    await authenticateToken(request, reply);
    if (reply.sent) return;

    if (request.user) {
      const { hasAccess, role } = await ResilientStore.checkProjectAccess(targetProjectId, request.user.id);
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Forbidden: Access to this screenplay is restricted to verified project members' });
      }
      request.userRole = role || 'reader';
    }
  };
}

export function requireDocumentAccess() {
  return async (request: FastifyRequest<{ Params: { id?: string; documentId?: string } }>, reply: FastifyReply) => {
    const docId = request.params.documentId || request.params.id;
    if (!docId) return;

    const doc = await ResilientStore.getDocument(docId);
    if (!doc) {
      return; // Let the downstream route handler return 404
    }

    if (doc.projectId === '00000000-0000-0000-0000-000000000000') {
      return;
    }

    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return reply.status(401).send({ error: 'Unauthorized: Authorization header required to access this screenplay document' });
    }

    await authenticateToken(request, reply);
    if (reply.sent) return;

    if (request.user) {
      const { hasAccess, role } = await ResilientStore.checkProjectAccess(doc.projectId, request.user.id);
      if (!hasAccess) {
        return reply.status(403).send({ error: 'Forbidden: Access to this screenplay document is restricted to verified project members' });
      }
      request.userRole = role || 'reader';
    }
  };
}
