import "server-only";

import fs from "fs";
import path from "path";
import { createAdminClient } from "@/lib/supabase/server";

// =============================================================================
// Multi-tenant Obsidian observer
// -----------------------------------------------------------------------------
// Writes markdown observation files into a per-organization Obsidian vault.
// Every path is validated against OBSIDIAN_ALLOWED_ROOT to avoid accidental
// or malicious writes outside a controlled directory. When the env var is
// unset, writes are disabled entirely (fail-closed) — we never trust a
// vault path stored in the database without an allowlist.
// =============================================================================

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Returns the allowed root (absolute), or null when Obsidian integration is
 * disabled in this environment.
 */
function getAllowedRoot(): string | null {
  const raw = process.env.OBSIDIAN_ALLOWED_ROOT;
  if (!raw || !raw.trim()) return null;
  try {
    return path.resolve(raw);
  } catch {
    return null;
  }
}

/**
 * Validate that `candidate` resolves to a path underneath the configured
 * `OBSIDIAN_ALLOWED_ROOT`. Returns null when integration is disabled or the
 * path escapes the sandbox.
 */
function safeResolveVaultPath(candidate: string): string | null {
  const allowedRoot = getAllowedRoot();
  if (!allowedRoot) return null;
  if (!candidate || !candidate.trim()) return null;

  const resolved = path.resolve(candidate);
  // Ensure the resolved path is contained by allowedRoot. Using path.relative
  // + checking for ".." handles symlink-free common cases; we do not follow
  // symlinks here — callers must curate OBSIDIAN_ALLOWED_ROOT.
  const rel = path.relative(allowedRoot, resolved);
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;
  return resolved;
}

interface OrgObsidianConfig {
  enabled: boolean;
  vaultPath: string | null;
}

/**
 * Load the organization's Obsidian configuration from ai_settings, validated
 * against the environment allowlist. Uses an admin client because this is
 * invoked from the background worker (no user session).
 */
async function loadOrgObsidianConfig(
  orgId: string
): Promise<OrgObsidianConfig> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("ai_settings")
    .select("obsidian_vault_path, obsidian_sync_enabled")
    .eq("organization_id", orgId)
    .maybeSingle();

  if (error || !data) {
    return { enabled: false, vaultPath: null };
  }

  const enabled = Boolean(data.obsidian_sync_enabled);
  const rawPath = (data.obsidian_vault_path as string | null) ?? null;
  const vaultPath = rawPath ? safeResolveVaultPath(rawPath) : null;

  return { enabled: enabled && vaultPath !== null, vaultPath };
}

function todayDate(): string {
  return new Date().toISOString().split("T")[0];
}

function ensureDir(dirPath: string) {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
}

function observationsDir(vaultPath: string): string {
  return path.join(vaultPath, "05-Pipeline", "observations");
}

function dailyFilePath(vaultPath: string, date: string): string {
  return path.join(observationsDir(vaultPath), `${date}-observations.md`);
}

function appendToFile(filePath: string, content: string, date: string): void {
  ensureDir(path.dirname(filePath));

  if (fs.existsSync(filePath)) {
    fs.appendFileSync(filePath, "\n" + content, "utf-8");
    return;
  }

  const frontmatter = `---
date: ${date}
tags:
  - lead-finder
  - observations
  - auto-generated
---

# Lead Finder Observations — ${date}

`;
  fs.writeFileSync(filePath, frontmatter + content, "utf-8");
}

async function recordSyncState(
  orgId: string,
  fileDate: string,
  fileBytes: number
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("lf_obsidian_sync_state").upsert(
    {
      organization_id: orgId,
      file_date: fileDate,
      file_bytes: fileBytes,
      last_synced_at: new Date().toISOString(),
    },
    { onConflict: "organization_id,file_date" }
  );
}

// ---------------------------------------------------------------------------
// Public API – lead + campaign observations
// ---------------------------------------------------------------------------

export interface LeadObservation {
  leadName: string;
  email?: string | null;
  website?: string | null;
  score: number;
  painPoints: string[];
  personalizationSummary: string;
  campaignName?: string | null;
}

export async function writeLeadObservation(
  orgId: string,
  observation: LeadObservation
): Promise<void> {
  const cfg = await loadOrgObsidianConfig(orgId);
  if (!cfg.enabled || !cfg.vaultPath) return;

  const scoreEmoji =
    observation.score >= 80
      ? "🟢"
      : observation.score >= 60
        ? "🟡"
        : observation.score >= 40
          ? "🟠"
          : "🔴";
  const now = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = todayDate();

  const content = `## ${scoreEmoji} ${observation.leadName} — Score: ${observation.score}/100
**Time:** ${now}${observation.campaignName ? ` | **Campaign:** ${observation.campaignName}` : ""}
${observation.email ? `**Email:** ${observation.email}` : ""}${observation.website ? ` | **Website:** ${observation.website}` : ""}

**Pain Points:**
${observation.painPoints.map((p) => `- ${p}`).join("\n")}

**Personalization:**
${observation.personalizationSummary}

---
`;

  try {
    const filePath = dailyFilePath(cfg.vaultPath, date);
    appendToFile(filePath, content, date);
    const bytes = fs.statSync(filePath).size;
    await recordSyncState(orgId, date, bytes);
  } catch (err) {
    console.error("[Obsidian Observer] writeLeadObservation failed:", err);
  }
}

export interface CampaignObservation {
  campaignId: string;
  campaignName: string;
  totalLeads: number;
  newLeads: number;
  avgScore?: number | null;
  topLeads?: { name: string; score: number }[];
}

export async function writeCampaignObservation(
  orgId: string,
  observation: CampaignObservation
): Promise<void> {
  const cfg = await loadOrgObsidianConfig(orgId);
  if (!cfg.enabled || !cfg.vaultPath) return;

  const now = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
  });
  const date = todayDate();

  const topLeadsSection = observation.topLeads?.length
    ? `\n**Top Leads:**\n${observation.topLeads.map((l) => `- ${l.name} (${l.score}/100)`).join("\n")}`
    : "";

  const content = `## 📊 Campaign Discovery: ${observation.campaignName}
**Time:** ${now} | **Campaign ID:** ${observation.campaignId}
**Leads Found:** ${observation.newLeads} new / ${observation.totalLeads} total${observation.avgScore ? ` | **Avg Score:** ${observation.avgScore}` : ""}
${topLeadsSection}

---
`;

  try {
    const filePath = dailyFilePath(cfg.vaultPath, date);
    appendToFile(filePath, content, date);
    const bytes = fs.statSync(filePath).size;
    await recordSyncState(orgId, date, bytes);
  } catch (err) {
    console.error(
      "[Obsidian Observer] writeCampaignObservation failed:",
      err
    );
  }
}

// ---------------------------------------------------------------------------
// Listing + reading (org-scoped)
// ---------------------------------------------------------------------------

export interface ObservationFileMeta {
  name: string;
  date: string;
  size: number;
}

export async function listObservationFiles(
  orgId: string
): Promise<ObservationFileMeta[]> {
  const cfg = await loadOrgObsidianConfig(orgId);
  if (!cfg.enabled || !cfg.vaultPath) return [];

  const dir = observationsDir(cfg.vaultPath);
  if (!fs.existsSync(dir)) return [];

  try {
    return fs
      .readdirSync(dir)
      .filter((f) => f.endsWith("-observations.md"))
      .map((f) => {
        const date = f.replace("-observations.md", "");
        const size = fs.statSync(path.join(dir, f)).size;
        return { name: f, date, size };
      })
      .sort((a, b) => b.date.localeCompare(a.date));
  } catch (err) {
    console.error("[Obsidian Observer] listObservationFiles failed:", err);
    return [];
  }
}

export async function readObservationFile(
  orgId: string,
  date: string
): Promise<string | null> {
  if (!DATE_RE.test(date)) return null;

  const cfg = await loadOrgObsidianConfig(orgId);
  if (!cfg.enabled || !cfg.vaultPath) return null;

  const filePath = dailyFilePath(cfg.vaultPath, date);
  // Re-validate the resolved filePath is still inside allowed root (defence
  // in depth against any subtle path traversal via `date` — we already regex
  // check it, but double-validation costs nothing).
  const allowedRoot = getAllowedRoot();
  if (!allowedRoot) return null;
  const rel = path.relative(allowedRoot, path.resolve(filePath));
  if (rel.startsWith("..") || path.isAbsolute(rel)) return null;

  if (!fs.existsSync(filePath)) return null;
  try {
    return fs.readFileSync(filePath, "utf-8");
  } catch (err) {
    console.error("[Obsidian Observer] readObservationFile failed:", err);
    return null;
  }
}
