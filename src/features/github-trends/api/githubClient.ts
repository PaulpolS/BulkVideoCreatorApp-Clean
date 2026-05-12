import { GITHUB_API_BASE_URL, GITHUB_API_VERSION } from '../config';

export class GithubApiError extends Error {
  status: number;
  resetAt?: Date;

  constructor(message: string, status: number, resetAt?: Date) {
    super(message);
    this.name = 'GithubApiError';
    this.status = status;
    this.resetAt = resetAt;
  }
}

export interface GithubRequestOptions {
  token?: string;
  accept?: string;
  signal?: AbortSignal;
}

export function buildGithubHeaders(options: GithubRequestOptions = {}) {
  const headers: Record<string, string> = {
    Accept: options.accept || 'application/vnd.github+json',
    'X-GitHub-Api-Version': GITHUB_API_VERSION,
  };
  if (options.token) headers.Authorization = `Bearer ${options.token}`;
  return headers;
}

export function githubUrl(path: string, params?: Record<string, string | number | boolean | undefined>) {
  const url = new URL(path.startsWith('http') ? path : `${GITHUB_API_BASE_URL}${path}`);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value !== undefined && value !== '') url.searchParams.set(key, String(value));
  });
  return url.toString();
}

export async function githubJson<T>(path: string, params?: Record<string, string | number | boolean | undefined>, options: GithubRequestOptions = {}): Promise<T> {
  const response = await fetch(githubUrl(path, params), {
    headers: buildGithubHeaders(options),
    signal: options.signal,
  });

  if (!response.ok) {
    let detail = '';
    try {
      const body = await response.json();
      detail = body?.message ? `: ${body.message}` : '';
    } catch {}
    const resetHeader = response.headers.get('x-ratelimit-reset');
    const resetAt = resetHeader ? new Date(Number(resetHeader) * 1000) : undefined;
    throw new GithubApiError(`GitHub API error ${response.status}${detail}`, response.status, resetAt);
  }

  return response.json() as Promise<T>;
}
