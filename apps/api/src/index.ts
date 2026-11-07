import { buildServer } from './server';
import { createCollabServer } from './collab/server';

const port = Number(process.env.PORT) || 3000;
const host = '0.0.0.0';
const collabPort = Number(process.env.COLLAB_PORT) || 3002;

async function start() {
  const server = buildServer();
  try {
    await server.listen({ port, host });
    console.log(`OpenScript API server running at http://${host}:${port}`);

    const collabServer = createCollabServer(collabPort);
    await collabServer.listen();
    console.log(`OpenScript Collaboration WebSocket server running at ws://${host}:${collabPort}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
