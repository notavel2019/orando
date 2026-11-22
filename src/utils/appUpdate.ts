export const APP_PACKAGE_ID = "com.oratorio.app";
export const APP_VERSION = (import.meta.env.VITE_APP_VERSION as string | undefined) || "1.0.0";
export const APP_VERSION_CODE = Number(import.meta.env.VITE_APP_VERSION_CODE) || 100;
export const DEFAULT_GITHUB_REPO =
  (import.meta.env.VITE_DEFAULT_GITHUB_REPO as string | undefined) || "";

const GITHUB_REPO_STORAGE_KEY = "oratorio_github_repo_url_v1";

export interface ParsedGitHubRepo {
  owner: string;
  repo: string;
  normalizedUrl: string;
}

export interface ReleaseApkAsset {
  name: string;
  sizeBytes: number;
  downloadUrl: string;
  isSignedRelease: boolean;
}

export interface UpdateCheckResult {
  repoFullName: string;
  tagName: string;
  versionName: string;
  versionCode: number | null;
  releaseName: string;
  publishedAt: string;
  releaseNotes: string;
  releaseUrl: string;
  apkAsset: ReleaseApkAsset | null;
  signedRelease: boolean;
}

export function apiUrl(path: string): string {
  const base = ((import.meta.env.VITE_API_BASE_URL as string | undefined) || "").trim();
  if (!base) return path;
  return `${base.replace(/\/+$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export function loadSavedGitHubRepo(): string {
  try {
    const saved = localStorage.getItem(GITHUB_REPO_STORAGE_KEY);
    if (saved) return saved;
  } catch {
    // ignore
  }
  return DEFAULT_GITHUB_REPO ? `https://github.com/${DEFAULT_GITHUB_REPO}` : "";
}

export function persistGitHubRepo(value: string): void {
  try {
    localStorage.setItem(GITHUB_REPO_STORAGE_KEY, value.trim());
  } catch {
    // ignore
  }
}

const SEGMENT_RE = /^[A-Za-z0-9_.-]{1,100}$/;

export function parseGitHubRepoInput(raw: string): ParsedGitHubRepo | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Allow shorthand "owner/repo"
  if (!trimmed.includes("://") && !trimmed.startsWith("github.com")) {
    const cleaned = trimmed.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
    const parts = cleaned.split("/");
    if (parts.length === 2 && SEGMENT_RE.test(parts[0]) && SEGMENT_RE.test(parts[1])) {
      return {
        owner: parts[0],
        repo: parts[1],
        normalizedUrl: `https://github.com/${parts[0]}/${parts[1]}`,
      };
    }
    return null;
  }

  const withScheme = trimmed.startsWith("github.com") ? `https://${trimmed}` : trimmed;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  const host = parsed.hostname.toLowerCase();
  if (host !== "github.com" && host !== "www.github.com") return null;

  const segments = parsed.pathname
    .split("/")
    .map((s) => s.trim())
    .filter(Boolean);

  if (segments.length < 2) return null;
  const owner = segments[0];
  const repo = segments[1].replace(/\.git$/i, "");
  if (!SEGMENT_RE.test(owner) || !SEGMENT_RE.test(repo)) return null;

  return {
    owner,
    repo,
    normalizedUrl: `https://github.com/${owner}/${repo}`,
  };
}

export function isSafeGitHubAssetUrl(rawUrl: string): boolean {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== "https:") return false;
    const host = parsed.hostname.toLowerCase();
    return (
      host === "github.com" ||
      host === "objects.githubusercontent.com" ||
      host === "release-assets.githubusercontent.com" ||
      host.endsWith(".githubusercontent.com")
    );
  } catch {
    return false;
  }
}

function parseSemverTuple(version: string): [number, number, number] {
  const cleaned = version.replace(/^v/i, "").split("-")[0];
  const parts = cleaned.split(".").map((n) => Number.parseInt(n, 10) || 0);
  return [parts[0] ?? 0, parts[1] ?? 0, parts[2] ?? 0];
}

export function compareAppVersion(
  latestVersion: string,
  latestCode: number | null
): "update_available" | "up_to_date" {
  if (latestCode !== null && Number.isFinite(latestCode)) {
    return latestCode > APP_VERSION_CODE ? "update_available" : "up_to_date";
  }

  const cur = parseSemverTuple(APP_VERSION);
  const nxt = parseSemverTuple(latestVersion);
  for (let i = 0; i < 3; i++) {
    if (nxt[i] > cur[i]) return "update_available";
    if (nxt[i] < cur[i]) return "up_to_date";
  }
  return "up_to_date";
}

export function formatMegabytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return "—";
  const mb = bytes / (1024 * 1024);
  return `${mb.toFixed(1)} MB`;
}

/**
 * Queries the backend route first, with a direct public GitHub API fallback
 * so standalone Android APKs can also check updates even without a remote server.
 */
export async function checkGitHubReleaseUpdate(
  repoInput: string
): Promise<UpdateCheckResult> {
  const parsed = parseGitHubRepoInput(repoInput);
  if (!parsed) {
    throw new Error(
      "Informe um link válido do GitHub (ex.: https://github.com/usuario/repositorio)."
    );
  }

  // Try server endpoint first
  try {
    const res = await fetch(apiUrl("/api/update/check"), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ repoUrl: parsed.normalizedUrl }),
    });
    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data?.error || "Não foi possível verificar atualizações.");
      }
      return data as UpdateCheckResult;
    }
  } catch (err) {
    // Only fall back to direct GitHub public API if network/endpoint is unreachable (e.g. offline Capacitor bundle)
    if (err instanceof Error && !err.message.includes("Failed to fetch")) {
      throw err;
    }
  }

  // Direct public GitHub Releases API fallback (read-only, strictly pinned host)
  const ghRes = await fetch(
    `https://api.github.com/repos/${encodeURIComponent(parsed.owner)}/${encodeURIComponent(
      parsed.repo
    )}/releases/latest`,
    {
      headers: {
        Accept: "application/vnd.github+json",
      },
    }
  );

  if (ghRes.status === 404) {
    throw new Error(
      "Nenhuma release publicada encontrada neste repositório. Suba o código e aguarde a GitHub Action concluir."
    );
  }
  if (!ghRes.ok) {
    throw new Error("Não foi possível consultar o GitHub agora. Tente novamente em instantes.");
  }

  const release = await ghRes.json();
  const assets = Array.isArray(release.assets) ? release.assets : [];
  const apkAssets = assets.filter(
    (a: { name?: string; browser_download_url?: string }) =>
      typeof a?.name === "string" &&
      a.name.toLowerCase().endsWith(".apk") &&
      typeof a.browser_download_url === "string" &&
      isSafeGitHubAssetUrl(a.browser_download_url)
  );
  const chosenApk =
    apkAssets.find((a: { name: string }) => a.name.toLowerCase().includes("release")) ??
    apkAssets[0] ??
    null;

  const tagName = String(release.tag_name || "");
  const versionName = tagName.replace(/^v/i, "") || "0.0.0";
  const releaseName = String(release.name || tagName || "Última versão");
  const buildMatch = releaseName.match(/Build\s+(\d+)/i) || String(release.body || "").match(/versionCode[^0-9]*(\d+)/i);
  const versionCode = buildMatch ? Number.parseInt(buildMatch[1], 10) : null;
  const isSignedRelease = Boolean(
    chosenApk?.name?.toLowerCase().includes("release") &&
      !chosenApk?.name?.toLowerCase().includes("debug")
  );

  return {
    repoFullName: `${parsed.owner}/${parsed.repo}`,
    tagName,
    versionName,
    versionCode,
    releaseName,
    publishedAt: String(release.published_at || ""),
    releaseNotes: String(release.body || "").slice(0, 2000),
    releaseUrl: isSafeGitHubAssetUrl(String(release.html_url || ""))
      ? String(release.html_url)
      : `${parsed.normalizedUrl}/releases/latest`,
    apkAsset: chosenApk
      ? {
          name: String(chosenApk.name),
          sizeBytes: Number(chosenApk.size) || 0,
          downloadUrl: String(chosenApk.browser_download_url),
          isSignedRelease,
        }
      : null,
    signedRelease: isSignedRelease,
  };
}
