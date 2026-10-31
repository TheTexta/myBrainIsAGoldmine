import type { APIRoute } from 'astro';

export const prerender = false;
// Preserve the old URL with an internal rewrite, not a client-side redirect.
export const GET: APIRoute = ({ rewrite }) => rewrite('/');
