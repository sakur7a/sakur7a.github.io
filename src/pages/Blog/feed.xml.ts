import { getPosts, blog, xml, isoDate } from '../../lib/blog';
export async function GET() {
  const posts = await getPosts();
  const feedUrl = `${blog.site}/Blog/feed.xml`;
  const entries = posts.map(post => `<entry><title>${xml(post.data.title)}</title><link href="${xml(blog.site + post.data.permalink)}"/><id>${xml(blog.site + post.data.permalink)}</id><published>${isoDate(post.data.date)}</published><updated>${isoDate(post.data.date)}</updated><summary>${xml(post.data.summary || '')}</summary><content type="html">${xml((post.rendered?.html || '').replace(/(src|href)="\/Blog\//g, `$1="${blog.site}/Blog/`))}</content><author><name>${blog.author}</name></author></entry>`).join('');
  return new Response(`<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom"><title>Sakura</title><subtitle>${xml(blog.description)}</subtitle><link href="${feedUrl}" rel="self"/><link href="${blog.site}/Blog/"/><id>${blog.site}/Blog/</id><updated>${posts.length ? isoDate(posts[0].data.date) : new Date().toISOString()}</updated>${entries}</feed>`, { headers: { 'Content-Type': 'application/atom+xml; charset=utf-8' } });
}
