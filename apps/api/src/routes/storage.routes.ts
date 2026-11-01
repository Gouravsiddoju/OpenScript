import { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { CloudStorageService } from '../services/cloudStorage.service';

const BackupPayloadSchema = z.object({
  projectId: z.string().min(1),
  filename: z.string().min(1),
  content: z.string(),
  contentType: z.string().optional().default('application/json'),
  metadata: z.record(z.string()).optional(),
});

export const storageRoutes: FastifyPluginAsync = async (server) => {
  // 1. Storage Status
  server.get('/api/v1/storage/status', {
    schema: {
      tags: ['Cloud Storage'],
      description: 'Get active cloud storage provider status (S3, Cloudflare R2, MinIO, or Local)',
    },
  }, async (_request, reply) => {
    const status = CloudStorageService.getStatus();
    return reply.send(status);
  });

  // 2. Upload / Save Backup
  server.post('/api/v1/storage/backup', {
    schema: {
      tags: ['Cloud Storage'],
      description: 'Upload screenplay backup or snapshot to cloud storage',
    },
  }, async (request, reply) => {
    const parseResult = BackupPayloadSchema.safeParse(request.body);
    if (!parseResult.success) {
      return reply.status(400).send({ error: 'Validation failed', details: parseResult.error.flatten() });
    }

    const { projectId, filename, content, contentType, metadata } = parseResult.data;
    try {
      const backupItem = await CloudStorageService.saveBackup(
        projectId,
        filename,
        content,
        contentType,
        metadata
      );
      return reply.status(201).send({ success: true, backup: backupItem });
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Failed to save cloud backup', message: err.message });
    }
  });

  // 3. List Backups for Project
  server.get('/api/v1/storage/backups/:projectId', {
    schema: {
      tags: ['Cloud Storage'],
      description: 'List all cloud backups for a specific screenplay project',
    },
  }, async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    try {
      const backups = await CloudStorageService.listBackups(projectId);
      return reply.send({ projectId, backups, count: backups.length });
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Failed to retrieve backups' });
    }
  });

  // 4. Download / Retrieve Backup Content
  server.get('/api/v1/storage/content/*', {
    schema: {
      tags: ['Cloud Storage'],
      description: 'Retrieve backup file contents by key',
    },
  }, async (request, reply) => {
    const key = (request.params as any)['*'] as string;
    if (!key) {
      return reply.status(400).send({ error: 'Storage key required' });
    }

    try {
      const content = await CloudStorageService.getBackupContent(key);
      if (!content) {
        return reply.status(404).send({ error: 'Backup not found' });
      }

      if (key.endsWith('.pdf')) {
        reply.header('Content-Type', 'application/pdf');
      } else if (key.endsWith('.fdx')) {
        reply.header('Content-Type', 'application/xml');
      } else if (key.endsWith('.fountain')) {
        reply.header('Content-Type', 'text/plain');
      } else {
        reply.header('Content-Type', 'application/json');
      }

      const basename = key.split('/').pop() || 'backup';
      reply.header('Content-Disposition', `attachment; filename="${basename}"`);
      return reply.send(content);
    } catch (err: any) {
      server.log.error(err);
      return reply.status(500).send({ error: 'Failed to download backup' });
    }
  });
};
