export const SITE_ORIGIN = 'https://something4nothing.top';
// Keep published Atom IDs stable across domain changes.
export const LEGACY_FEED_ID_ORIGIN = 'https://sakur7a.github.io';
export const SITE_TIME_ZONE = 'Asia/Shanghai';
export const siteOwner = {
  name: 'Jinzheng Wang',
  email: 'sakur7a@outlook.com',
  github: 'https://github.com/sakur7a',
};
export const BLOG_PREFIX = '/Blog';
export const BLOG_ROOT = `${BLOG_PREFIX}/`;
export const BLOG_ASSETS = `${BLOG_ROOT}assets`;

export const blogPaths = {
  archive: pagePermalink('archive'),
  about: pagePermalink('about'),
  feed: `${BLOG_ROOT}feed.xml`,
  search: `${BLOG_ROOT}search.json`,
  searchPage: pagePermalink('search'),
};

export const postPermalinkPattern = new RegExp(String.raw`^${BLOG_ROOT}\d{4}-\d{2}-\d{2}/[^/?#\\]+(?:\.html|/)$`);
export const postSlugPattern = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

const blogDateFormatter = new Intl.DateTimeFormat('sv-SE', {
  timeZone: SITE_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** @param {string | Date} value */
export function blogDateLabel(value) {
  return blogDateFormatter.format(new Date(value));
}

/**
 * @param {string} date
 * @param {string} slug
 */
export function postPermalink(date, slug) {
  return `${BLOG_ROOT}${date}/${slug}/`;
}

/** @param {string} permalink */
export function canonicalPostPermalink(permalink) {
  return permalink.replace(/\.html$/, '/');
}

/** @param {string} permalink */
export function legacyPostPermalink(permalink) {
  return permalink.replace(/\/$/, '.html');
}

/** @param {string} id */
export function pagePermalink(id) {
  return `${BLOG_ROOT}${id}/`;
}
