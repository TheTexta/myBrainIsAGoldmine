import { execFileSync, spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { setTimeout } from 'node:timers/promises';

// A disposable local container only: no connection strings, ports, volumes, or
// shared services. Never substitute the production database for this harness.
let container;
try {
    const context = process.env.DOCKER_CONTEXT ? [process.env.DOCKER_CONTEXT] : [];
    const endpoint = process.env.DOCKER_HOST && !context.length ? process.env.DOCKER_HOST :
        JSON.parse(execFileSync('docker', ['context', 'inspect', ...context, '--format', '{{json .Endpoints.docker.Host}}'], { encoding: 'utf8' }));
    if (!endpoint.startsWith('unix://')) throw new Error('Database tests require a local Docker Unix socket; remote Docker targets are refused.');
    container = execFileSync('docker', ['run', '--detach', '--rm', '--network', 'none',
        '--tmpfs', '/var/lib/postgresql/data', '-e', 'POSTGRES_HOST_AUTH_METHOD=trust', 'postgres:17-alpine'], { encoding: 'utf8' }).trim();
    let ready = false;
    for (let attempt = 0; attempt < 80; attempt++) {
        // The image's initialization-only server accepts Unix sockets before it
        // restarts. TCP inside the isolated container identifies the final server.
        if (spawnSync('docker', ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'], { stdio: 'ignore' }).status === 0) { ready = true; break; }
        await setTimeout(250);
    }
    if (!ready) throw new Error('Isolated PostgreSQL did not start.');
    const bootstrap = `
        create role anon; create role authenticated; create role service_role bypassrls;
        create schema auth;
        create table auth.users(id uuid primary key);
        create function auth.uid() returns uuid language sql stable as
            $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
        grant usage on schema auth to anon, authenticated, service_role;
        grant execute on function auth.uid() to anon, authenticated, service_role;
    `;
    const migration = readFileSync(new URL('../supabase/migrations/202610300001_mybrain_publishing.sql', import.meta.url), 'utf8');
    const tests = readFileSync(new URL('../tests/db/publishing.sql', import.meta.url), 'utf8');
    execFileSync('docker', ['exec', '-i', container, 'psql', '-h', '127.0.0.1', '-U', 'postgres', '-v', 'ON_ERROR_STOP=1'], {
        input: `${bootstrap}\n${migration}\n${tests}`, stdio: ['pipe', 'inherit', 'inherit'],
    });
    console.log('Isolated database authorization and publication checks passed.');
} finally {
    if (container && /^[a-f0-9]{64}$/.test(container)) execFileSync('docker', ['rm', '--force', container], { stdio: 'ignore' });
}
