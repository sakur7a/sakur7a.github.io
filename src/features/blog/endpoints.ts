import type { CollectionEntry } from 'astro:content';
import { BLOG_ROOT, SITE_ORIGIN, blogPaths, legacyPostPermalink } from '../../config/site.js';
import { dateLabel, isoDate } from '../../shared/dates';
import { blog } from './config';
import { getPosts, getPublishedEntries } from './content';

const xmlEntities: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&apos;',
};
const escapeXml = (value: string) => value.replace(/[&<>"']/g, char => xmlEntities[char]);

function xmlResponse(body: string, contentType: string) {
  return new Response('<?xml version="1.0" encoding="utf-8"?>' + body, {
    headers: { 'Content-Type': contentType },
  });
}

function feedEntry({ data, rendered }: CollectionEntry<'posts'>) {
  const url = escapeXml(SITE_ORIGIN + data.permalink);
  // Atom readers use the ID to recognize previously seen entries.
  const id = escapeXml(SITE_ORIGIN + legacyPostPermalink(data.permalink));
  const date = isoDate(data.date);
  const html = (rendered?.html || '')
    .replaceAll(`src="${BLOG_ROOT}`, `src="${SITE_ORIGIN}${BLOG_ROOT}`)
    .replaceAll(`href="${BLOG_ROOT}`, `href="${SITE_ORIGIN}${BLOG_ROOT}`);

  return [
    '<entry>',
    `<title>${escapeXml(data.title)}</title>`,
    `<link href="${url}"/><id>${id}</id>`,
    `<published>${date}</published><updated>${date}</updated>`,
    `<summary>${escapeXml(data.summary || '')}</summary>`,
    `<content type="html">${escapeXml(html)}</content>`,
    `<author><name>${escapeXml(blog.author)}</name></author>`,
    '</entry>',
  ].join('');
}

export function legacyPostRedirect(permalink: string) {
  const destination = new URL(permalink, SITE_ORIGIN);
  const path = escapeXml(destination.pathname);
  const canonical = escapeXml(destination.href);
  return new Response(`<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <title>文章地址已更新</title>
  <link rel="canonical" href="${canonical}">
  <noscript><meta http-equiv="refresh" content="0; url=${path}"></noscript>
</head>
<body>
  <p><a href="${path}" id="new-address">打开文章</a></p>
  <script>
    const destination = new URL(document.getElementById('new-address').href);
    destination.search = location.search;
    destination.hash = location.hash;
    location.replace(destination.href);
  </script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html; charset=utf-8' } });
}

export async function feedResponse() {
  const posts = await getPosts();
  const homeUrl = SITE_ORIGIN + BLOG_ROOT;
  const updated = posts[0] ? isoDate(posts[0].data.date) : new Date().toISOString();
  return xmlResponse([
    '<feed xmlns="http://www.w3.org/2005/Atom">',
    `<title>${escapeXml(blog.title)}</title><subtitle>${escapeXml(blog.description)}</subtitle>`,
    `<link href="${SITE_ORIGIN + blogPaths.feed}" rel="self"/>`,
    `<link href="${homeUrl}"/><id>${homeUrl}</id><updated>${updated}</updated>`,
    ...posts.map(feedEntry),
    '</feed>',
  ].join(''), 'application/atom+xml; charset=utf-8');
}

export interface SearchEntry {
  title: string;
  url: string;
  date: string;
  summary: string;
}

export async function searchResponse() {
  const posts = await getPosts();
  const entries: SearchEntry[] = posts.map(({ data }) => ({
    title: data.title,
    url: data.permalink,
    date: dateLabel(data.date),
    summary: data.summary || '',
  }));
  return Response.json(entries);
}

export async function sitemapResponse(includeHome: boolean) {
  const { pages, posts } = await getPublishedEntries();
  const urls = [
    ...(includeHome ? ['/'] : []),
    BLOG_ROOT,
    blogPaths.archive,
    ...pages.map(page => page.url),
    ...posts.map(post => post.url),
  ];
  const locations = urls.map(url => `<url><loc>${escapeXml(SITE_ORIGIN + url)}</loc></url>`);
  return xmlResponse(`<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${locations.join('')}</urlset>`, 'application/xml');
}
