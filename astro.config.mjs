import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import { mathHandlers, rehypeCompatibility } from './scripts/markdown-compat.js';

export default defineConfig({
  site: 'https://sakur7a.github.io',
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
