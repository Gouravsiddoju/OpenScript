import { buildServer } from './server';
import { createCollabServer } from './collab/server';

const port = Number(process.env.PORT) || 3000;
const host = '0.0.0.0';
const collabPort = Number(process.env.COLLAB_PORT) || 3002;

async function start() {
  const server = buildServer();
  try {
    const collabServer = createCollabServer(collabPort);

    // Attach Hocuspocus WebSocket upgrade handler to Fastify's HTTP server.
    // This allows clients to connect directly over standard HTTP/HTTPS ports (3000 in dev, 443 in production)
    // without requiring reverse proxy firewall changes for separate ports.
    server.server.on('upgrade', (request, socket, head) => {
      try {
        (collabServer as any).crossws.handleUpgrade(request, socket, head);
      } catch (err) {
        console.error('[CollabServer] WebSocket upgrade error:', err);
        socket.destroy();
      }
    });

    await server.listen({ port, host });
    console.log(`OpenScript API server running at http://${host}:${port}`);

    // Standalone fallback listener (for explicit collabPort connections)
    try {
      await collabServer.listen();
      console.log(`OpenScript Collaboration WebSocket server running at ws://${host}:${collabPort}`);
    } catch (collabErr) {
      console.warn('[CollabServer] Standalone port listen note:', collabErr);
    }
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
