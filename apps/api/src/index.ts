import { buildServer } from './server';

const port = Number(process.env.PORT) || 3000;
const host = '0.0.0.0';

async function start() {
  const server = buildServer();
  try {
    await server.listen({ port, host });
    console.log(`Scripto API server running at http://${host}:${port}`);
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
}

start();
