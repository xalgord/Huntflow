/**
 * Turn a parsed import into concrete store changes for one program:
 * new targets, enriched existing targets, draft findings with evidence and
 * updated scope rules. Pure — the caller decides whether to commit it.
 */
import type { EvidenceAsset, ReconAsset, Submission, Target } from '$lib/types';
import { createFinding, evidenceFromHttp } from './findingWorkflow';
import { generateId } from './id';
import { classifyScope, mergeScopeText, type ImportResult, type ImportedAsset } from './importers';

export interface ImportOptions {
  /** Keep hosts the program's scope rules exclude (flagged out of scope). */
  includeOutOfScope: boolean;
  /** Create draft findings from scanner results (nuclei, Burp). */
  createFindings: boolean;
  /** Append scope rules from HackerOne CSV / pasted scope to the program. */
  updateScope: boolean;
}

export interface ImportPlan {
  newAssets: ReconAsset[];
  updatedAssets: ReconAsset[];
  findings: Submission[];
  evidence: EvidenceAsset[];
  /** New scope text for the program, when the import changes it. */
  scopeText?: string;
  skipped: { outOfScope: number; existingFindings: number; unchanged: number };
}

const SCOPE_KINDS = new Set(['h1-scope-csv', 'scope-text']);

function sameAsset(existing: ReconAsset, incoming: ImportedAsset): boolean {
  if (existing.hostname.toLowerCase() !== incoming.hostname.toLowerCase()) return false;
  if (!existing.url || !incoming.url) return true;
  return existing.url.replace(/\/$/, '') === incoming.url.replace(/\/$/, '');
}

function mergeAsset(existing: ReconAsset, incoming: ImportedAsset, authoritativeScope: boolean, now: number): ReconAsset | null {
  const technologies = [...new Set([...existing.technologies, ...incoming.technologies])];
  const ports = [...new Set([...(existing.ports ?? []), ...incoming.ports])].sort((a, b) => a - b);
  const keepScope = existing.scopeStatus && existing.scopeStatus !== 'unknown' && !authoritativeScope;
  const scopeStatus = keepScope ? existing.scopeStatus : incoming.scopeStatus ?? existing.scopeStatus;
  const next: ReconAsset = {
    ...existing,
    url: existing.url ?? incoming.url,
    ipAddress: existing.ipAddress ?? incoming.ipAddress,
    title: incoming.title ?? existing.title,
    httpStatus: incoming.httpStatus ?? existing.httpStatus,
    assetType: existing.assetType ?? incoming.assetType,
    technologies,
    ports: ports.length ? ports : existing.ports,
    scopeStatus,
    inScope: scopeStatus ? scopeStatus !== 'out-of-scope' : existing.inScope,
    notes: existing.notes || incoming.notes
  };
  const changed = (Object.keys(next) as (keyof ReconAsset)[]).some(
    (key) => JSON.stringify(next[key]) !== JSON.stringify(existing[key])
  );
  return changed ? { ...next, updatedAt: now } : null;
}

export function planImport(
  parsed: ImportResult,
  program: Target,
  existingAssets: ReconAsset[],
  existingFindings: Submission[],
  options: ImportOptions,
  now = Date.now()
): ImportPlan {
  const authoritativeScope = SCOPE_KINDS.has(parsed.kind);
  const scopeText =
    authoritativeScope && options.updateScope && (parsed.scope.include.length || parsed.scope.exclude.length)
      ? mergeScopeText(program.scope ?? '', parsed.scope.include, parsed.scope.exclude, `Imported ${new Date(now).toISOString().slice(0, 10)}`)
      : undefined;
  const result = classifyScope(parsed, scopeText ?? program.scope ?? '');
  const byHost = new Map<string, ReconAsset[]>();
  for (const asset of existingAssets) {
    if (asset.targetId !== program.id) continue;
    const key = asset.hostname.toLowerCase();
    byHost.set(key, [...(byHost.get(key) ?? []), asset]);
  }

  const plan: ImportPlan = {
    newAssets: [],
    updatedAssets: [],
    findings: [],
    evidence: [],
    scopeText: scopeText !== undefined && scopeText !== (program.scope ?? '') ? scopeText : undefined,
    skipped: { outOfScope: 0, existingFindings: 0, unchanged: 0 }
  };

  const updated = new Map<string, ReconAsset>();
  for (const incoming of result.assets) {
    const candidates = byHost.get(incoming.hostname.toLowerCase()) ?? [];
    const existing = candidates.find((asset) => sameAsset(asset, incoming));
    if (existing) {
      const merged = mergeAsset(existing, incoming, authoritativeScope, now);
      if (merged) {
        updated.set(merged.id, merged);
        // Later rows for the same host build on this merge, not the original.
        byHost.set(incoming.hostname.toLowerCase(), candidates.map((asset) => (asset.id === merged.id ? merged : asset)));
      } else if (!updated.has(existing.id)) {
        plan.skipped.unchanged += 1;
      }
      continue;
    }
    if (incoming.scopeStatus === 'out-of-scope' && !options.includeOutOfScope && !authoritativeScope) {
      plan.skipped.outOfScope += 1;
      continue;
    }
    const scopeStatus = incoming.scopeStatus ?? 'unknown';
    plan.newAssets.push({
      id: generateId(),
      targetId: program.id,
      hostname: incoming.hostname,
      url: incoming.url,
      ipAddress: incoming.ipAddress,
      assetType: incoming.assetType,
      scopeStatus,
      status: scopeStatus === 'out-of-scope' ? 'out-of-scope' : 'untested',
      inScope: scopeStatus !== 'out-of-scope',
      httpStatus: incoming.httpStatus,
      title: incoming.title,
      technologies: incoming.technologies,
      ports: incoming.ports.length ? incoming.ports : undefined,
      notes: incoming.notes,
      source: incoming.source,
      tags: [],
      discoveredAt: now,
      createdAt: now,
      updatedAt: now
    });
  }

  plan.updatedAssets = [...updated.values()];

  if (options.createFindings) {
    const knownKeys = new Set(existingFindings.map((finding) => finding.importKey).filter(Boolean));
    for (const imported of result.findings) {
      if (knownKeys.has(imported.sourceKey)) {
        plan.skipped.existingFindings += 1;
        continue;
      }
      knownKeys.add(imported.sourceKey);
      const evidence = imported.httpEvidence ? evidenceFromHttp(imported.httpEvidence, program.id, now) : null;
      if (evidence) {
        evidence.title = `${imported.source === 'nuclei' ? 'nuclei' : 'Burp'}: ${evidence.title}`.slice(0, 200);
        evidence.tags = [imported.source];
        plan.evidence.push(evidence);
      }
      plan.findings.push(
        createFinding(
          program,
          {
            title: imported.title.slice(0, 200),
            severity: imported.severity,
            vulnerabilityType: imported.vulnerabilityType,
            cweId: imported.cweId,
            cvssVector: imported.cvssVector?.startsWith('CVSS:3') ? imported.cvssVector : undefined,
            cvssScore: imported.cvssScore,
            summary: imported.summary,
            remediation: imported.remediation,
            references: imported.references,
            affectedAssets: imported.affectedAssets,
            evidenceAssetIds: evidence ? [evidence.id] : [],
            tags: [imported.source],
            importKey: imported.sourceKey
          },
          now
        )
      );
    }
  }

  return plan;
}

export function describePlan(plan: ImportPlan): string {
  const parts = [
    plan.newAssets.length ? `${plan.newAssets.length} new target${plan.newAssets.length === 1 ? '' : 's'}` : '',
    plan.updatedAssets.length ? `${plan.updatedAssets.length} updated` : '',
    plan.findings.length ? `${plan.findings.length} draft finding${plan.findings.length === 1 ? '' : 's'}` : '',
    plan.scopeText !== undefined ? 'scope rules updated' : ''
  ].filter(Boolean);
  return parts.length ? parts.join(', ') : 'Nothing new to import';
}
