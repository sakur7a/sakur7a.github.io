import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import remarkMath from 'remark-math';
import rehypeRaw from 'rehype-raw';
import { SITE_ORIGIN } from './src/config/site.js';
import { mathHandlers, rehypeCompatibility, remarkDefaultCodeLanguage } from './src/features/blog/markdown.js';
import { withStaticMath } from './src/features/blog/math-markup.js';
import genericCode from './src/features/blog/generic-code.tmLanguage.json' with { type: 'json' };

export default defineConfig({
  site: SITE_ORIGIN,
  output: 'static',
  build: { format: 'preserve' },
  trailingSlash: 'ignore',
  compressHTML: false,
  markdown: {
    shikiConfig: {
      themes: { light: 'github-light', dark: 'github-dark' },
      langs: [genericCode],
    },
    processor: withStaticMath(unified({
      remarkPlugins: [remarkMath, remarkDefaultCodeLanguage],
      remarkRehype: { handlers: mathHandlers },
      rehypePlugins: [rehypeRaw, rehypeCompatibility],
    })),
  },
});
