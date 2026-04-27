import type { Bookmark, BookmarkCategory } from '$lib/types';

interface BookmarkSeed {
  id: string;
  title: string;
  url: string;
  description: string;
  category: BookmarkCategory;
  tags?: string[];
}

const seeds: BookmarkSeed[] = [
  // Methodology / cheatsheets
  {
    id: 'hacktricks',
    title: 'HackTricks',
    url: 'https://book.hacktricks.wiki/',
    description: 'Encyclopedic offensive-security reference. First stop for unfamiliar tech.',
    category: 'methodology',
    tags: ['reference']
  },
  {
    id: 'pentesterland',
    title: 'PayloadsAllTheThings',
    url: 'https://github.com/swisskyrepo/PayloadsAllTheThings',
    description: 'Payload + bypass repo organized by vulnerability class.',
    category: 'cheatsheet',
    tags: ['payloads']
  },
  {
    id: 'owasp-wstg',
    title: 'OWASP Web Security Testing Guide',
    url: 'https://owasp.org/www-project-web-security-testing-guide/',
    description: 'Authoritative web pentest methodology.',
    category: 'methodology'
  },
  {
    id: 'api-top10',
    title: 'OWASP API Security Top 10 (2023)',
    url: 'https://owasp.org/API-Security/editions/2023/en/0x11-t10/',
    description: 'API-specific risks and testing guidance.',
    category: 'methodology',
    tags: ['api']
  },
  {
    id: 'mstg',
    title: 'OWASP Mobile Application Security',
    url: 'https://mas.owasp.org/',
    description: 'Mobile testing guide and verification standard.',
    category: 'mobile'
  },
  {
    id: 'portswigger-academy',
    title: 'PortSwigger Web Security Academy',
    url: 'https://portswigger.net/web-security',
    description: 'Free interactive labs for every web bug class.',
    category: 'methodology',
    tags: ['labs']
  },

  // Recon / OSINT
  {
    id: 'projectdiscovery',
    title: 'ProjectDiscovery (subfinder / nuclei / httpx)',
    url: 'https://projectdiscovery.io/',
    description: 'The standard recon CLI suite.',
    category: 'tools',
    tags: ['recon', 'cli']
  },
  {
    id: 'nuclei-templates',
    title: 'Nuclei Templates',
    url: 'https://github.com/projectdiscovery/nuclei-templates',
    description: 'Community + official templates for nuclei.',
    category: 'recon',
    tags: ['nuclei']
  },
  {
    id: 'crt-sh',
    title: 'crt.sh',
    url: 'https://crt.sh/',
    description: 'Certificate transparency search; great for subdomain discovery.',
    category: 'recon',
    tags: ['ct-logs']
  },
  {
    id: 'shodan',
    title: 'Shodan',
    url: 'https://www.shodan.io/',
    description: 'Internet-wide host & service search.',
    category: 'recon',
    tags: ['osint']
  },
  {
    id: 'wayback',
    title: 'Wayback Machine',
    url: 'https://web.archive.org/',
    description: 'Find legacy paths and old vulnerabilities.',
    category: 'recon'
  },
  {
    id: 'gitdorker',
    title: 'GitDorker',
    url: 'https://github.com/obheda12/GitDorker',
    description: 'Automated GitHub dorking for leaked secrets.',
    category: 'recon',
    tags: ['secrets']
  },

  // Tooling
  {
    id: 'burp',
    title: 'Burp Suite',
    url: 'https://portswigger.net/burp',
    description: 'The hunter\'s default proxy.',
    category: 'tools'
  },
  {
    id: 'caido',
    title: 'Caido',
    url: 'https://caido.io/',
    description: 'Modern Burp alternative with HTTPQL filtering.',
    category: 'tools'
  },
  {
    id: 'gtfobins',
    title: 'GTFOBins',
    url: 'https://gtfobins.github.io/',
    description: 'Unix binaries that can be abused for privilege escalation.',
    category: 'tools',
    tags: ['privesc', 'linux']
  },
  {
    id: 'lolbas',
    title: 'LOLBAS',
    url: 'https://lolbas-project.github.io/',
    description: 'Living-off-the-land Windows binaries.',
    category: 'tools',
    tags: ['privesc', 'windows']
  },

  // Class-specific
  {
    id: 'jwt-io',
    title: 'jwt.io',
    url: 'https://jwt.io/',
    description: 'Decode/encode JWTs and inspect signatures.',
    category: 'jwt'
  },
  {
    id: 'cyberchef',
    title: 'CyberChef',
    url: 'https://gchq.github.io/CyberChef/',
    description: 'Encoding / decoding / crypto multitool.',
    category: 'tools'
  },
  {
    id: 'graphql-cheatsheet',
    title: 'GraphQL Pentesting Cheat Sheet',
    url: 'https://github.com/swisskyrepo/PayloadsAllTheThings/tree/master/GraphQL%20Injection',
    description: 'Common GraphQL attack vectors and tricks.',
    category: 'graphql'
  },
  {
    id: 'oauth-cheatsheet',
    title: 'OAuth 2.0 Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/OAuth2_Cheat_Sheet.html',
    description: 'Common OAuth pitfalls and fixes.',
    category: 'oauth'
  },
  {
    id: 'sql-cheatsheet',
    title: 'SQL Injection Cheat Sheet',
    url: 'https://portswigger.net/web-security/sql-injection/cheat-sheet',
    description: 'Per-database SQLi syntax reference.',
    category: 'sqli'
  },
  {
    id: 'xss-cheatsheet',
    title: 'XSS Filter Evasion Cheat Sheet',
    url: 'https://owasp.org/www-community/xss-filter-evasion-cheatsheet',
    description: 'Classic OWASP XSS reference.',
    category: 'xss'
  },
  {
    id: 'ssrf-bible',
    title: 'SSRF Bible',
    url: 'https://docs.google.com/document/d/1v1TkWZtrhzRLy0bYXBcdLUedXGb9njTNIJXa3u9akHM/',
    description: 'Comprehensive SSRF tricks and protocol smuggling.',
    category: 'ssrf'
  },
  {
    id: 'xxe-cheatsheet',
    title: 'XXE Cheat Sheet',
    url: 'https://cheatsheetseries.owasp.org/cheatsheets/XML_External_Entity_Prevention_Cheat_Sheet.html',
    description: 'XXE attack and prevention reference.',
    category: 'xxe'
  },
  {
    id: 'recon-roadmap',
    title: 'Bug Bounty Recon Roadmap (jhaddix)',
    url: 'https://github.com/jhaddix/tbhm',
    description: 'Long-form recon methodology.',
    category: 'recon',
    tags: ['methodology']
  },
  {
    id: 'wadcoms',
    title: 'WADComs',
    url: 'https://wadcoms.github.io/',
    description: 'Cheatsheet for AD / Windows pentesting.',
    category: 'cheatsheet',
    tags: ['windows', 'ad']
  },

  // CVE intel
  {
    id: 'cvedetails',
    title: 'CVE Details',
    url: 'https://www.cvedetails.com/',
    description: 'Searchable CVE database.',
    category: 'cve'
  },
  {
    id: 'nvd',
    title: 'NVD',
    url: 'https://nvd.nist.gov/',
    description: 'NIST National Vulnerability Database.',
    category: 'cve'
  },
  {
    id: 'github-advisory',
    title: 'GitHub Advisory Database',
    url: 'https://github.com/advisories',
    description: 'Curated open-source advisories with PoC links.',
    category: 'cve'
  },

  // Programs
  {
    id: 'hackerone-disclosed',
    title: 'HackerOne Hacktivity',
    url: 'https://hackerone.com/hacktivity',
    description: 'Public reports for inspiration and dupe checks.',
    category: 'general'
  },
  {
    id: 'chaos',
    title: 'Chaos Bug Bounty Recon',
    url: 'https://chaos.projectdiscovery.io/',
    description: 'Curated subdomains for public BB programs.',
    category: 'recon'
  }
];

const now = Date.now();

export const BUILT_IN_BOOKMARKS: Bookmark[] = seeds.map((seed) => ({
  id: `bi-${seed.id}`,
  title: seed.title,
  url: seed.url,
  description: seed.description,
  category: seed.category,
  tags: seed.tags ?? [],
  isBuiltIn: true,
  isFavorite: false,
  createdAt: now,
  updatedAt: now
}));

export const BOOKMARK_CATEGORIES: { value: BookmarkCategory; label: string }[] = [
  { value: 'methodology', label: 'Methodology' },
  { value: 'cheatsheet', label: 'Cheatsheets' },
  { value: 'tools', label: 'Tools' },
  { value: 'recon', label: 'Recon' },
  { value: 'cve', label: 'CVE / Advisories' },
  { value: 'xss', label: 'XSS' },
  { value: 'sqli', label: 'SQLi' },
  { value: 'ssrf', label: 'SSRF' },
  { value: 'xxe', label: 'XXE' },
  { value: 'ssti', label: 'SSTI' },
  { value: 'lfi', label: 'LFI' },
  { value: 'rce', label: 'RCE' },
  { value: 'auth', label: 'Auth' },
  { value: 'idor', label: 'IDOR' },
  { value: 'jwt', label: 'JWT' },
  { value: 'oauth', label: 'OAuth' },
  { value: 'graphql', label: 'GraphQL' },
  { value: 'mobile', label: 'Mobile' },
  { value: 'general', label: 'General' }
];

export function bookmarkCategoryLabel(category: BookmarkCategory): string {
  return BOOKMARK_CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
}
