/** @param {string} text */
async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.readOnly = true;
  textarea.style.position = 'fixed';
  textarea.style.opacity = '0';
  document.body.append(textarea);

  try {
    textarea.select();
    if (!document.execCommand('copy')) throw new Error('Clipboard copy failed');
  } finally {
    textarea.remove();
  }
}

/** @param {{ className: string, label: string, text: string }} options */
export function createCopyButton({ className, label, text }) {
  const namespace = 'http://www.w3.org/2000/svg';
  const button = document.createElement('button');
  button.type = 'button';
  button.className = className;
  button.setAttribute('aria-live', 'polite');

  const svg = document.createElementNS(namespace, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  const icon = document.createElementNS(namespace, 'path');
  icon.setAttribute('fill', 'none');
  icon.setAttribute('stroke', 'currentColor');
  icon.setAttribute('stroke-width', '1.8');
  icon.setAttribute('stroke-linecap', 'round');
  icon.setAttribute('stroke-linejoin', 'round');
  svg.append(icon);
  button.append(svg);

  const idleIcon = 'M8 8h10v10H8z M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1';
  function showStatus(message, path) {
    button.title = message;
    button.setAttribute('aria-label', message);
    icon.setAttribute('d', path);
  }

  let reset;
  showStatus(label, idleIcon);
  button.addEventListener('click', async () => {
    try {
      await copyText(text);
      button.dataset.copyState = 'success';
      showStatus('已复制', 'M20 6 9 17l-5-5');
    } catch {
      button.dataset.copyState = 'error';
      showStatus('复制失败', 'M12 7v5m0 5h.01');
    }
    clearTimeout(reset);
    reset = setTimeout(() => {
      delete button.dataset.copyState;
      showStatus(label, idleIcon);
    }, 1700);
  });
  return button;
}
