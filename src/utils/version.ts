import { GITHUB_RAW_URL } from '../constants';

export interface VersionInfo {
  version: string;
  buildDate?: string;
  updateUrl?: string;
  releaseNotes?: string;
}

const LOCAL_VERSION_URL = '/version.json';

const withCacheBust = (url: string) => {
  const separator = url.includes('?') ? '&' : '?';
  return `${url}${separator}t=${Date.now()}`;
};

const parseVersionInfo = (raw: string, sourceUrl: string): VersionInfo => {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    throw new Error(`Invalid JSON from ${sourceUrl}`);
  }

  if (!data || typeof data !== 'object' || typeof (data as { version?: unknown }).version !== 'string') {
    throw new Error(`Invalid version schema from ${sourceUrl}`);
  }

  const parsed = data as {
    version: string;
    buildDate?: unknown;
    updateUrl?: unknown;
    releaseNotes?: unknown;
  };

  if (parsed.buildDate !== undefined && typeof parsed.buildDate !== 'string') {
    throw new Error(`Invalid buildDate schema from ${sourceUrl}`);
  }

  if (parsed.updateUrl !== undefined && typeof parsed.updateUrl !== 'string') {
    throw new Error(`Invalid updateUrl schema from ${sourceUrl}`);
  }

  if (parsed.releaseNotes !== undefined && typeof parsed.releaseNotes !== 'string') {
    throw new Error(`Invalid releaseNotes schema from ${sourceUrl}`);
  }

  const buildDate = typeof parsed.buildDate === 'string' ? parsed.buildDate : undefined;
  const updateUrl = typeof parsed.updateUrl === 'string' ? parsed.updateUrl.trim() || undefined : undefined;
  const releaseNotes = typeof parsed.releaseNotes === 'string' ? parsed.releaseNotes : undefined;

  return {
    version: parsed.version,
    buildDate,
    updateUrl,
    releaseNotes,
  };
};

export const fetchLatestVersion = async (): Promise<VersionInfo> => {
  const candidates = [GITHUB_RAW_URL, LOCAL_VERSION_URL].filter(Boolean);
  let lastError: unknown;

  for (const sourceUrl of candidates) {
    try {
      const response = await fetch(withCacheBust(sourceUrl));
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const raw = await response.text();
      return parseVersionInfo(raw, sourceUrl);
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError ?? new Error('No version source configured');
};
