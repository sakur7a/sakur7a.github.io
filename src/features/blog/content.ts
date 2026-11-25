import { getCollection } from 'astro:content';
import { BLOG_ROOT, pagePermalink } from '../../config/site.js';
import { blog } from './config';

export async function getPosts() {
  const posts = await getCollection('posts');
  return posts.sort((a, b) => new Date(b.data.date).getTime() - new Date(a.data.date).getTime());
}

export function getArchiveGroups(posts: CollectionEntry<'posts'>[]) {
  const groups = blog.categories.map(category => ({
    ...category,
    posts: posts.filter(post => post.data.categories.includes(category.name)),
  }));
  const otherPosts = posts.filter(post => !blog.categories.some(category => post.data.categories.includes(category.name)));
  return [...groups, { name: '其他', slug: 'other', posts: otherPosts }].filter(group => group.posts.length > 0);
}

export const getPages = () => getCollection('pages');

export async function getPublishedEntries() {
  const [posts, pages] = await Promise.all([getPosts(), getPages()]);
  return {
    posts: posts.map(entry => ({ entry, url: entry.data.permalink })),
    pages: pages.map(entry => ({ entry, url: pagePermalink(entry.id) })),
  };
}

export async function getPostRoutes() {
  const posts = await getPosts();
  const seen = new Set<string>();
  return posts.map(entry => {
    const url = entry.data.permalink;
    if (seen.has(url)) throw new Error(`Duplicate blog permalink: ${url}`);
    seen.add(url);
    const [date, slug] = url.slice(BLOG_ROOT.length, -1).split('/');
    return { params: { date, slug }, props: { entry } };
  });
}

export async function getPageRoutes() {
  return (await getPages()).map(entry => ({ params: { path: entry.id }, props: { entry } }));
}
