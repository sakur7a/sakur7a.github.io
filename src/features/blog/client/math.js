import { createCopyButton } from './clipboard.js';

function addCopyButton(formula, latex) {
  const button = createCopyButton({ className: 'math-copy-button', label: '复制 LaTeX 公式', text: latex });
  button.dataset.latex = latex;

  formula.classList.add('has-math-copy');
  formula.append(button);
}

export function mountMath() {
  const content = document.getElementById('post-content');
  if (!content) return;
  const formulas = Array.from(document.querySelectorAll('.post-shell :is(.math-inline, .math-display > .katex-display)'));
  if (!formulas.length) return;

  for (const formula of content.querySelectorAll('.math-display[data-latex]')) {
    addCopyButton(formula, formula.dataset.latex);
  }
  function updateScrollability() {
    const overflow = formulas.map(formula => formula.clientWidth > 0 && formula.scrollWidth > formula.clientWidth + 1);
    formulas.forEach((formula, index) => {
      formula.dataset.mathScrollable = String(overflow[index]);
      if (overflow[index]) formula.tabIndex = 0;
      else formula.removeAttribute('tabindex');
    });
  }

  updateScrollability();
  document.fonts.ready.then(updateScrollability);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(updateScrollability);
    observer.observe(content);
    const toc = document.querySelector('.post-toc nav');
    if (toc) observer.observe(toc);
  } else {
    window.addEventListener('resize', updateScrollability);
  }
}
