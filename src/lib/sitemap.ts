import { getCollection } from 'astro:content';
import { getPosts, blog, xml } from './blog';
export async function sitemap(includeHome = true) {
  const urls = [...(includeHome ? ['/'] : []), '/Blog/', '/Blog/archive.html', '/Blog/moments.html', ...(await getCollection('pages')).map(page => `/Blog/${page.id}.html`), ...(await getPosts()).map(post => post.data.permalink)];
  return new Response(`<?xml version="1.0" encoding="utf-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${urls.map(url => `<url><loc>${xml(blog.site + url)}</loc></url>`).join('')}</urlset>`, { headers: { 'Content-Type': 'application/xml' } });
}
