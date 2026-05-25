import type { AuthConfig } from 'convex/server';

// Convex deployments must set FIREBASE_PROJECT_ID via:
//   npx convex env set FIREBASE_PROJECT_ID <id>
// The cutover playbook covers this. Failing loud here is intentional —
// silently falling back to an empty string would produce a malformed
// issuer domain (https://securetoken.google.com/) that rejects every
// Firebase ID token, which is much harder to diagnose than a startup error.
const rawProjectId = process.env.FIREBASE_PROJECT_ID;
const projectId = typeof rawProjectId === 'string' ? rawProjectId.trim() : '';

if (!projectId) {
	throw new Error(
		'FIREBASE_PROJECT_ID is not set on the Convex deployment. ' +
			'Run: npx convex env set FIREBASE_PROJECT_ID <firebase-project-id>'
	);
}

export default {
	providers: [
		{
			// Firebase issues ID tokens with iss = https://securetoken.google.com/<projectId>.
			// The trailing /<projectId> is part of the issuer URL — do not strip it.
			domain: `https://securetoken.google.com/${projectId}`,
			// Firebase sets aud = <projectId> on every ID token.
			applicationID: projectId
		}
	]
} satisfies AuthConfig;
