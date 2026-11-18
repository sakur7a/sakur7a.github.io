import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { PAGES_DIRECTORY, POSTS_DIRECTORY } from './config/content.js';
import { postPermalinkPattern } from './config/site.js';

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
    date: z.union([z.string(), z.date()]),
    slug: z.string(),
    categories: z.union([z.array(z.string()), z.string()]).transform(value => Array.isArray(value) ? value : [value]),
    permalink: z.string().regex(postPermalinkPattern),
    source_file: z.string().optional(),
  }).transform(data => ({ ...data, title: data.title || data.slug.replace(/-/g, ' ') })),
});
const pages = defineCollection({ loader: glob({ base: `./${PAGES_DIRECTORY}`, pattern: '*.md' }), schema: metadata });
export const collections = { posts, pages };
