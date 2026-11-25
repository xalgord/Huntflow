/**
 * `huntflow push` — send tool output to a running HuntFlow.
 *
 *   subfinder -d acme.com | huntflow push --program acme
 *   httpx -l hosts.txt -json | tee httpx.jsonl | huntflow push
 *   huntflow push nuclei.jsonl --program "Acme Bug Bounty"
 *
 * The output lands in HuntFlow's inbox; the app shows it for review (scope
 * check, dedupe, preview) before anything is added. If HuntFlow isn't
 * running, the output is queued on disk and appears the next time it is.
 */
import { existsSync, readFileSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { homedir } from 'node:os';
import { basename, dirname, join } from 'node:path';
import { IMPORT_KINDS, MAX_INBOX_BYTES, defaultInboxDir, writeInboxItem } from './local-api.mjs';

export function runtimeFile() {
  return join(homedir(), '.huntflow', 'server.json');
}

/** Remember where the server listens so `huntflow push` can find it. */
export function writeRuntime({ port, host }) {
  const file = runtimeFile();
  const reachable = !host || host === '0.0.0.0' || host === '::' ? '127.0.0.1' : host.includes(':') ? `[${host}]` : host;
  try {
    mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
    writeFileSync(file, JSON.stringify({ url: `http://${reachable}:${port}`, port, pid: process.pid, startedAt: Date.now() }), { mode: 0o600 });
  } catch {
    /* push falls back to the default port */
  }
}

export function clearRuntime() {
  try {
    const current = JSON.parse(readFileSync(runtimeFile(), 'utf8'));
    if (current.pid === process.pid) rmSync(runtimeFile());
  } catch {
    /* nothing to clear */
  }
}

function serverUrl({ url, port }) {
  if (url) return url.replace(/\/$/, '');
  if (process.env.HUNTFLOW_URL) return process.env.HUNTFLOW_URL.replace(/\/$/, '');
  if (port) return `http://127.0.0.1:${port}`;
  try {
    const runtime = JSON.parse(readFileSync(runtimeFile(), 'utf8'));
    if (runtime.url) return runtime.url;
  } catch {
    /* not running, or started by an older version */
  }
  return 'http://127.0.0.1:3000';
}

export function parsePushArgs(args) {
  const options = { program: undefined, kind: undefined, url: undefined, port: undefined, tee: false, name: undefined, file: undefined, help: false, inboxDir: defaultInboxDir() };
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    const value = () => {
      if (arg.includes('=')) return arg.slice(arg.indexOf('=') + 1);
      return args[++i];
    };
    if (arg === '-h' || arg === '--help') options.help = true;
    else if (arg === '--program' || arg === '-P' || arg.startsWith('--program=')) options.program = value();
    else if (arg === '--format' || arg === '-f' || arg.startsWith('--format=')) options.kind = value();
    else if (arg === '--url' || arg.startsWith('--url=')) options.url = value();
    else if (arg === '--port' || arg === '-p' || arg.startsWith('--port=')) options.port = parseInt(value(), 10) || undefined;
    else if (arg === '--name' || arg.startsWith('--name=')) options.name = value();
    else if (arg === '--inbox-dir' || arg.startsWith('--inbox-dir=')) options.inboxDir = value() || options.inboxDir;
    else if (arg === '--tee') options.tee = true;
    else if (arg === '-') options.file = undefined;
    else if (!arg.startsWith('-')) options.file = arg;
    else throw new Error(`Unknown option: ${arg}`);
  }
  if (options.kind && !IMPORT_KINDS.includes(options.kind)) {
    throw new Error(`Unknown format "${options.kind}". Use one of: ${IMPORT_KINDS.join(', ')}.`);
  }
  return options;
}

export function pushHelp() {
  return `
Send tool output to HuntFlow for review.

Usage:
  <tool> | huntflow push [options]
  huntflow push <file> [options]

Options:
  -P, --program <name>   Program to import into (name or part of it)
  -f, --format <format>  Skip auto-detection: ${IMPORT_KINDS.join(', ')}
      --tee              Also print the input, so it still shows in your terminal
      --name <name>      Label shown in HuntFlow (defaults to the file name)
  -p, --port <number>    Port HuntFlow runs on (found automatically)
      --url <url>        Full HuntFlow URL, e.g. http://127.0.0.1:3000

Examples:
  subfinder -d acme.com -silent | huntflow push -P acme
  httpx -l hosts.txt -json | huntflow push --tee -P acme
  nuclei -l urls.txt -jsonl | huntflow push -P acme
  huntflow push scope.csv -P "Acme Bug Bounty"
  nmap -sV -oX - acme.com | huntflow push -P acme

HuntFlow checks everything against the program's scope and shows a
preview before adding targets or draft findings.
`;
}

async function readStdin(tee) {
  const chunks = [];
  let size = 0;
  for await (const chunk of process.stdin) {
    if (tee) process.stdout.write(chunk);
    size += chunk.length;
    if (size > MAX_INBOX_BYTES) throw new Error('Input is larger than 25 MB. Filter it first (e.g. -silent, or split the scan).');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

const plural = (count, word) => `${count.toLocaleString('en-US')} ${word}${count === 1 ? '' : 's'}`;

export async function push(args, { log = (line) => process.stderr.write(`${line}\n`), stdinIsTTY = process.stdin.isTTY } = {}) {
  const options = parsePushArgs(args);
  if (options.help) {
    process.stdout.write(pushHelp());
    return 0;
  }
  let text;
  if (options.file) {
    if (!existsSync(options.file)) throw new Error(`No such file: ${options.file}`);
    text = readFileSync(options.file, 'utf8');
    if (options.tee) process.stdout.write(text);
  } else {
    if (stdinIsTTY) {
      process.stdout.write(pushHelp());
      return 1;
    }
    text = await readStdin(options.tee);
  }
  if (!text.trim()) throw new Error('Nothing to push: the input was empty.');
  if (Buffer.byteLength(text) > MAX_INBOX_BYTES) throw new Error('Input is larger than 25 MB. Filter it first.');

  const body = {
    text,
    program: options.program,
    kind: options.kind,
    fileName: options.name ?? (options.file ? basename(options.file) : undefined),
    source: 'cli'
  };
  const lines = text.split('\n').filter((line) => line.trim()).length;
  const target = options.program ? ` for ${options.program}` : '';
  const base = serverUrl(options);

  let response;
  try {
    response = await fetch(`${base}/api/huntflow/inbox`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-HuntFlow-Client': '1' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000)
    });
  } catch {
    // HuntFlow isn't running (or not where we looked): queue on disk.
    writeInboxItem(options.inboxDir, body);
    log(`✓ Queued ${plural(lines, 'line')}${target}. HuntFlow isn't running; start it with \`npx huntflow\` to review.`);
    return 0;
  }
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error ?? `HuntFlow answered ${response.status}.`);
  log(`✓ Sent ${plural(lines, 'line')} to HuntFlow${target}. Review it in your browser at ${base}.`);
  return 0;
}
