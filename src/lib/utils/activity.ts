/**
 * A program's activity log: sessions, notes, evidence and findings folded
 * into one reverse-chronological feed, grouped by day.
 */
import type { EvidenceAsset, Note, Session, Submission } from '$lib/types';

export type ActivityKind = 'session' | 'note' | 'evidence' | 'finding';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  at: number;
  title: string;
  detail: string;
  href?: string;
}

export interface ActivityDay {
  key: string;
  at: number;
  entries: ActivityEntry[];
}

const minutes = (seconds: number) => {
  const total = Math.round(seconds / 60);
  return total >= 60 ? `${Math.floor(total / 60)}h ${total % 60}m` : `${total}m`;
};

export function buildActivity(
  programId: string,
  data: { sessions: Session[]; notes: Note[]; evidence: EvidenceAsset[]; findings: Submission[] }
): ActivityEntry[] {
  const out: ActivityEntry[] = [];
  for (const session of data.sessions) {
    if (session.targetId !== programId || session.status === 'abandoned') continue;
    const running = session.status === 'running' || session.status === 'paused';
    out.push({
      id: `session:${session.id}`,
      kind: 'session',
      at: session.startedAt,
      title: running ? 'Session in progress' : `Hunted for ${minutes(session.durationActual)}`,
      detail: session.quickNote?.trim() || (running ? 'Started' : 'Focused session'),
      href: '/sessions'
    });
  }
  for (const note of data.notes) {
    if (note.targetId !== programId) continue;
    out.push({
      id: `note:${note.id}`,
      kind: 'note',
      at: note.updatedAt,
      title: note.title || 'Untitled note',
      detail: ['Note', ...(note.tags ?? []).slice(0, 3).map((tag) => `#${tag}`)].join(' · '),
      href: `/notes/${note.id}`
    });
  }
  for (const asset of data.evidence) {
    if (asset.targetId !== programId) continue;
    out.push({
      id: `evidence:${asset.id}`,
      kind: 'evidence',
      at: asset.createdAt ?? asset.updatedAt,
      title: asset.title,
      detail: `Evidence · ${asset.kind.replace(/-/g, ' ')}`,
      href: `/assets?asset=${asset.id}`
    });
  }
  for (const finding of data.findings) {
    if (finding.targetId !== programId) continue;
    out.push({
      id: `finding:${finding.id}`,
      kind: 'finding',
      at: finding.submittedAt ?? finding.createdAt,
      title: finding.title || 'Untitled finding',
      detail: `${finding.submittedAt ? 'Submitted' : 'Draft'} · ${finding.severity === 'informational' ? 'Info' : finding.severity[0].toUpperCase() + finding.severity.slice(1)}`,
      href: `/findings?id=${finding.id}`
    });
  }
  return out.sort((a, b) => b.at - a.at);
}

export function groupByDay(entries: ActivityEntry[]): ActivityDay[] {
  const days: ActivityDay[] = [];
  for (const entry of entries) {
    const date = new Date(entry.at);
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    const last = days[days.length - 1];
    if (last?.key === key) last.entries.push(entry);
    else days.push({ key, at: entry.at, entries: [entry] });
  }
  return days;
}

export function dayLabel(at: number, now = Date.now()): string {
  const date = new Date(at);
  const today = new Date(now);
  const yesterday = new Date(now);
  yesterday.setDate(today.getDate() - 1);
  const same = (a: Date, b: Date) => a.toDateString() === b.toDateString();
  if (same(date, today)) return 'Today';
  if (same(date, yesterday)) return 'Yesterday';
  return date.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
    year: date.getFullYear() === today.getFullYear() ? undefined : 'numeric'
  });
}
