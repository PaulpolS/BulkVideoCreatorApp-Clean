export const GITHUB_API_BASE_URL = 'https://api.github.com';
export const GITHUB_API_VERSION = '2022-11-28';

export const GITHUB_TRENDS_DEFAULT_LIMIT = 30;
export const GITHUB_TRENDS_DEFAULT_DAYS = 1;
export const GITHUB_TRENDS_MAX_LIMIT = 100;
export const GITHUB_STARS_PER_PAGE = 100;
export const GITHUB_STARS_MAX_PAGES = 10;

export const GITHUB_TRENDS_CONTENT_MODEL = {
  repoName: 'repo_name',
  starsToday: 'stars_today',
  description: 'description',
  headline: 'headline',
  articleBody: 'article_body',
  tags: 'tags',
  imagePath: 'image_path',
  templateId: 'template_id',
} as const;
