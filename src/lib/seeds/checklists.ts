import type {
  ChecklistKind,
  ChecklistTemplate,
  ChecklistTemplateItem,
  ChecklistTemplateSection
} from '$lib/types';

interface ItemSeed {
  id: string;
  title: string;
  description?: string;
  references?: string[];
}

interface SectionSeed {
  id: string;
  title: string;
  items: ItemSeed[];
}

interface TemplateSeed {
  id: string;
  name: string;
  kind: ChecklistKind;
  description: string;
  sections: SectionSeed[];
}

const templates: TemplateSeed[] = [
  {
    id: 'wstg-condensed',
    name: 'OWASP Web Security (condensed)',
    kind: 'web',
    description:
      'Condensed adaptation of the OWASP Web Security Testing Guide. Use as a per-target coverage map.',
    sections: [
      {
        id: 'recon',
        title: 'Information gathering',
        items: [
          { id: 'recon-fingerprint', title: 'Fingerprint web server, framework, and CDN' },
          { id: 'recon-robots', title: 'Review robots.txt, sitemap.xml, security.txt' },
          { id: 'recon-archive', title: 'Crawl archive.org / wayback for legacy endpoints' },
          { id: 'recon-subdomains', title: 'Enumerate subdomains and live hosts' },
          { id: 'recon-js', title: 'Pull endpoints/secrets from JS bundles' },
          { id: 'recon-leaks', title: 'Check GitHub / postman / pastebin for secrets' }
        ]
      },
      {
        id: 'config',
        title: 'Configuration & deployment',
        items: [
          { id: 'config-headers', title: 'Audit security headers (CSP, HSTS, X-Frame, X-CT)' },
          { id: 'config-cors', title: 'Test CORS policy with arbitrary Origin and credentials' },
          { id: 'config-tls', title: 'Test TLS configuration / cipher suites' },
          { id: 'config-default', title: 'Probe default credentials, debug endpoints, .env / .git' },
          { id: 'config-cloud', title: 'Search for exposed cloud buckets and metadata' }
        ]
      },
      {
        id: 'identity',
        title: 'Identity & authentication',
        items: [
          { id: 'auth-enum', title: 'Username enumeration via login / forgot-password / signup' },
          { id: 'auth-rate', title: 'Rate-limit on login, MFA, OTP, forgot-password' },
          { id: 'auth-mfa', title: 'MFA bypass via response tampering or skipped step' },
          { id: 'auth-default', title: 'Default and weak password policy check' },
          { id: 'auth-jwt', title: 'JWT none-alg, algorithm confusion, kid injection' },
          { id: 'auth-oauth', title: 'OAuth: state, redirect_uri, scope upgrade, code reuse' }
        ]
      },
      {
        id: 'session',
        title: 'Session management',
        items: [
          { id: 'sess-cookie', title: 'Cookie flags: HttpOnly, Secure, SameSite' },
          { id: 'sess-fixation', title: 'Session fixation on login' },
          { id: 'sess-rotation', title: 'Session ID rotation on auth state change' },
          { id: 'sess-logout', title: 'Logout invalidates session server-side' }
        ]
      },
      {
        id: 'authorization',
        title: 'Authorization',
        items: [
          { id: 'authz-idor', title: 'Object IDOR across user / org boundaries' },
          { id: 'authz-vertical', title: 'Vertical privilege escalation (user → admin)' },
          { id: 'authz-functional', title: 'Hidden / undocumented endpoints accessible to lower roles' },
          { id: 'authz-method', title: 'Authorization on uncommon HTTP methods' }
        ]
      },
      {
        id: 'input',
        title: 'Input validation',
        items: [
          { id: 'inp-xss-reflected', title: 'Reflected XSS' },
          { id: 'inp-xss-stored', title: 'Stored XSS' },
          { id: 'inp-xss-dom', title: 'DOM XSS in client sinks' },
          { id: 'inp-sqli', title: 'SQL injection (boolean, error, time, union)' },
          { id: 'inp-nosqli', title: 'NoSQL injection in JSON bodies' },
          { id: 'inp-ssti', title: 'SSTI smoke test ({{7*7}})' },
          { id: 'inp-cmd', title: 'Command injection in shell-bound parameters' },
          { id: 'inp-lfi', title: 'LFI / path traversal' },
          { id: 'inp-ssrf', title: 'SSRF in URL / webhook / image-fetch fields' },
          { id: 'inp-xxe', title: 'XXE in XML / SVG / DOCX uploads' },
          { id: 'inp-deserial', title: 'Insecure deserialization (Java/Python/Node)' },
          { id: 'inp-csrf', title: 'CSRF on state-changing endpoints' },
          { id: 'inp-redirect', title: 'Open redirect' }
        ]
      },
      {
        id: 'errors',
        title: 'Errors & cryptography',
        items: [
          { id: 'err-stack', title: 'Stack traces and verbose errors leaked' },
          { id: 'err-keys', title: 'API keys / secrets in responses' },
          { id: 'crypto-weak', title: 'Weak password hashing or crypto primitives' }
        ]
      },
      {
        id: 'logic',
        title: 'Business logic',
        items: [
          { id: 'logic-race', title: 'Race conditions on state changes (coupons, transfers)' },
          { id: 'logic-quantity', title: 'Negative or huge quantities accepted' },
          { id: 'logic-workflow', title: 'Skip steps in a multi-step workflow' },
          { id: 'logic-trust', title: 'Trust on client-side data (price, role, totals)' }
        ]
      },
      {
        id: 'client',
        title: 'Client-side',
        items: [
          { id: 'cli-postmsg', title: 'postMessage origin checks' },
          { id: 'cli-cors', title: 'Cross-origin resource sharing weaknesses' },
          { id: 'cli-clickjack', title: 'Clickjacking via missing X-Frame / CSP' },
          { id: 'cli-tabnabbing', title: 'Reverse tabnabbing on rel-less external links' }
        ]
      }
    ]
  },
  {
    id: 'api-top10-2023',
    name: 'OWASP API Top 10 (2023)',
    kind: 'api',
    description: 'Hit each API security category against the target. Use Burp + Postman + ffuf.',
    sections: [
      {
        id: 'api1-bola',
        title: 'API1: Broken Object Level Authorization',
        items: [
          { id: 'bola-id-swap', title: 'Swap object IDs across users' },
          { id: 'bola-uuid-leak', title: 'Find UUIDs in URLs / responses to enumerate' },
          { id: 'bola-nested', title: 'Test nested resources (/users/A/orders/B)' }
        ]
      },
      {
        id: 'api2-auth',
        title: 'API2: Broken Authentication',
        items: [
          { id: 'auth-token-rotation', title: 'Stolen/expired tokens still valid' },
          { id: 'auth-weak-jwt', title: 'JWT secret / algorithm confusion' },
          { id: 'auth-credential-stuffing', title: 'No rate limit on login' }
        ]
      },
      {
        id: 'api3-bopla',
        title: 'API3: Broken Object Property Level Authorization',
        items: [
          { id: 'bopla-mass-assign', title: 'Mass assignment on PATCH / PUT' },
          { id: 'bopla-extra-fields', title: 'Send admin-only fields in body' },
          { id: 'bopla-hidden-resp', title: 'Hidden fields in responses (PII leaks)' }
        ]
      },
      {
        id: 'api4-resources',
        title: 'API4: Unrestricted Resource Consumption',
        items: [
          { id: 'rate-spam', title: 'No / weak rate limit' },
          { id: 'rate-pagination', title: 'Pagination with huge limit' },
          { id: 'rate-recursive', title: 'Recursive GraphQL / nested queries' }
        ]
      },
      {
        id: 'api5-bfla',
        title: 'API5: Broken Function Level Authorization',
        items: [
          { id: 'bfla-admin', title: 'Admin endpoints reachable as user' },
          { id: 'bfla-method', title: 'Verbs other than GET (PUT/DELETE) unauthorized' }
        ]
      },
      {
        id: 'api6-flow',
        title: 'API6: Unrestricted Access to Sensitive Business Flows',
        items: [
          { id: 'flow-redeem', title: 'Replay redeem / claim flows' },
          { id: 'flow-purchase', title: 'Race scarce-inventory purchases' }
        ]
      },
      {
        id: 'api7-ssrf',
        title: 'API7: Server-Side Request Forgery',
        items: [
          { id: 'ssrf-import', title: 'URL-import endpoints' },
          { id: 'ssrf-webhook', title: 'Webhook configuration' },
          { id: 'ssrf-pdf', title: 'PDF / image generators' }
        ]
      },
      {
        id: 'api8-misconfig',
        title: 'API8: Security Misconfiguration',
        items: [
          { id: 'misconfig-cors', title: 'CORS allows credentials with wildcard' },
          { id: 'misconfig-debug', title: 'Debug / actuator endpoints exposed' },
          { id: 'misconfig-headers', title: 'Missing security headers' }
        ]
      },
      {
        id: 'api9-inventory',
        title: 'API9: Improper Inventory Management',
        items: [
          { id: 'inv-old-version', title: 'Old API versions still online' },
          { id: 'inv-staging', title: 'Staging / dev hosts in scope' }
        ]
      },
      {
        id: 'api10-consumption',
        title: 'API10: Unsafe Consumption of APIs',
        items: [
          { id: 'consume-third-party', title: 'Trust of third-party API responses (SSRF / RCE)' },
          { id: 'consume-tls', title: 'Outbound calls without TLS validation' }
        ]
      }
    ]
  },
  {
    id: 'mobile-top10',
    name: 'OWASP Mobile Top 10 (snapshot)',
    kind: 'mobile',
    description: 'Quick mobile coverage map. Use MobSF / Frida / Burp + AndroidWPA.',
    sections: [
      {
        id: 'mob-storage',
        title: 'Insecure storage',
        items: [
          { id: 'mob-storage-files', title: 'Sensitive data in /data/data, NSUserDefaults, plist' },
          { id: 'mob-storage-keystore', title: 'Keystore / Keychain misuse' },
          { id: 'mob-storage-logs', title: 'Sensitive data in logcat / system logs' }
        ]
      },
      {
        id: 'mob-comm',
        title: 'Insecure communication',
        items: [
          { id: 'mob-tls', title: 'TLS pinning bypassable' },
          { id: 'mob-cleartext', title: 'Cleartext HTTP traffic allowed' }
        ]
      },
      {
        id: 'mob-auth',
        title: 'Authentication / authorization',
        items: [
          { id: 'mob-auth-bypass', title: 'Local biometric or PIN bypass' },
          { id: 'mob-token-storage', title: 'Tokens stored insecurely' }
        ]
      },
      {
        id: 'mob-code',
        title: 'Code & platform',
        items: [
          { id: 'mob-deeplink', title: 'Exported activities / intents and deep-link issues' },
          { id: 'mob-webview', title: 'WebView with JS bridge / addJavascriptInterface' },
          { id: 'mob-tamper', title: 'Anti-tampering / root detection bypass' }
        ]
      },
      {
        id: 'mob-server',
        title: 'Mobile backend',
        items: [
          { id: 'mob-api', title: 'Run the OWASP API Top 10 against the mobile API' },
          { id: 'mob-otp', title: 'OTP / SMS rate limiting and reuse' }
        ]
      }
    ]
  }
];

const now = Date.now();

function buildItems(items: ItemSeed[]): ChecklistTemplateItem[] {
  return items.map((item) => ({
    id: item.id,
    title: item.title,
    description: item.description,
    references: item.references
  }));
}

function buildSections(sections: SectionSeed[]): ChecklistTemplateSection[] {
  return sections.map((section) => ({
    id: section.id,
    title: section.title,
    items: buildItems(section.items)
  }));
}

export const BUILT_IN_CHECKLIST_TEMPLATES: ChecklistTemplate[] = templates.map((template) => ({
  id: `bi-${template.id}`,
  name: template.name,
  kind: template.kind,
  description: template.description,
  sections: buildSections(template.sections),
  isBuiltIn: true,
  createdAt: now,
  updatedAt: now
}));

export const CHECKLIST_KIND_LABELS: Record<ChecklistKind, string> = {
  web: 'Web app',
  api: 'API',
  mobile: 'Mobile',
  cloud: 'Cloud',
  recon: 'Recon',
  custom: 'Custom'
};

export function totalChecklistItems(template: ChecklistTemplate): number {
  return template.sections.reduce((sum, section) => sum + section.items.length, 0);
}
