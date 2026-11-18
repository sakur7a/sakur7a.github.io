import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { PAGES_DIRECTORY, POSTS_DIRECTORY } from './config/content.js';
import { blogDateLabel, postPermalink, postPermalinkPattern, postSlugPattern } from './config/site.js';

const metadata = z.looseObject({
  title: z.string(),
  summary: z.string().optional(),
  cover: z.string().optional(),
  cover_position: z.string().optional(),
  header_image: z.string().optional(),
  header_position: z.string().optional(),
  visibility: z.literal('public').default('public'),
});

const posts = defineCollection({
  loader: glob({ base: `./${POSTS_DIRECTORY}`, pattern: '*.md', generateId: ({ entry }) => entry.replace(/\.md$/, '') }),
  schema: metadata.extend({
    title: z.string().optional(),
    date: z.union([z.string(), z.date()]).refine(value => Number.isFinite(new Date(value).getTime()), 'Invalid publication date'),
    slug: z.string(),
    categories: z.union([z.array(z.string()), z.string()]).default(['随笔'])
      .transform(value => Array.isArray(value) ? value : [value]),
    permalink: z.string().regex(postPermalinkPattern).optional(),
  }).refine(data => data.permalink || postSlugPattern.test(data.slug), {
    path: ['slug'],
    message: 'Use a slug made of letters or numbers separated by hyphens, or supply an explicit permalink',
  }).transform(data => ({
    ...data,
    title: data.title || data.slug.replace(/-/g, ' '),
    permalink: data.permalink || postPermalink(blogDateLabel(data.date), data.slug),
  })),
});
const pages = defineCollection({ loader: glob({ base: `./${PAGES_DIRECTORY}`, pattern: '*.md' }), schema: metadata });
export const collections = { posts, pages };
