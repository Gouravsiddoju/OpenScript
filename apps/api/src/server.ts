import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

import { authRoutes } from './routes/auth.routes';
import { projectRoutes } from './routes/projects.routes';
import { documentRoutes } from './routes/documents.routes';
import { reportRoutes } from './routes/reports.routes';
import { collaboratorRoutes } from './routes/collaborators.routes';
import { noteRoutes } from './routes/notes.routes';
import { collaborationRoutes } from './routes/collaboration.routes';

export function buildServer() {
  const server = Fastify({
    logger: true,
  });

  server.register(cors, {
    origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
    credentials: true,
  });

  server.register(helmet, {
    contentSecurityPolicy: false,
  });

  // Root endpoint info
  server.get('/', async () => {
    return {
      service: 'OpenScript Studio API',
      version: '0.2.0',
      status: 'online',
      studioUiUrl: 'http://localhost:5173',
      endpoints: {
        health: '/api/v1/health',
        projects: '/api/v1/projects',
        documents: '/api/v1/documents/:id',
        notes: '/api/v1/documents/:id/notes',
        collaborators: '/api/v1/projects/:id/collaborators',
        presence: '/api/v1/projects/:id/presence',
      },
    };
  });

  // Health check endpoint
  server.get('/api/v1/health', async () => {
    return {
      status: 'ok',
      service: 'openscript-api',
      timestamp: new Date().toISOString(),
    };
  });

  // Register modular domain routes
  server.register(authRoutes);
  server.register(projectRoutes);
  server.register(documentRoutes);
  server.register(reportRoutes);
  server.register(collaboratorRoutes);
  server.register(noteRoutes);
  server.register(collaborationRoutes);

  return server;
}

