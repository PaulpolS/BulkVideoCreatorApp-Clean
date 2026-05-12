import {
  GITHUB_STARS_MAX_PAGES,
  GITHUB_STARS_PER_PAGE,
  GITHUB_TRENDS_DEFAULT_DAYS,
  GITHUB_TRENDS_DEFAULT_LIMIT,
  GITHUB_TRENDS_MAX_LIMIT,
} from '../config';
import type {
  FetchGithubTrendingReposOptions,
  GithubRateLimitResponse,
  GithubReadmeResult,
  GithubRepository,
  GithubSearchRepositoriesResponse,
  GithubTrendingRepository,
} from '../types';
import { githubJson } from './githubClient';

interface StargazerRecord {
  starred_at?: string;
  user?: unknown;
}

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

export function getTrendSinceDate(days = GITHUB_TRENDS_DEFAULT_DAYS, now = new Date()) {
  const since = new Date(now);
  since.setDate(since.getDate() - Math.max(1, days));
  return since;
}

export function toGithubDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

export function buildTrendingSearchQuery(query = '', since = getTrendSinceDate()) {
  const cleaned = query.trim();
  const windowQualifier = `pushed:>=${toGithubDate(since)}`;
  const visibilityQualifier = 'is:public';
  const base = cleaned || 'stars:>0';
  return `${base} ${windowQualifier} ${visibilityQualifier}`.trim();
}

export function createGithubRepoTags(repo: GithubRepository) {
  const tags = new Set<string>(['github']);
  if (repo.language) tags.add(repo.language.toLowerCase().replace(/\s+/g, '-'));
  (repo.topics || []).slice(0, 5).forEach(topic => tags.add(topic));

  const haystack = `${repo.full_name} ${repo.description || ''} ${(repo.topics || []).join(' ')}`.toLowerCase();
  if (/\b(ai|llm|agent|openai|rag|model|machine-learning)\b/.test(haystack)) tags.add('ai');
  if (/\b(web|react|vue|next|frontend|ui)\b/.test(haystack)) tags.add('web-dev');
  if (/\b(cli|terminal|shell)\b/.test(haystack)) tags.add('developer-tools');
  if (/\b(security|pentest|vulnerability|scanner)\b/.test(haystack)) tags.add('security');
  if (/\b(data|analytics|database|sql)\b/.test(haystack)) tags.add('data');

  return [...tags].slice(0, 10);
}

async function fetchGithubDailyTrendingPage(limit: number, token?: string) {
  const res = await fetch(`/api/github-trending?limit=${encodeURIComponent(String(limit))}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
  const data = await res.json();
  if (!res.ok || !data.success) throw new Error(data.error || 'โหลด GitHub Trending ไม่สำเร็จ');
  return (Array.isArray(data.repos) ? data.repos : []) as GithubTrendingRepository[];
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, mapper: (item: T, index: number) => Promise<R>) {
  const results: R[] = new Array(items.length);
  let cursor = 0;

  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (cursor < items.length) {
      const index = cursor++;
      results[index] = await mapper(items[index], index);
    }
  });

  await Promise.all(workers);
  return results;
}

export async function fetchStarsSince(fullName: string, since: Date, token?: string) {
  let total = 0;

  for (let page = 1; page <= GITHUB_STARS_MAX_PAGES; page++) {
    const records = await githubJson<StargazerRecord[]>(
      `/repos/${fullName}/stargazers`,
      { per_page: GITHUB_STARS_PER_PAGE, page },
      { token, accept: 'application/vnd.github.star+json' },
    );

    if (!Array.isArray(records) || records.length === 0) break;

    let sawOlderStar = false;
    for (const record of records) {
      const starredAt = record.starred_at ? new Date(record.starred_at) : null;
      if (starredAt && starredAt >= since) total++;
      if (starredAt && starredAt < since) sawOlderStar = true;
    }

    if (records.length < GITHUB_STARS_PER_PAGE || sawOlderStar) break;
  }

  return total;
}

async function fetchGithubSearchRepos(options: FetchGithubTrendingReposOptions, limit: number, since: Date) {
  const candidateLimit = clamp(options.candidateLimit || Math.max(limit, 30), limit, GITHUB_TRENDS_MAX_LIMIT);
  const q = options.rawQuery
    ? String(options.query || '').trim()
    : buildTrendingSearchQuery(options.query || '', since);
  const search = await githubJson<GithubSearchRepositoriesResponse>(
    '/search/repositories',
    {
      q,
      sort: options.sort || 'stars',
      order: 'desc',
      per_page: candidateLimit,
    },
    { token: options.token },
  );

  const candidates = (search.items || []).slice(0, candidateLimit);
  const shouldFetchDailyStars = options.includeStarsToday !== false;
  const enriched = await mapWithConcurrency(candidates, shouldFetchDailyStars ? 4 : 1, async repo => {
    let starsToday = 0;
    if (shouldFetchDailyStars) {
      try {
        starsToday = await fetchStarsSince(repo.full_name, since, options.token);
      } catch {
        starsToday = 0;
      }
    }

    return {
      ...repo,
      stars_today: starsToday,
      trend_since: since.toISOString(),
      fetched_at: new Date().toISOString(),
      tags: createGithubRepoTags(repo),
    } satisfies GithubTrendingRepository;
  });

  return enriched
    .sort((a, b) => b.stars_today - a.stars_today || b.stargazers_count - a.stargazers_count)
    .slice(0, limit);
}

export async function fetchGithubTrendingRepos(options: FetchGithubTrendingReposOptions = {}) {
  const limit = clamp(options.limit || GITHUB_TRENDS_DEFAULT_LIMIT, 1, GITHUB_TRENDS_MAX_LIMIT);
  const since = getTrendSinceDate(options.days || GITHUB_TRENDS_DEFAULT_DAYS);
  if (!String(options.query || '').trim()) {
    try {
      const dailyTrending = await fetchGithubDailyTrendingPage(limit, options.token);
      if (dailyTrending.length >= limit) return dailyTrending.slice(0, limit);

      try {
        const existing = new Set(dailyTrending.map(repo => repo.full_name));
        const fillSince = getTrendSinceDate(7);
        const fill = await fetchGithubSearchRepos({
          ...options,
          query: `created:>=${toGithubDate(fillSince)} stars:>10 is:public`,
          rawQuery: true,
          sort: 'stars',
          includeStarsToday: false,
          candidateLimit: GITHUB_TRENDS_MAX_LIMIT,
        }, limit, fillSince);
        return [
          ...dailyTrending,
          ...fill.filter(repo => !existing.has(repo.full_name)),
        ].slice(0, limit);
      } catch (fillError) {
        console.warn('[GitHub Trends] Trending fill failed:', fillError);
        return dailyTrending.slice(0, limit);
      }
    } catch (e) {
      console.warn('[GitHub Trends] Falling back to Search API because GitHub Trending page failed:', e);
    }
  }

  return fetchGithubSearchRepos(options, limit, since);
}

export function extractReadmeGifUrls(markdown: string) {
  const seen = new Set<string>();
  const gifs: string[] = [];
  const add = (url: string) => {
    const clean = url.split('?')[0].trim();
    if (!clean.startsWith('http') || seen.has(clean)) return;
    if (!/\.gif$/i.test(clean)) return;
    if (/shields\.io|badge|travis|circleci|codecov/i.test(clean)) return;
    seen.add(clean);
    gifs.push(clean);
  };

  for (const match of markdown.matchAll(/!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)/g)) add(match[1]);
  for (const match of markdown.matchAll(/<img[^>]+src=["'](https?:\/\/[^"'\s>]+)["']/gi)) add(match[1]);
  return [gifs[0] || '', gifs[1] || '', gifs[2] || ''];
}

export async function fetchGithubReadme(fullName: string, token?: string): Promise<GithubReadmeResult> {
  try {
    const data = await githubJson<{ content?: string }>(
      `/repos/${fullName}/readme`,
      undefined,
      { token, accept: 'application/vnd.github+json' },
    );
    const decoded = atob(String(data.content || '').replace(/\n/g, ''));
    return {
      content: decoded.slice(0, 3500),
      images: extractReadmeGifUrls(decoded),
    };
  } catch {
    return { content: '', images: ['', '', ''] };
  }
}

export async function fetchGithubRateLimit(token?: string) {
  return githubJson<GithubRateLimitResponse>('/rate_limit', undefined, { token });
}
