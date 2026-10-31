import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

export interface PeerPresence {
  userId: string;
  displayName: string;
  color: string;
  role: 'owner' | 'co-writer' | 'commenter' | 'reader';
  activeBlockId?: string;
  cursorOffset?: number;
  isTyping: boolean;
  lastPing: number;
}

// In-memory room presence store: projectId -> Map<userId, PeerPresence>
const rooms = new Map<string, Map<string, PeerPresence>>();

const PRESENCE_TIMEOUT_MS = 15000;

function cleanupStalePeers(projectId: string) {
  const room = rooms.get(projectId);
  if (!room) return;
  const now = Date.now();
  for (const [userId, peer] of room.entries()) {
    if (now - peer.lastPing > PRESENCE_TIMEOUT_MS) {
      room.delete(userId);
    }
  }
}

const HeartbeatSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  color: z.string().default('#3b82f6'),
  role: z.enum(['owner', 'co-writer', 'commenter', 'reader']).default('co-writer'),
  activeBlockId: z.string().optional(),
  cursorOffset: z.number().int().optional(),
  isTyping: z.boolean().default(false),
});

export const collaborationRoutes: FastifyPluginAsync = async (server) => {
  // Get currently active presence for a project
  server.get<{ Params: { id: string } }>('/api/v1/projects/:id/presence', async (request, reply) => {
    const { id } = request.params;
    cleanupStalePeers(id);
    const room = rooms.get(id);
    const peers = room ? Array.from(room.values()) : [];
    return { peers, count: peers.length };
  });

  // Send presence heartbeat & return active peers
  server.post<{ Params: { id: string } }>('/api/v1/projects/:id/presence', async (request, reply) => {
    const { id } = request.params;
    const parseResult = HeartbeatSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { userId, displayName, color, role, activeBlockId, cursorOffset, isTyping } = parseResult.data;

    if (!rooms.has(id)) {
      rooms.set(id, new Map());
    }
    const room = rooms.get(id)!;

    room.set(userId, {
      userId,
      displayName,
      color,
      role,
      activeBlockId,
      cursorOffset,
      isTyping,
      lastPing: Date.now(),
    });

    cleanupStalePeers(id);
    const peers = Array.from(room.values());
    return { peers, count: peers.length };
  });

  // Leave room
  server.post<{ Params: { id: string }; Body: { userId: string } }>('/api/v1/projects/:id/presence/leave', async (request, reply) => {
    const { id } = request.params;
    const { userId } = request.body || {};
    if (userId && rooms.has(id)) {
      rooms.get(id)!.delete(userId);
    }
    return { success: true };
  });
};
