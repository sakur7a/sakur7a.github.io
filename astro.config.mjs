import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import { SITE_ORIGIN } from './src/config/site.js';
import { mathHandlers, rehypeCompatibility } from './src/features/blog/markdown.js';

export default defineConfig({
  site: SITE_ORIGIN,
  output: 'static',
  build: { format: 'preserve' },
  trailingSlash: 'ignore',
  compressHTML: false,
  markdown: {
    shikiConfig: { themes: { light: 'github-light', dark: 'github-dark' } },
    processor: unified({
      remarkPlugins: [remarkMath],
      remarkRehype: { handlers: mathHandlers },
      rehypePlugins: [rehypeRaw, rehypeCompatibility],
    }),
  },
});
