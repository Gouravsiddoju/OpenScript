import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

import { authRoutes } from './routes/auth.routes';
import { projectRoutes } from './routes/projects.routes';
import { documentRoutes } from './routes/documents.routes';
import { reportRoutes } from './routes/reports.routes';

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

  return server;
}

