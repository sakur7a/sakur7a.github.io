import { createCopyButton } from './clipboard.js';

const unlabeledLanguages = new Set(['generic-code', 'plaintext', 'text', 'txt']);

export function mountCodeCopy() {
  for (const block of document.querySelectorAll('#post-content .highlighter-rouge > .highlight')) {
    const pre = block.querySelector('pre');
    const code = pre?.querySelector('code');
    if (!code || block.querySelector('.highlight-header')) continue;

    const language = code.dataset.lang || pre.dataset.language;
    const header = document.createElement('div');
    header.className = 'highlight-header';
    if (language && !unlabeledLanguages.has(language)) {
      const label = document.createElement('span');
      label.className = 'highlight-lang';
      label.textContent = language;
      header.append(label);
    }

    header.append(createCopyButton({
      className: 'copy-btn',
      label: '复制代码',
      text: code.textContent,
    }));
    block.prepend(header);
  }
}
