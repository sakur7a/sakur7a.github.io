import katex from 'katex';
import { fromHtml } from 'hast-util-from-html';
import { toHtml } from 'hast-util-to-html';
import { textOf } from './markdown.js';

export function renderFormula(source, displayMode = false) {
  return katex.renderToString(source, {
    displayMode,
    output: 'htmlAndMathml',
    throwOnError: false,
    strict: 'ignore',
  });
}

export function withStaticMath(processor) {
  return {
    ...processor,
    name: 'sakura-katex',
    async createRenderer(options) {
      const renderer = await processor.createRenderer(options);
      return {
        async render(content, options) {
          const result = await renderer.render(content, options);
          if (!/class="math-(?:inline|display)"/.test(result.code)) return result;

          const tree = fromHtml(result.code, { fragment: true });
          const headingLabels = new Map();
          function typeset(node) {
            if (node.properties?.id && /^h[1-6]$/.test(node.tagName)) {
              headingLabels.set(node.properties.id, textOf(node));
            }
            const classes = node.properties?.className || [];
            const display = classes.includes('math-display');
            const placeholder = node.children?.[0];
            if ((display || classes.includes('math-inline')) && placeholder?.type === 'text'
              && (display ? placeholder.value.startsWith('\\[') : placeholder.value.startsWith('\\('))) {
              const source = placeholder.value.slice(2, -2);
              node.properties.dataLatex = display ? '$$\n' + source + '\n$$' : '$' + source + '$';
              node.children = fromHtml(renderFormula(source, display), { fragment: true }).children;
              return;
            }
            node.children?.forEach(typeset);
          }
          typeset(tree);
          // Use the heading IDs collected by Astro and the original TeX in each label.
          const headings = result.metadata.headings.map(heading => ({
            ...heading,
            text: headingLabels.get(heading.slug) ?? heading.text,
          }));
          return { code: toHtml(tree), metadata: { ...result.metadata, headings } };
        },
      };
    },
  };
}
