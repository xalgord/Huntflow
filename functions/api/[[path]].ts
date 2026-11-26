// Cloudflare Pages Function: every /api/* request lands here and is
// dispatched by the framework-free router in /server (unit-tested
// with an in-memory D1/R2). Static assets never invoke Functions —
// Pages only routes /api/* to this file.
import type { Env } from '../../server/env';
import { handleApiRequest } from '../../server/router';

export const onRequest: PagesFunction<Env> = (context) => handleApiRequest(context.request, context.env);
