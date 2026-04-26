import { evidenceNodeKey } from '$lib/db/evidence';
import type {
  EvidenceAsset,
  EvidenceAssetKind,
  EvidenceCanvasPosition,
  EvidenceLink,
  EvidenceNodeType,
  EvidenceRelationship,
  Note,
  Platform,
  Session,
  Target
} from '$lib/types';

export const EVIDENCE_CLOUD_MAX_FILE_SIZE = 100 * 1024 * 1024;
export const EVIDENCE_CLOUD_MAX_SYNC_BYTES = 1024 * 1024 * 1024;

export interface EvidenceFileValidation {
  valid: boolean;
  errors: string[];
}

export interface EvidenceGraphNode {
  id: string;
  type: EvidenceNodeType;
  entityId: string;
  label: string;
  subtitle: string;
  tone: string;
  size: number;
  x?: number;
  y?: number;
}

export interface EvidenceGraphEdge {
  id: string;
  source: string;
  target: string;
  relationship: EvidenceRelationship;
  label: string;
}

export interface EvidenceGraph {
  nodes: EvidenceGraphNode[];
  edges: EvidenceGraphEdge[];
}

const imageTypes = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml']);
const archiveExtensions = ['.zip', '.tar', '.gz', '.7z', '.rar'];

export function normalizeEvidenceTags(tags: string | string[]): string[] {
  const raw = Array.isArray(tags) ? tags : tags.split(',');
  return Array.from(
    new Set(
      raw
        .map((tag) => tag.trim().toLowerCase())
        .filter((tag) => /^[a-z0-9_-]{1,30}$/i.test(tag))
    )
  ).slice(0, 12);
}

export function evidenceKindFromFile(file: Pick<File, 'name' | 'type'>): EvidenceAssetKind {
  const type = file.type.toLowerCase();
  const name = file.name.toLowerCase();

  if (imageTypes.has(type) || type.startsWith('image/')) return 'image';
  if (type === 'application/pdf' || name.endsWith('.pdf')) return 'pdf';
  if (
    type.startsWith('text/') ||
    name.endsWith('.txt') ||
    name.endsWith('.log') ||
    name.endsWith('.md') ||
    name.endsWith('.json') ||
    name.endsWith('.xml') ||
    name.endsWith('.yaml') ||
    name.endsWith('.yml')
  ) {
    return 'text';
  }
  if (archiveExtensions.some((extension) => name.endsWith(extension))) return 'archive';
  return 'binary';
}

export function validateEvidenceFile(file: Pick<File, 'name' | 'size'>): EvidenceFileValidation {
  const errors: string[] = [];

  if (!file.name.trim()) errors.push('File name is required.');
  if (file.size <= 0) errors.push('File is empty.');

  return { valid: errors.length === 0, errors };
}

export function cloudEvidenceQuotaError(fileSize: number, currentSyncedBytes: number): string | null {
  if (fileSize > EVIDENCE_CLOUD_MAX_FILE_SIZE) return 'Cloud sync supports evidence files up to 100MB.';
  if (currentSyncedBytes + fileSize > EVIDENCE_CLOUD_MAX_SYNC_BYTES) {
    return 'Cloud evidence storage quota is 1GB per user.';
  }
  return null;
}

export function normalizeEvidencePath(path: string | undefined): string {
  return (path ?? '').replace(/\\/g, '/').replace(/^\/+/, '').replace(/\/+/g, '/').trim();
}

export function folderPathFromRelativePath(relativePath: string | undefined): string | undefined {
  const normalized = normalizeEvidencePath(relativePath);
  const parts = normalized.split('/').filter(Boolean);
  if (parts.length <= 1) return undefined;
  return parts.slice(0, -1).join('/');
}

export function totalEvidenceBytes(assets: EvidenceAsset[]): number {
  return assets.reduce((sum, asset) => sum + (asset.source === 'url' ? 0 : asset.size), 0);
}

export function isPreviewableText(asset: EvidenceAsset): boolean {
  return asset.kind === 'text' || asset.kind === 'request' || asset.kind === 'response' || asset.mimeType.startsWith('text/');
}

export function isPreviewableImage(asset: EvidenceAsset): boolean {
  return asset.kind === 'image' || asset.mimeType.startsWith('image/');
}

export function formatEvidenceBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kib = bytes / 1024;
  if (kib < 1024) return `${kib.toFixed(kib >= 10 ? 0 : 1)} KB`;
  const mib = kib / 1024;
  if (mib < 1024) return `${mib.toFixed(mib >= 10 ? 0 : 1)} MB`;
  const gib = mib / 1024;
  return `${gib.toFixed(gib >= 10 ? 0 : 1)} GB`;
}

function platformLabel(platform: Platform): string {
  const labels: Record<Platform, string> = {
    hackerone: 'HackerOne',
    bugcrowd: 'Bugcrowd',
    intigriti: 'Intigriti',
    synack: 'Synack',
    yeswehack: 'YesWeHack',
    'self-hosted': 'Self-hosted',
    other: 'Other'
  };
  return labels[platform];
}

function hostFromUrl(url: string | undefined): string {
  if (!url) return 'URL';
  try {
    return new URL(url).host;
  } catch {
    return url;
  }
}

function addNode(nodes: Map<string, EvidenceGraphNode>, node: EvidenceGraphNode): void {
  if (!nodes.has(node.id)) nodes.set(node.id, node);
}

function addEdge(edges: Map<string, EvidenceGraphEdge>, edge: EvidenceGraphEdge): void {
  if (edge.source === edge.target) return;
  if (!edges.has(edge.id)) edges.set(edge.id, edge);
}

export function deriveEvidenceGraph(input: {
  assets: EvidenceAsset[];
  links: EvidenceLink[];
  targets: Target[];
  sessions: Session[];
  notes: Note[];
  positions?: Record<string, EvidenceCanvasPosition>;
  targetId?: string;
  includeSessions?: boolean;
  includeNotes?: boolean;
  includeUrls?: boolean;
}): EvidenceGraph {
  const includeSessions = input.includeSessions ?? true;
  const includeNotes = input.includeNotes ?? true;
  const includeUrls = input.includeUrls ?? true;
  const targetsById = new Map(input.targets.map((target) => [target.id, target]));
  const sessionsById = new Map(input.sessions.map((session) => [session.id, session]));
  const notesById = new Map(input.notes.map((note) => [note.id, note]));
  const assetsById = new Map(input.assets.map((asset) => [asset.id, asset]));
  const nodes = new Map<string, EvidenceGraphNode>();
  const edges = new Map<string, EvidenceGraphEdge>();

  const scopedAssets = input.targetId
    ? input.assets.filter((asset) => asset.targetId === input.targetId)
    : input.assets;
  const assetsByFolder = new Map<string, EvidenceAsset[]>();

  for (const asset of scopedAssets) {
    const nodeType: EvidenceNodeType = asset.kind === 'url' ? 'url' : 'asset';
    const assetNodeId = evidenceNodeKey(nodeType, asset.id);
    if (asset.folderPath) {
      assetsByFolder.set(asset.folderPath, [...(assetsByFolder.get(asset.folderPath) ?? []), asset]);
    }

    addNode(nodes, {
      id: assetNodeId,
      type: nodeType,
      entityId: asset.id,
      label: asset.kind === 'url' ? hostFromUrl(asset.url) : asset.title,
      subtitle: asset.kind === 'url' ? asset.title : asset.kind,
      tone: asset.kind === 'url' ? 'cyan' : asset.kind === 'image' ? 'green' : asset.kind === 'pdf' ? 'amber' : 'violet',
      size: asset.kind === 'url' ? 15 : 18,
      ...input.positions?.[assetNodeId]
    });

    if (asset.targetId) {
      const target = targetsById.get(asset.targetId);
      if (target) {
        const targetNodeId = evidenceNodeKey('target', target.id);
        addNode(nodes, {
          id: targetNodeId,
          type: 'target',
          entityId: target.id,
          label: target.name,
          subtitle: platformLabel(target.platform),
          tone: 'green',
          size: 24,
          ...input.positions?.[targetNodeId]
        });
        addEdge(edges, {
          id: `implicit:${assetNodeId}:${targetNodeId}`,
          source: assetNodeId,
          target: targetNodeId,
          relationship: 'belongs-to',
          label: 'belongs to'
        });
      }
    }

    if (includeSessions && asset.sessionId) {
      const session = sessionsById.get(asset.sessionId);
      if (session) {
        const sessionNodeId = evidenceNodeKey('session', session.id);
        addNode(nodes, {
          id: sessionNodeId,
          type: 'session',
          entityId: session.id,
          label: 'Hunt session',
          subtitle: new Date(session.startedAt).toLocaleDateString(),
          tone: 'blue',
          size: 16,
          ...input.positions?.[sessionNodeId]
        });
        addEdge(edges, {
          id: `implicit:${assetNodeId}:${sessionNodeId}`,
          source: assetNodeId,
          target: sessionNodeId,
          relationship: 'belongs-to',
          label: 'captured in'
        });
      }
    }

    if (includeNotes && asset.noteId) {
      const note = notesById.get(asset.noteId);
      if (note) {
        const noteNodeId = evidenceNodeKey('note', note.id);
        addNode(nodes, {
          id: noteNodeId,
          type: 'note',
          entityId: note.id,
          label: note.title,
          subtitle: note.tags.slice(0, 2).join(', ') || 'note',
          tone: 'amber',
          size: 16,
          ...input.positions?.[noteNodeId]
        });
        addEdge(edges, {
          id: `implicit:${assetNodeId}:${noteNodeId}`,
          source: assetNodeId,
          target: noteNodeId,
          relationship: 'references',
          label: 'referenced by'
        });
      }
    }
  }

  for (const [folderPath, folderAssets] of assetsByFolder) {
    const orderedAssets = [...folderAssets].sort((first, second) => first.title.localeCompare(second.title));
    for (let index = 1; index < orderedAssets.length; index += 1) {
      const previous = orderedAssets[index - 1];
      const current = orderedAssets[index];
      const previousType: EvidenceNodeType = previous.kind === 'url' ? 'url' : 'asset';
      const currentType: EvidenceNodeType = current.kind === 'url' ? 'url' : 'asset';
      const source = evidenceNodeKey(previousType, previous.id);
      const target = evidenceNodeKey(currentType, current.id);
      addEdge(edges, {
        id: `folder:${folderPath}:${previous.id}:${current.id}`,
        source,
        target,
        relationship: 'belongs-to',
        label: folderPath
      });
    }
  }

  for (const link of input.links) {
    if (!nodeExists(link.fromType, link.fromId, assetsById, targetsById, sessionsById, notesById)) continue;
    if (!nodeExists(link.toType, link.toId, assetsById, targetsById, sessionsById, notesById)) continue;
    const source = evidenceNodeKey(link.fromType, link.fromId);
    const target = evidenceNodeKey(link.toType, link.toId);
    if (!nodes.has(source) || !nodes.has(target)) continue;
    if (!includeUrls && (link.fromType === 'url' || link.toType === 'url')) continue;
    if (!includeSessions && (link.fromType === 'session' || link.toType === 'session')) continue;
    if (!includeNotes && (link.fromType === 'note' || link.toType === 'note')) continue;

    addEdge(edges, {
      id: link.id,
      source,
      target,
      relationship: link.relationship,
      label: link.label || link.relationship
    });
  }

  return {
    nodes: Array.from(nodes.values()),
    edges: Array.from(edges.values())
  };
}

function nodeExists(
  type: EvidenceNodeType,
  id: string,
  assetsById: Map<string, EvidenceAsset>,
  targetsById: Map<string, Target>,
  sessionsById: Map<string, Session>,
  notesById: Map<string, Note>
): boolean {
  if (type === 'target') return targetsById.has(id);
  if (type === 'session') return sessionsById.has(id);
  if (type === 'note') return notesById.has(id);
  return assetsById.has(id);
}
