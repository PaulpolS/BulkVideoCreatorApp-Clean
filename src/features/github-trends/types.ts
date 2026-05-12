export interface GithubRepositoryOwner {
  login: string;
  avatar_url: string;
}

export interface GithubRepository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  topics: string[];
  updated_at: string;
  pushed_at?: string;
  owner: GithubRepositoryOwner;
}

export interface GithubTrendingRepository extends GithubRepository {
  stars_today: number;
  trend_since: string;
  fetched_at: string;
  tags: string[];
  trending_source?: string;
}

export interface GithubSearchRepositoriesResponse {
  total_count: number;
  incomplete_results: boolean;
  items: GithubRepository[];
}

export interface GithubRateLimitResource {
  limit: number;
  remaining: number;
  reset: number;
  used?: number;
}

export interface GithubRateLimitResponse {
  resources: {
    core: GithubRateLimitResource;
    search: GithubRateLimitResource;
    [key: string]: GithubRateLimitResource;
  };
  rate: GithubRateLimitResource;
}

export interface GithubReadmeResult {
  content: string;
  images: string[];
}

export interface FetchGithubTrendingReposOptions {
  query?: string;
  limit?: number;
  days?: number;
  token?: string;
  includeStarsToday?: boolean;
  candidateLimit?: number;
  rawQuery?: boolean;
  sort?: 'stars' | 'forks' | 'updated' | 'help-wanted-issues';
}

export interface GithubTrendCardDraft {
  repo_name: string;
  stars_today: number;
  description: string;
  headline: string;
  article_body: string;
  tags: string[];
  image_path: string;
  template_id: string;
}
