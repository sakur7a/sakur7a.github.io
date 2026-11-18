export const SITE_ORIGIN = 'https://sakur7a.github.io';
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
  archive: `${BLOG_ROOT}archive.html`,
  about: `${BLOG_ROOT}about.html`,
  feed: `${BLOG_ROOT}feed.xml`,
  search: `${BLOG_ROOT}search.json`,
};

export const postPermalinkPattern = new RegExp(String.raw`^${BLOG_ROOT}\d{4}-\d{2}-\d{2}/[^/]+\.html$`);

/**
 * @param {string} date
 * @param {string} slug
 */
export function postPermalink(date, slug) {
  return `${BLOG_ROOT}${date}/${slug}.html`;
}

/** @param {string} id */
export function pagePermalink(id) {
  return `${BLOG_ROOT}${id}.html`;
}
