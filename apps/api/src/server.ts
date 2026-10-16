import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';

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
      service: 'scripto-api',
      timestamp: new Date().toISOString(),
    };
  });

  return server;
}
