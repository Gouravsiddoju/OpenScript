import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';

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

  // Swagger OpenAPI Specification
  server.register(swagger, {
    openapi: {
      info: {
        title: 'OpenScript Studio API',
        description: 'Self-hosted screenplay writing & film pre-production studio API (Fastify, PostgreSQL, Drizzle)',
        version: '0.2.0',
      },
      servers: [
        { url: 'http://localhost:3000', description: 'Local Backend' },
        { url: 'https://dev-openscript.ssnpictures.in', description: 'Dev Staging Environment' },
        { url: 'https://openscript.ssnpictures.in', description: 'Production Environment' },
      ],
      tags: [
        { name: 'Health', description: 'Service health status' },
        { name: 'Projects', description: 'Screenplay project workspaces' },
        { name: 'Documents', description: 'Screenplay canonical AST & revisions' },
        { name: 'Notes', description: 'ScriptNotes & threaded feedback' },
        { name: 'Collaborators', description: 'Team sharing & granular role permissions' },
        { name: 'Presence', description: 'Real-time co-writing presence' },
        { name: 'Reports', description: 'DOOD scheduling, cast & location breakdowns' },
      ],
    },
  });

  // Interactive Swagger UI at /docs
  server.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
    },
    staticCSP: false,
  });

  // Alias /documentation to /docs
  server.get('/documentation', async (request, reply) => {
    return reply.redirect('/docs');
  });

  // Root discovery endpoint
  server.get('/', async () => {
    return {
      service: 'OpenScript Studio API',
      version: '0.2.0',
      status: 'online',
      swaggerUrl: 'http://localhost:3000/docs',
      studioUiUrl: 'http://localhost:5173',
      endpoints: {
        docs: '/docs',
        health: '/api/v1/health',
        projects: '/api/v1/projects',
        documents: '/api/v1/documents/:id',
        notes: '/api/v1/documents/:id/notes',
        collaborators: '/api/v1/projects/:id/collaborators',
        presence: '/api/v1/projects/:id/presence',
        castReport: '/api/v1/documents/:id/reports/speaking-cast',
        locationReport: '/api/v1/documents/:id/reports/locations',
      },
    };
  });

  // Health check endpoint
  server.get('/api/v1/health', {
    schema: {
      description: 'API health check endpoint',
      tags: ['Health'],
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            service: { type: 'string' },
            timestamp: { type: 'string' },
          },
        },
      },
    },
  }, async () => {
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
