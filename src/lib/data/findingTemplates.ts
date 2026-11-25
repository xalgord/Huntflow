/**
 * Built-in finding templates — a vulnerability knowledge base the hunter
 * starts a write-up from, like the finding libraries in pentest reporting
 * tools. Each template carries the classification triage teams expect
 * (CWE, a typical CVSS 3.1 vector, the Bugcrowd VRT category) plus a
 * professional scaffold for every report section.
 *
 * Placeholders use ‹angle quotes› so they're easy to spot and replace.
 * Content describes impact and fixes; it intentionally contains no
 * weaponised payloads.
 */
import type { PayoutSeverity } from '$lib/types';

export interface FindingTemplate {
  id: string;
  name: string;
  /** Short label stored on the finding (`vulnerabilityType`). */
  vulnerabilityType: string;
  category: 'Access control' | 'Injection' | 'Client-side' | 'Authentication' | 'Server-side' | 'Logic' | 'Exposure' | 'Configuration';
  cweId?: string;
  severity: PayoutSeverity;
  cvssVector?: string;
  /** Bugcrowd Vulnerability Rating Taxonomy path. */
  vrt?: string;
  keywords: string[];
  summary: string;
  stepsToReproduce: string;
  impact: string;
  remediation: string;
  references: string[];
}

const steps = (...lines: string[]) => lines.map((line, index) => `${index + 1}. ${line}`).join('\n');

export const FINDING_TEMPLATES: FindingTemplate[] = [
  {
    id: 'idor',
    name: 'Insecure Direct Object Reference (IDOR)',
    vulnerabilityType: 'IDOR',
    category: 'Access control',
    cweId: 'CWE-639',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:L/A:N',
    vrt: 'Broken Access Control (BAC) > Insecure Direct Object References (IDOR)',
    keywords: ['idor', 'bola', 'object', 'authorization', 'access control', 'id'],
    summary:
      'The ‹endpoint› endpoint returns or modifies a ‹resource› identified by a user-supplied ID without checking that it belongs to the authenticated user. By changing the ID, one account can ‹read/modify› another account\'s ‹resource›.',
    stepsToReproduce: steps(
      'Create two test accounts, **A** (attacker) and **B** (victim), and note B\'s ‹resource› ID.',
      'Sign in as A and send the following request, replacing the ID with B\'s:',
      '```http\n‹paste request›\n```',
      'Observe that the response contains B\'s ‹resource› (or that B\'s data is changed).'
    ),
    impact:
      'Any authenticated user can access ‹data type› belonging to other users. IDs are ‹sequential / guessable / leaked in X›, so an attacker could enumerate ‹N› accounts and ‹describe concrete consequence›.',
    remediation:
      'Enforce object-level authorization on every request: look up the ‹resource› by both its ID and the current user (or tenant), and return 404 when they don\'t match. Avoid relying on unguessable IDs as the only control.',
    references: [
      'https://owasp.org/API-Security/editions/2023/en/0xa1-broken-object-level-authorization/',
      'https://cwe.mitre.org/data/definitions/639.html',
      'https://portswigger.net/web-security/access-control/idor'
    ]
  },
  {
    id: 'stored-xss',
    name: 'Stored Cross-Site Scripting (XSS)',
    vulnerabilityType: 'Stored XSS',
    category: 'Client-side',
    cweId: 'CWE-79',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:R/S:C/C:L/I:L/A:N',
    vrt: 'Cross-Site Scripting (XSS) > Stored > Non-Privileged User to Anyone',
    keywords: ['xss', 'stored', 'persistent', 'script', 'html injection'],
    summary:
      'User-controlled input saved through ‹feature› is rendered in ‹page› without output encoding, so JavaScript supplied by one user executes in the browser of anyone who views it.',
    stepsToReproduce: steps(
      'Sign in as a low-privileged user and open ‹feature›.',
      'Save the following benign proof value in the ‹field› field: `‹proof value›`.',
      'As a second user, open ‹page›.',
      'Observe the script executes in the second user\'s session (see screenshot).'
    ),
    impact:
      'Script runs in the context of ‹domain› for every viewer, including ‹admins/support staff›. An attacker could perform actions as the victim, read data shown on the page, or ‹describe realistic consequence›. ‹Note relevant cookie flags / CSP›.',
    remediation:
      'Encode output for the context it is rendered in (HTML body, attribute, URL, JavaScript). Prefer framework auto-escaping, sanitise any rich text with a vetted allow-list sanitiser, and add a restrictive Content-Security-Policy as defence in depth.',
    references: [
      'https://owasp.org/www-community/attacks/xss/',
      'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html',
      'https://portswigger.net/web-security/cross-site-scripting/stored'
    ]
  },
  {
    id: 'reflected-xss',
    name: 'Reflected Cross-Site Scripting (XSS)',
    vulnerabilityType: 'Reflected XSS',
    category: 'Client-side',
    cweId: 'CWE-79',
    severity: 'medium',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N',
    vrt: 'Cross-Site Scripting (XSS) > Reflected > Non-Self',
    keywords: ['xss', 'reflected', 'script', 'parameter'],
    summary:
      'The ‹parameter› parameter on ‹URL› is reflected into the response without encoding, allowing a crafted link to execute JavaScript in the victim\'s browser.',
    stepsToReproduce: steps(
      'Open the following URL in a browser where you are signed in: `‹crafted URL›`.',
      'Observe the injected script executes (benign `alert(document.domain)` proof).'
    ),
    impact:
      'An attacker who gets a user to open a link can run script as that user on ‹domain›: performing actions on their behalf or reading data displayed to them.',
    remediation:
      'Encode the parameter for its output context and validate it against the expected format. Add a Content-Security-Policy that disallows inline script.',
    references: [
      'https://portswigger.net/web-security/cross-site-scripting/reflected',
      'https://cheatsheetseries.owasp.org/cheatsheets/Cross_Site_Scripting_Prevention_Cheat_Sheet.html'
    ]
  },
  {
    id: 'dom-xss',
    name: 'DOM-based Cross-Site Scripting',
    vulnerabilityType: 'DOM XSS',
    category: 'Client-side',
    cweId: 'CWE-79',
    severity: 'medium',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N',
    vrt: 'Cross-Site Scripting (XSS) > DOM-Based',
    keywords: ['xss', 'dom', 'innerhtml', 'postmessage', 'location.hash', 'sink'],
    summary:
      'Client-side code in ‹file.js› reads ‹source, e.g. location.hash / postMessage data› and writes it to ‹sink, e.g. innerHTML› without sanitisation.',
    stepsToReproduce: steps(
      'Open `‹crafted URL›`.',
      'Observe the value flows from ‹source› into ‹sink› (see the highlighted code below) and the script executes.',
      '```js\n‹relevant code snippet›\n```'
    ),
    impact: 'A crafted link runs script in the victim\'s session on ‹domain›.',
    remediation:
      'Avoid dangerous sinks (`innerHTML`, `document.write`, `eval`). Use `textContent` or a sanitiser such as DOMPurify, and validate the origin of postMessage events.',
    references: ['https://portswigger.net/web-security/cross-site-scripting/dom-based']
  },
  {
    id: 'sqli',
    name: 'SQL Injection',
    vulnerabilityType: 'SQL Injection',
    category: 'Injection',
    cweId: 'CWE-89',
    severity: 'critical',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    vrt: 'Server-Side Injection > SQL Injection',
    keywords: ['sqli', 'sql', 'injection', 'database', 'query'],
    summary:
      'The ‹parameter› parameter of ‹endpoint› is concatenated into a SQL query. Supplying SQL syntax changes the query\'s behaviour, confirmed via ‹error / boolean / time-based› testing.',
    stepsToReproduce: steps(
      'Send the baseline request and note the response:',
      '```http\n‹baseline request›\n```',
      'Send the same request with the validation payload `‹benign payload›` and observe ‹difference: error text / response change / delay›.',
      'Testing was stopped at confirmation; no data beyond ‹version string / current user› was retrieved.'
    ),
    impact:
      'An unauthenticated attacker can run arbitrary queries against the ‹DBMS› database, exposing ‹tables/data types› and potentially modifying or deleting data.',
    remediation:
      'Use parameterised queries / prepared statements for every query. Avoid building SQL with string concatenation, apply least privilege to the database account, and validate input types.',
    references: [
      'https://owasp.org/www-community/attacks/SQL_Injection',
      'https://cheatsheetseries.owasp.org/cheatsheets/SQL_Injection_Prevention_Cheat_Sheet.html',
      'https://portswigger.net/web-security/sql-injection'
    ]
  },
  {
    id: 'ssrf',
    name: 'Server-Side Request Forgery (SSRF)',
    vulnerabilityType: 'SSRF',
    category: 'Server-side',
    cweId: 'CWE-918',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:C/C:H/I:N/A:N',
    vrt: 'Server-Side Request Forgery (SSRF) > Internal High Impact',
    keywords: ['ssrf', 'url', 'fetch', 'webhook', 'metadata', 'callback'],
    summary:
      'The ‹feature› feature fetches a user-supplied URL from the server side without restricting the destination, so the server can be made to request internal or cloud-metadata addresses.',
    stepsToReproduce: steps(
      'Point ‹parameter› at an out-of-band listener you control (`‹collaborator URL›`) and observe the inbound request from ‹server IP›.',
      'Replace the URL with `‹internal address›` and observe ‹response content / timing difference›.'
    ),
    impact:
      'An attacker can reach internal services that are not exposed to the internet (‹examples›). ‹If confirmed: access to cloud metadata could expose temporary credentials›.',
    remediation:
      'Allow-list destinations; resolve and validate the final IP (block private, loopback and link-local ranges, including after redirects); disable unused URL schemes; require IMDSv2 on cloud instances.',
    references: [
      'https://owasp.org/www-community/attacks/Server_Side_Request_Forgery',
      'https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html',
      'https://portswigger.net/web-security/ssrf'
    ]
  },
  {
    id: 'ato-reset',
    name: 'Account Takeover via Password Reset',
    vulnerabilityType: 'Account Takeover',
    category: 'Authentication',
    cweId: 'CWE-640',
    severity: 'critical',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
    vrt: 'Broken Authentication and Session Management > Failure to Invalidate Session',
    keywords: ['ato', 'account takeover', 'password reset', 'token', 'host header'],
    summary:
      'The password reset flow ‹describe the flaw: e.g. trusts the Host header when building the link / leaks the token / accepts a reused token›, allowing an attacker to reset another user\'s password.',
    stepsToReproduce: steps(
      'Request a password reset for the victim test account `‹victim email›`.',
      '‹Manipulate / obtain the token as described›.',
      'Use the token to set a new password and sign in as the victim.'
    ),
    impact:
      'Full takeover of any account whose email address is known, without user interaction, including ‹admin / paid› accounts.',
    remediation:
      'Generate reset links from a fixed, server-side base URL; make tokens single-use, short-lived and bound to the account; invalidate existing sessions after a reset.',
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/Forgot_Password_Cheat_Sheet.html']
  },
  {
    id: 'auth-bypass',
    name: 'Authentication Bypass',
    vulnerabilityType: 'Authentication Bypass',
    category: 'Authentication',
    cweId: 'CWE-287',
    severity: 'critical',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
    vrt: 'Broken Authentication and Session Management > Authentication Bypass',
    keywords: ['auth', 'bypass', 'login', 'mfa', '2fa', 'session'],
    summary: '‹Protected function› can be reached without valid authentication by ‹technique›.',
    stepsToReproduce: steps('Start logged out (or as ‹lower role›).', 'Send:\n```http\n‹request›\n```', 'Observe access to ‹protected data/function›.'),
    impact: 'Unauthenticated access to ‹what›, affecting ‹which users›.',
    remediation: 'Enforce authentication server-side on every protected route and action; never rely on client-side checks or optional parameters.',
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html']
  },
  {
    id: 'privilege-escalation',
    name: 'Privilege Escalation / Broken Function-Level Authorization',
    vulnerabilityType: 'Privilege Escalation',
    category: 'Access control',
    cweId: 'CWE-285',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N',
    vrt: 'Broken Access Control (BAC) > Privilege Escalation',
    keywords: ['privilege', 'escalation', 'role', 'admin', 'bfla', 'function level'],
    summary: 'A ‹low-privileged role› can call ‹admin-only function› because the endpoint does not check the caller\'s role.',
    stepsToReproduce: steps(
      'Sign in as a ‹low-privileged role› user.',
      'Send the request normally issued by an admin:\n```http\n‹request›\n```',
      'Observe it succeeds (‹evidence›).'
    ),
    impact: 'Any ‹role› can perform ‹admin action›, e.g. ‹concrete consequence›.',
    remediation: 'Centralise authorization checks and deny by default; verify the caller\'s role for every privileged operation on the server.',
    references: ['https://owasp.org/API-Security/editions/2023/en/0xa5-broken-function-level-authorization/']
  },
  {
    id: 'mass-assignment',
    name: 'Mass Assignment',
    vulnerabilityType: 'Mass Assignment',
    category: 'Access control',
    cweId: 'CWE-915',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N',
    vrt: 'Broken Access Control (BAC) > Privilege Escalation',
    keywords: ['mass assignment', 'role', 'json', 'property', 'overposting'],
    summary: 'The ‹endpoint› endpoint binds request properties directly to the ‹model›, so a user can set protected fields such as `‹field›`.',
    stepsToReproduce: steps('Send the normal update request.', 'Add `"‹field›": ‹value›` to the JSON body.', 'Observe the protected field changes (‹evidence›).'),
    impact: 'Users can grant themselves ‹role / plan / verified status›.',
    remediation: 'Allow-list the properties each endpoint may update (DTOs / explicit bindings); never bind request bodies to persistence models directly.',
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/Mass_Assignment_Cheat_Sheet.html']
  },
  {
    id: 'csrf',
    name: 'Cross-Site Request Forgery (CSRF)',
    vulnerabilityType: 'CSRF',
    category: 'Client-side',
    cweId: 'CWE-352',
    severity: 'medium',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:H/A:N',
    vrt: 'Cross-Site Request Forgery (CSRF) > Application-Wide',
    keywords: ['csrf', 'xsrf', 'samesite', 'state-changing'],
    summary: 'The state-changing ‹action› request has no CSRF protection, so a third-party page can perform it on behalf of a signed-in user.',
    stepsToReproduce: steps('While signed in, open the following HTML from another origin:', '```html\n‹auto-submitting form›\n```', 'Observe ‹action› is performed on the account.'),
    impact: 'An attacker can make victims ‹change email / settings / perform action› by visiting a page.',
    remediation: 'Require an anti-CSRF token on state-changing requests, set `SameSite=Lax` or `Strict` session cookies, and verify Origin/Referer.',
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/Cross-Site_Request_Forgery_Prevention_Cheat_Sheet.html']
  },
  {
    id: 'open-redirect',
    name: 'Open Redirect',
    vulnerabilityType: 'Open Redirect',
    category: 'Client-side',
    cweId: 'CWE-601',
    severity: 'low',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:N/I:L/A:N',
    vrt: 'Unvalidated Redirects and Forwards > Open Redirect > GET-Based',
    keywords: ['redirect', 'open redirect', 'returnurl', 'next'],
    summary: 'The ‹parameter› parameter on ‹URL› redirects to arbitrary external sites.',
    stepsToReproduce: steps('Open `‹crafted URL›`.', 'Observe the browser is redirected to `‹external domain›`.'),
    impact: 'Enables convincing phishing links on ‹domain›. ‹If chained with OAuth: token theft›.',
    remediation: 'Redirect only to relative paths or an allow-list of destinations; reject absolute and protocol-relative URLs.',
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/Unvalidated_Redirects_and_Forwards_Cheat_Sheet.html']
  },
  {
    id: 'subdomain-takeover',
    name: 'Subdomain Takeover',
    vulnerabilityType: 'Subdomain Takeover',
    category: 'Configuration',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:C/C:L/I:L/A:N',
    vrt: 'Server Security Misconfiguration > Misconfigured DNS > High Impact Subdomain Takeover',
    keywords: ['subdomain', 'takeover', 'dns', 'cname', 'dangling'],
    summary: '`‹subdomain›` has a CNAME to `‹service host›`, but the ‹service› resource no longer exists, so anyone can claim it and serve content on the subdomain.',
    stepsToReproduce: steps('`dig CNAME ‹subdomain›` shows `‹target›`.', 'The target returns the ‹service› "not found" page.', 'Claimed the resource and served a harmless proof file at `‹URL›` (removed after reporting).'),
    impact: 'Content can be served under ‹domain›: phishing, ‹cookie scope / CSP / OAuth redirect implications›.',
    remediation: 'Remove dangling DNS records, monitor for records pointing at deprovisioned resources, and decommission DNS before cloud resources.',
    references: ['https://github.com/EdOverflow/can-i-take-over-xyz', 'https://developer.mozilla.org/en-US/docs/Web/Security/Subdomain_takeovers']
  },
  {
    id: 'info-disclosure',
    name: 'Sensitive Information Disclosure',
    vulnerabilityType: 'Information Disclosure',
    category: 'Exposure',
    cweId: 'CWE-200',
    severity: 'medium',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N',
    vrt: 'Sensitive Data Exposure > Disclosure of Secrets',
    keywords: ['information disclosure', 'leak', 'pii', 'debug', 'stack trace', 'exposure'],
    summary: '‹Endpoint / file› exposes ‹what data›, which should not be accessible to ‹audience›.',
    stepsToReproduce: steps('Request `‹URL›`.', 'Observe the response contains ‹data› (redacted in the attached screenshot).'),
    impact: '‹Describe what an attacker can do with the data — be concrete and avoid overclaiming›.',
    remediation: 'Remove the data from the response, restrict access, and disable verbose errors / debug endpoints in production.',
    references: ['https://cwe.mitre.org/data/definitions/200.html']
  },
  {
    id: 'exposed-secret',
    name: 'Exposed API Key or Credential',
    vulnerabilityType: 'Exposed Secret',
    category: 'Exposure',
    cweId: 'CWE-798',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:L/A:N',
    vrt: 'Sensitive Data Exposure > Disclosure of Secrets > For Publicly Accessible Asset',
    keywords: ['api key', 'secret', 'token', 'credential', 'aws', 'github', 'leak', 'javascript'],
    summary: 'A valid ‹service› credential is exposed in ‹location: JS bundle / public repo / mobile app›.',
    stepsToReproduce: steps('Open `‹location›` and find `‹redacted key prefix›…`.', 'Confirm validity with a read-only call: `‹harmless verification request›` (no data accessed beyond confirming the key works).'),
    impact: 'The key grants ‹permissions› on ‹service›, which could allow ‹consequence›.',
    remediation: 'Revoke and rotate the credential, remove it from the source, move secrets server-side, and add secret scanning to CI.',
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html']
  },
  {
    id: 'xxe',
    name: 'XML External Entity (XXE) Injection',
    vulnerabilityType: 'XXE',
    category: 'Injection',
    cweId: 'CWE-611',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:L',
    vrt: 'Server-Side Injection > XML External Entity Injection (XXE)',
    keywords: ['xxe', 'xml', 'entity', 'dtd', 'svg', 'docx'],
    summary: 'The XML parser used by ‹endpoint / upload› resolves external entities.',
    stepsToReproduce: steps('Submit an XML document that defines an external entity pointing at an out-of-band listener.', 'Observe the server fetches ‹collaborator URL›.'),
    impact: 'Reading local files, SSRF to internal hosts, or denial of service.',
    remediation: 'Disable DTDs and external entity resolution in the XML parser configuration.',
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html']
  },
  {
    id: 'ssti',
    name: 'Server-Side Template Injection (SSTI)',
    vulnerabilityType: 'SSTI',
    category: 'Injection',
    cweId: 'CWE-1336',
    severity: 'critical',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:H',
    vrt: 'Server-Side Injection > Remote Code Execution (RCE)',
    keywords: ['ssti', 'template', 'jinja', 'twig', 'freemarker'],
    summary: 'User input in ‹field› is evaluated by the ‹engine› template engine.',
    stepsToReproduce: steps('Set ‹field› to an arithmetic expression such as `‹engine-specific expression›`.', 'Observe the evaluated result in ‹location›.'),
    impact: 'Template evaluation typically leads to remote code execution on the server.',
    remediation: 'Never render user input as a template; pass it as data. Use a sandboxed / logic-less engine where templates must be user-editable.',
    references: ['https://portswigger.net/web-security/server-side-template-injection']
  },
  {
    id: 'command-injection',
    name: 'OS Command Injection',
    vulnerabilityType: 'Command Injection',
    category: 'Injection',
    cweId: 'CWE-78',
    severity: 'critical',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:H',
    vrt: 'Server-Side Injection > Remote Code Execution (RCE)',
    keywords: ['rce', 'command injection', 'shell', 'exec'],
    summary: '‹Parameter› is passed to a shell command, allowing additional commands to run.',
    stepsToReproduce: steps('Send ‹request› with ‹benign time-delay / OOB-DNS proof›.', 'Observe ‹delay / DNS interaction›.'),
    impact: 'Arbitrary command execution on ‹host› as ‹user›.',
    remediation: 'Avoid shelling out; use language APIs with argument arrays, never string-built commands; validate input against strict allow-lists.',
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/OS_Command_Injection_Defense_Cheat_Sheet.html']
  },
  {
    id: 'path-traversal',
    name: 'Path Traversal / Local File Read',
    vulnerabilityType: 'Path Traversal',
    category: 'Server-side',
    cweId: 'CWE-22',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:N/A:N',
    vrt: 'Server Security Misconfiguration > Path Traversal',
    keywords: ['lfi', 'path traversal', 'directory traversal', 'file read'],
    summary: 'The ‹parameter› parameter is used to build a file path without normalisation, so files outside ‹directory› can be read.',
    stepsToReproduce: steps('Request `‹URL with traversal sequence›`.', 'Observe the contents of ‹harmless file such as /etc/hostname›.'),
    impact: 'Reading ‹config files / source / secrets› from the server.',
    remediation: 'Map user input to an allow-list of files or IDs; canonicalise paths and verify they stay within the intended base directory.',
    references: ['https://portswigger.net/web-security/file-path-traversal']
  },
  {
    id: 'file-upload',
    name: 'Unrestricted File Upload',
    vulnerabilityType: 'File Upload',
    category: 'Server-side',
    cweId: 'CWE-434',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:H/A:N',
    vrt: 'Server-Side Injection > File Inclusion',
    keywords: ['upload', 'file', 'extension', 'content-type', 'svg', 'webshell'],
    summary: '‹Upload feature› accepts ‹dangerous type› and serves it from ‹location› ‹as executable / same-origin›.',
    stepsToReproduce: steps('Upload `‹harmless proof file›` via ‹feature›.', 'Open ‹URL› and observe ‹execution / same-origin rendering›.'),
    impact: '‹Stored XSS on the main origin / server-side execution›.',
    remediation: 'Validate type by content, store uploads outside the web root or on a separate sandbox domain, set `Content-Disposition: attachment` and `X-Content-Type-Options: nosniff`.',
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html']
  },
  {
    id: 'business-logic',
    name: 'Business Logic Flaw',
    vulnerabilityType: 'Business Logic',
    category: 'Logic',
    cweId: 'CWE-840',
    severity: 'medium',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:N/I:H/A:N',
    vrt: 'Broken Access Control (BAC) > Bypass of Business Logic',
    keywords: ['logic', 'business', 'coupon', 'price', 'workflow', 'payment'],
    summary: '‹Feature› assumes ‹intended rule›, but ‹actual behaviour› lets a user ‹outcome›.',
    stepsToReproduce: steps('‹Step›', '‹Step›', 'Observe ‹outcome› (screenshots attached).'),
    impact: '‹Financial / fairness / data impact with a concrete number where possible›.',
    remediation: 'Enforce the business rule server-side at the point the state changes; ‹specific suggestion›.',
    references: ['https://portswigger.net/web-security/logic-flaws']
  },
  {
    id: 'race-condition',
    name: 'Race Condition',
    vulnerabilityType: 'Race Condition',
    category: 'Logic',
    cweId: 'CWE-362',
    severity: 'medium',
    cvssVector: 'CVSS:3.1/AV:N/AC:H/PR:L/UI:N/S:U/C:N/I:H/A:N',
    vrt: 'Application-Level Denial-of-Service (DoS) > Race Condition',
    keywords: ['race', 'concurrency', 'limit overrun', 'single packet', 'toctou'],
    summary: 'Concurrent requests to ‹endpoint› bypass the ‹limit/check›, letting a single-use ‹resource› be used ‹N› times.',
    stepsToReproduce: steps('Prepare ‹N› identical requests to ‹endpoint›.', 'Send them in parallel (single-packet attack).', 'Observe ‹count› successes where only one should succeed.'),
    impact: '‹Concrete effect, e.g. coupon applied 5 times, balance credited twice›.',
    remediation: 'Make the check-and-update atomic (database constraints, row locks, or idempotency keys).',
    references: ['https://portswigger.net/web-security/race-conditions']
  },
  {
    id: 'jwt',
    name: 'JWT Validation Weakness',
    vulnerabilityType: 'JWT',
    category: 'Authentication',
    cweId: 'CWE-347',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:H/I:H/A:N',
    vrt: 'Broken Authentication and Session Management > Weak Login Function',
    keywords: ['jwt', 'token', 'alg none', 'signature', 'hs256', 'kid'],
    summary: 'The API accepts JSON Web Tokens ‹without a valid signature / signed with a guessable secret / with a tampered alg›.',
    stepsToReproduce: steps('Take a valid token for account A.', '‹Describe the modification›.', 'Send it to ‹endpoint› and observe it is accepted as ‹account / role›.'),
    impact: 'Forging tokens for arbitrary users, including ‹roles›.',
    remediation: 'Verify signatures with a pinned algorithm and strong key; reject `none`; validate `kid`, `iss`, `aud` and `exp`.',
    references: ['https://portswigger.net/web-security/jwt']
  },
  {
    id: 'oauth',
    name: 'OAuth Misconfiguration',
    vulnerabilityType: 'OAuth',
    category: 'Authentication',
    cweId: 'CWE-287',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:H/A:N',
    vrt: 'Broken Authentication and Session Management > Authentication Bypass',
    keywords: ['oauth', 'openid', 'redirect_uri', 'state', 'sso', 'pkce'],
    summary: 'The OAuth flow ‹accepts arbitrary redirect_uri values / omits the state parameter / …›, allowing ‹token or code theft / login CSRF›.',
    stepsToReproduce: steps('Start the flow with `‹crafted authorize URL›`.', 'Observe ‹the code/token delivered to the attacker URL / session linked to attacker account›.'),
    impact: '‹Account takeover / account linking› for users who click a link.',
    remediation: 'Exact-match registered redirect URIs, require and validate `state`, use PKCE, and avoid open redirects on the callback origin.',
    references: ['https://portswigger.net/web-security/oauth', 'https://datatracker.ietf.org/doc/html/rfc9700']
  },
  {
    id: 'cors',
    name: 'CORS Misconfiguration',
    vulnerabilityType: 'CORS',
    category: 'Configuration',
    cweId: 'CWE-942',
    severity: 'medium',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:R/S:U/C:H/I:N/A:N',
    vrt: 'Server Security Misconfiguration > Unsafe Cross-Origin Resource Sharing',
    keywords: ['cors', 'origin', 'access-control-allow-origin', 'credentials'],
    summary: '‹Endpoint› reflects arbitrary `Origin` values with `Access-Control-Allow-Credentials: true`.',
    stepsToReproduce: steps('Send the request with `Origin: https://attacker.example`.', 'Observe both headers reflected in the response.', 'A page on that origin can read ‹sensitive response› for a signed-in victim (PoC attached).'),
    impact: 'Any website can read ‹data› from a signed-in user\'s session.',
    remediation: 'Allow-list trusted origins exactly; never reflect arbitrary or `null` origins together with credentials.',
    references: ['https://portswigger.net/web-security/cors']
  },
  {
    id: 'rate-limit',
    name: 'Missing Rate Limiting',
    vulnerabilityType: 'Rate Limiting',
    category: 'Authentication',
    cweId: 'CWE-307',
    severity: 'low',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:L/I:N/A:N',
    vrt: 'Broken Authentication and Session Management > Weak Login Function > Lack of Rate Limiting',
    keywords: ['rate limit', 'brute force', 'otp', 'login', 'enumeration'],
    summary: '‹Endpoint› accepts unlimited attempts, enabling brute force of ‹OTP / password / codes›.',
    stepsToReproduce: steps('Send ‹N› attempts in ‹time› against your own test account.', 'Observe no lockout, CAPTCHA or throttling.'),
    impact: '‹4-digit OTP brute-forced in ~X minutes → account takeover›.',
    remediation: 'Throttle per account and per IP, lock out after repeated failures, and expire codes quickly.',
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/Authentication_Cheat_Sheet.html#protect-against-automated-attacks']
  },
  {
    id: 'graphql-authz',
    name: 'GraphQL Authorization Flaw',
    vulnerabilityType: 'GraphQL',
    category: 'Access control',
    cweId: 'CWE-285',
    severity: 'medium',
    cvssVector: 'CVSS:3.1/AV:N/AC:L/PR:L/UI:N/S:U/C:H/I:N/A:N',
    vrt: 'Broken Access Control (BAC) > Insecure Direct Object References (IDOR)',
    keywords: ['graphql', 'introspection', 'resolver', 'node', 'query'],
    summary: 'The ‹query / mutation / field› resolver returns ‹data› without checking the caller\'s permissions.',
    stepsToReproduce: steps('Send:\n```graphql\n‹query›\n```', 'Observe ‹other users\' data / privileged field› in the response.'),
    impact: '‹What data / actions are exposed›.',
    remediation: 'Enforce authorization in resolvers (or a shared data-access layer), not just at the HTTP gateway.',
    references: ['https://cheatsheetseries.owasp.org/cheatsheets/GraphQL_Cheat_Sheet.html']
  },
  {
    id: 'request-smuggling',
    name: 'HTTP Request Smuggling',
    vulnerabilityType: 'Request Smuggling',
    category: 'Server-side',
    cweId: 'CWE-444',
    severity: 'high',
    cvssVector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:N/S:C/C:H/I:H/A:N',
    vrt: 'Server Security Misconfiguration > HTTP Request Smuggling',
    keywords: ['smuggling', 'desync', 'cl.te', 'te.cl', 'h2'],
    summary: 'The front-end and back-end disagree on request boundaries (‹CL.TE / TE.CL / H2.CL›).',
    stepsToReproduce: steps('Send the timing-based detection request (attached).', 'Observe ‹consistent delay / poisoned response› confirming desync. Testing used isolated, harmless paths only.'),
    impact: 'Poisoning other users\' responses, bypassing front-end controls, or capturing requests.',
    remediation: 'Normalise ambiguous requests at the edge, use HTTP/2 end-to-end, and reject requests with conflicting length headers.',
    references: ['https://portswigger.net/web-security/request-smuggling']
  },
  {
    id: 'prototype-pollution',
    name: 'Prototype Pollution',
    vulnerabilityType: 'Prototype Pollution',
    category: 'Client-side',
    cweId: 'CWE-1321',
    severity: 'medium',
    cvssVector: 'CVSS:3.1/AV:N/AC:H/PR:N/UI:R/S:U/C:L/I:L/A:N',
    vrt: 'Cross-Site Scripting (XSS) > DOM-Based',
    keywords: ['prototype pollution', '__proto__', 'constructor', 'merge'],
    summary: '‹Source› is merged into an object recursively, allowing `__proto__` keys to pollute `Object.prototype`, which ‹gadget› then uses.',
    stepsToReproduce: steps('Open `‹URL with pollution payload›`.', 'Observe `Object.prototype.‹property›` is set and ‹gadget effect›.'),
    impact: '‹DOM XSS via gadget / server-side behaviour change›.',
    remediation: 'Block `__proto__`/`constructor` keys in merges, use `Object.create(null)` or `Map` for user-keyed data, and update vulnerable libraries.',
    references: ['https://portswigger.net/web-security/prototype-pollution']
  }
];

export const FINDING_TEMPLATE_CATEGORIES = Array.from(new Set(FINDING_TEMPLATES.map((template) => template.category)));

export function getFindingTemplate(id: string | undefined): FindingTemplate | undefined {
  return id ? FINDING_TEMPLATES.find((template) => template.id === id) : undefined;
}

/** Rank templates for a free-text query (title, vulnerability type, CWE). */
export function searchFindingTemplates(query: string): FindingTemplate[] {
  const terms = query
    .toLowerCase()
    .split(/[^a-z0-9-]+/)
    .filter((term) => term.length > 1);
  if (terms.length === 0) return FINDING_TEMPLATES;
  return FINDING_TEMPLATES.map((template) => {
    const haystack = [template.name, template.vulnerabilityType, template.cweId ?? '', ...template.keywords].join(' ').toLowerCase();
    const score = terms.reduce((sum, term) => sum + (haystack.includes(term) ? (template.keywords.includes(term) ? 3 : 1) : 0), 0);
    return { template, score };
  })
    .filter(({ score }) => score > 0)
    .sort((a, b) => b.score - a.score)
    .map(({ template }) => template);
}
