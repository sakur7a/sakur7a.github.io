import { getCollection } from 'astro:content';
import { BLOG_ROOT, pagePermalink } from '../../config/site.js';
import { blog } from './config';

export async function getPosts() {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
}

export async function getArchiveGroups() {
  const posts = await getPosts();
  return blog.categories.map(category => ({
    ...category,
    posts: posts.filter(post => post.data.categories.includes(category.name)),
  }));
}

export const getPages = () => getCollection('pages');

export async function getPublishedEntries() {
  const [posts, pages] = await Promise.all([getPosts(), getPages()]);
  return {
    posts: posts.map(entry => ({ entry, url: entry.data.permalink })),
    pages: pages.map(entry => ({ entry, url: pagePermalink(entry.id) })),
  };
}

export async function getEntryRoutes() {
  const { posts, pages } = await getPublishedEntries();
  const seen = new Set<string>();
  return [...posts, ...pages].map(({ entry, url }) => {
    if (seen.has(url)) throw new Error(`Duplicate blog permalink: ${url}`);
    seen.add(url);
    return { params: { path: url.slice(BLOG_ROOT.length, -'.html'.length) }, props: { entry } };
  });
}
