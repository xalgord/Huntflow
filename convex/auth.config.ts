import type { AuthConfig } from 'convex/server';

function cleanEnvValue(value: string | undefined): string {
  return value?.replace(/\\n/g, '').trim() ?? '';
}

export default {
  providers: [
    {
      domain: cleanEnvValue(process.env.CLERK_JWT_ISSUER_DOMAIN),
      applicationID: 'convex'
    }
  ]
} satisfies AuthConfig;
