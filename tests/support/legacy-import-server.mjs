import { createServer } from 'vite';
import { fileURLToPath } from 'node:url';

// Test-only Vite root: no Astro build, application configuration, or service doubles.
const repository = fileURLToPath(new URL('../../', import.meta.url));
const server = await createServer({
    configFile: false,
    root: fileURLToPath(new URL('../fixtures/legacy-import/', import.meta.url)),
    server: { host: '127.0.0.1', port: 4323, strictPort: true, fs: { allow: [repository] } },
});
await server.listen();
async function stop() { await server.close(); process.exit(0); }
process.once('SIGTERM', stop);
process.once('SIGINT', stop);
