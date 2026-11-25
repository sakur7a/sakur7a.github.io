import legacy from './legacy-headings.json' with { type: 'json' };
import { legacyPostPermalink } from '../../config/site.js';

export const textOf = node => node.value ?? (node.children || []).map(textOf).join('');
const normalized = text => text.replace(/\s+/g, ' ').trim();

export const mathHandlers = {
  math: (_state, node) => ({ type: 'element', tagName: 'div', properties: { className: ['math-display'] }, children: [{ type: 'text', value: `\\[${node.value}\\]` }] }),
  inlineMath: (_state, node) => ({ type: 'element', tagName: 'span', properties: { className: ['math-inline'] }, children: [{ type: 'text', value: `\\(${node.value}\\)` }] }),
};

export function remarkDefaultCodeLanguage() {
  function visit(node) {
    if (node.type === 'code' && !node.lang) node.lang = 'generic-code';
    node.children?.forEach(visit);
  }
  return visit;
}

export function rehypeCompatibility() {
  return (tree, file) => {
    const route = file.data.astro?.frontmatter?.permalink;
    const headings = route ? legacy[legacyPostPermalink(route)] || [] : [];
    const used = new Set();
    function walk(parent) {
      for (let index = 0; index < (parent.children || []).length; index++) {
        const node = parent.children[index];
        if (node.type !== 'element') continue;
        if (/^h[1-6]$/.test(node.tagName)) {
          node.properties.tabIndex = -1;
          const record = headings.find((item, i) => !used.has(i) && item.level === Number(node.tagName[1]) && normalized(item.text) === normalized(textOf(node)));
          if (record) {
            node.properties.id = record.id;
            used.add(headings.indexOf(record));
          }
        }
        if (node.tagName === 'table') {
          parent.children[index] = {
            type: 'element',
            tagName: 'div',
            properties: { className: ['table-scroll'], tabIndex: 0, role: 'region', ariaLabel: '表格' },
            children: [node],
          };
        }
        if (node.tagName === 'pre' && node.children?.[0]?.tagName === 'code') {
          const code = node.children[0];
          const language = (code.properties.className || []).find(value => value.startsWith('language-'));
          if (language) code.properties['data-lang'] = language.slice(9);
          parent.children[index] = { type: 'element', tagName: 'div', properties: { className: ['highlighter-rouge'] }, children: [{ type: 'element', tagName: 'div', properties: { className: ['highlight'] }, children: [node] }] };
        }
        walk(node);
      }
    }
    walk(tree);
  };
}
