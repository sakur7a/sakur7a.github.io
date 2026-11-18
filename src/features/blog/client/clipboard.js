/** @param {string} text */
export async function copyText(text) {
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
