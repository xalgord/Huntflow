/**
 * HuntFlow cloud API router (Cloudflare Pages Functions).
 *
 *   GET    /api/health              service + binding status (no secrets)
 *   GET    /api/me                  { uid, email, isPro, currentPeriodEnd }
 *   GET    /api/sync/changes        change feed page after ?cursor=
 *   POST   /api/sync/push           last-writer-wins upsert (Pro)
 *   POST   /api/sync/clear          wipe the caller's cloud copy
 *   PUT    /api/assets/:assetId     upload evidence file (Pro)
 *   GET    /api/assets/:assetId     download evidence file
 *   DELETE /api/assets/:assetId     delete evidence file
 *   POST   /api/billing/checkout    Dodo hosted checkout link
 *   POST   /api/billing/portal      Dodo customer portal link
 *   POST   /api/webhooks/dodo       Dodo subscription webhook
 *   POST   /api/contact             landing-page contact form
 */
import { handleAssetDelete, handleAssetDownload, handleAssetUpload } from './assets';
import { requireUser } from './auth';
import { handleCheckout, handleDodoWebhook, handlePortal } from './billing';
import { handleContact } from './contact';
import { getEntitlement } from './entitlements';
import { envValue, type Env } from './env';
import { HttpError, corsHeaders, errorResponse, json, withHeaders } from './http';
import { clearCloud, handleChanges, handlePush } from './sync';

function methodNotAllowed(allowed: string): never {
  throw new HttpError(405, 'method_not_allowed', `Use ${allowed} for this endpoint.`);
}

async function route(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  if (path === '/api/health') {
    if (method !== 'GET') methodNotAllowed('GET');
    let database = false;
    try {
      await env.DB.prepare('SELECT 1').first();
      database = true;
    } catch {
      database = false;
    }
    return json({
      ok: database,
      services: {
        database,
        storage: Boolean(env.EVIDENCE),
        auth: Boolean(envValue(env, 'FIREBASE_PROJECT_ID')),
        billing: Boolean(envValue(env, 'DODO_API_KEY') && envValue(env, 'DODO_PRO_PRODUCT_ID')),
        webhooks: Boolean(envValue(env, 'DODO_WEBHOOK_SIGNING_SECRET')),
        contact: Boolean(envValue(env, 'RESEND_API_KEY'))
      }
    });
  }

  if (path === '/api/webhooks/dodo') {
    if (method !== 'POST') methodNotAllowed('POST');
    return handleDodoWebhook(request, env);
  }

  if (path === '/api/contact') {
    if (method !== 'POST') methodNotAllowed('POST');
    return handleContact(request, env);
  }

  if (path === '/api/me') {
    if (method !== 'GET') methodNotAllowed('GET');
    const user = await requireUser(request, env);
    const row = await getEntitlement(env.DB, user.uid);
    return json({
      uid: user.uid,
      email: user.email,
      isPro: row?.is_pro === 1,
      currentPeriodEnd: row?.current_period_end ?? null
    });
  }

  if (path === '/api/sync/changes') {
    if (method !== 'GET') methodNotAllowed('GET');
    return handleChanges(url, env.DB, await requireUser(request, env));
  }

  if (path === '/api/sync/push') {
    if (method !== 'POST') methodNotAllowed('POST');
    return handlePush(request, env.DB, await requireUser(request, env));
  }

  if (path === '/api/sync/clear') {
    if (method !== 'POST') methodNotAllowed('POST');
    return json(await clearCloud(env.DB, env.EVIDENCE, await requireUser(request, env)));
  }

  const asset = /^\/api\/assets\/([^/]+)$/.exec(path);
  if (asset) {
    const user = await requireUser(request, env);
    if (method === 'PUT') return handleAssetUpload(request, asset[1], env.DB, env.EVIDENCE, user);
    if (method === 'GET') return handleAssetDownload(asset[1], env.DB, env.EVIDENCE, user);
    if (method === 'DELETE') return handleAssetDelete(asset[1], env.DB, env.EVIDENCE, user);
    methodNotAllowed('PUT, GET or DELETE');
  }

  if (path === '/api/billing/checkout') {
    if (method !== 'POST') methodNotAllowed('POST');
    return handleCheckout(request, env, await requireUser(request, env));
  }

  if (path === '/api/billing/portal') {
    if (method !== 'POST') methodNotAllowed('POST');
    return handlePortal(env, await requireUser(request, env));
  }

  throw new HttpError(404, 'not_found', 'No such API endpoint.');
}

export async function handleApiRequest(request: Request, env: Env): Promise<Response> {
  const cors = corsHeaders(request);
  // Pages' _headers file only covers static assets; API responses get
  // their hardening headers here.
  cors.set('x-content-type-options', 'nosniff');
  cors.set('strict-transport-security', 'max-age=63072000; includeSubDomains');
  if (request.method.toUpperCase() === 'OPTIONS') {
    return new Response(null, { status: 204, headers: cors });
  }
  let response: Response;
  try {
    response = await route(request, env);
  } catch (error) {
    response = errorResponse(error);
  }
  return withHeaders(response, cors);
}
